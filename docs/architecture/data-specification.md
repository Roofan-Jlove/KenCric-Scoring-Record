# Cricket Scoring Book — Data Specification

| | |
|---|---|
| **Document** | Data Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-21 |
| **Upstream** | `docs/architecture/system-architecture.md` v0.1.0 (§3.5 Database architecture, §4.6 schema sketch, `ADR-T04/T05`) · `docs/specs/live-scoring.md` v0.1.0 (event/audit schema, `RunEvent`/`WicketDetail` models) · `docs/architecture/offline-first-specification.md` v0.1.0 (ownership, sync fields, the outbox/fence/idempotency model) · `docs/specs/software-requirements-specification.md` v0.1.0 |
| **Downstream** | Migration DDL · the shared scoring core's persistence adapters (server Postgres and client SQLite, `ADR-T06`) |
| **Status** | A **complete, precisely-typed schema specification** — every table, field, type, key, constraint, and index — expressed as structured tables rather than executable DDL, continuing and completing the convention `system-architecture.md §4.6` opened ("schema sketch, not DDL"). This document does not introduce new tables casually: every table here either fulfils one of the entities the brief names explicitly, or is a supporting table required for referential completeness of one that does — each is labelled accordingly. **Not runnable SQL** — say the word if literal PostgreSQL DDL is wanted instead; every design decision below is precise enough to transcribe directly. |

> Defines the complete data model for the Cricket Scoring Book: every table, its fields and types, primary/foreign keys, constraints, indexes, relationships, and the audit/version/sync/soft-deletion treatment each one needs — designed, throughout, so a scorer can conduct and complete a match with zero connectivity and have it reconcile deterministically once online.

---

## 1. Conventions (apply once, stated here, not repeated per table)

### 1.1 Two layers: the event store and the read model

This schema is **CQRS** (`system-architecture.md ADR-06`), and every table below belongs to exactly one of two layers — conflating them is the single most common schema-design mistake for an event-sourced system, so it is stated up front:

- **The event store (write model, §6):** `match_events` — one generic, append-only, hash-chained table. It is the **only** source of truth for what happened in a match. Nothing is ever deleted or updated in it.
- **The read model (§7–§8):** `innings`, `overs`, `deliveries`, `delivery_run_events`, `wickets`, `partnerships`, `batter_card_lines`, `bowler_card_lines`, `match_snapshots`, and related tables. **Every row in every read-model table is a derived, disposable fact** (`MBR-07`) — recomputable at any time by folding the active portion of `match_events` through the shared scoring core (`live-scoring.md §5–§15`). A read-model table is a materialised cache for query performance (server reporting, and — critically for offline-first — fast local rendering without refolding the whole log on every screen paint), never an independent source of truth. Where this document says a read-model row is "derived, not directly inserted," that is an `[INVARIANT]`, not a style preference: a client or server code path that writes to a read-model table other than by replaying `match_events` is non-conformant.

Non-scoring tables (`users`, `organizations`, `teams`, `players`, `officials`, …) are **ordinary mutable entities**, not event-sourced — they use a simpler, conventional CRUD model (§1.4).

### 1.2 Type and notation conventions

Types are given as PostgreSQL type names (the committed engine, `ADR-T05`) for precision; a local SQLite mirror (`ADR-T06`) maps them by the client persistence layer (e.g. `uuid`→`TEXT`, `timestamptz`→`TEXT` ISO-8601 or `INTEGER` epoch, `jsonb`→`TEXT`) — that mapping is an implementation detail of the offline store, not a schema decision, and is not repeated per field below.

| Notation | Meaning |
|---|---|
| `uuid` | A UUID (v4 or v7), almost always the identity strategy for this schema (§1.4). |
| `text` | Unbounded text. |
| `integer` / `bigint` | Whole numbers. |
| `numeric(p,s)` | Fixed-precision decimal (used for rate/average figures where floating-point drift is unacceptable). |
| `boolean` | True/false. |
| `timestamptz` | Timestamp with time zone, stored in UTC, rendered per `docs/ux/ux-specification.md §2.7`'s locale/match-timezone rule. |
| `jsonb` | Structured, queryable JSON — used only where the shape is genuinely open-ended or already fully specified elsewhere (event payloads, provenance) — never as a substitute for a proper column where one is knowable. |
| `enum(...)` | A closed set of string values, listed inline. |
| `T[]` | An array of type `T`. |
| **PK** | Primary key. **FK →** `table.column` | Foreign key. **UQ** | Unique constraint. **CK** | Check constraint. **IX** | Index. |
| Nullability | Every field table states `Null: yes/no` explicitly — never left implicit. |

### 1.3 Identity strategy `[INVARIANT]`

**Every table whose rows can originate on a client device uses a client-generated `uuid` (v4 or v7) as its primary key, generated once at creation and never reassigned.** This is what makes offline creation safe by construction: a team, player, or match created offline already has its permanent identity the instant it is created, with no "renumbering on sync" step to get wrong (exactly the same principle `live-scoring.md §16.2` already applies to `event_id`). Tables that can only ever be created server-side (e.g. `sync_cursors`, which are pure server/device bookkeeping never exchanged as domain facts) may use a server-assigned key; each table's spec states which applies.

### 1.4 Two sync models — do not conflate them `[INVARIANT]`

This schema deliberately uses **two different** synchronization models, matched to the stakes and shape of the data, per `docs/architecture/offline-first-specification.md`:

| | **Event-sourced sync** | **CRUD-entity sync** |
|---|---|---|
| Applies to | `match_events` only | Every other offline-creatable table (`teams`, `players`, `organizations`, `matches`'s header fields, etc.) |
| Model | Strictly-ordered append-only stream: `device_id` + `device_seq` + `hlc` + `event_ordinal`, hash-chained, idempotent on `event_id`, never mutated | Client-generated `uuid` PK + optimistic-concurrency `row_version` + `updated_at`; sync is an idempotent **upsert** keyed on the PK |
| Conflict handling | Writer-fence + divergence detection/resolution (`offline-first-specification.md §10–11`) | A stale `row_version` on upsert is rejected; the client re-pulls the current row and re-applies its change (or surfaces a merge prompt for a genuine concurrent edit) — a conventional, lighter-weight pattern, appropriate because metadata edits are low-frequency and low-stakes compared to ball-by-ball scoring |
| Why the distinction is deliberate | Scoring facts are high-frequency, high-stakes, and must never be silently overwritten — the full event-sourcing machinery earns its cost here | Applying the same heavyweight machinery to "a team's name was edited offline" would be over-engineering with no correctness benefit |

Every table's spec below states which model it uses. This is the direct, concrete answer to "ensure the model supports offline-first operation" — not one mechanism stretched to cover everything, but the right mechanism per data shape (elaborated further in §11).

### 1.5 Audit fields `[INVARIANT]`

Every CRUD-entity table (§1.4) carries: `created_at timestamptz`, `created_by uuid` (references the acting user or a device-local placeholder for a not-yet-claimed guest match, per `system-architecture.md §3.12`'s `actor_ref` concept), `updated_at timestamptz`, `updated_by uuid`. Event-sourced and append-only tables (`match_events`, `audit_log`) carry the richer **provenance** model instead (actor, device, app version, build hash — `live-scoring.md §17`) and **no** `updated_at`/`updated_by` at all, because they are never updated — their absence is itself a conformance signal, not an oversight.

### 1.6 Version fields — two distinct concepts, never conflated `[INVARIANT]`

- **Optimistic-concurrency `row_version integer`** — on every CRUD-entity table (§1.4); increments by exactly 1 on every update; a write whose supplied `row_version` doesn't match the current value is rejected (§1.4). This is a technical safety mechanism, invisible to the domain.
- **Domain versioning** — a first-class *business* concept, unrelated to row-level concurrency: `sign_offs.version` (a new sign-off supersedes the last, both retained, `BR-006`), `dls_revisions` (each revision numbered and individually reversible, `BR-021`), `match_snapshots.snapshot_version`, and reference-data versions (`reference_data.version`, pinned per match at creation, `BR-032`/`MINV-05`). These are meaningful to users and auditors and are never used as a concurrency-control mechanism.

### 1.7 Soft deletion — where appropriate, and explicitly nowhere else `[INVARIANT]`

Three distinct policies, chosen per table and stated in each table's spec — never a blanket rule:

1. **Never deletable, soft or hard** — `match_events`, `audit_log`. Deleting or soft-deleting a row here would directly violate append-only integrity (`MINV-01`). There is no `deleted_at` column on either table, deliberately.
2. **Soft-deactivate / status lifecycle, never hard-delete** — `users`, `memberships`, `players` (via merge), `officials`. These are entities whose historical references (authored events, past appearances) must remain resolvable even after the "current" relationship ends (`BR-009` deactivation retains authorship, `BR-044` player merge). Realised as a `deleted_at timestamptz null` column **or** a domain `status` enum that includes a terminal, non-active state — whichever is more meaningful for that entity; each table's spec says which.
3. **Ordinary hard delete permitted** — `sync_cursors`, `writer_fences`, and other pure process/bookkeeping tables that hold no domain fact and reference nothing that needs historical resolution. Hard-deleting a stale cursor is simply housekeeping.

Every table's spec below states which of these three it follows — "soft deletion where appropriate" is honoured precisely, including by *excluding* the tables where it would be wrong.

### 1.8 Row-level security `[INVARIANT]`

Every table except pure local-device bookkeeping (§1.7 policy 3, which never reaches the server) carries RLS enforcement per `system-architecture.md §3.9`: tenant isolation via `organization_id` (or, for guest data, `organization_id IS NULL` with device-scoped access) and role checks for writes. This document states the isolation key per table; the policy logic itself is `system-architecture.md`'s to define, not repeated here.

---

## 2. Entity-relationship overview

```
IDENTITY & TENANCY                    PARTICIPANTS
┌────────────┐  1   n ┌─────────────┐ ┌────────┐  n   n ┌──────────┐
│organizations│───────│ memberships │ │  teams │────────│ players  │
└──────┬─────┘        └──────┬──────┘ └───┬────┘ squad_ └────┬─────┘
       │                     │n           │      members     │
       │                    1│            │                  │(merged_into → players)
       │              ┌──────┴─────┐      │                  │
       │              │   users    │      │                  │
       │              └────────────┘      │                  │
       │                                  │                  │
       ▼ 1..n                             ▼ n (home/away)    ▼ n (via squad_members)
┌──────────────────────────────────────────────────────────────────────────┐
│                                  matches                                  │
│   organization_id? · home_team_id · away_team_id · conditions_profile    │
└───┬───────────────┬───────────────────────┬──────────────────┬──────────┘
    │1              │1                      │1                 │n
    │n               │n                      │n                 │
┌───▼──────┐   ┌─────▼────────┐        ┌─────▼──────┐    ┌──────▼────────┐
│ officials │   │ match_events  │        │  innings   │    │ match_snapshots│
│  (via     │   │  (WRITE MODEL │        │(READ MODEL)│    │ sign_offs      │
│  match_   │   │  — append-only,│       └───┬────────┘    │ reconciliation_│
│  officials│   │  hash-chained) │           │1             │  reports       │
│  join)    │   └────────────────┘           │n             │ dls_revisions  │
└───────────┘                                ▼              │ divergences    │
                                        ┌──────────┐         └────────────────┘
                                        │  overs   │  (derived from match_events;
                                        └────┬─────┘   never directly inserted)
                                             │1
                                             │n
                                        ┌────▼──────┐
                                        │deliveries │
                                        └─┬───┬───┬─┘
                                    1│n   │1n │0..1
                                     ▼    ▼   ▼
                          delivery_run_events  wickets
                          (Runs & Extras)      (0 or 1 per delivery,
                                                 or delivery_id NULL for
                                                 mankad/timed-out/retired-out)

Also derived from match_events (READ MODEL, one row per batter/bowler per innings):
  batter_card_lines, bowler_card_lines, partnerships

SYNC (mostly device-local; * = server too)          AUDIT
┌──────────────┐  ┌───────────────┐  ┌─────────┐    ┌───────────┐
│sync_cursors  │  │writer_fences* │  │ outbox* │    │audit_log  │
└──────────────┘  └───────────────┘  └─────────┘    └───────────┘
```

Supporting tables referenced for FK completeness but not separately detailed as their own top-level catalogue entries beyond §5.4/§8.4–8.5: `reference_data` (pinned condition profiles / DLS tables), `dls_revisions`, `divergences` — each still given a full field-level spec in this document since another table's foreign key depends on it.

---

## 3. Identity & Tenancy

### 3.1 `users`

*Purpose:* one row per person with a Cricket Scoring Book identity — mirrors the auth provider (`system-architecture.md §3.8`, `ADR-T08`) plus product-specific fields.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | Matches the auth provider's user id 1:1. |
| `email` | `text` | no | — | |
| `display_name` | `text` | no | — | |
| `is_minor` | `boolean` | no | `false` | Drives `NFR-033`/`SEC-013` field-redaction behaviour. |
| `guardian_user_id` | `uuid` | yes | — | Set iff `is_minor`. |
| `anonymized_at` | `timestamptz` | yes | — | Set on account deletion; when non-null, `display_name`/`email` are replaced with a stable placeholder — the **row itself is retained** so every `actor_ref` that points at it (in `match_events`, `audit_log`) keeps resolving (`BR-025`, `AUD-014`). |
| `row_version` | `integer` | no | `1` | §1.6 optimistic concurrency. |
| `created_at`, `created_by`, `updated_at`, `updated_by` | `timestamptz`/`uuid` | per §1.5 | — | |

**PK:** `id`. **UQ:** `email` (where `anonymized_at IS NULL`). **IX:** `email`.
**Soft deletion:** policy 2 (§1.7) — `anonymized_at`, never hard-deleted.
**Sync model:** CRUD-entity (§1.4); identity/auth writes are server-only regardless (`A-12`), so this table is effectively server-authored, but is still readable/cacheable offline for the claims-snapshot flow (`OFF-013`).

### 3.2 `organizations`

*Purpose:* the tenant boundary — a club, league, or association (`AGG-ORGANIZATION`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | Client-generatable (an org can be created from an onboarding flow). |
| `name` | `text` | no | — | |
| `branding` | `jsonb` | yes | — | Logo ref, colours (`ADM-*`). |
| `row_version` | `integer` | no | `1` | |
| `created_at`, `created_by`, `updated_at`, `updated_by` | — | per §1.5 | — | |

**PK:** `id`. **IX:** `name` (trigram, for admin search).
**Soft deletion:** not defined in this iteration — organizations are not expected to be deleted; revisit if a decommissioning flow is added (§13).
**Sync model:** CRUD-entity.

### 3.3 `memberships`

*Purpose:* the additive-RBAC join between a user and an organization (`system-architecture.md §3.9`, `SEC-005`) — the RLS anchor for every tenant-scoped table.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `user_id` | `uuid` | no | — | FK → `users.id`. |
| `organization_id` | `uuid` | no | — | FK → `organizations.id`. |
| `roles` | `text[]` | no | `{}` | The 12 additive roles (`foundation §4`); capability = union. |
| `status` | `enum(ACTIVE, DEACTIVATED)` | no | `ACTIVE` | |
| `row_version` | `integer` | no | `1` | |
| `created_at`, `created_by`, `updated_at`, `updated_by` | — | per §1.5 | — | |

**PK:** `id`. **FK:** `user_id → users.id`, `organization_id → organizations.id`. **UQ:** `(user_id, organization_id)`. **IX:** `organization_id`, `user_id`.
**Soft deletion:** policy 2 — `status = DEACTIVATED` (never a row delete): a deactivated member "performs no new actions but retains authorship of past events" (`BR-024`), which requires the row — and therefore the `actor_ref` it anchors — to persist.
**Sync model:** CRUD-entity; role changes are network-required (`docs/ux/ux-specification.md UX-28`'s explicit offline-disabling for this exact reason).

---

## 4. Participants

### 4.1 `teams`

*Purpose:* a team profile — either canonical (organization-registered) or ad-hoc/local (`AGG-TEAM`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | **Client-generated** — a team may be created offline (`A-24`). |
| `organization_id` | `uuid` | yes | — | Null for a guest/ad-hoc team never attached to an org. |
| `name` | `text` | no | — | |
| `canonical_ref` | `uuid` | yes | — | Self-reference; set if this row is a lightweight per-match duplicate later reconciled to a canonical team. |
| `row_version` | `integer` | no | `1` | |
| `created_at`, `created_by`, `updated_at`, `updated_by` | — | per §1.5 | — | |

**PK:** `id`. **FK:** `organization_id → organizations.id`, `canonical_ref → teams.id`. **IX:** `organization_id`, `name` (trigram).
**Soft deletion:** not applicable — a team with match history is never deleted; an unused ad-hoc team may be hard-deleted by its creator only (no historical references exist yet).
**Sync model:** CRUD-entity — this is the offline-creation case §1.3/§1.4 exist for.

### 4.2 `players`

*Purpose:* a canonical person in the player registry (`AGG-PLAYER`), or an ad-hoc/draft identity created during setup.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | **Client-generated.** |
| `organization_id` | `uuid` | yes | — | Null for a purely local/ad-hoc player. |
| `name` | `text` | no | — | |
| `dob` | `date` | yes | — | Minors'-data care (`NFR-033`); redacted in public views. |
| `photo_ref` | `text` | yes | — | Storage reference. |
| `status` | `enum(ACTIVE, MERGED)` | no | `ACTIVE` | |
| `merged_into_player_id` | `uuid` | yes | — | Self-reference; set iff `status = MERGED` (`BR-044`). |
| `row_version` | `integer` | no | `1` | |
| `created_at`, `created_by`, `updated_at`, `updated_by` | — | per §1.5 | — | |

**PK:** `id`. **FK:** `organization_id → organizations.id`, `merged_into_player_id → players.id`. **CK:** `merged_into_player_id IS NOT NULL ⇔ status = MERGED`. **IX:** `organization_id`, `name` (trigram), `merged_into_player_id`.
**Soft deletion:** policy 2 — merge (`status = MERGED` + `merged_into_player_id`), never a hard delete: "the merge is logged and the losing ID redirects to the surviving ID" (`BR-044`) requires the losing row (and every historical FK pointing at it) to remain resolvable forever.
**Sync model:** CRUD-entity — created offline routinely (ad-hoc players, `FR-033`).

### 4.3 `squad_members`

*Purpose:* which players belong to which team's squad — the pool a Playing XI is picked from (`VO-SQUAD`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `team_id` | `uuid` | no | — | FK → `teams.id`. |
| `player_id` | `uuid` | no | — | FK → `players.id`. |
| `role_hint` | `text` | yes | — | Free-text ("wicketkeeper-batter"), display only — never authoritative for match-time role assignment (that's `matches`' lineup fields, §5.1). |
| `created_at`, `created_by` | — | per §1.5 (no update fields — this is an add/remove join, not an edited entity) | — | |

**PK:** `(team_id, player_id)`. **FK:** `team_id → teams.id`, `player_id → players.id`. **IX:** `team_id`.
**Soft deletion:** ordinary hard delete (removing a player from a squad list) — the historical fact of having *played* a specific match is carried by `batter_card_lines`/`bowler_card_lines` (§7.7–7.8), not by squad membership, so removing a squad-list entry never orphans a historical reference.
**Sync model:** CRUD-entity.

---

## 5. Match & Officials

### 5.1 `matches`

*Purpose:* the match header — setup, lineups, toss, and lifecycle state (`AGG-MATCH`'s aggregate root fields; the ball-by-ball facts themselves live in `match_events`/the read model, not here).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | **Client-generated** — a match is always created offline-first (`FR-001/016/017`). |
| `organization_id` | `uuid` | yes | — | **Null = guest match** (`MINV-15`); set only on claim (`EVT-GUEST-MATCH-CLAIMED`). |
| `origin_device_id` | `uuid` | no | — | The device that created it; carried permanently, even after claim (`MBR-02`). |
| `claim_status` | `enum(GUEST, CLAIMED)` | no | `GUEST` | |
| `home_team_id`, `away_team_id` | `uuid` | no | — | FK → `teams.id` each. |
| `home_xi`, `away_xi` | `jsonb` | yes | — | Ordered list of `{player_id, is_captain, is_keeper}`; set once and frozen at first ball (`FR-032/034/035`); edited only via setup screens before the freeze, never after. |
| `officials_summary` | `jsonb` | yes | — | Denormalised convenience copy of `match_officials` (§5.3) for fast header display; `match_officials` remains authoritative. |
| `format` | `enum(T20, ODI, T10, THE_HUNDRED, CUSTOM, FIRST_CLASS)` | no | — | |
| `overs_allotted` | `integer` | yes | — | Null for `FIRST_CLASS`. |
| `conditions_profile` | `jsonb` | no | — | The resolved `CFG-REG` values (`VO-PLAYING-CONDITIONS-PROFILE`), frozen at first ball (`MINV-05`, `BR-017`). |
| `conditions_profile_version` | `integer` | no | — | FK → `reference_data.version` (kind = `CONDITIONS_PROFILE`) at creation; never changes after (`BR-032`). |
| `dls_table_version` | `integer` | yes | — | FK → `reference_data.version` (kind = `DLS_TABLE`); pinned identically. Null if `rain_method = NONE`. |
| `rain_method` | `enum(DLS_STANDARD, NONE)` | no | `NONE` | `[CFG]`; `NONE` is the default per `A-06`/`A-19` until `SPK-01` clears. |
| `toss_winner_team_id` | `uuid` | yes | — | FK → `teams.id`; set once, then locked by the conditions freeze (`BR-026`). |
| `toss_decision` | `enum(BAT, BOWL)` | yes | — | |
| `venue`, `scheduled_start` | `text`, `timestamptz` | yes/yes | — | |
| `match_timezone` | `text` | no | — | IANA zone name; every match timestamp displays in this zone (`NFR-059`). |
| `min_overs_for_result` | `integer` | yes | — | `FR-029`. |
| `state` | `enum(SCHEDULED, READY, IN_PROGRESS, INNINGS_BREAK, PAUSED, COMPLETE, ABANDONED)` | no | `SCHEDULED` | Mirrors `SM-MATCH`; this is the **only** authoritative store of current lifecycle state — a read-model convenience, itself re-derivable from `match_events` (`MBR-07`), materialised here for fast RLS-gated reads. |
| `result` | `jsonb` | yes | — | `VO-RESULT` (type, method, margin, statement); re-derivable, never independently asserted (`MBR-11`). |
| `row_version` | `integer` | no | `1` | |
| `created_at`, `created_by`, `updated_at`, `updated_by` | — | per §1.5 | — | |

**PK:** `id`. **FK:** `organization_id → organizations.id`, `home_team_id/away_team_id → teams.id`, `toss_winner_team_id → teams.id`, `conditions_profile_version/dls_table_version → reference_data.version`. **CK:** `home_team_id <> away_team_id`. **IX:** `organization_id`, `state`, `(home_team_id, away_team_id)`, `scheduled_start`.
**Soft deletion:** not applicable in this iteration — a match, once it has any deliveries, is never deleted (its `match_events` alone are permanent by policy 1); an empty/never-started match may be hard-deleted by its creator.
**Sync model:** CRUD-entity for the header fields above; the ball-by-ball facts they summarise are event-sourced (§6). This split is why `matches` is a CRUD table even though matches are inseparable from event sourcing overall — the header is metadata *about* the event stream, not part of it.

### 5.2 `officials`

*Purpose:* a person who can serve as an umpire, referee, head scorer, or assistant scorer on a match — distinct from `players` (an official is typically, but not necessarily, also a `users` account holder).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | Client-generatable. |
| `organization_id` | `uuid` | yes | — | |
| `user_id` | `uuid` | yes | — | FK → `users.id`, where the official also has a platform account. |
| `name` | `text` | no | — | |
| `row_version` | `integer` | no | `1` | |
| `created_at`, `created_by`, `updated_at`, `updated_by` | — | per §1.5 | — | |

**PK:** `id`. **FK:** `organization_id → organizations.id`, `user_id → users.id`. **IX:** `organization_id`.
**Soft deletion:** not applicable — retained via `match_officials`'s historical FK; a never-assigned official may be hard-deleted.
**Sync model:** CRUD-entity.

### 5.3 `match_officials`

*Purpose:* which official served which role on which match (`FR-025`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `official_id` | `uuid` | no | — | FK → `officials.id`. |
| `role` | `enum(UMPIRE, THIRD_UMPIRE, REFEREE, HEAD_SCORER, ASSISTANT_SCORER)` | no | — | |
| `created_at`, `created_by` | — | per §1.5 (no update — reassignment is a remove+add) | — | |

**PK:** `(match_id, official_id, role)`. **FK:** `match_id → matches.id`, `official_id → officials.id`. **IX:** `match_id`.
**Soft deletion:** ordinary hard delete of the assignment row; the official's own historical involvement remains visible via the read-model card lines' `actor_ref`/provenance regardless of whether the assignment row still exists.
**Sync model:** CRUD-entity.

### 5.4 `reference_data` *(supporting)*

*Purpose:* versioned, centrally-published condition-profile templates and DLS reference tables (`BR-032`, `BR-045`, `MINV-05`) — what `matches.conditions_profile_version`/`dls_table_version` pin against.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `kind` | `enum(CONDITIONS_PROFILE, DLS_TABLE, APP_CONFIG)` | no | — | |
| `version` | `integer` | no | — | Monotonically increasing per `kind`. |
| `payload` | `jsonb` | no | — | The versioned content itself. |
| `published_at` | `timestamptz` | no | — | |
| `published_by` | `uuid` | no | — | FK → `users.id` (platform-admin, `system-architecture.md §3.9`). |

**PK:** `(kind, version)`. **FK:** `published_by → users.id`. **IX:** `kind` (to fetch the latest quickly). **Immutability:** a published `(kind, version)` row is **never** updated in place — a change is a new `version` (`BR-045`).
**Soft deletion:** none — every historical version must remain resolvable for as long as any match still pins it.
**Sync model:** pull-only (§2.1 of `offline-first-specification.md`) — devices cache a pinned snapshot; they never write to this table.

---

## 6. The event store (write model)

### 6.1 `match_events`

*Purpose:* **the single source of truth for everything that happened in a match.** Every other scoring table in this document (§7–§8) is derived from this one, by folding it through the shared scoring core. This table's shape is defined authoritatively in `live-scoring.md §16.2` and `system-architecture.md §3.5`; restated here in full, in this document's own type notation, so the data specification is self-contained.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `event_id` | `uuid` | no | — | Client-generated once, at commit; the idempotency key (`offline-first-specification.md §9`). |
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `scorer_stream_id` | `uuid` | no | — | Identifies the independent writer stream (P1: exactly one per match; P2: one per scorer). |
| `device_id` | `uuid` | no | — | |
| `device_seq` | `bigint` | no | — | Strictly monotonic per `(scorer_stream_id, device_id)`, no gaps (`offline-first-specification.md §3.3/§10.3`). |
| `hlc` | `text` | no | — | Hybrid logical clock value, canonically formatted. |
| `event_ordinal` | `numeric(20,10)` | no | — | Dense, insertable-between-neighbours timeline position (`MINV-03`). |
| `type` | `text` | no | — | One of the `EVT-*` types (`live-scoring.md §16.2–16.5`). |
| `event_version` | `integer` | no | — | Schema version of `payload` for this `type`; upcasters apply on read (`system-architecture.md §4.8`). |
| `payload` | `jsonb` | no | — | The full event body (e.g. `EVT-DELIVERY-RECORDED`'s `legality`/`runEvents`/`wicket`/… fields, `live-scoring.md §3/§9.2`). |
| `supersedes` | `uuid` | yes | — | FK → `match_events.event_id`; set only on a correction (`live-scoring.md §19`). |
| `voids` | `uuid` | yes | — | FK → `match_events.event_id`; set only on an Undo (`live-scoring.md §18`). |
| `actor_ref` | `uuid` | no | — | FK → `users.id`, or a device-local guest placeholder; resolves through `users.anonymized_at` if the actor later deletes their account (`AUD-014`). |
| `provenance` | `jsonb` | no | — | `{app_version, platform, device_model, os_version, build_hash}` (`AUD-002`). |
| `recorded_at` | `timestamptz` | no | — | Device clock at commit. |
| `server_received_at` | `timestamptz` | yes | — | Null until synced; set by the server on ingest. |
| `prev_hash` | `text` | no | — | The previous **active** event's `hash` in this same `scorer_stream_id`, or a fixed genesis value for the first. |
| `hash` | `text` | no | — | Canonical hash of this event (`system-architecture.md §4.8`), computed client-side and **independently re-verified server-side** on ingest (`offline-first-specification.md §17.3`) — never simply trusted. |

**PK:** `event_id`. **FK:** `match_id → matches.id`, `supersedes/voids → match_events.event_id`. **UQ:** `(scorer_stream_id, device_id, device_seq)`. **IX:** `(match_id, scorer_stream_id, event_ordinal)` (canonical read order), `(match_id, device_id, device_seq)` (sync watermark lookups), GIN on `payload` where server-side queries need it.
**Partitioning:** hash of `match_id` (or monthly — `AQ-2`, still open), per `system-architecture.md §3.5/§3.17`.
**Grants:** **`INSERT` only** for every application role — no `UPDATE`, no `DELETE`, ever, for any role including admins (append-only is enforced at the grant level, not merely by application logic).
**Soft deletion:** policy 1 (§1.7) — none, structurally impossible by grant.
**Sync model:** event-sourced (§1.4) — this is the table that model exists for.

---

## 7. Scoring read model (typed projections)

**Every table in this section is derived, not directly inserted** (§1.1). Rows are upserted by the projector whenever it folds `match_events` (locally after every delivery, and server-side on ingest) — never written by a client command directly, and never independently the target of a correction (a correction targets `match_events`; these tables simply reflect the result of the next fold). None of them carry `created_by`/`updated_by` in the usual sense, since "who caused this row's current value" is answered by the underlying `match_events.actor_ref`, not by a separate audit trail on the projection itself — duplicating that here would violate `MBR-01`'s "no side channel."

### 7.1 `innings`

*Purpose:* one row per innings (`ENT-INNINGS`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | Deterministically derivable from `(match_id, innings_number)`, but stored as a stable `uuid` for FK convenience. |
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `innings_number` | `integer` | no | — | 1, 2 (limited-overs); up to 4 (first-class). |
| `batting_team_id`, `bowling_team_id` | `uuid` | no | — | FK → `teams.id` each. |
| `overs_allotted` | `integer` | yes | — | May differ from the match default after a reduction (`FR-079`). |
| `total_runs` | `integer` | no | `0` | |
| `extras_byes`, `extras_leg_byes`, `extras_wides`, `extras_no_balls`, `extras_penalty` | `integer` each | no | `0` | Maps 1:1 to `live-scoring.md §12`'s `InningsState.extras` buckets. |
| `wickets_lost` | `integer` | no | `0` | |
| `legal_balls_bowled` | `integer` | no | `0` | |
| `target` | `integer` | yes | — | Set for the chasing innings (`BR-018`, `MINV-11`). |
| `free_hit_pending` | `boolean` | no | `false` | Live, ephemeral read-model state (`MINV-09`) — meaningful only while `state = IN_PROGRESS`. |
| `state` | `enum(NOT_STARTED, IN_PROGRESS, COMPLETE)` | no | `NOT_STARTED` | Mirrors `SM-INNINGS`. |
| `end_reason` | `enum(ALL_OUT, OVERS_COMPLETE, TARGET_REACHED, DECLARATION, FORFEITURE)` | yes | — | Set on completion (`FR-071…077`). |
| `as_of_event_ordinal` | `numeric(20,10)` | no | — | The highest `match_events.event_ordinal` this row reflects — the freshness marker for incremental re-fold. |

**PK:** `id`. **FK:** `match_id → matches.id`, `batting_team_id/bowling_team_id → teams.id`. **UQ:** `(match_id, innings_number)`. **IX:** `match_id`.
**Soft deletion:** none — an innings, once folded, is never removed; a correction that changes innings-end timing (`live-scoring.md §19.2`) updates this row on the next fold, it does not delete and recreate it.
**Sync model:** derived (§1.1) — not independently synced at all; each client re-derives it locally from its own local `match_events` fold, and the server maintains its own copy the same way from its merged view. Nothing about `innings` rows themselves crosses the wire.

### 7.2 `overs`

*Purpose:* one row per over, per innings (`ENT-OVER`) — explicitly a **derived** table (`live-scoring.md §16.1`: over-completion is never an independently emitted fact).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `over_number` | `integer` | no | — | |
| `bowler_id` | `uuid` | no | — | FK → `players.id`. |
| `legal_ball_count` | `integer` | no | `0` | 0..`ballsPerOver`; `= ballsPerOver` once complete (or the innings ended mid-over — `live-scoring.md §13.1`). |
| `runs_conceded` | `integer` | no | `0` | Includes wides/no-balls runs (`live-scoring.md §13.2`). |
| `is_maiden` | `boolean` | yes | — | Null until the over is complete; evaluated once, per `live-scoring.md §13.3`. |
| `as_of_event_ordinal` | `numeric(20,10)` | no | — | |

**PK:** `id`. **FK:** `innings_id → innings.id`, `bowler_id → players.id`. **UQ:** `(innings_id, over_number)`. **IX:** `innings_id`, `bowler_id`.
**Soft deletion:** none.
**Sync model:** derived, not synced (as §7.1).

### 7.3 `deliveries`

*Purpose:* one row per delivery, the typed read-model twin of the delivery-shaped subset of `match_events` (`ENT-DELIVERY`) — this is where a query engine (scorecard rendering, ball-by-ball view, `docs/ux/ux-specification.md UX-21`) actually reads from, rather than replaying raw events on every screen paint.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `event_id` | `uuid` | no | — | FK → `match_events.event_id` — the **active** event that currently defines this row's values (`MINV-02`'s "active event set"). |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `over_id` | `uuid` | no | — | FK → `overs.id`. |
| `ball_in_over` | `integer` | no | — | 1..`ballsPerOver`, only meaningful for `legality = LEGAL`. |
| `event_ordinal` | `numeric(20,10)` | no | — | Copied from the source event — the true, gap-tolerant timeline position (used for e.g. the mankad display convention, `live-scoring.md §9.6`). |
| `legality` | `enum(LEGAL, WIDE, NO_BALL, DEAD_BALL)` | no | — | `live-scoring.md §3`. |
| `striker_id`, `non_striker_id`, `bowler_id` | `uuid` each | no | — | FK → `players.id` each — the crease context **at the moment this ball was bowled** (`MINV-04`), never re-derived after the fact even if a later correction changes who batted afterwards. |
| `is_free_hit` | `boolean` | no | `false` | |
| `total_runs` | `integer` | no | `0` | §7's aggregation, after the short-run adjustment. |
| `batter_runs` | `integer` | no | `0` | |
| `short_runs` | `integer` | no | `0` | |
| `dead_ball_reason` | `text` | yes | — | Set iff `legality = DEAD_BALL`. |
| `commentary` | `text` | yes | — | |
| `override_reason` | `text` | yes | — | Set iff a guardrail was overridden to record this delivery. |
| `superseded_by_event_id` | `uuid` | yes | — | FK → `match_events.event_id`; set (and this row's other fields updated to the superseding values) once a correction is folded in. |

**PK:** `id`. **FK:** `event_id/superseded_by_event_id → match_events.event_id`, `innings_id → innings.id`, `over_id → overs.id`, `striker_id/non_striker_id/bowler_id → players.id`. **UQ:** `(innings_id, event_ordinal)`. **IX:** `innings_id`, `over_id`, `bowler_id`, `striker_id`.
**Soft deletion:** none — a corrected delivery's row is **updated in place to reflect the current active fold** (this is the one read-model table where "update in place" is correct, precisely because it is a disposable cache of the *current* derivation, not a historical log — the full history lives in `match_events`, not here).
**Sync model:** derived, not synced.

### 7.4 `delivery_run_events`

*Purpose:* the normalised **Runs and Extras** table — one row per `RunEvent` (`live-scoring.md §7.1`), child of `deliveries`. A single delivery may have zero (a dot ball), one (the common case), or several rows (e.g. a no-ball penalty plus runs off the bat; a run plus an overthrow).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `delivery_id` | `uuid` | no | — | FK → `deliveries.id`. |
| `sequence` | `integer` | no | — | Order within the delivery (for display, e.g. "1 run, then overthrow 4"). |
| `origin` | `enum(OFF_BAT, BYE, LEG_BYE, WIDE, NO_BALL_PENALTY, NO_BALL_BAT, NO_BALL_BYE, NO_BALL_LEG_BYE, PENALTY)` | no | — | `live-scoring.md §7.1`. |
| `value` | `integer` | no | — | `≥ 0`. |
| `method` | `enum(RUN, BOUNDARY, OVERTHROW, AUTOMATIC)` | no | — | Drives strike-rotation eligibility (`live-scoring.md §14.4`) — never re-derived from `origin` alone. |
| `awarded_to_team_id` | `uuid` | yes | — | FK → `teams.id`; set only for `origin = PENALTY` (§7.7 of `live-scoring.md`, may be either side). |

**PK:** `id`. **FK:** `delivery_id → deliveries.id`, `awarded_to_team_id → teams.id`. **CK:** `awarded_to_team_id IS NOT NULL ⇔ origin = 'PENALTY'`. **UQ:** `(delivery_id, sequence)`. **IX:** `delivery_id`.
**Soft deletion:** none — replaced wholesale (all rows for a `delivery_id` deleted and reinserted) whenever that delivery's owning `deliveries` row is updated by a correction fold; this is an internal projector mechanic, not a domain deletion.
**Sync model:** derived, not synced.

### 7.5 `wickets`

*Purpose:* one row per dismissal (`ENT-WICKET`) — including the non-delivery-attached modes (mankad is delivery-attached via `EVT-NON-STRIKER-RUN-OUT`, but `TIMED_OUT` and `RETIRED_OUT` are not attached to any delivery at all, `live-scoring.md §9.6–9.7`), hence `delivery_id` is nullable.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `delivery_id` | `uuid` | yes | — | FK → `deliveries.id`; **null** for `TIMED_OUT`/`RETIRED_OUT`. |
| `event_id` | `uuid` | no | — | FK → `match_events.event_id` — the wicket-bearing event. |
| `mode` | `enum(BOWLED, CAUGHT, LBW, RUN_OUT, STUMPED, HIT_WICKET, OBSTRUCTING_THE_FIELD, HIT_BALL_TWICE, TIMED_OUT, RETIRED_OUT)` | no | — | `live-scoring.md §9.1`. |
| `out_batter_id` | `uuid` | no | — | FK → `players.id`. |
| `fielder_ids` | `uuid[]` | yes | — | References into `players.id`, validated at write time, not FK-enforced as an array. |
| `bowler_id` | `uuid` | yes | — | FK → `players.id`; the bowler of record (may be null for `TIMED_OUT`/`RETIRED_OUT`). |
| `credits_bowler` | `boolean` | no | — | Pure function of `mode` (`live-scoring.md §9.4`) — stored for query convenience, never independently set. |
| `end_vacated` | `enum(STRIKER, NON_STRIKER)` | no | — | |
| `crossed_before_dismissal` | `boolean` | yes | — | Set only for `RUN_OUT` (`live-scoring.md §9.5`). |
| `incoming_batter_id` | `uuid` | yes | — | FK → `players.id`; null iff the innings ended on this wicket. |
| `team_score_at_fall` | `integer` | no | — | Fall-of-wickets display value. |
| `over_ball_at_fall` | `text` | yes | — | Display string (e.g. `"9.3 (before delivery)"` for a mankad, per `live-scoring.md §9.6`); null for `TIMED_OUT`. |

**PK:** `id`. **FK:** `innings_id → innings.id`, `delivery_id → deliveries.id`, `event_id → match_events.event_id`, `out_batter_id/bowler_id/incoming_batter_id → players.id`. **IX:** `innings_id`, `bowler_id`, `out_batter_id`.
**Soft deletion:** none — replaced on re-fold exactly as §7.3/§7.4, following the same corrected-in-place read-model convention.
**Sync model:** derived, not synced.

### 7.6 `partnerships`

*Purpose:* one row per partnership segment (`INV-007`'s basis).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `wicket_number` | `integer` | no | — | 1 = opening partnership, etc. |
| `batter_a_id`, `batter_b_id` | `uuid` each | no | — | FK → `players.id` each. |
| `runs` | `integer` | no | `0` | |
| `balls` | `integer` | no | `0` | |
| `batter_a_contribution`, `batter_b_contribution` | `integer` each | no | `0` | |
| `is_unbroken` | `boolean` | no | `false` | True for the innings' last, still-active partnership. |

**PK:** `id`. **FK:** `innings_id → innings.id`, `batter_a_id/batter_b_id → players.id`. **UQ:** `(innings_id, wicket_number)`. **IX:** `innings_id`.
**Soft deletion:** none — replaced on re-fold.
**Sync model:** derived, not synced.

### 7.7 `batter_card_lines`

*Purpose:* one row per batter, per innings — the batting-card figures (`ENT-BATTER-CARD-LINE`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `player_id` | `uuid` | no | — | FK → `players.id`. |
| `batting_position` | `integer` | yes | — | Order of arrival at the crease. |
| `runs` | `integer` | no | `0` | |
| `balls_faced` | `integer` | no | `0` | |
| `fours`, `sixes` | `integer` each | no | `0` | |
| `status` | `enum(NOT_OUT, OUT, RETIRED_NOT_OUT, RETIRED_OUT, ABSENT)` | no | `NOT_OUT` (or `ABSENT` if never came in) | `live-scoring.md §9.8`, `SM-BATTER-CARD-LINE`. |
| `wicket_id` | `uuid` | yes | — | FK → `wickets.id`; set iff `status ∈ {OUT, RETIRED_OUT}`. |

**PK:** `id`. **FK:** `innings_id → innings.id`, `player_id → players.id`, `wicket_id → wickets.id`. **UQ:** `(innings_id, player_id)`. **IX:** `innings_id`.
**Soft deletion:** none — replaced on re-fold; a `RETIRED_NOT_OUT` batter's accumulated figures are preserved and reused on resumption (`live-scoring.md §22.10`), never reset by recreating the row.
**Sync model:** derived, not synced.

### 7.8 `bowler_card_lines`

*Purpose:* one row per bowler, per innings — the bowling-analysis figures (`ENT-BOWLER-CARD-LINE`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `player_id` | `uuid` | no | — | FK → `players.id`. |
| `legal_balls_bowled` | `integer` | no | `0` | Overs display (`W.B`) is derived, never stored redundantly. |
| `maidens` | `integer` | no | `0` | |
| `runs_charged` | `integer` | no | `0` | |
| `wickets` | `integer` | no | `0` | |
| `wides_bowled`, `no_balls_bowled` | `integer` each | no | `0` | |

**PK:** `id`. **FK:** `innings_id → innings.id`, `player_id → players.id`. **UQ:** `(innings_id, player_id)`. **IX:** `innings_id`.
**Soft deletion:** none — replaced on re-fold.
**Sync model:** derived, not synced.

**Numeric-rate fields** (economy, strike rate, average) shown on scorecards are computed **at read time** from the integer figures above using `numeric` arithmetic, not stored — storing a derived rate risks it silently drifting from its source integers, which the integer-only storage in §7.7–7.8 structurally prevents.

---

## 8. Sign-off & snapshots

Distinct from §7: these tables are **not silently disposable** — a `match_snapshots` row, once created, is a permanent, versioned record of an official state (`AUD-008`), not a cache to be casually rebuilt and discarded. `sign_offs` and `reconciliation_reports` are similarly append-only historical records, not re-fold targets.

### 8.1 `sign_offs`

*Purpose:* one row per sign-off (and counter-signature, and post-Final re-sign-off) — `VO-SIGN-OFF`.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `version` | `integer` | no | — | **Domain versioning** (§1.6) — 1, 2, 3… each supersedes the last; all retained (`BR-006`). |
| `signed_by` | `uuid` | no | — | FK → `users.id`. |
| `counter_signatures` | `jsonb` | yes | — | `[{user_id, signed_at}]` *(V2)*. |
| `reconciliation_state` | `enum(PASS, OVERRIDE)` | no | — | |
| `override_reason` | `text` | yes | — | Set iff `reconciliation_state = OVERRIDE` (`BR-007`). |
| `signed_at` | `timestamptz` | no | — | |
| `supersedes_version` | `integer` | yes | — | Self-referential via `(match_id, version)`; set on a post-Final re-sign-off. |

**PK:** `id`. **FK:** `match_id → matches.id`, `signed_by → users.id`. **UQ:** `(match_id, version)`. **IX:** `match_id`.
**Immutability:** every row is permanent once created — never updated, never deleted, even by a later correction (`BR-006`'s "the prior Final version is retained").
**Soft deletion:** policy 1-equivalent — none.
**Sync model:** the sign-off **command** is an event-sourced fact (a `match_events` row, `live-scoring.md`); this table is the queryable, permanent record derived from it — but unlike §7's tables, once a version is written here it is never overwritten by a later fold, only appended to with a new version.

### 8.2 `reconciliation_reports`

*Purpose:* one row per reconciliation checkpoint (interval and sign-off) — `VO-RECONCILIATION-REPORT`, `AUD-006`.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `checkpoint` | `enum(INTERVAL, SIGN_OFF)` | no | — | |
| `sign_off_id` | `uuid` | yes | — | FK → `sign_offs.id`; set iff `checkpoint = SIGN_OFF`. |
| `results` | `jsonb` | no | — | `[{inv_id, status, detail}]` — one entry per `INV-001…018` check (`live-scoring.md §20`). |
| `as_of_event_ordinal` | `numeric(20,10)` | no | — | |
| `created_at` | `timestamptz` | no | — | |

**PK:** `id`. **FK:** `match_id → matches.id`, `sign_off_id → sign_offs.id`. **IX:** `match_id`, `sign_off_id`.
**Soft deletion:** none — permanent historical record.
**Sync model:** as `sign_offs` — an append-only historical table, not a re-fold target.

### 8.3 `match_snapshots`

*Purpose:* the full, immutable projection captured at each sign-off version — the official, versioned scorecard artefact (`system-architecture.md §3.5`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `snapshot_version` | `integer` | no | — | **Domain versioning** — matches `sign_offs.version` 1:1 when taken at sign-off; may also exist for a periodic in-progress snapshot (unversioned display cache, `snapshot_version = 0` reserved for that case). |
| `as_of_event_ordinal` | `numeric(20,10)` | no | — | |
| `projection` | `jsonb` | no | — | The complete, self-contained scorecard (both innings' `batter_card_lines`/`bowler_card_lines`/FoW/partnerships/result), denormalised for fast, single-row serving to viewers. |
| `created_at` | `timestamptz` | no | — | |

**PK:** `id`. **FK:** `match_id → matches.id`. **UQ:** `(match_id, snapshot_version)` where `snapshot_version > 0`. **IX:** `match_id`.
**Immutability:** a `snapshot_version > 0` row (tied to a real sign-off) is never updated once written — permanent, per `AUD-008`.
**Soft deletion:** none.
**Sync model:** server-side materialisation only (`system-architecture.md §3.4`'s `signoff-materialise` function); not a client sync target — a device serves its **own** locally-folded projection while offline and only ever reads a `match_snapshots` row when viewing another match it did not itself score.

### 8.4 `dls_revisions` *(supporting)*

*Purpose:* one row per DLS revision, individually versioned and reversible (`BR-021`, `ENT-DLS-REVISION`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `innings_id` | `uuid` | no | — | FK → `innings.id`. |
| `revision_number` | `integer` | no | — | **Domain versioning**, per innings. |
| `inputs` | `jsonb` | no | — | Overs lost, wickets down, score, time. |
| `method_version` | `integer` | no | — | FK → `reference_data.version` (kind = `DLS_TABLE`). |
| `outputs` | `jsonb` | no | — | Revised target, par ladder. |
| `status` | `enum(ACTIVE, SUPERSEDED, REVERTED)` | no | `ACTIVE` | |
| `supersedes_revision_number` | `integer` | yes | — | |
| `actor_ref` | `uuid` | no | — | FK → `users.id`. |
| `created_at` | `timestamptz` | no | — | |

**PK:** `id`. **FK:** `innings_id → innings.id`, `method_version → reference_data.version`, `actor_ref → users.id`. **UQ:** `(innings_id, revision_number)`. **IX:** `innings_id`.
**Soft deletion:** none — a revision is superseded/reverted by a new row (`status` transition on the old + a new row), never deleted, exactly mirroring the correction pattern used throughout this schema.
**Sync model:** the underlying command is event-sourced; this table is its permanent, queryable, append-only record — same treatment as §8.1–8.2.

### 8.5 `divergences` *(supporting — dual-scorer, V2)*

*Purpose:* one row per detected field-level mismatch between two scorer streams (`VO-DIVERGENCE`, `offline-first-specification.md §10.2/§11.2`).

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `match_id` | `uuid` | no | — | FK → `matches.id`. |
| `over_ball` | `text` | no | — | Display position of the disputed delivery. |
| `field` | `text` | no | — | Which field disagrees (`runs`, `wicket`, `striker`, …). |
| `stream_a_id`, `stream_b_id` | `uuid` each | no | — | FK → the two `scorer_stream_id`s involved (a logical reference, not a physical FK table — streams are identified within `match_events`, not their own table). |
| `value_a`, `value_b` | `jsonb` each | no | — | The two recorded values, verbatim. |
| `status` | `enum(OPEN, PROPOSED, RESOLVED)` | no | `OPEN` | |
| `proposed_value` | `jsonb` | yes | — | |
| `proposed_by` | `uuid` | yes | — | FK → `users.id`. |
| `confirmed_by` | `uuid` | yes | — | FK → `users.id`; distinct user from `proposed_by` required (`MINV-14`). |
| `resolved_event_id` | `uuid` | yes | — | FK → `match_events.event_id` — the `EVT-DIVERGENCE-RESOLVED` event that converged both streams. |

**PK:** `id`. **FK:** `match_id → matches.id`, `proposed_by/confirmed_by → users.id`, `resolved_event_id → match_events.event_id`. **CK:** `confirmed_by IS DISTINCT FROM proposed_by`. **IX:** `match_id`, `status`.
**Soft deletion:** none — a resolved divergence remains on record permanently as part of the audit trail of how two independent records were reconciled.
**Sync model:** server-computed (the alignment pass requires both streams present, §10.2 of the offline-first spec) — not itself pushed by a client; the resolution *proposal/confirmation* actions are event-sourced commands.

---

## 9. Sync records

Device-local process/bookkeeping state (§1.7 policy 3) — `sync_cursors` and `writer_fences` exist primarily **on-device**; `writer_fences` additionally has a server-side authoritative copy (the server is the arbiter of the current valid lease, `offline-first-specification.md §10.1`). None of these three tables hold a domain fact about the match itself.

### 9.1 `sync_cursors`

*Purpose:* per-device, per-stream watermark for both push progress (this device's own stream) and pull progress (every remote stream it reads) — `offline-first-specification.md §3.2/§7.3`.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `device_id` | `uuid` | no | — | |
| `match_id` | `uuid` | no | — | |
| `scorer_stream_id` | `uuid` | no | — | The stream this cursor tracks (may be this device's own, or a remote one it pulls). |
| `direction` | `enum(PUSH, PULL)` | no | — | |
| `last_confirmed_device_seq` | `bigint` | yes | — | Meaningful for `direction = PUSH` only. |
| `last_pulled_event_ordinal` | `numeric(20,10)` | yes | — | Meaningful for `direction = PULL` only. |
| `updated_at` | `timestamptz` | no | — | |

**PK:** `(device_id, match_id, scorer_stream_id, direction)`. **IX:** `(match_id, scorer_stream_id)`.
**Soft deletion:** ordinary hard delete permitted — this is purely rebuildable process state (a lost cursor simply means the next sync re-derives it from `match_events`' own acknowledged state, at worst re-checking a wider range).
**Sync model:** device-local only; never itself synchronized to the server as domain data (the server's equivalent bookkeeping is its own internal `lastConfirmedDeviceSeq` tracked directly against `match_events`, not a separate mirrored table).

### 9.2 `writer_fences`

*Purpose:* the current valid writer lease per scorer stream (P1 single-writer handoff, `offline-first-specification.md §7.6/§10.1/§11.1`) — **server-authoritative**; a device caches its last-known value locally but the server's copy is the one that decides a push's fate.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `scorer_stream_id` | `uuid` | no | — | |
| `match_id` | `uuid` | no | — | FK → `matches.id` (server copy only). |
| `current_lease_value` | `bigint` | no | — | Monotonically increasing; bumped on every take-over. |
| `held_by_device_id` | `uuid` | no | — | |
| `granted_at` | `timestamptz` | no | — | |

**PK:** `scorer_stream_id` (server copy). **FK (server copy):** `match_id → matches.id`. **IX (server copy):** `match_id`.
**Soft deletion:** ordinary hard delete on the client's local cached copy; the server's authoritative row is retained for the life of the match (it is cheap, small, and needed for every future push validation).
**Sync model:** device-local cache mirrors the server's authoritative value; the device's own copy is disposable and re-fetched on demand — never itself "synced" as if it were a domain fact requiring reconciliation (there is exactly one current value at the server at any time, by definition, so there is nothing to reconcile).

### 9.3 `outbox` *(server-side, integration events)*

*Purpose:* the transactional outbox for **downstream integration events** (`system-architecture.md §3.11`, `ADR-09`) — distinct from a client device's local push queue (which is simply the not-yet-acknowledged tail of its own `match_events`, not a separate table; see `offline-first-specification.md §6`). This table exists **only** server-side.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `integration_event_type` | `text` | no | — | e.g. `MatchFinalised`, `AppearanceClaimApproved`. |
| `payload` | `jsonb` | no | — | |
| `created_at` | `timestamptz` | no | — | Same transaction as the state change that triggered it. |
| `dispatched_at` | `timestamptz` | yes | — | Null until a consumer has acknowledged it. |
| `attempts` | `integer` | no | `0` | |

**PK:** `id`. **IX:** `dispatched_at` (partial index `WHERE dispatched_at IS NULL`, for the drainer's polling query).
**Soft deletion:** ordinary hard delete or archival once dispatched and past a retention window — this is delivery bookkeeping, not a domain fact; the domain fact it announces already lives permanently in `match_events`/`sign_offs`/etc.
**Sync model:** not client-facing at all.

---

## 10. Audit records

### 10.1 `audit_log`

*Purpose:* the cross-cutting, append-only, hash-chained audit trail (`AUD-001…015`, `system-architecture.md §3.12`) — auth events, role changes, impersonation (double-attributed), guardrail overrides (mirrored here for a single pane, in addition to living in `match_events`'s own `override_reason`), exports, share-link actions, admin/platform actions, retention/anonymisation runs, dispute adjudications, player merges.

| Field | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | |
| `category` | `enum(AUTH, MEMBERSHIP, IMPERSONATION, OVERRIDE, EXPORT, SHARE_LINK, ADMIN, RETENTION, DISPUTE, PLAYER_MERGE)` | no | — | |
| `actor_ref` | `uuid` | no | — | FK → `users.id`; resolves through `anonymized_at` identically to `match_events.actor_ref`. |
| `impersonated_actor_ref` | `uuid` | yes | — | FK → `users.id`; set iff this action occurred under support impersonation — **both** identities recorded (`SEC-011`, `AUD-007`), never just one. |
| `target_ref` | `uuid` | yes | — | The entity acted upon (a `uuid` into whichever table `category` implies; not a single FK, since the target table varies). |
| `action` | `text` | no | — | |
| `detail` | `jsonb` | no | — | |
| `reason` | `text` | yes | — | Required by application logic for `category = OVERRIDE`/`ADMIN`/`DISPUTE`/`PLAYER_MERGE`, though not DB-enforced here since the requirement is category-conditional (enforced at the write path, mirroring `live-scoring.md`'s `overrideReason` pattern). |
| `prev_hash` | `text` | no | — | |
| `hash` | `text` | no | — | Computed over a canonicalised serialisation covering `actor_ref` (the stable surrogate), never raw PII — so anonymising a `users` row never breaks this chain's verifiability (`system-architecture.md §3.12`). |
| `created_at` | `timestamptz` | no | — | |

**PK:** `id`. **FK:** `actor_ref/impersonated_actor_ref → users.id`. **IX:** `actor_ref`, `category`, `created_at`.
**Grants:** `INSERT` only, and only via a `SECURITY DEFINER` helper — no application role has direct `INSERT`, `UPDATE`, or `DELETE` privilege on this table (`system-architecture.md §3.12`).
**Soft deletion:** policy 1 (§1.7) — none, ever, for any role.
**Sync model:** server-only — a device never holds or writes this table directly; every action a device performs that belongs in `audit_log` reaches it via a server-side write triggered by the corresponding synced event or API call, not by direct client insertion.

---

## 11. How this model supports offline-first operation

A direct summary of the design decisions above, stated once as the answer to the brief's explicit requirement:

1. **Every offline-creatable entity has a stable identity from the moment of creation** (§1.3) — client-generated UUIDs on `matches`, `teams`, `players`, `match_events`, and every other table a device can originate, mean nothing ever needs "renumbering" or reconciliation of identity itself when it syncs; only content can conflict, never identity.
2. **The two sync models are matched to the actual stakes of the data** (§1.4) — the heavyweight, provably-correct event-sourcing apparatus is spent exactly once, on `match_events`, where it is needed (ball-by-ball facts must never be silently lost or overwritten); everything else uses a lighter, conventional, still-safe upsert-with-optimistic-concurrency model appropriate to low-frequency metadata.
3. **The write model and read model are cleanly separated** (§1.1, §7) — a device can score an entire match against `match_events` alone, with zero connectivity, and render every screen (`docs/ux/ux-specification.md`) from its own local fold of the read-model tables, because §7's tables are defined as pure, disposable functions of the event log rather than independently-authored state that could itself desynchronise.
4. **Nothing in the scoring path requires a server round trip to validate or persist** — `matches` (setup), `players`/`teams` (ad-hoc creation), and `match_events` (every delivery, correction, undo, and sign-off) are all fully specified as offline-writable in this document, matching `docs/architecture/offline-first-specification.md §4`'s command catalogue exactly.
5. **Soft deletion is applied precisely where historical references demand it, and explicitly nowhere else** (§1.7) — this prevents the two failure modes offline-first systems are prone to: silently losing a historical reference (avoided by never hard-deleting `users`/`players`/`memberships`) and needlessly complicating tables that don't need it (avoided by permitting ordinary deletes on `squad_members`, `sync_cursors`, and similar bookkeeping).
6. **Audit and integrity travel with the data, not alongside it** — provenance and hash-chaining live directly on `match_events` and `audit_log` (§1.5, §6.1, §10.1), so a device's local, never-synced record is exactly as auditable and tamper-evident as the server's copy, from the very first event (`offline-first-specification.md §17.2`).

---

## 12. Traceability

| This document | Source |
|---|---|
| §3 Identity & Tenancy | `system-architecture.md §3.5/§3.8/§3.9`, `SEC-002/004/005`, `BR-001/024/025` |
| §4 Participants | `FR-030…040`, `BR-009…012/044`, `A-24` |
| §5 Match & Officials | `FR-016…029`, `BR-017/026/032/045`, `MINV-05` |
| §6 `match_events` | `live-scoring.md §16`, `system-architecture.md §3.5/§4.6`, `MINV-01…03` |
| §7 Scoring read model | `live-scoring.md §7–§15`, domain model `ENT-*`, `MBR-07` |
| §8 Sign-off & snapshots | `FR-097…112`, `BR-006/007/021`, `AUD-006/008/009` |
| §9 Sync records | `offline-first-specification.md §3/§7/§10/§11` |
| §10 Audit records | `AUD-001…015`, `system-architecture.md §3.12` |
| §11 Offline-first summary | `offline-first-specification.md` (whole document) |

---

## 13. Open items

| # | Item | Current default | Resolution path |
|---|---|---|---|
| DSQ-1 | `match_events` partitioning key: hash of `match_id` vs. monthly | Undecided here, matches `system-architecture.md AQ-2`, still open there too | Backend + architecture, before first production migration |
| DSQ-2 | Whether `organizations` needs a soft-delete/decommission path | Not modelled (§4.1's note) | Revisit if an org-offboarding flow becomes a requirement |
| DSQ-3 | Whether `match_snapshots`'s in-progress (`snapshot_version = 0`) rows should live in this table or a separate `live_state`-style hot cache (as sketched in `system-architecture.md §4.6`) to avoid write contention with the permanent, versioned rows | Kept as one table here for a simpler initial spec | Revisit under load testing (`system-architecture.md §3.17`); splitting is a pure performance optimisation, not a correctness change |
| DSQ-4 | Exact index strategy for `delivery_run_events`/`wickets` under very high read volume (popular live matches) | Baseline indexes only (§7.4/§7.5) | Tune post-pilot against real query patterns |
| DSQ-5 | Whether this specification should be escalated into literal PostgreSQL DDL now, or remain a structured specification pending implementation | Structured specification, per the front-matter note | **User decision** — ask if unclear; everything above is precise enough to transcribe directly either way |

---

## 14. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial data specification. §1 conventions: the write-model/read-model (CQRS) split stated as the organising principle; type notation; the client-generated-UUID identity strategy; the two distinct sync models (event-sourced vs. CRUD-entity) explicitly separated and matched to data stakes; audit-field policy; the two distinct meanings of "version" (optimistic concurrency vs. domain versioning) disambiguated; a three-way soft-deletion policy (never / soft-deactivate / ordinary hard-delete) applied per table, not blanket. §2 ASCII entity-relationship overview. §3–§10: full field-by-field specification (type, nullability, default, notes) with explicit PK/FK/UQ/CK/IX and soft-deletion/sync-model statements for 22 tables across Identity & Tenancy (`users`, `organizations`, `memberships`), Participants (`teams`, `players`, `squad_members`), Match & Officials (`matches`, `officials`, `match_officials`, `reference_data`), the event store (`match_events`), the scoring read model (`innings`, `overs`, `deliveries`, `delivery_run_events` — the normalised Runs & Extras table — `wickets`, `partnerships`, `batter_card_lines`, `bowler_card_lines`), sign-off & snapshots (`sign_offs`, `reconciliation_reports`, `match_snapshots`, `dls_revisions`, `divergences`), sync records (`sync_cursors`, `writer_fences`, `outbox`), and audit records (`audit_log`). §11 explicit six-point summary of how the model supports offline-first operation. §12 traceability, §13 five open items including an explicit request for confirmation on the specification-vs-DDL format choice. A structured, fully-typed schema specification — not executable DDL — continuing and completing `system-architecture.md §4.6`'s "schema sketch, not DDL" convention. |

