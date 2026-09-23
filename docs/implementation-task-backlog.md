# Cricket Scoring Book — Implementation Task Backlog

| | |
|---|---|
| **Document** | Implementation Task Backlog |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/master-specification.md` v0.1.0 (exclusively, per its own precedence rule), decomposed using `docs/ai-development-harness.md`'s task schema (§4) and sizing discipline. |
| **Downstream** | The first `TASK-####` records `ai-development-harness.md`'s workflow will run — Context → Prompt → Plan → Implement → Test → Verify → Review → Update Context, per task. |
| **Status** | A **task breakdown**, not implementation. No code is written here, no repository scaffolding created, no task has been started. This document answers "what is the first buildable unit, precisely," not "here is the build." |

> **Do not implement anything from this document without going through the harness's own Plan stage and Gate G1 first** (`ai-development-harness.md §1.3, §8`). A task listed here is a *candidate* unit of work — Plan approval is still where scope gets confirmed against the live spec state at the time work actually begins.

---

## 0. How this decomposition works, and its honest limits

`master-specification.md` synthesizes 168 functional requirements, 36 domain rules, 34 business rules, 45 NFRs, ~640 cricket rules, 28 database tables, dozens of API endpoints, and 28 UX screens (`ai-context-pack.md §14`). Turning literally every one of those into its own hand-written task here would produce many hundreds of near-duplicate entries and would not survive one document without drift or error — the same asymmetric-mapping judgment this corpus has applied consistently (`api-specification.md §19.2`, `testing-strategy.md §19.1`, `acceptance-criteria.md §11`) applies here too.

This document therefore does two things, honestly separated:

1. **§4 fully decomposes the MVP-critical foundation** — the database schema, the shared scoring core, the offline event log, and the sync/conflict layer — into 38 concrete, small, dependency-ordered tasks (`TASK-0001`…`TASK-0038`). This is the part of the system with the deepest existing specification detail (`live-scoring.md`'s 15-step pipeline, `data-specification.md`'s 28 tables) and the highest cost of getting wrong first, so it is decomposed in full rather than by pattern.
2. **§5 works one vertical slice end-to-end** (database → shared core → API → UI → test) for a single user-facing capability, showing how a feature actually cuts across the foundation tasks above once they exist.
3. **§6 defines the generation rule** — the exact, repeatable method — for producing the remaining backlog (the other 10 generic CRUD resources, the other 27 UX screens, DLS/dual-scorer/V1+ scope) on demand, with one worked example each, rather than pre-writing hundreds of tasks for scope that isn't being built yet.

§3's epic map shows where every part of the Master Specification lands, decomposed or not, so nothing is silently missing from the plan even where it isn't yet broken into tasks.

---

## 1. Sizing rule — "small enough for one AI development loop"

A task in this backlog satisfies **all** of the following, or it is split further before being listed:

1. **Touches one architectural layer primarily** (schema, or shared-core pipeline stage, or API layer, or one screen) — a task needing schema changes *and* new UI in the same unit is two tasks, linked by Dependencies.
2. **Cites five or fewer requirement/rule IDs directly** (a table's own field list, or one pipeline stage's rule set) — a task needing more is a sign the underlying spec cluster itself needs splitting first.
3. **Has a Definition of Done checkable by the Verify stage's five mechanical checks alone** (`ai-development-harness.md §7`) — no task depends on a judgment call to know if it's finished.
4. **Produces one reviewable diff** small enough that Gate G2 Review (`ai-development-harness.md §8`) is a single sitting, not a multi-day audit.
5. **Its Dependencies list only tasks earlier in this backlog** — no forward references, no circular waits. The backlog is topologically ordered; a task's number is always safe to start once every ID in its Dependencies field shows `Merged` status.

A task that would violate any of these (e.g. "implement the scoring engine") is not a task — it's an epic (§3), and stays unlisted at task grain until broken down.

---

## 2. Task template

Every task in §4 and §5 uses exactly these eleven fields, matching the request that opened this document and remaining compatible with the harness's own `TASK-####` schema (`ai-development-harness.md §4` — `Type`/`Status`/`Approval gate(s)` are implied for every task below: `Type: Feature`, `Status: Drafted`, `Approval gate(s) required: G1+G2` unless stated otherwise).

```
Task ID:                 TASK-####
Requirement IDs:          [the ≤5 IDs this task exists to satisfy]
Goal:                      [one sentence — what exists once this task is done]
Context needed:            [which docs/sections — beyond ai-context-pack.md + ai-development-harness.md, always implicitly loaded]
Dependencies:              [TASK-#### IDs that must be Merged first, or "None — foundation task"]
Inputs:                    [what pre-state/data this task assumes exists]
Expected behavior:         [precise, deterministic description — what the result must do, not how]
Acceptance criteria:       [existing criteria this satisfies, by trace — acceptance-criteria.md has no bare numeric IDs; cite by its §/category/source rule per acceptance-criteria.md §1.3]
Tests required:            [test tier(s), citing testing-strategy.md]
Files/components expected to change: [directories/paths, per repository-structure.md — nothing is created by this backlog itself]
Verification procedure:    [ai-development-harness.md §7's five checks, plus anything task-specific]
```

---

## 3. Epic map — where every part of the Master Specification lands

| Epic | Master-spec area | Decomposition status |
|---|---|---|
| E-01 | Database — Identity & Tenancy (`data-specification.md §3`) | Decomposed (§4, `TASK-0001…0002`) |
| E-02 | Database — Teams/Players/Squads (`§4`) | Decomposed (`TASK-0003…0004`) |
| E-03 | Database — Match/Officials/Reference data (`§5`) | Decomposed (`TASK-0005`) |
| E-04 | Database — Event store, `match_events` (`§6`), incl. reference-data pin enforcement | Decomposed (`TASK-0006…0008`) |
| E-05 | Database — Scoring read model (`§7`) | Decomposed (`TASK-0009…0010`) |
| E-06 | Database — Sign-off/snapshot/sync/audit records (`§8–§10`) | Decomposed (`TASK-0011…0012`) |
| E-07 | Auth & RLS foundation (`security-specification.md §3–§4`, `ADR-04`) | Decomposed (`TASK-0013…0015`) |
| E-08 | Shared core — ports & pipeline skeleton (`live-scoring.md §1–§6`) | Decomposed (`TASK-0016…0018`) |
| E-09 | Shared core — `RunEvent`/extras (`§7–§8`) | Decomposed (`TASK-0019…0020`) |
| E-10 | Shared core — wicket resolution (`§9`) | Decomposed (`TASK-0021…0022`) |
| E-11 | Shared core — batter/bowler/team/over state (`§10–§13`) | Decomposed (`TASK-0023…0024`) |
| E-12 | Shared core — strike resolution, innings/match end (`§14–§15`) | Decomposed (`TASK-0025…0026`) |
| E-13 | Shared core — event generation & audit (`§16–§17`) | Decomposed (`TASK-0027…0028`) |
| E-14 | Shared core — undo & correction (`§18–§19`) | Decomposed (`TASK-0029…0030`) |
| E-15 | Conformance test harness (`testing-strategy.md §4`) | Decomposed (`TASK-0031…0032`) |
| E-16 | Offline persistence & local event log (`offline-first-specification.md §2–§6`) | Decomposed (`TASK-0033…0034`) |
| E-17 | Sync protocol — push/pull/idempotency (`§7, §9`) | Decomposed (`TASK-0035…0036`) |
| E-18 | Conflict detection, writer-fence, resolution surfacing (`§10–§12`) | Decomposed (`TASK-0037…0038`) |
| E-19 | API — generic CRUD foundation (`api-specification.md §10`) | Pattern given (§6.1); one worked instance in §5 |
| E-20 | API — match-lifecycle commands (`§11`) | Pattern given (§6.1) |
| E-21 | API — sync & event endpoints (`§12–§13`) | Covered by E-17/E-18's server-side halves; remainder pattern given (§6.1) |
| E-22 | Web/Android — 28 UX screens (`ux-specification.md`) | One worked instance in §5 (UX-04); pattern given (§6.2) |
| E-23 | Outputs — scorecards, exports, sharing (`api-specification.md §14–§16`) | Not yet decomposed — MVP-boundary dependent, see `product-roadmap.md` |
| E-24 | CI/CD pipeline (`.github/workflows/*`, `repository-structure.md §12`) | Not yet decomposed — depends on E-01…E-18 existing to have anything to gate |
| E-25 | V1 scope — DLS, dual-scorer reconciliation, analytics | Not decomposed — blocked on `SPK-01` (DLS licensing) and `SPK-04` (parity); decompose on demand when unblocked |
| E-26 | V2/Future scope | Not decomposed — out of current roadmap horizon (`product-roadmap.md`) |

---

## 4. Foundation tasks — fully decomposed

### E-01 — Database: Identity & Tenancy

#### TASK-0001 — Migrate `users`, `organizations`, `memberships` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §3.1–3.3`; `DR-*` identity/tenancy rules (SRS §5); `MINV-*` identity invariants (`domain-model.md`) |
| Goal | The three identity/tenancy tables exist in Postgres exactly as specified — fields, types, PKs, FKs, constraints, indexes, audit fields. |
| Context needed | `data-specification.md §1` (conventions: client-generated UUID identity, audit fields, soft-deletion policy), `§3` |
| Dependencies | None — foundation task |
| Inputs | None (first migration) |
| Expected behavior | `CREATE TABLE` statements matching `data-specification.md §3.1–3.3` field-for-field; `memberships` enforces the org-scoped role FK; soft-deletion applied only where §3 marks it, not uniformly (`data-specification.md §1.7`). |
| Acceptance criteria | The baseline schema-conformance criterion implied by every field in `data-specification.md §3` (no bespoke AC numbering exists for schema fields — trace is the table spec itself, per `acceptance-criteria.md §11`'s stated asymmetry). |
| Tests required | Database tests — schema/constraint conformance (`testing-strategy.md §7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_users.sql`, `..._create_organizations.sql`, `..._create_memberships.sql` |
| Verification procedure | `ai-development-harness.md §7` checks 7.1–7.2, 7.4 (migration applies cleanly, pgTAP schema assertions pass); manual diff against `data-specification.md §3`'s field tables |

#### TASK-0002 — RLS policies for identity & tenancy tables

| Field | Value |
|---|---|
| Requirement IDs | `SR-B01` (RLS is the enforcement boundary), `SR-B02` (match-scoped vs org-wide roles), `SR-B05` (cross-tenant isolation) |
| Goal | Every identity/tenancy table has an RLS policy enforcing tenant isolation and role-appropriate access, verified by policy tests. |
| Context needed | `security-specification.md §4` (`SR-B*` cluster) |
| Dependencies | `TASK-0001` |
| Inputs | The three tables from `TASK-0001` |
| Expected behavior | A user can read/write only rows their `memberships` entitle them to; no policy grants cross-organization visibility by default (`SR-B05`). |
| Acceptance criteria | `acceptance-criteria.md §10` (Security category) cross-tenant-isolation criteria |
| Tests required | Security tests — RLS policy matrix (`testing-strategy.md §15`), Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_rls_policies.sql`, `database/supabase/tests/` |
| Verification procedure | pgTAP RLS matrix passes for every actor role defined in `security-specification.md §4.2`; §7 checks 7.2–7.4 |

### E-02 — Database: Teams, Players, Squads

#### TASK-0003 — Migrate `teams`, `players`, `squad_members` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §4.1–4.3`; SRS cluster C (Squads, Lineups & Roles) |
| Goal | The three team/participant tables exist, matching field-for-field. |
| Context needed | `data-specification.md §1, §4` |
| Dependencies | `TASK-0001` (FK to `organizations`/`users`) |
| Inputs | Identity/tenancy tables from E-01 |
| Expected behavior | `players` supports the lightweight-per-match creation path (`product-foundation.md A-24`) without requiring an `organizations` row first, per `data-specification.md §4.2`'s stated nullable-FK design. |
| Acceptance criteria | `acceptance-criteria.md` §3–§4 (Normal/Boundary) entries traced to SRS cluster C |
| Tests required | Database tests (`testing-strategy.md §7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_teams.sql`, `..._create_players.sql`, `..._create_squad_members.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; diff against `data-specification.md §4` |

#### TASK-0004 — RLS + constraints for teams/players/squads

| Field | Value |
|---|---|
| Requirement IDs | `SR-B01`, `SR-B04` (least-privilege default), `SR-J04/J05` (minors' data) |
| Goal | Access-control and minors-data-handling constraints are enforced at the database layer for team/player data. |
| Context needed | `security-specification.md §4, §11` (privacy cluster J) |
| Dependencies | `TASK-0003` |
| Inputs | Tables from `TASK-0003` |
| Expected behavior | A minor's player profile is visible only per `SR-J04/J05`'s relationship-gating rule, enforced by RLS, not application code alone. |
| Acceptance criteria | `acceptance-criteria.md §10` privacy/security entries traced to `SR-J*` |
| Tests required | Security tests (`§15`), Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_rls_policies.sql` (extended), `database/supabase/tests/` |
| Verification procedure | pgTAP policy matrix including a minor-profile actor scenario; §7 checks 7.2–7.4 |

### E-03 — Database: Match, Officials, Reference Data

#### TASK-0005 — Migrate `matches`, `officials`, `match_officials`, `reference_data` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §5.1–5.4`; SRS cluster B (Match Setup) |
| Goal | The match-shell tables exist, including the `reference_data` table that carries pinned playing-conditions profiles. |
| Context needed | `data-specification.md §5`, `cricket-rules-reference.md §0` (profile concept) |
| Dependencies | `TASK-0001`, `TASK-0003` |
| Inputs | Identity and team/player tables |
| Expected behavior | A `matches` row references exactly one `reference_data` profile snapshot, immutable once the first delivery is recorded (`ADR-11`). |
| Acceptance criteria | `acceptance-criteria.md §3` Normal-case entries traced to SRS cluster B |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_matches.sql`, `..._create_officials.sql`, `..._create_match_officials.sql`, `..._create_reference_data.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; diff against `data-specification.md §5` |

### E-04 — Database: Event store

#### TASK-0006 — Migrate `match_events` (append-only, hash-chained, partitioned)

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §6.1`; `ADR-01` (event sourcing), `ADR-08` (hash-chained append-only) |
| Goal | The write-model table exists with its hash-chain columns and partitioning strategy as specified. |
| Context needed | `data-specification.md §6.1`, `live-scoring.md §16` (event schema this table stores) |
| Dependencies | `TASK-0005` |
| Inputs | `matches` table |
| Expected behavior | Each row carries a hash of the prior row in the same match's chain; the table is partitioned per `data-specification.md §6.1`'s stated strategy. |
| Acceptance criteria | `acceptance-criteria.md §6` cricket-edge/audit-integrity entries traced to `live-scoring.md §17` |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_match_events.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; diff against `data-specification.md §6.1` |

#### TASK-0007 — INSERT-only grants & hash-chain enforcement

| Field | Value |
|---|---|
| Requirement IDs | `ADR-08`, `C-4`/`C-9` (`ai-context-pack.md §1` — corrections supersede, tamper-evident record) |
| Goal | No role can `UPDATE` or `DELETE` a `match_events` row; a trigger rejects any insert whose hash doesn't chain from the prior row. |
| Context needed | `data-specification.md §6.1`, `security-specification.md §4` |
| Dependencies | `TASK-0006`, `TASK-0002` (RLS pattern established) |
| Inputs | `match_events` table |
| Expected behavior | `GRANT` statements omit `UPDATE`/`DELETE` for every application role; an insert with a broken hash chain is rejected. |
| Acceptance criteria | `acceptance-criteria.md §10` (Security) append-only-integrity entries |
| Tests required | Security tests (`§15`), Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._match_events_grants_and_chain_trigger.sql`, `database/supabase/tests/` |
| Verification procedure | pgTAP test attempting `UPDATE`/`DELETE` and a broken-chain `INSERT`, both asserted rejected; §7 checks 7.2, 7.4 |

#### TASK-0008 — Reference-data versioning & pin enforcement

| Field | Value |
|---|---|
| Requirement IDs | `ADR-11` (reference data versioned and pinned per match at creation) |
| Goal | A constraint/trigger prevents a match's pinned `reference_data` version from changing after its first recorded delivery. |
| Context needed | `data-specification.md §5.4`, `ai-context-pack.md C-6/FA-6` (no silent format assumptions) |
| Dependencies | `TASK-0005`, `TASK-0006` (needs `match_events` to detect "first delivery recorded") |
| Inputs | `matches`, `reference_data`, `match_events` tables |
| Expected behavior | An `UPDATE` attempting to change `matches.conditions_profile`, `conditions_profile_version`, or `dls_table_version` (§5.1's actual pinned-reference-data fields — this entry originally said `reference_data_id`, a column that doesn't exist; corrected 2026-09-23 during implementation) after any `match_events` row exists for that match is rejected at the database layer. |
| Acceptance criteria | `acceptance-criteria.md §6` (Cricket edge) entries on profile immutability |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._reference_data_pin_trigger.sql` |
| Verification procedure | pgTAP test attempting the forbidden update and asserting rejection; §7 checks 7.2, 7.4 |

### E-05 — Database: Scoring read model

#### TASK-0009 — Migrate `innings`, `overs`, `deliveries`, `delivery_run_events` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §7.1–7.4` |
| Goal | The core read-model tables exist, structurally separate from `match_events` per CQRS (`ADR-06`). |
| Context needed | `data-specification.md §1.1` (two-layer model), `§7.1–7.4` |
| Dependencies | `TASK-0006` |
| Inputs | `match_events` table |
| Expected behavior | These tables are populated only by projection (folding `match_events`), never written directly by client requests — enforced by grants, not just convention. |
| Acceptance criteria | `acceptance-criteria.md §3` Normal-case entries on scorecard/delivery data shape |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_innings.sql`, `..._create_overs.sql`, `..._create_deliveries.sql`, `..._create_delivery_run_events.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; diff against `data-specification.md §7.1–7.4` |

#### TASK-0010 — Migrate `wickets`, `partnerships`, `batter_card_lines`, `bowler_card_lines` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §7.5–7.8` |
| Goal | The remaining scoring read-model tables exist. |
| Context needed | `data-specification.md §7.5–7.8` |
| Dependencies | `TASK-0009` |
| Inputs | `innings`/`overs`/`deliveries` tables |
| Expected behavior | `wickets` carries the dismissal-mode enum matching `live-scoring.md §9`'s validity matrix exactly, including the always-zero-runs vs. may-carry-runs distinction as a stored, not derived, field. |
| Acceptance criteria | `acceptance-criteria.md §6` cricket-edge entries on dismissal recording |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_wickets.sql`, `..._create_partnerships.sql`, `..._create_card_lines.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; diff against `data-specification.md §7.5–7.8` |

### E-06 — Database: Sign-off/snapshot/sync/audit

#### TASK-0011 — Migrate `sign_offs`, `reconciliation_reports`, `match_snapshots` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §8.1–8.3`; SRS cluster H (Corrections, Audit & Sign-off) |
| Goal | The sign-off and snapshot tables exist. |
| Context needed | `data-specification.md §8.1–8.3` |
| Dependencies | `TASK-0009` |
| Inputs | Scoring read-model tables |
| Expected behavior | `match_snapshots` stores a point-in-time fold result usable for fast recovery (`offline-first-specification.md §15`), never treated as authoritative over `match_events`. |
| Acceptance criteria | `acceptance-criteria.md §9` (Recovery) entries |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | `database/supabase/migrations/..._create_sign_offs.sql`, `..._create_reconciliation_reports.sql`, `..._create_match_snapshots.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4 |

#### TASK-0012 — Migrate `sync_cursors`, `writer_fences`, `outbox`, `audit_log` tables

| Field | Value |
|---|---|
| Requirement IDs | `data-specification.md §9.1–9.3, §10.1`; `ADR-07` (writer-fence), `ADR-09` (transactional outbox) |
| Goal | The sync-record and audit tables exist. |
| Context needed | `data-specification.md §9–§10` |
| Dependencies | `TASK-0006` |
| Inputs | `match_events` table |
| Expected behavior | `writer_fences` supports the P1 single-writer-per-stream check (`offline-first-specification.md §10`); `audit_log` is append-only, same discipline as `match_events` (`TASK-0007`). |
| Acceptance criteria | `acceptance-criteria.md §10` (Security) audit entries |
| Tests required | Database tests (`§7`) |
| Files/components expected to change | ~~`database/supabase/migrations/..._create_sync_cursors.sql`~~ (corrected 2026-09-23: `data-specification.md §9`'s own text says `sync_cursors` "exist[s] primarily on-device" and is "never itself synchronized to the server as domain data" — no server-side Postgres table belongs here; its real home is client-side SQLite, a different codebase location), `..._create_writer_fences.sql`, `..._create_outbox.sql`, `..._create_audit_log.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; audit_log grants checked same way as `TASK-0007` |

### E-07 — Auth & RLS foundation

#### TASK-0042 — Bootstrap the `backend/` Node/TypeScript workspace

*(Newly minted 2026-09-23, inserted here as `TASK-0013`'s prerequisite — numbered `0042` per `ai-development-harness.md §4`'s "sequential, never reused" rule, appended after the original 41 rather than renumbering everything that follows `TASK-0013` in this document.)*

| Field | Value |
|---|---|
| Requirement IDs | `repository-structure.md §8` (backend directory responsibility), `§15.1` (Node/pnpm workspace for `apps/web`+`backend`) |
| Goal | A minimal, buildable Node/TypeScript workspace exists at `backend/`, with no business logic yet — somewhere real code can actually go. |
| Context needed | `repository-structure.md §8, §15.1` |
| Dependencies | None — foundation task, no schema/data dependency |
| Inputs | None |
| Expected behavior | `backend/package.json` and `backend/tsconfig.json` exist and are valid; the directory skeleton `§8` specifies exists as empty (or near-empty, `.gitkeep`-style) directories: `src/commands/`, `src/sync/`, `src/authz/`, `src/projection/`, `src/exports/`, `src/outbox/`, `src/webhooks/`, `tests/`. No table, no endpoint, no auth logic. |
| Acceptance criteria | None from `acceptance-criteria.md` — this is pure tooling scaffolding, not a domain behavior; verified structurally, not against a G/W/T criterion |
| Tests required | None — nothing to test yet; a future task's tests will run inside this workspace |
| Files/components expected to change | `backend/package.json`, `backend/tsconfig.json`, `backend/src/{commands,sync,authz,projection,exports,outbox,webhooks}/`, `backend/tests/` |
| Verification procedure | The workspace installs and type-checks cleanly (`npm install && npx tsc --noEmit`, once a package manager is actually run — not executed by this task, same "written but not run" limitation as every SQL migration so far) |

#### TASK-0013 — Supabase Auth (GoTrue) integration & role-claim wiring

*(Split 2026-09-23 into two parts, per the recommendation given when this task's original scope was found to need tooling that didn't exist: the `infrastructure/supabase-projects/` half proceeds now as a template; the `backend/src/authz/` half now depends on `TASK-0042` and is deferred to a follow-on task once that workspace exists.)*

| Field | Value |
|---|---|
| Requirement IDs | `SR-A01, SR-A02, SR-A08`; `ADR-T08` |
| Goal | User sign-in issues a JWT whose claims RLS policies can read to resolve `memberships`-based roles. |
| Context needed | `security-specification.md §3`, `technology-stack.md ADR-T08` |
| Dependencies | `TASK-0001`, `TASK-0002` (original); `TASK-0042` (new, for the `backend/src/authz/` half only) |
| Inputs | `users`, `memberships` tables |
| Expected behavior | A signed-in request's role/org context is derivable entirely from the JWT + `memberships` table, with no client-supplied role claim trusted directly (`SR-B01`). |
| Acceptance criteria | `acceptance-criteria.md §10` (Security) auth entries |
| Tests required | Security tests (`§15`), API tests (`§6`) — deferred with the `backend/src/authz/` half |
| Files/components expected to change | `infrastructure/supabase-projects/` (template, this round); `backend/src/authz/` (deferred, needs `TASK-0042`) |
| Verification procedure | §7 checks 7.2, 7.4; manual sign-in flow against a local Supabase instance — deferred with the code half |

#### TASK-0014 — `SVC-AUTHORIZER` server-side module skeleton

| Field | Value |
|---|---|
| Requirement IDs | `SR-B01` (RLS + application-layer defense in depth); `domain-model.md` `SVC-AUTHORIZER` |
| Goal | A backend module exists that performs command-level authorization checks *before* a request reaches RLS, per the three-layer enforcement model (`master-specification.md §5.4`). |
| Context needed | `security-specification.md §4.1`, `domain-model.md §12` (13 domain services) |
| Dependencies | `TASK-0013` |
| Inputs | The JWT/role context from `TASK-0013` |
| Expected behavior | The module exposes a check callable by every command handler (`backend/src/commands/`) before any database write; a denied check returns the exact error code from `api-specification.md §5`'s registry. |
| Acceptance criteria | `acceptance-criteria.md §5` (Invalid) authorization-rejection entries |
| Tests required | Unit tests (`§3`), Security tests (`§15`) |
| Files/components expected to change | `backend/src/authz/` |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5 |

#### TASK-0015 — RLS policy matrix pgTAP suite bootstrap

| Field | Value |
|---|---|
| Requirement IDs | `SR-B01`; `security-specification.md §4.2` (14-actor × 20-capability matrix) |
| Goal | A pgTAP suite exists that can assert, for any table, whether a given actor role can read/write a given row — the harness every subsequent RLS-touching task (`TASK-0002`, `TASK-0004`, etc.) is verified against. |
| Context needed | `security-specification.md §4.2`, `testing-strategy.md §15` |
| Dependencies | `TASK-0002` |
| Inputs | The identity/tenancy RLS policies from `TASK-0002` |
| Expected behavior | The suite is parameterized by actor role and table, generating the matrix's cells as individual assertions rather than one hand-written test per cell. |
| Acceptance criteria | `acceptance-criteria.md §10` (Security) — the matrix itself is the acceptance criterion source |
| Tests required | Security tests (`§15`), Database tests (`§7`) |
| Files/components expected to change | `database/supabase/tests/` |
| Verification procedure | §7 checks 7.2, 7.4; the matrix generator itself is reviewed for completeness against `security-specification.md §4.2`'s full actor list |

### E-08 — Shared core: ports & pipeline skeleton

#### TASK-0016 — Define ports: `ClockPort`, `IdPort`, `EventLogPort`, `ReferenceDataPort`

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §1.1` (determinism — no I/O/clock/RNG inside the pipeline); `system-architecture.md §4.2` |
| Goal | Four interfaces exist in `commonMain`, with zero implementation — the boundary that keeps the pipeline pure. |
| Context needed | `repository-structure.md §5` (ports/adapters explanation) |
| Dependencies | None — foundation task (parallel-startable with E-01) |
| Inputs | None |
| Expected behavior | Each port is a Kotlin interface with no default implementation; `commonMain` code may only reach time/identity/storage/reference-data through these. |
| Acceptance criteria | `ai-context-pack.md §6` Coding Rule 2 (the core must be pure) is the acceptance bar — no runnable test yet, this is a structural task |
| Tests required | Unit tests (`§3`) — a compile-time check that no I/O import exists in `commonMain` |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../ports/` |
| Verification procedure | §7 check 7.1; a lint rule or CI check asserting no forbidden import in `commonMain/ports/` or its callers |

#### TASK-0017 — `DeliveryInput` model & guardrail validation (V1–V11)

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §2–§6` (pre-state, `DeliveryInput` schema, guardrails, V1–V11 validation) |
| Goal | A delivery input can be validated against the eleven guardrail checks, returning either a validated value or a specific rejection. |
| Context needed | `live-scoring.md §2–§6` |
| Dependencies | `TASK-0016` |
| Inputs | The port interfaces from `TASK-0016` |
| Expected behavior | Each of V1–V11 is independently testable; a rejected input returns the exact validation-failure identity `live-scoring.md §6` defines, not a generic error. |
| Acceptance criteria | `live-scoring.md §21.9` (rejected-inputs case catalogue) — every listed case passes |
| Tests required | Unit tests (`§3`), Domain/conformance tests (`§4`) against `live-scoring.md §21.9`'s cases |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`DeliveryInput`), `.../pipeline/` (validation stage) |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5; every §21.9 case reproduced as a conformance test and passing |

#### TASK-0018 — Legality classification stage

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §6` (legality classification, following guardrails) |
| Goal | A validated delivery input is classified as legal or one of the illegal-delivery categories (wide/no-ball/etc.), deterministically. |
| Context needed | `live-scoring.md §6` |
| Dependencies | `TASK-0017` |
| Inputs | A validated `DeliveryInput` |
| Expected behavior | Classification is a pure function of the input and pre-state; the same input against the same pre-state always classifies identically (`C-3`). |
| Acceptance criteria | `live-scoring.md §21.3–21.4` (wides, no-balls cases) |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; parity check across JVM/JS targets once `TASK-0031` exists |

### E-09 — Shared core: `RunEvent` & extras

#### TASK-0019 — `RunEvent` model & core run formulas

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §7` (`RunEvent` model; `batterRuns`/`bowlerRunsCharged`/`ranRuns` formulas) |
| Goal | Runs decompose into origin/value/method components, and the three derived totals compute correctly for every combination in the case catalogue. |
| Context needed | `live-scoring.md §7` |
| Dependencies | `TASK-0018` |
| Inputs | A classified, legal-or-illegal delivery |
| Expected behavior | `batterRuns`, `bowlerRunsCharged`, and `ranRuns` are computed exactly per §7's formulas for every origin/method combination. |
| Acceptance criteria | `live-scoring.md §21.2` (off-the-bat runs) full case set |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`RunEvent`), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; all §21.2 cases pass |

#### TASK-0020 — Extras decomposition (wide/no-ball/bye/leg-bye/penalty) & short runs

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §7–§8` (extras decomposition, short-run handling) |
| Goal | Every extras type decomposes into the correct `RunEvent` set, including short-run adjustment. |
| Context needed | `live-scoring.md §7–§8` |
| Dependencies | `TASK-0019` |
| Inputs | The `RunEvent` model from `TASK-0019` |
| Expected behavior | A short run reduces `ranRuns` by exactly the short-run count without affecting `batterRuns`/extras attribution rules elsewhere in §7. |
| Acceptance criteria | `live-scoring.md §21.3–21.6` (wides, no-balls, byes/leg-byes, penalty/dead-ball) |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; all §21.3–21.6 cases pass |

### E-10 — Shared core: wicket resolution

#### TASK-0021 — Dismissal-mode-validity-by-legality matrix

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §9` (dismissal-mode validity matrix) |
| Goal | Given a delivery's legality classification, only the dismissal modes valid for that legality are accepted. |
| Context needed | `live-scoring.md §9` |
| Dependencies | `TASK-0018` |
| Inputs | A classified delivery + an attempted dismissal mode |
| Expected behavior | E.g. `STUMPED` off a legal delivery with no wide is accepted; the same mode attempted off a scenario the matrix forbids is rejected with the exact validation identity. |
| Acceptance criteria | `live-scoring.md §21.7` (wickets case set) |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`WicketDetail`), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; all §21.7 cases pass |

#### TASK-0043 — Batter-replacement end resolution (`§9.5`)

*(Newly minted 2026-09-23, requested explicitly after `TASK-0021`'s report found this scope unclaimed by any existing task — `§21.7`'s `C31`/`C36–C38` cases test it, but neither `TASK-0021` (mode-validity) nor `TASK-0022` (zero-vs-preserve runs) actually covers it. Numbered `0043`, appended after `TASK-0042`, per the "sequential, never reused" rule.)*

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §9.5` (batter-replacement end resolution) |
| Goal | Given a dismissal, determine which crease end the incoming batter occupies and which end the surviving batter ends up at. |
| Context needed | `live-scoring.md §9.5` |
| Dependencies | `TASK-0021` |
| Inputs | A dismissal mode, the dismissed batter's crease end at the start of the delivery, the declared `endVacated`, and (for `RUN_OUT` only) `crossedBeforeDismissal` |
| Expected behavior | Non-`RUN_OUT`: the new batter takes exactly `endVacated`, the survivor stays at the other end. `RUN_OUT`, not crossed: survivor stays at their original end, new batter takes the declared `endVacated`. `RUN_OUT`, crossed: the survivor and dismissed batter have swapped ends (matching how batters physically swap on any completed run) — survivor ends up at the dismissed batter's original end, new batter takes the survivor's original end. |
| Acceptance criteria | `live-scoring.md §21.7` `C31` (non-`RUN_OUT` baseline), `C36–C38` (the three `RUN_OUT` sub-cases, including the not-crossed/crossed distinction) |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`CreaseEnd`), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; all of `C31`/`C36–C38` pass |

#### TASK-0022 — Always-zero-runs vs. may-carry-runs dismissal resolution

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §9` (the corrected always-zero-runs set `{BOWLED, CAUGHT, LBW, STUMPED, HIT_BALL_TWICE}` vs. may-carry-runs set `{RUN_OUT, HIT_WICKET, OBSTRUCTING_THE_FIELD}`) |
| Goal | A dismissal in the always-zero-runs set forces `ranRuns = 0` regardless of input; a may-carry-runs dismissal preserves whatever runs were legitimately run before the dismissal. |
| Context needed | `live-scoring.md §9` (including the caught-and-bowled = `CAUGHT` with `fielderIds=[bowlerId]` clarifying note) |
| Dependencies | `TASK-0021`, `TASK-0019` |
| Inputs | A dismissal mode + the delivery's `RunEvent` set |
| Expected behavior | A `RUN_OUT` on the non-striker's end during a legitimate second run preserves the completed first run; a `CAUGHT` dismissal zeroes any attempted run in flight. |
| Acceptance criteria | `live-scoring.md §21.7`; `live-scoring.md §22` `EX-*` worked examples involving run-outs |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; the specific `EX-*` examples involving mid-run dismissals pass exactly |

### E-11 — Shared core: batter/bowler/team/over state

#### TASK-0023 — Batter & bowler state update rules

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §10–§11` (batter state, bowler state) |
| Goal | Batter and bowler cumulative state (runs, balls faced, overs bowled, etc.) update correctly per delivery. |
| Context needed | `live-scoring.md §10–§11` |
| Dependencies | `TASK-0020`, `TASK-0022` |
| Inputs | A fully resolved delivery (runs + wicket outcome) |
| Expected behavior | A dot-ball extra (e.g. a wide with no runs) updates bowler-state (balls-in-over count) per §11's rule without crediting the batter a ball faced, per §10. |
| Acceptance criteria | `live-scoring.md §22` worked examples touching batter/bowler figures |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`BatterCardLine`, `BowlerCardLine`), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5 |

#### TASK-0024 — Team score & over-completion state rules

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §12–§13` (team score, over state) |
| Goal | Team score aggregates correctly; an over completes exactly when its legal-ball count reaches the format's configured balls-per-over. |
| Context needed | `live-scoring.md §12–§13`, `cricket-rules-reference.md §35` (`[CFG]` balls-per-over) |
| Dependencies | `TASK-0023` |
| Inputs | Batter/bowler state from `TASK-0023` |
| Expected behavior | Over completion is computed against the match's pinned playing-conditions profile (`TASK-0008`), not a hardcoded 6-ball assumption (`FA-6`). |
| Acceptance criteria | `live-scoring.md §22` worked examples spanning an over boundary |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`OverState`), `.../pipeline/`, `.../config/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; an alternate-profile (e.g. `HUNDRED`-format) conformance case passes without code branching on format |

### E-12 — Shared core: strike resolution, innings/match end

#### TASK-0025 — Strike resolution (`netRotates` XOR formula)

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §14` (`netRotates = (ranRuns mod 2 = 1) XOR (isOverFinalBall)`) |
| Goal | Strike rotates exactly per the formula for every combination of odd/even runs and over-final-ball state. |
| Context needed | `live-scoring.md §14` |
| Dependencies | `TASK-0024` |
| Inputs | A resolved delivery with `ranRuns` and over-position known |
| Expected behavior | An odd-run delivery on a non-final ball rotates strike; an odd-run delivery on the over's final ball does not (the two rotations cancel) — and every other combination per the formula. |
| Acceptance criteria | `live-scoring.md §22` worked examples `EX-*` specifically covering strike rotation at an over boundary |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; all four truth-table combinations of the XOR formula covered by distinct conformance cases |

#### TASK-0026 — Innings-end and match-end evaluation

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §15` (innings/match-end evaluation) |
| Goal | After each delivery, the pipeline correctly determines whether the innings and/or match has ended, per every stated ending condition (all-out, overs-complete, target-reached, etc.). |
| Context needed | `live-scoring.md §15` |
| Dependencies | `TASK-0025` |
| Inputs | Updated team/over state from `TASK-0024`/`0025` |
| Expected behavior | A chase reaching the target mid-over ends the innings immediately, not at the over's completion — evaluated deterministically from state alone. |
| Acceptance criteria | `live-scoring.md §22` worked examples covering innings/match-end |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`InningsState`), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5 |

### E-13 — Shared core: event generation & audit

#### TASK-0027 — `EVT-DELIVERY-RECORDED` and related event schemas

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §16` (event generation: `EVT-DELIVERY-RECORDED`, `EVT-NON-STRIKER-RUN-OUT`, `EVT-STRIKER-OVERRIDDEN`, `EVT-PLAYING-CONDITIONS-FROZEN`) |
| Goal | Every delivery outcome emits the correct event(s), matching the schemas exactly. |
| Context needed | `live-scoring.md §16`, `domain-model.md` (`EVT-*` catalogue) |
| Dependencies | `TASK-0026` |
| Inputs | A fully resolved delivery (all of E-09–E-12's output) |
| Expected behavior | ~~A non-striker run-out additionally emits `EVT-NON-STRIKER-RUN-OUT` alongside the base delivery event, per §16's stated co-emission rule.~~ **Corrected during `TASK-0027` (2026-09-23):** no such co-emission rule exists in `§16`. `§16.3`'s actual text is "emitted **instead of** `EVT-DELIVERY-RECORDED`" for the pre-delivery mankad case (`§9.6`) only — a replacement, never an addition. A normal in-play `RUN_OUT` of the non-striker carries its `WicketDetail` inside `EVT-DELIVERY-RECORDED`'s own payload like any other wicket (`§16.2`) and gets no separate event at all. |
| Acceptance criteria | `live-scoring.md §22` worked examples with multi-event emission |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (event types), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; emitted event JSON matches `specs/events/` schemas once `E-19`'s contract task exists (forward note, not a dependency) |

#### TASK-0028 — Audit record generation per delivery

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §17` (audit record) |
| Goal | Every delivery produces an audit record with full attribution, matching §17's fields exactly. |
| Context needed | `live-scoring.md §17`, `security-specification.md §11` (`SR-I*`) |
| Dependencies | `TASK-0027` |
| Inputs | The event(s) from `TASK-0027` |
| Expected behavior | The audit record identifies the acting scorer, device, and timestamp per §17, sufficient to reconstruct who did what without ambiguity. |
| Acceptance criteria | `acceptance-criteria.md §10` (Security) audit entries traced to `SR-I01…I04` |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../model/` (`AuditRecord`), `.../pipeline/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5 |

### E-14 — Shared core: undo & correction

#### TASK-0029 — Undo (void-and-refold)

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §18` (universal void-and-refold undo) |
| Goal | Undoing the most recent delivery voids its event and refolds state to exactly what it was before, with no special-casing per delivery type. |
| Context needed | `live-scoring.md §18` |
| Dependencies | `TASK-0028` |
| Inputs | A match with at least one recorded delivery |
| Expected behavior | Undo works identically whether the last delivery was a dot ball, a wicket, or an over-ending delivery — the refold, not delivery-type logic, handles every case. |
| Acceptance criteria | `live-scoring.md §22` worked examples covering undo after different delivery types |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../pipeline/`, `.../services/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; refolded state is byte-identical to the pre-delivery state captured before the original delivery was applied |

#### TASK-0030 — Correction (supersede-and-refold), incl. innings-end-timing-changed edge case

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §19` (universal supersede-and-refold correction, including the innings-end-timing-changed handling) |
| Goal | Correcting an arbitrary past delivery emits a superseding event and refolds all state from that point forward, including re-evaluating whether the innings/match end-point shifts. |
| Context needed | `live-scoring.md §19` |
| Dependencies | `TASK-0029`, `TASK-0026` |
| Inputs | A match with a past delivery to correct |
| Expected behavior | Correcting a delivery that was originally the innings-ending ball, such that the corrected version is not, re-evaluates every subsequent delivery's validity per §19's stated handling — never silently drops the now-invalid subsequent deliveries without flagging. |
| Acceptance criteria | `live-scoring.md §22` worked example(s) covering the innings-end-timing-changed case specifically |
| Tests required | Domain/conformance tests (`§4`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../pipeline/`, `.../services/` |
| Verification procedure | §7 checks 7.2, 7.4–7.5; the innings-end-timing-changed conformance case passes exactly as §19 specifies |

### E-15 — Conformance test harness

#### TASK-0031 — Conformance runner scaffolding

| Field | Value |
|---|---|
| Requirement IDs | `testing-strategy.md §4` (domain/conformance suite) |
| Goal | A runner exists in `commonTest` that loads fixture cases and asserts pipeline output, runnable identically on every KMP target. |
| Context needed | `testing-strategy.md §4.1–4.2` |
| Dependencies | `TASK-0016` (parallel-startable with E-09 onward once ports exist) |
| Inputs | The pipeline stages built so far |
| Expected behavior | The same runner and fixture set produce identical pass/fail results on JVM, JS, and (once available) the backend build — the parity check `C-7` depends on. |
| Acceptance criteria | `testing-strategy.md §4.3` (entry/exit criteria) |
| Tests required | This task *is* test infrastructure — no separate test-of-the-test beyond a smoke fixture |
| Files/components expected to change | `shared/src/commonTest/kotlin/` |
| Verification procedure | §7 checks 7.1, 7.4; a trivial fixture (one case) runs and passes on at least two targets |

#### TASK-0032 — Load `C01…C55` + `EX-01…13` as fixture files

| Field | Value |
|---|---|
| Requirement IDs | `live-scoring.md §21–§22` (the full case catalogue and worked examples) |
| Goal | Every catalogued case and worked example exists as a literal fixture file in `specs/conformance/`, consumed by the runner from `TASK-0031`. |
| Context needed | `live-scoring.md §21–§22` in full |
| Dependencies | `TASK-0031` |
| Inputs | The case catalogue text itself |
| Expected behavior | Fixtures are data, not code — adding a new case never requires a code change to the runner, only a new fixture file. |
| Acceptance criteria | 100% of `C01…C55` and `EX-01…13` represented as fixtures (`testing-strategy.md §19.1`'s "critical" coverage claim depends on this) |
| Tests required | This task populates the fixtures the rest of E-08–E-14's tasks are verified against — effectively a prerequisite made concrete after the fact as those tasks land |
| Files/components expected to change | `specs/conformance/` |
| Verification procedure | §7 check 7.1; a count check — fixture file count equals 55 + 13 |

### E-16 — Offline persistence & local event log

#### TASK-0033 — Local event-log durability (write-ahead, crash recovery)

| Field | Value |
|---|---|
| Requirement IDs | `offline-first-specification.md §3` (local persistence, durability contract, write ordering); `product-foundation.md A-17` |
| Goal | A delivery recorded locally survives a simulated process crash immediately after acknowledgment, with no data loss. |
| Context needed | `offline-first-specification.md §2–§3` |
| Dependencies | `TASK-0028` (needs event+audit generation to have something to persist) |
| Inputs | An `EventLogPort` implementation target (Android: SQLite/PowerSync; Web: IndexedDB/PowerSync) |
| Expected behavior | Write-ahead persistence completes before the UI acknowledges the delivery as recorded, per the durability contract in §3. |
| Acceptance criteria | `acceptance-criteria.md §7` (Offline) durability entries |
| Tests required | Offline tests — chaos harness subset (`testing-strategy.md §8.1`) |
| Files/components expected to change | `shared/src/androidMain/kotlin/.../persistence/` or `apps/android/src/main/kotlin/persistence/` (per the adapter split in `repository-structure.md §5/§7`), `apps/web/src/persistence/` |
| Verification procedure | §7 checks 7.2, 7.4; a forced-kill test immediately after a recorded delivery, asserting the event exists on restart |

#### TASK-0034 — Offline command execution model (local apply, event enqueue)

| Field | Value |
|---|---|
| Requirement IDs | `offline-first-specification.md §4` (offline commands — commands execute immediately locally; only the resulting event is queued) |
| Goal | A scoring command applies to local state immediately, with zero network dependency, and only the resulting event is added to the outbound queue. |
| Context needed | `offline-first-specification.md §4` (explicit: this is not a command queue) |
| Dependencies | `TASK-0033` |
| Inputs | Local persistence from `TASK-0033` |
| Expected behavior | With connectivity fully disabled, a full sequence of deliveries records and updates local scorecards correctly — the network is never on this path (`FA-15`). |
| Acceptance criteria | `acceptance-criteria.md §7` (Offline) command-execution entries |
| Tests required | Offline tests (`§8`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../sync/` (outbox interface), platform adapters |
| Verification procedure | §7 checks 7.2, 7.4; the offline-chaos harness's baseline "airplane mode, full innings" scenario passes |

### E-17 — Sync protocol: push/pull/idempotency

#### TASK-0035 — Push protocol (ordering, idempotency key)

| Field | Value |
|---|---|
| Requirement IDs | `offline-first-specification.md §7.1, §9` (push half of the protocol; idempotency via `event_id`, no expiry) |
| Goal | Queued local events push to the server in deterministic order, and a re-sent event (network retry duplicate) is rejected/no-op'd, never double-applied. |
| Context needed | `offline-first-specification.md §7, §9`, `data-specification.md §6.1` |
| Dependencies | `TASK-0034`, `TASK-0007` (server-side event store must exist and enforce append-only) |
| Inputs | The local outbox from `TASK-0034`, the `match_events` table from `TASK-0006`/`0007` |
| Expected behavior | Pushing the same `event_id` twice (simulating a retried request after a dropped response) results in exactly one stored event, not two. |
| Acceptance criteria | `acceptance-criteria.md §8` (Synchronization) idempotency entries |
| Tests required | Sync tests (`§9.1` convergence flagship, subset) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../sync/`, `backend/src/sync/`, `database/supabase/functions/sync-events/` |
| Verification procedure | §7 checks 7.2, 7.4; a duplicate-push test asserting exactly-once storage |

#### TASK-0036 — Pull protocol & cursor management

| Field | Value |
|---|---|
| Requirement IDs | `offline-first-specification.md §7.2` (pull half), `data-specification.md §9.1` (`sync_cursors`) |
| Goal | A client can pull events it hasn't yet seen, resuming correctly from its last cursor after a disconnect of any duration. |
| Context needed | `offline-first-specification.md §7.2, §12` (reconnection) |
| Dependencies | `TASK-0035` |
| Inputs | The `sync_cursors` table from `TASK-0012`, server-side event store |
| Expected behavior | A client reconnecting after an arbitrary offline duration pulls exactly the events after its stored cursor, in the deterministic order `ADR-05` specifies — no gaps, no duplicates. |
| Acceptance criteria | `acceptance-criteria.md §8` (Synchronization) reconnection entries |
| Tests required | Sync tests (`§9`) |
| Files/components expected to change | `shared/src/commonMain/kotlin/.../sync/`, `backend/src/sync/` |
| Verification procedure | §7 checks 7.2, 7.4; the sync-convergence harness's basic reconnect-after-N-hours scenario passes |

### E-18 — Conflict detection, writer-fence, resolution surfacing

#### TASK-0037 — Writer-fence enforcement (P1 single-writer)

| Field | Value |
|---|---|
| Requirement IDs | `offline-first-specification.md §10` (writer-fence conflict kind); `ADR-07` (single-writer per stream in P1) |
| Goal | A second device attempting to write to a match already fenced to another device's writer stream is rejected with the correct, explicit conflict signal — never silently accepted or silently dropped. |
| Context needed | `offline-first-specification.md §10–§11` |
| Dependencies | `TASK-0036`, `TASK-0012` (`writer_fences` table) |
| Inputs | Two simulated client devices, one match |
| Expected behavior | The second device's push is rejected with a fence-conflict response; no automatic resolution occurs (`C-6`). |
| Acceptance criteria | `acceptance-criteria.md §8` (Synchronization) conflict-detection entries |
| Tests required | Conflict tests (`§10`) |
| Files/components expected to change | `backend/src/sync/`, `database/supabase/migrations/` (fence-check function), `shared/src/commonMain/kotlin/.../sync/` |
| Verification procedure | §7 checks 7.2, 7.4; a two-device simulation asserting the second writer is fenced, not merged |

#### TASK-0038 — Value-level divergence detection & human-surfacing hook

| Field | Value |
|---|---|
| Requirement IDs | `offline-first-specification.md §10–§11` (value-level divergence — dual-scorer streams disagreeing on a recorded fact) |
| Goal | When two independent event streams for the same match produce divergent facts (P2 dual-scorer), the divergence is detected and surfaced for human resolution — never auto-merged. |
| Context needed | `offline-first-specification.md §10.2`, `data-specification.md §8.5` (`divergences` table, V2) |
| Dependencies | `TASK-0037` |
| Inputs | Two independent scorer streams for one match |
| Expected behavior | A divergence is recorded as a `divergences` row with both conflicting values retained, surfaced to `UX-25 Conflict Resolution` (UI hook only — no resolution UI built by this task). |
| Acceptance criteria | `acceptance-criteria.md §8` (Synchronization) dual-scorer entries |
| Tests required | Conflict tests (`§10`) |
| Files/components expected to change | `backend/src/sync/`, `database/supabase/migrations/` (extends `TASK-0012`'s divergences table if not already present) |
| Verification procedure | §7 checks 7.2, 7.4; a two-scorer divergence simulation produces exactly one `divergences` row with both values intact |

---

## 5. Worked vertical slice — "Create a match" (`UX-04`)

Shows how one user-facing capability cuts across foundation tasks once they exist, and how E-19/E-20/E-22 (not epic-decomposed above) get sliced when their turn comes.

#### TASK-0039 — ~~API: `POST /matches`~~ API: `PUT /matches/{id}` (generic CRUD create)

**Corrected during implementation (2026-09-24):** `api-specification.md §10.1` states outright "there is no server-assigning `POST /{resource}` for any table in this section" — every resource, matches included, uses `PUT /{resource}/{id}` with a **client-supplied** id; `data-specification.md §5.1` independently confirms `matches.id` is "Client-generated — a match is always created offline-first." Implemented as `PUT`, not `POST`.

| Field | Value |
|---|---|
| Requirement IDs | SRS cluster B (Match Setup); `api-specification.md §10` (generic CRUD pattern) |
| Goal | An authenticated, authorized request with a valid match-creation payload creates a `matches` row and returns it. |
| Context needed | ~~`api-specification.md §9` (validation layers, error registry)~~ **corrected:** `§4` (Validation, the three-layer model) and `§5` (Error codes, the registry) — §9 is "Versioning," unrelated. `§10`. |
| Dependencies | `TASK-0005`, `TASK-0014` |
| Inputs | A valid create-match payload per `api-specification.md §10`'s generic schema |
| Expected behavior | ~~A payload missing a required field returns the exact `422` per §9's registry~~ **corrected:** per `§4.1`'s own three-layer table, a missing/malformed field is a **schema** validation failure (`400`), not a business-rule one (`422`) — `422` is reserved for a well-formed payload violating a domain rule (e.g. this table's own `CK`: `home_team_id <> away_team_id`). A valid payload returns `201` with the created row, including server-assigned audit fields. |
| Acceptance criteria | `acceptance-criteria.md §3–§5` (Normal/Boundary/Invalid) entries traced to SRS cluster B |
| Tests required | API tests (`§6`) |
| Files/components expected to change | `backend/src/commands/` (or generic CRUD handler if not command-specific), `database/supabase/functions/` (thin entrypoint) |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5 |

#### TASK-0040 — Web: `UX-04 Create Match` screen

**Corrected during implementation (2026-09-24):** `ux-specification.md UX-04`'s own Inputs are `Match label, guest-vs-organization toggle, template selector, quick-pick format` only — it does **not** collect `home_team_id`/`away_team_id`/`match_timezone`, all `NOT NULL` on `data-specification.md §5.1`'s `matches` table (team selection is `UX-06`, timezone is `UX-05`, both later screens). "Submitting the form offline creates the match" (this task's own Expected Behavior) therefore cannot mean calling `TASK-0039`'s `createMatch()` from this screen — doing so would require fabricating values this screen never collects. Implemented as producing a local `DraftMatch` (client-generated id, everything UX-04 itself gathers) instead; wiring the full multi-screen `UX-04→09` flow into one eventual `PUT /matches/{id}` call is a genuine, flagged open integration question for later, not resolved by guessing here.

| Field | Value |
|---|---|
| Requirement IDs | `ux-specification.md` `UX-04` |
| Goal | A scorer can create a match from the web app, offline or online, reaching `UX-05 Match Setup` on success. |
| Context needed | `ux-specification.md`'s `UX-04` entry (Purpose/Inputs/Actions/Validation/States/Error handling/Empty states/Offline behavior/Accessibility) |
| Dependencies | `TASK-0039`, `TASK-0034` (offline command execution — match creation must work with zero connectivity per `C-1`) |
| Inputs | The API contract from `TASK-0039` |
| Expected behavior | ~~Submitting the form offline creates the match locally and queues the event, per `TASK-0034`'s model~~ **corrected:** UX-04 itself only collects label/ownership/template/format, not the full `matches` row — it produces a local draft; actually creating the row (queuing the event) happens once the remaining required fields are known, a later integration point. The screen does not block on network either way. |
| Acceptance criteria | `acceptance-criteria.md §3` (Normal) plus `§7` (Offline) entries for this screen |
| Tests required | Web tests (`§13`), the `UX-04→UX-05` step of the relevant E2E workflow (`§14`) |
| Files/components expected to change | `apps/web/src/screens/UX-04-create-match/` |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5; manual offline-mode walkthrough |

#### TASK-0041 — Android: `UX-04 Create Match` screen

| Field | Value |
|---|---|
| Requirement IDs | `ux-specification.md` `UX-04` |
| Goal | The same capability as `TASK-0040`, native Android. |
| Context needed | Same as `TASK-0040` |
| Dependencies | `TASK-0039`, `TASK-0034` |
| Inputs | Same API contract |
| Expected behavior | Behaviorally identical outcome to `TASK-0040` for the same input, per cross-platform parity (`C-7`) |
| Acceptance criteria | Same as `TASK-0040` |
| Tests required | Android tests (`§12`) |
| Files/components expected to change | `apps/android/src/main/kotlin/ui/screens/ux04creatematch/` |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5; parity comparison against `TASK-0040`'s result for the same fixture input |

---

## 6. Generation rule for the remaining backlog

### 6.1 Generic CRUD / command endpoint tasks (E-19, E-20, E-21)

For each of the 10 remaining generic-CRUD resources (`api-specification.md §10`) and each match-lifecycle command (`§11`) not yet covered: **one task per resource-operation pair** (e.g. `TASK-#### — API: PATCH /teams/{id}`), using exactly `TASK-0039`'s template — Requirement IDs from the resource's SRS cluster, Dependencies on that resource's schema task (§4) plus `TASK-0014`, Expected behavior stated as the validation/response contract from ~~`api-specification.md §9–§10`~~ **corrected (found while minting `TASK-0044`, the same error `TASK-0039` already caught in its own field text): `§4` (Validation) and `§5` (Error codes) — `§9` is "Versioning," unrelated.** `§10` for the CRUD shape itself. Tests required = API tests (`§6`). A command endpoint (§11) additionally depends on the shared-core task(s) implementing the command's effect (e.g. a "record delivery" command endpoint depends on all of E-08–E-14).

#### TASK-0044 — API: `matches` update (`PUT /matches/{id}`, existing id)

*(Newly minted 2026-09-24 — the first task generated by `§6.1`'s own rule, using `TASK-0039`'s template exactly. Completes `TASK-0039`'s own explicitly-flagged gap: "an update — existing id, `row_version` check — is a natural extension not built here." Chosen over starting a fresh resource because it finishes `matches`' CRUD story before moving on, reuses `TASK-0039`'s already-built `MatchStore`/`MatchRow`/error-constructor types directly, and is the first task in this backlog to genuinely exercise `api-specification.md §4.1`'s third validation layer — state-dependent/`409` optimistic concurrency — completing coverage of all three layers (`400`/`422`/`409`) across the two `matches` tasks together.)*

| Field | Value |
|---|---|
| Requirement IDs | SRS cluster B (Match Setup); `api-specification.md §10` (generic CRUD pattern, the update half) |
| Goal | An authenticated, authorized `PUT /matches/{id}` request against an existing match, with a current `row_version`, updates the row; a stale `row_version` is rejected, never silently overwritten. |
| Context needed | `api-specification.md §4` (Validation, the three-layer model — this task's own focus is the third, state-dependent layer), `§5` (Error codes), `§10.1` (`PUT` create-or-update semantics), `§10.2`'s `matches` row (write-once-then-locked fields: `home_xi`/`away_xi`/`toss_*`/`conditions_profile*`) |
| Dependencies | `TASK-0039` |
| Inputs | An existing `matches` row (from `TASK-0039`'s create path) plus an update payload carrying the `row_version` last read |
| Expected behavior | A `PUT` with the current `row_version` updates the row and increments `row_version`; a `PUT` with a stale (non-matching) `row_version` is rejected `409 concurrency/stale-version`, the stored row left untouched; a `PUT` attempting to change a write-once-then-locked field after it's already set is rejected `422 validation/business-rule` (`BR-017`, `MINV-05`), distinct from the stale-version case. |
| Acceptance criteria | `acceptance-criteria.md §3–§5` (Normal/Boundary/Invalid) entries traced to SRS cluster B, extended to the update case |
| Tests required | API tests (`§6`) |
| Files/components expected to change | `backend/src/commands/matches.ts` (extended, not a new module — the update path belongs alongside `createMatch`) |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5; a stale-`row_version` update is rejected with the stored row provably unchanged; a valid update is confirmed to increment `row_version` by exactly 1 |

### 6.2 UX screen tasks (E-22)

For each of the remaining 27 screens: **one task per screen per platform** (two tasks per screen, matching `TASK-0040`/`0041`'s pattern), Dependencies on the screen's underlying API/command task(s) from §6.1 plus any offline-model task it needs, Acceptance criteria drawn from `acceptance-criteria.md`'s applicability matrix (§2.1) row for that screen's FR cluster, Tests required = Web tests (`§13`) or Android tests (`§12`) plus the screen's step in whichever E2E workflow (`testing-strategy.md §14`) includes it.

### 6.3 V1/V2/Future scope (E-25, E-26)

Not decomposed at all yet, deliberately — per `ai-context-pack.md FA-8` (a requirement not explicitly Must/P1 is not MVP scope) and `FA-14` (an open item like `SPK-01` is not resolved by picking a default in a task). When `SPK-01` (DLS licensing) or `SPK-04` (cross-platform parity spike) resolve, or a release gate in `product-roadmap.md` opens V1 scope, apply the same method as §4: pick the epic's richest-specified sub-area first (for DLS, that's `cricket-rules-reference.md`'s DLS rule set and the `RainMethod` strategy interface `ADR-10` already names), and decompose it the same way — pipeline/schema/API/UI, small, dependency-ordered.

---

## 7. Traceability and coverage statement

Every task above cites at least one real ID from `ai-context-pack.md §14`'s legend — no task in this document uses a requirement ID that does not exist in the corpus (self-check per `ai-development-harness.md §7.2`, applied to this document's own authoring). §3's epic map accounts for every top-level area of the Master Specification, whether decomposed to task grain yet or explicitly marked pending. This document does **not** claim 100% requirement-to-task coverage at the individual `FR-*`/`DR-*`/`BR-*` level — it claims, consistent with the corpus's established asymmetric-mapping precedent, that every requirement lands in a *named, findable place* (an epic, and either a task or a stated generation rule) — which is the coverage bar `api-specification.md §19`, `testing-strategy.md §19`, and `acceptance-criteria.md §11` each already set for themselves.

---

## 8. Open items

*(Note: earlier drafts of this section numbered these `HQ-6`/`HQ-7`, colliding with `ai-development-harness.md §16`'s separately-minted `HQ-6…8`. Renamed to `ITQ-*` — Implementation Task backlog Questions — to disambiguate; no content changed.)*

| ID | Question |
|---|---|
| `ITQ-1` | Should `TASK-0039…0041`'s vertical slice be built *before* or *interleaved with* finishing all of E-08–E-14 (the full scoring core)? This document orders by dependency validity, not necessarily by recommended build sequence — that's a planning decision for whoever runs the harness's Plan stage first. |
| `ITQ-2` | Where exactly does `TASK-0027`'s emitted-event JSON get its schema contract from, given `specs/events/` (`repository-structure.md §4`) doesn't have its own decomposed task yet — is a `specs/` schema-authoring task a prerequisite of E-13, or can E-13 define the schema informally first and E-19 formalize it later? |
| `ITQ-3` | `TASK-0004` found that `players` has no linkage to `users` at all — `SR-B09`'s "minor's own account, their guardian" visibility clause cannot be enforced by RLS until one exists. Schema RCR adding a linkage, or an explicit decision that self/guardian access waits? |
| `ITQ-4` | `TASK-0004` also found the canonical org-admin role token is unconfirmed anywhere reachable from a migration (`memberships.roles` is deliberately unconstrained `text[]`; `product-foundation.md` only names the role conceptually). Where should the authoritative role-token list actually live — a `CHECK` constraint added retroactively, a `specs/` reference file, or deferred entirely to `SVC-AUTHORIZER` (`TASK-0014`)? |

---

## 9. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial draft. Decomposes the Master Specification's MVP-critical foundation (database schema, auth/RLS, shared scoring core, conformance harness, offline persistence, sync protocol, conflict detection) into 38 fully-specified tasks (`TASK-0001…0038`) plus a 3-task worked vertical slice (`TASK-0039…0041`), using the 11-field template requested. Provides a full epic map for the entire Master Specification and an explicit generation rule for the undecomposed remainder (generic CRUD, UX screens, V1/V2 scope) rather than pre-writing hundreds of pattern-identical tasks. |
| 0.1.0 | 2026-09-23 | **`TASK-0001` (Migrate `users`, `organizations`, `memberships` tables): Merged.** First task in this backlog to complete the full harness loop — Plan approved (G1), Implemented (`database/supabase/migrations/20260923000001…000003_*.sql`), a bounded pgTAP schema test written (`database/supabase/tests/001_identity_tenancy_schema.test.sql`, execution pending a provisioned Postgres environment — not yet run), and Reviewed/approved (G2) 2026-09-23. `TASK-0002` (RLS policies for these tables) is now unblocked — its only dependency is satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0002` (RLS policies for identity & tenancy tables): Merged.** Implemented (`database/supabase/migrations/20260923000004_create_rls_policies.sql`), a bounded pgTAP policy-existence test written (`database/supabase/tests/002_identity_tenancy_rls.test.sql`, not yet executed — same environment limitation as `TASK-0001`), Reviewed/approved (G2) 2026-09-23. Deliberately ships without `organizations`/`memberships` write policies — see the migration's own comments; org-creation and joining an org do not yet work, by design, pending `SVC-AUTHORIZER` (`TASK-0014`). `TASK-0015` (RLS policy matrix pgTAP suite bootstrap) is now unblocked — its only dependency is satisfied. `TASK-0007` (grants/hash-chain) still additionally needs `TASK-0006`. |
| 0.1.0 | 2026-09-23 | **`TASK-0003` (Migrate `teams`, `players`, `squad_members` tables): Merged.** Implemented (`database/supabase/migrations/20260923000005…000007_*.sql`), a bounded pgTAP schema test written (`database/supabase/tests/003_teams_players_squads_schema.test.sql`, not yet executed), Reviewed/approved (G2) 2026-09-23. `players`' merge biconditional (`merged_into_player_id IS NOT NULL ⇔ status = MERGED`) implemented as a named check constraint. `TASK-0004` (RLS + constraints for these tables) is now unblocked — its only dependency is satisfied. `TASK-0005` (matches/officials/reference_data) is now fully unblocked — both its dependencies (`TASK-0001`, `TASK-0003`) are satisfied. |
| 0.1.0 | 2026-09-23 | §8's `HQ-6/7` renamed to `ITQ-1/2` — collided with `ai-development-harness.md §16`'s own, separately-minted `HQ-6…8`. Caught while filing new open items for `TASK-0004`; no content changed, only the IDs. Registered in `ai-context-pack.md §14`. |
| 0.1.0 | 2026-09-23 | **`TASK-0004` (RLS + constraints for teams/players/squads): Merged, with two known gaps left open (`ITQ-3`, `ITQ-4`).** Implemented (`database/supabase/migrations/20260923000008_teams_players_squads_rls.sql`), including a `players_public` redaction view for `dob`/`photo_ref` per `SR-B09`. Reviewed/approved (G2) 2026-09-23 **as a partial implementation, explicitly**: (1) `SR-B09`'s "minor's own account, their guardian" clause is unenforceable — `players` has no `users` linkage — redaction currently covers everyone except the row's creator only; (2) the org-admin exception was left out rather than guess `memberships.roles`' exact token, so an org-admin currently sees the same redacted view as anyone else. Both fail safe (under-grant, not over-grant) and are tracked as `ITQ-3`/`ITQ-4`, not silently resolved by this merge. |
| 0.1.0 | 2026-09-23 | **`TASK-0005` (Migrate `matches`, `officials`, `match_officials`, `reference_data` tables): Merged, with one known gap left open.** Implemented (`database/supabase/migrations/20260923000009…000012_*.sql`), a bounded pgTAP schema test written (`database/supabase/tests/005_match_officials_schema.test.sql`, not yet executed). Reviewed/approved (G2) 2026-09-23 — approval given via a direct "commit this" instruction rather than a separate explicit "Approve `TASK-0005`" message; recorded here so the approval itself stays on the audit trail per `ai-development-harness.md §8`. **Known gap:** `matches.conditions_profile_version`/`dls_table_version` are specified as an FK to `reference_data.version`, but `reference_data`'s PK is the composite `(kind, version)` — a plain single-column FK isn't valid against it. Columns exist exactly as specified; referential integrity for those two fields is not yet database-enforced (needs either an undocumented companion `kind` column or a trigger — a decision, not made here). `TASK-0006` (the event store) is now unblocked — its only dependency is satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0006` (Migrate `match_events`): Merged, with two known gaps left open.** Implemented (`database/supabase/migrations/20260923000013_create_match_events.sql`), a bounded pgTAP schema test written (`database/supabase/tests/006_match_events_schema.test.sql`, not yet executed), Reviewed/approved (G2, via "commit this") 2026-09-23. **Known gaps:** (1) `§6.1`'s own stated partitioning strategy is explicitly an open question (`AQ-2`, "hash of `match_id` (or monthly)") — implemented as a plain, unpartitioned table rather than commit to one side of it; (2) `actor_ref` has no FK to `users.id`, same guest-placeholder reasoning as `TASK-0001`'s `created_by`/`updated_by`. Also flagged: as created by this task alone, the table has **no append-only enforcement** — any default role could still `UPDATE`/`DELETE` it; that's `TASK-0007`'s explicit, separate scope. `TASK-0007` is now unblocked — both its dependencies (`TASK-0006`, `TASK-0002`) are satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0007` (INSERT-only grants & hash-chain enforcement): Merged.** Implemented (`database/supabase/migrations/20260923000014_match_events_grants_and_chain_trigger.sql`), a behavioral pgTAP test written (`database/supabase/tests/007_match_events_append_only_and_chain.test.sql`, asserting UPDATE/DELETE/broken-chain-INSERT rejection and a correctly-chained INSERT's success — not yet executed). Reviewed/approved (G2, via "commit this") 2026-09-23. Since `GRANT`/`REVOKE` cannot bind a table's owner, append-only enforcement uses trigger-level hard blocks in addition to grants, satisfying `§6.1`'s "even admins" requirement. Also enables RLS on `match_events` with zero policies (safe deny-all default) — beyond this task's literal scope, but necessary: granting `SELECT` without it would have let any authenticated user read every match's events. **Flagged, not verified:** the hash-chain ordering key (`event_ordinal` within `scorer_stream_id`) is this task's best-supported reading of an underspecified point in `§6.1`, not confirmed against `live-scoring.md §16.2`/`system-architecture.md §4.8` where the canonical definition lives. `TASK-0008` (reference-data pin enforcement) is now unblocked — both its dependencies (`TASK-0005`, `TASK-0006`) are satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0008` (Reference-data versioning & pin enforcement): Merged.** Implemented (`database/supabase/migrations/20260923000015_reference_data_pin_trigger.sql`), a behavioral pgTAP test written (`database/supabase/tests/008_matches_conditions_freeze.test.sql`, asserting free updates pre-delivery, rejection post-delivery, and unrelated fields remaining updatable — not yet executed). Reviewed/approved (G2, via "commit this") 2026-09-23. **Correction made during implementation:** this task's own `Expected behavior` field named the target column `matches.reference_data_id`, which does not exist in the real schema (`TASK-0005`, built from `data-specification.md §5.1`) — corrected in place to the actual columns (`conditions_profile`, `conditions_profile_version`, `dls_table_version`), all three protected together since `§5.1` treats them as one "frozen at first ball" concept (`MINV-05`, `BR-017`), not three separate rules. `TASK-0009` (scoring read-model tables) remains gated only by `TASK-0006`, already satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0009` (Migrate `innings`, `overs`, `deliveries`, `delivery_run_events` tables): Merged, clean.** Implemented (`database/supabase/migrations/20260923000016…000019_*.sql`), a bounded pgTAP schema/grants test written (`database/supabase/tests/009_scoring_read_model_schema.test.sql`, not yet executed), Reviewed/approved (G2, via "commit this") 2026-09-23. "Populated only by projection... enforced by grants" satisfied by granting `authenticated` `SELECT`-only on all four tables (no write grant at all) plus RLS-enabled-zero-policies (same safe-default pattern as `TASK-0007`); the projector runs under `service_role`, which needs no explicit grant. `deliveries` deliberately kept mutable in-place (`§7.3`'s own exception to the append-only pattern) rather than over-applying `TASK-0007`'s trigger design. `TASK-0010` (wickets/partnerships/card lines) is now unblocked — its only dependency is satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0010` (Migrate `wickets`, `partnerships`, `batter_card_lines`, `bowler_card_lines` tables): Merged, with one known gap left open.** Implemented (`database/supabase/migrations/20260923000020…000022_*.sql`), a bounded pgTAP schema/grants test written (`database/supabase/tests/010_wickets_partnerships_cards_schema.test.sql`, not yet executed), Reviewed/approved (G2, via "commit this") 2026-09-23. `wickets.mode`'s 10 values independently confirmed against `adversarial-verification-report.md AVF-SE-01`. **Known gap:** `wickets.credits_bowler` is specified as a pure function of `mode`, but no `CHECK` ties the two — the exact `live-scoring.md §9.4` mapping wasn't confirmed in this task's context, and a wrong constraint would silently reject valid inserts. **Self-caught fix included:** a missed biconditional on `deliveries.dead_ball_reason` from `TASK-0009` was found and added as its own addendum migration (`20260923000023`), not folded into `TASK-0010`'s own files. `TASK-0011` (sign-off/snapshot tables) is now unblocked — its only dependency is satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0011` (Migrate `sign_offs`, `reconciliation_reports`, `match_snapshots` tables): Merged, clean.** Implemented (`database/supabase/migrations/20260923000024…000026_*.sql`), a behavioral pgTAP test written (`database/supabase/tests/011_signoff_snapshots.test.sql`, not yet executed), Reviewed/approved (G2, via "commit this") 2026-09-23. **Scope extended beyond the task's own narrow field description, flagged as such:** `§8`'s intro and `§8.1`'s Immutability note require `sign_offs`/`reconciliation_reports` to be append-only, same as `match_events` (`TASK-0007`'s pattern) — implemented for all three tables, not just `match_snapshots` (the only one the task's Expected Behavior field named), since no other task exists to add this protection. `match_snapshots`' freeze is conditional, not blanket: `snapshot_version = 0` (in-progress cache) stays freely updatable; only `snapshot_version > 0` (a real sign-off) is permanently frozen — tested both directions. `sign_offs.supersedes_version`'s composite FK is validly expressible (unlike `reference_data`'s gap in `TASK-0005`) since both columns live on the same table with a matching unique constraint. `TASK-0012` (sync records + audit log) is now unblocked — its only dependency is satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0012` (Migrate `sync_cursors`, `writer_fences`, `outbox`, `audit_log` tables): Merged, with `sync_cursors` deliberately omitted.** Implemented (`database/supabase/migrations/20260923000027…000029_*.sql`), a behavioral pgTAP test written (`database/supabase/tests/012_sync_records_and_audit_log.test.sql`, not yet executed), Reviewed/approved (G2, via "commit this") 2026-09-23. **`sync_cursors` was not created** — `§9`'s own text states it "exist[s] primarily on-device" and is "never itself synchronized to the server as domain data," with the server keeping its own different internal bookkeeping rather than a mirrored table; this task's own file list is corrected in place above. `audit_log`'s grants are the strictest built so far — no application role gets direct `INSERT`, only a new `SECURITY DEFINER` function (`audit_log_write()`), with no `EXECUTE` grant to `authenticated` either, matching `§10.1`'s "server-only" framing; `reason`'s category-conditional requirement is deliberately **not** DB-enforced, per the spec's own explicit instruction — the first field this session where a `CHECK` was correctly *not* added. **One real gap:** the task's Expected Behavior claims `audit_log` follows "the same discipline as `match_events`," but only the append-only half is implemented — `audit_log` has no stated hash-chain ordering key the way `match_events` had `event_ordinal`/`scorer_stream_id`, and guessing one risked a worse outcome (a wrongly-enforced, racy chain) than leaving it undone. `TASK-0013` is now unblocked — both its dependencies (`TASK-0001`, `TASK-0002`) are satisfied. |
| 0.1.0 | 2026-09-23 | **`TASK-0013` found to need tooling that didn't exist — split rather than forced through.** Its own file list (`infrastructure/supabase-projects/`, `backend/src/authz/`) crossed into Node/TypeScript application code and infrastructure config, neither of which any prior task in this backlog had bootstrapped — a real gap, not a choice to skip something. Recommended and approved: insert `TASK-0042` as a new prerequisite, split `TASK-0013` into a now-half (infra template) and a deferred-half (real authz code). |
| 0.1.0 | 2026-09-23 | **`TASK-0042` (Bootstrap the `backend/` Node/TypeScript workspace): Merged, clean — the first task in this backlog with real, executable verification.** Implemented `backend/package.json`, `backend/tsconfig.json`, and the 8-directory skeleton `repository-structure.md §8` specifies (empty, `.gitkeep`-marked, each annotated with what eventually belongs there). Unlike every SQL task so far (no Postgres environment provisioned), Node/npm **are** available in this environment, so verification actually ran: `npm install` succeeded, `npm audit` initially flagged 5 vulnerabilities (3 moderate, 1 high, 1 critical) in `vitest`'s dev-only toolchain (`esbuild`/`vite`, local-dev-server-only exposure, never shipped) — fixed by bumping `vitest` from `^2.1.0` to `^5.0.1` before merging, re-verified at 0 vulnerabilities rather than shipped with known issues on record. `npx tsc --noEmit` and `npx vitest run` both correctly report "nothing to check/test yet" (`TS18003`, "No test files found") — the expected, correct result for an intentionally business-logic-free skeleton, not a failure. Reviewed/approved (G2) 2026-09-23. `TASK-0013`'s `backend/src/authz/` half is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0013` (infra-template half only): Merged.** Implemented `infrastructure/supabase-projects/{dev,staging,pilot,production}.env.example` — project-ref-only templates (`repository-structure.md §11`: "no keys, only project refs"), matching the pattern `infrastructure/environments/*.env.example` already established. No real Supabase project has been provisioned in this repository at any point this session (`release-readiness-assessment.md`: still NO-GO), so every value is a placeholder, clearly marked as such. The `backend/src/authz/` half — the actual JWT-claims-to-role-resolution logic — remains deferred to a follow-on task, now that `TASK-0042` gives it somewhere real to go. |
| 0.1.0 | 2026-09-23 | **`TASK-0013` (deferred half) + `TASK-0014` (`SVC-AUTHORIZER` skeleton): Merged together, real tests passing.** `TASK-0014`'s own `Inputs` field named "the JWT/role context from `TASK-0013`" — exactly the half deferred last turn — so `TASK-0014` was not actually unblocked despite the infra-template half landing; built the real prerequisite first rather than start `TASK-0014` on a dependency that didn't exist. Implemented `backend/src/authz/{roleContext,session,errors,authorize}.ts`: `computeRoleContext` (pure — excludes `DEACTIVATED` memberships per `BR-024`) and `fetchRoleContext`/`resolveUserId` (I/O via `@supabase/supabase-js`, added as a new dependency, not integration-tested — no live Supabase project exists); `authorize()` returns the exact `auth/forbidden` (403) RFC 7807 error from `api-specification.md §5.2` on denial, with a deliberately generic client-facing `detail` that does not enumerate the missing role or confirm/deny organization membership — matching this corpus's established anti-enumeration principle (`adversarial-verification-report.md §4`). **8 real unit tests written and executed — `npm install` (0 vulnerabilities), `npx tsc --noEmit` (clean), `npx vitest run` (8/8 passed)** — the first task in this backlog where the Test stage produced a real pass/fail result, not a written-but-unexecuted file. `TASK-0015` (RLS matrix pgTAP bootstrap) remains gated on `TASK-0002` only, already satisfied — unaffected by this task. |
| 0.1.0 | 2026-09-23 | **`TASK-0015` (RLS policy matrix pgTAP suite bootstrap): Merged, with an honest scope reduction.** Implemented `database/supabase/tests/015_rls_matrix.test.sql` — a genuinely reusable generator (`test_rls_select`, simulating a specific/anonymous caller via Supabase's `request.jwt.claims`/`role` session mechanism) with 9 matrix cells generated through it across `users`/`organizations`/`memberships`. **Scope reduction, flagged not overstated:** `§4.2`'s matrix distinguishes 14 actors by *role*; `TASK-0002`'s actual policies check coarse tenant membership only and never inspect `memberships.roles` — there is nothing in the database yet to exercise the role dimension. The generator pattern is proven against what's real (self/co-tenant/cross-tenant/anonymous visibility); the full role-aware matrix extends the same pattern once role-specific RLS exists. Not executed — needs a live Supabase-shaped database (`auth.users` in particular), not just any Postgres. `TASK-0016` (shared/ ports) is unblocked — it has no dependency at all, foundation task. |
| 0.1.0 | 2026-09-23 | **`TASK-0016` (Define ports: `ClockPort`, `IdPort`, `EventLogPort`, `ReferenceDataPort`): Merged.** Implemented `shared/src/commonMain/kotlin/com/kencric/scoring/core/ports/{Clock,Id,EventLog,ReferenceData}Port.kt` — four pure interfaces, zero implementation. **First task in this backlog with genuinely zero verification capability**, not just "not yet run": no Java/Kotlin/Gradle toolchain exists anywhere in this environment (checked explicitly), unlike the Node-based backend work. Substituted the best available check — `grep` confirming zero `import` statements and zero method bodies — for a real compiler run. `EventLogPort`/`ReferenceDataPort` deliberately use plain `String` payloads, not a typed domain event, since that model is `TASK-0017`'s scope; flagged in each file as possibly needing revisiting once it exists. `TASK-0017` (`DeliveryInput` model & guardrails) is now unblocked — its only dependency is satisfied, though it carries the same unverifiable-in-this-environment caveat. |
| 0.1.0 | 2026-09-23 | **`TASK-0017` (`DeliveryInput` model & V1–V11 validation): Merged, with three honest scope decisions.** Implemented `model/{DeliveryInput,DismissalMode,Legality,RunEvent,ValidationFailure,WicketDetail}.kt` and `pipeline/DeliveryValidator.kt`, plus `commonTest/.../DeliveryValidatorTest.kt` covering all 6 mandatory `§21.9` cases (`C50…C55`) and extra coverage for `V1/V2/V7/V8` (not exercised by `§21.9`). **Scoped to `§5` (V1–V11) only, not `§4`'s guardrails** — the backlog's own wording called V1–V11 "the eleven guardrail checks," but `live-scoring.md` uses "guardrail" specifically for `§4`; kept the narrower, acceptance-criteria-matching scope. `V1` implemented as a documented no-op (structurally guaranteed by the `Legality` enum); `V10` deliberately not implemented (depends on `§4`'s guardrail stage, out of scope) rather than written as a check that could never verify anything. `V7`/`V8` are conservative — `V7` only covers `CAUGHT`; `V8` doesn't handle the legitimate-resumption exception (`§9.6`). `DismissalMode` correctly uses 10 values, matching `AVF-SE-01`, cited directly rather than the "11" `§9.2`'s prose claims. **Self-review caught and fixed one real issue** (no compiler exists to catch it): `WicketDetail`'s field order had a defaulted parameter before a required one — safe only because every call site used named arguments; reordered to remove the risk. `TASK-0018` (legality classification) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0018` (Legality classification stage): Merged.** Implemented `pipeline/LegalityClassifier.kt` + test — `§6.1–6.4`'s three boolean outputs (`consumesLegalBallSlot`, `incrementsStrikerBallsFaced`, `incrementsBowlerLegalBalls`) plus the `DEAD_BALL` short-circuit flag, verified against every `LB✓`/`BF✓` value across `C01…C23` (`§21.2–21.4`) — not the full tables' run totals/extras/rotation columns, which belong to `TASK-0019`/`TASK-0025`. `TASK-0019` (`RunEvent` core formulas) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0019` (`RunEvent` model & core run formulas): Merged, clean.** Implemented `pipeline/RunAggregator.kt` + test — `§7.2`'s five aggregate formulas (`total`, `batterRuns`, extras-by-category, `bowlerRunsCharged`, `ranRuns`), verified against 13 of `§21.2–21.4`'s 23 cases, hand-checked against 5 by formula before any code was written given zero compiler safety net. Confirmed `§7.6`'s "boundary subsumes" rule needs no special-case logic — it falls out of which `RunEvent`s the caller constructs, not extra logic in the aggregator. `shortRuns` (`§8`) deduction correctly excluded — `TASK-0020`'s separately-listed scope, not this one's; `aggregateRuns` returns the pre-short-run-adjustment raw values. `TASK-0020` (extras decomposition & short runs) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0020` (Extras decomposition & short runs): Merged, with one significant correction.** Implemented `pipeline/{ShortRunAdjuster,ExtrasDecomposer}.kt` + tests. **Correction, not silently matched to the wrong text:** this task's own Expected Behavior field said a short run reduces `ranRuns` "without affecting `batterRuns`/extras" — `§8`'s actual text says the opposite explicitly ("this adjusted value... flows into `batterRuns`, `bowlerRunsCharged`, extras totals... across every downstream total"), with a worked example confirming it. Implemented per the actual spec text (authoritative over the backlog's paraphrase), with a test reproducing that exact worked example. `ExtrasDecomposer.kt` covers the genuinely distinct "which `RunEvent`s to construct" half of this task's goal, cross-checked against the same `C13/C14/C16/C19/C21/C22` cases already hand-verified in `TASK-0019`. `TASK-0021` (dismissal-mode-validity matrix) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0021` (Dismissal-mode-validity-by-legality matrix): Merged — its own named goal was already satisfied by `TASK-0017`.** `validDismissalModesFor()`/`V5` already implement the full `§9.1` matrix, built as a necessary byproduct of validating a wicket's mode. What `§21.7` (this task's actual acceptance criteria) needed instead was bowler credit (`§9.4`) — implemented as `creditsBowler()`/`BOWLER_CREDITED_MODES` in `model/DismissalMode.kt`, verified against all 14 `§21.7` cases. **Also closed a flagged gap from `TASK-0010`:** `wickets.credits_bowler` had no `CHECK` constraint because the mapping wasn't confirmed at the time — added as addendum migration `20260923000030_wickets_credits_bowler_check.sql`, now that `§9.4` gives it exactly. Surfaced a real, unclaimed scope gap (`§9.5` end-resolution) — requested and minted as `TASK-0043`, see below. |
| 0.1.0 | 2026-09-23 | **`TASK-0043` (new — batter-replacement end resolution, `§9.5`): Merged.** Implemented `pipeline/EndResolver.kt` (+ `CreaseEnd.opposite()` in `model/WicketDetail.kt`) — all three `§9.5` rules. The crossed-vs-not-crossed distinction needed real reasoning (cross-checked against how batters physically swap ends on any completed run) before it was clear the two branches produce different outputs at all. Verified exactly against `C31`/`C36` and, critically, `§22.8`'s fully worked `EX-09` — traced by hand and matched exactly, the strongest confirmation any `shared/` task has had so far. `C37`/`C38`'s multi-run geometry not fully reconstructed from the case table alone; tested via representative cases instead, stated honestly rather than over-claimed. **Self-review caught a real bug:** the test file used `.opposite()` without importing the extension function; fixed before reporting. |
| 0.1.0 | 2026-09-23 | **`TASK-0022` (Always-zero-runs vs. may-carry-runs dismissal resolution): Merged — scope much smaller than the title implies, built exactly that rather than inventing extra work.** `§9.3` itself attributes the always-zero-runs requirement directly to `V6` (already a hard rejection at validation, `TASK-0017`) and says may-carry-runs modes use "the normal `§7` aggregation and the `§8` short-run adjustment" unchanged — confirmed exactly by `EX-09` (`total=1, ranRuns=1`, verified by calling the real `TASK-0019` aggregator, not hand-constructing the expected value). Implemented `pipeline/WicketRunResolver.kt`'s `assertWicketRunInvariant()` as a named, testable Step-5 checkpoint that documents the invariant and fails loudly if `V6` is ever bypassed, rather than duplicating logic that already exists. `TASK-0021`, `TASK-0043`, and `TASK-0022` together: two of three "named" tasks turned out substantially smaller than titled once `§9`'s actual rules were traced; the third (`TASK-0043`) was the genuinely new, unclaimed scope. `TASK-0023` (batter/bowler state) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0023` (Batter & bowler state update rules, `§10–§11`): Merged.** Implemented `model/{BatterCardLine,BowlerCardLine}.kt` and `pipeline/BatterBowlerStateUpdater.kt` (`updateBatterCardLine`, `updateBowlerCardLine`, `oversBowledDisplay`), composing `classifyLegality()` (`TASK-0018`), `aggregateRuns()` (`TASK-0019`), and `creditsBowler()` (`TASK-0021`) rather than recomputing anything already available. Verified by hand, before writing tests, against every `§22` worked example that reports batter/bowler figures — `EX-01`, `EX-02`, `EX-03`, `EX-05`, `EX-06`, `EX-08` — each traced to its exact stated numbers, not just spot-checked; `commonTest/.../BatterBowlerStateUpdaterTest.kt` reproduces all six plus `EX-07` (confirms `RUN_OUT` never credits the bowler) and `C06`'s all-run-four case (confirms `fours` requires `method = BOUNDARY`, not merely `value = 4` — the one condition in `§10` most likely to be got wrong). **Honest scope decision:** `BatterCardLine.status`/`dismissal` are declared (matching `§10`'s own table) but deliberately not written by `updateBatterCardLine` — setting them correctly needs the full wicket/who-was-dismissed orchestration, which isn't a single pipeline step yet; flagged in the type's own doc comment rather than silently left half-done. `maidens` similarly declared on `BowlerCardLine` but untouched — `§11` itself scopes it to over-completion (`§13.3`), a later task's concern. Same unverifiable-in-this-environment caveat as every `shared/` task since `TASK-0016` (no Kotlin/Gradle/Java toolchain); self-reviewed carefully in its place, cross-checking every field name used against the already-committed `LegalityClassification`/`RunAggregate`/`RunEvent` types before writing any call site. `TASK-0024` is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0024` (Team score & over-completion state rules, `§12–§13`): Merged, with one real ambiguity resolved and one gap flagged.** Implemented `model/{OverState,InningsScoreState}.kt`, `config/PlayingConditionsProfile.kt` (the typed CFG-REG shape `TASK-0016`'s `ReferenceDataPort` doc comment had flagged as "not yet modeled" — scoped to exactly the one key this task needs, `format.balls_per_over`, not the full registry), and `pipeline/InningsOverStateUpdater.kt` (`updateInningsScoreState`, `updateOverState`). **Ambiguity resolved, not glossed over:** `§12`'s `totalRuns` row, read literally, double-counts a batting-side `PENALTY` (already inside `RunAggregate.total` per `§7.2`'s own side-blind formula) while separately saying to add "any PENALTY awarded to the batting side" — resolved by treating the operative instruction as `§12`'s own third sentence: subtract a fielding-side-awarded `PENALTY` back out of `total` before crediting it to `totalRuns`; `extras.penalty` stays unconditional per `§12`'s literal wording (records that a penalty happened, not who it benefited). **Flagged gap, not silently dropped:** a `PENALTY` awarded to the fielding side is correctly excluded from the batting side's `totalRuns` here, but `§7.7` also requires crediting it to the *other* team's own running total — no structure spanning both sides' innings exists yet to receive that credit. Verified by hand against every `§22` example reporting team-score/over-state figures, including the flagship `EX-03`/`EX-04` over-boundary parity pair (`legalBallCount` reaching `ballsPerOver` completes the over identically regardless of how the runs on the final ball arose) plus one self-constructed case (no worked example covers a fielding-side penalty) derived directly from `§7.7`'s text. `previousOverBowlerId`/`BR-027` and next-over bowler selection deliberately left to the orchestration layer — `§4` guardrails are out of scope for every task so far, same reasoning `TASK-0017`'s `V10` was skipped. `TASK-0025` (strike resolution) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0025` (Strike resolution, `netRotates` XOR formula, `§14.2`): Merged, scoped exactly to the formula per the task's own title.** Implemented `pipeline/StrikeResolver.kt` (`resolvesStrikeRotation`, `applyStrikeRotation`/`StrikePositions`). `isOverFinalLegalBall` is deliberately taken as a precomputed `Boolean` rather than re-derived — it's exactly `TASK-0024`'s `OverUpdateResult.isOverComplete` for the same delivery, since §14.2's own definition of "the over's final ball" is identical to how that flag is already computed there; no duplicate logic. `effectiveRanRuns` must come from a `RunAggregate` built off the §8-adjusted `RunEvent` list (`TASK-0020`'s `applyShortRuns()`), the same "adjusted list in" contract already established by `TASK-0022`. **All four XOR truth-table combinations verified against real `§22` examples, not synthetic cases:** `EX-01` (even/not-final → no rotation), `EX-02` (odd/not-final → rotates), `EX-03` (even/final → rotates purely from the end-of-over swap, `ranRuns=0` confirmed since `BOUNDARY` never contributes), `EX-04` (odd/final → the run-swap and end-swap cancel, the case implementers most often get backward), `EX-05` (a wide can never be "the over's final ball" at all, confirmed independent of its own `ranRuns`). **Honest scope decision:** §14.3 (wicket interaction), §14.5 (manual override), §14.6 (mankad, which skips this formula entirely) are orchestration rules about when/how to call this formula and combine it with `TASK-0043`'s `resolveEndPositions()` — not additional computation the formula itself needs, and not implemented here; flagged in the file's own doc comment rather than silently expanded into. `TASK-0026` (innings/match-end evaluation) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0026` (Innings-end and match-end evaluation, `§15`): Merged, with one deliberate scope narrowing flagged.** Implemented `model/InningsEndReason.kt` (`ALL_OUT`/`OVERS_COMPLETE`/`TARGET_REACHED`) and `pipeline/InningsEndEvaluator.kt`'s `evaluateInningsEnd()`, in §15's own fixed priority order (all-out checked first, then overs-complete, then target-reached — first condition met wins, verified by two dedicated priority-order tests where more than one condition is simultaneously true). Takes plain primitives, not a full `InningsState` aggregate, matching this pipeline's established style (`LegalityClassifier` takes a bare `Legality`, not a whole `DeliveryInput`). **Scope narrowing, flagged not silently done:** §2's full `InningsState` shape (`inningsId`, `battingTeamId`, `bowlingTeamId`, `target`, `freeHitPending`, `strikerBatterId`, `nonStrikerBatterId`, `currentBowlerId`, `previousOverBowlerId`) still does not exist as a single assembled type anywhere in this backlog — `InningsScoreState` (`TASK-0024`) only ever carried §12's score-aggregate subset; assembling the real aggregate is orchestration-layer work for a later task, not this pure evaluator's job. §15.4 (declaration/forfeiture) correctly excluded — the spec's own text calls it captain-initiated, not delivery-triggered. Verified against `§22.8`'s `EX-11` (a `RETIRED_NOT_OUT` batter reduces the effective all-out threshold by exactly 1, `MINV-10`) plus the task's own stated Expected Behavior (target reached mid-over ends the innings immediately — tested with `legalBallsBowled` deliberately short of the over's completion). `TASK-0027` (event schemas) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0027` (`EVT-DELIVERY-RECORDED` and related event schemas, `§16`): Merged — a real error in this task's own backlog entry found and corrected, not silently followed.** Implemented `model/MatchEvent.kt` (`DeliveryRecorded`, `NonStrikerRunOut`, `StrikerOverridden`, `PlayingConditionsFrozen`) and `pipeline/EventGenerator.kt` (`deliveryRecordedEvents`, `nonStrikerRunOutEvent`). `DeliveryRecorded` wraps the existing `DeliveryInput` type directly rather than re-declaring its 11 fields — §16.2's own field table lists exactly `DeliveryInput`'s shape as "copied... verbatim." **Error found:** this task's own Expected Behavior field claimed a non-striker run-out "additionally emits `EVT-NON-STRIKER-RUN-OUT` alongside the base delivery event, per §16's stated co-emission rule" — no such rule exists; `§16.3`'s actual text says `EVT-NON-STRIKER-RUN-OUT` is emitted **instead of** `EVT-DELIVERY-RECORDED`, only for the pre-delivery mankad case (§9.6) — a replacement, never an addition; a normal in-play `RUN_OUT` of the non-striker carries its `WicketDetail` inside `EVT-DELIVERY-RECORDED`'s payload like any other wicket and gets no separate event at all. Implemented per §16's actual text; the backlog field itself corrected in place above, with the original wording struck through and dated rather than silently replaced. **Scope split, flagged:** the generic event envelope (`eventId`, `actorRef`, `provenance`, `prevHash`/`hash`, etc.) is deliberately not modeled here — it's `TASK-0028`'s explicit `§17` scope and already exists as `match_events` columns (`TASK-0006`); this task models only each event type's domain-specific payload. **Open edge case flagged, not resolved either way:** §16.5 ties `EVT-PLAYING-CONDITIONS-FROZEN` specifically to the very first `EVT-DELIVERY-RECORDED`, not the match's first event of any kind — if a mankad genuinely happens before any ball is ever bowled, the literal spec text leaves the conditions-frozen event un-emitted until the actual first legal delivery, possibly several deliveries later; noted in `EventGenerator.kt`'s own doc comment. `TASK-0028` (audit record generation) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0028` (Audit record generation per delivery, `§17`): Merged, with a real Acceptance-Criteria mismatch flagged.** Implemented `model/AuditedEvent.kt` (`EventProvenance`, `AuditedEvent`) and `pipeline/AuditEventGenerator.kt`'s `auditEvent()` — the first pipeline function in this backlog to compose `TASK-0016`'s `ClockPort`/`IdPort`, per §1.1's determinism boundary (`eventId` from `IdPort.newId()`, `recordedAt` from `ClockPort.nowEpochMillis()`, never a direct UUID/system-clock call). `AuditedEvent` **is** the "`AuditRecord`" this task's own Files/components field named — §17's own opening line states "every event in §16 is its own audit record," so this is the generic attribution envelope wrapping a `MatchEvent` (`TASK-0027`) that that task's own doc comment explicitly deferred here, not a separate type alongside it. §17's five numbered requirements verified: (1) `actorRef` non-nullable by construction; (2) `provenance` a required constructor argument, never backfilled; (3) `prevHash`/`hash` modeled as required fields but **not computed** — flagged as a real, standing gap, since no canonical `MatchEvent` serialization format exists anywhere in this backlog yet (`EventLogPort`'s own `TASK-0016` doc comment already deferred this); (4) `overrideReason` verified to survive unseparated inside the wrapped event (test asserts it round-trips through `DeliveryInput`/`DeliveryRecorded` unchanged); (5) the same `auditEvent()` function verified to handle a `WIDE` delivery identically to a `LEGAL` one — no per-legality branching. **Mismatch flagged, not silently ignored:** this task's own Acceptance Criteria cites `security-specification.md §11`'s `SR-I01…I04` — read in full, all four are database-grant/scheduled-job/API-authz requirements (append-only grants, admin-audit-log completeness, a scheduled hash-chain verification job, role-gated audit-trail read access), none of which are shared/ Kotlin domain-model concerns at all. `SR-I01` is already satisfied by `TASK-0007`'s grants; `SR-I02`/`I03`/`I04` remain unimplemented anywhere in this backlog — a real gap for whichever future backend/infra task actually owns a scheduled verification job and admin-plane audit wiring, not something this type can satisfy by itself. `TASK-0029` (undo/void-and-refold) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0029` (Undo, void-and-refold, `§18`): Merged — the first orchestration task in this backlog, wiring `TASK-0017`-`0026`'s pure functions into an actual Steps 5-11 fold engine, with real gaps found and fixed during self-review, plus three flagged, deliberately unresolved edge cases.** Implemented `model/InningsFoldState.kt` (`InningsFoldState`, `FoldConfig` — the full per-innings projection aggregate every prior E-09..E-13 task deferred assembling), widened `config/PlayingConditionsProfile.kt` with `freeHitOnNoBall` (needed to fold `§13.4`), added `MatchEvent.DeliveryVoided` to `TASK-0027`'s sealed class (`§18.1` step 2 names this event but, unlike `§16.2-16.5`, never gave it its own field table — modeled minimally per the one field §18.1's text actually specifies), and `pipeline/InningsFolder.kt` (`updateFreeHitPending`, `applyDelivery`, `foldInnings`, `undoLastDelivery`). `undoLastDelivery` is literally `foldInnings` over `deliveries.dropLast(1)` — Undo needs no delivery-type-specific logic at all, per §18.1's own central claim, verified structurally rather than merely asserted. **Bug caught and fixed during self-review, before any test was run against it:** the first draft never reset `OverState` when a new over began mid-fold — `updateOverState()` deliberately never does this itself (the caller's job, per `OverState`'s own doc comment), and the first draft never supplied that caller-side reset, which would have made every over after the first accumulate `legalBallCount` past `ballsPerOver` forever. Fixed by checking `legalBallCount == ballsPerOver` at the start of each `applyDelivery` call and constructing a fresh `OverState` (new `overNumber`, `bowlerId` from the delivery already being processed) before folding that delivery in. **Verified against real `§22` examples across every delivery type the task's own Expected Behavior names:** `EX-01` (dot ball, plus its own Undo claim reproduced exactly), `EX-03`/`EX-04` (the flagship over-boundary parity pair), `EX-08` (caught — undo removes the incoming batter's card line entirely and restores the outgoing batter to `NOT_OUT`), and `EX-12`'s own compound claim (over/strike/score all revert together automatically across an over boundary, with no bespoke "un-complete the over" code) — reproduced structurally via a dedicated test. A general batch-vs-incremental-folding agreement property is also checked across a longer mixed sequence, directly exercising this task's own stated Verification procedure ("refolded state is byte-identical to the pre-delivery state"). **Three edge cases flagged, deliberately not resolved:** (1) the pre-delivery mankad (`§9.6`) is not foldable by `applyDelivery` at all — it has no `DeliveryInput` to fold (`§16.3`'s own text: "minus legality... none apply"), and would need a parallel, differently-shaped fold step not built here; (2) `§14.3` step 3's claim that the end-of-over swap applies "on top of" a wicket-resolved striker/non-striker pairing is implemented per its best-supported literal reading, but no `§22` worked example combines a wicket with the over's final ball to verify it against; (3) Step 1 (validation, `§5`) is deliberately never re-run during a fold — `§18.1`'s own step list names "Steps 5-11" only, and re-validating already-accepted active events is out of this function's scope. `TASK-0030` (correction/supersede-and-refold) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0030` (Correction, supersede-and-refold, incl. innings-end-timing-changed edge case, `§19`): Merged.** Implemented `pipeline/InningsCorrector.kt` (`foldInningsToEnd`, `foldTrace`, `firstStrikeContinuityBreak`, `correctDelivery`), reusing `TASK-0029`'s `applyDelivery` entirely — §19.1 step 4 is explicit that recomputation is "identical mechanism to §18.1 step 3." The genuinely new content: (1) re-validating the corrected payload via `TASK-0017`'s `validateDelivery()` before accepting it (§19.1 step 2, never re-run by Undo's fold) — a deliberately-invalid correction (a `CAUGHT` wicket with non-empty `runEvents`, violating `V6`) is verified to be rejected, not silently applied; (2) `§19.2`'s two innings-end-timing sub-cases, detected by comparing where the corrected fold actually ends (`foldInningsToEnd`, which stops early rather than looping through no-op deliveries) against the corrected delivery list's own length and the original fold's end status; (3) the `§19.1` step 5 cascade summary's strike-continuity check (`firstStrikeContinuityBreak`), comparing full step-by-step fold traces before and after the correction. **`§19.2`'s two sub-cases tested as small, purpose-built scenarios reproducing the exact structural property `§22.12`'s `EX-13` describes** (a correction shifting whether/when the innings ends) rather than transcribing `EX-13`'s own multi-over, dozens-of-deliveries narrative verbatim — flagged as a deliberate scale reduction, not a skipped requirement, since the underlying mechanism (`foldInningsToEnd`'s early-stop plus a length/end-status comparison) is identical either way. Also verified `§19.1` step 4's own central claim directly: correcting an early delivery's run parity (1→2 runs) is shown to flip the re-derived striker not only for that delivery but for a **second, entirely untouched** later delivery — the cascade genuinely propagates forward, not just at the edited point. **Honest scope note:** this function does not itself emit `EVT-DELIVERY-CORRECTED` (`TASK-0027`'s event-schema scope) or enforce `§19.3`'s post-Final elevated-role precondition (an authz/orchestration concern) — it is the deterministic supersede-and-refold computation those concerns wrap around, consistent with every prior task's "pure function, not the full orchestration shell" scoping. `TASK-0031` (conformance runner scaffolding) is now unblocked. |
| 0.1.0 | 2026-09-23 | **`TASK-0031` (Conformance runner scaffolding, `testing-strategy.md §4`): Merged.** Implemented `commonTest/.../conformance/ConformanceCase.kt` (`ConformanceCase`, `ConformanceCaseResult`, `runConformanceCase`, `runConformanceSuite`) and `ConformanceRunnerSmokeTest.kt`. The runner is deliberately thin: a case is one delivery applied to a known pre-state via `TASK-0029`'s `applyDelivery` (already composing every `§5-§15` pipeline stage this suite needs), compared against a known expected post-state by full `InningsFoldState` equality — exactly `§4.1`'s "pure input... plus pre-state in, a fully-computed output across every dimension... out" framing, reusing existing machinery rather than building a second parallel pipeline just for testing. `runConformanceSuite` runs every case (never short-circuiting on the first failure) so one execution reports every failing case at once, matching `§4.3`'s "100% required to release... a hard release gate" framing — a suite needs a result per case, not one pass/fail boolean for the whole run. The smoke fixture reuses `EX-01` (already independently verified in four earlier tasks' own suites) specifically as the trivial case this task's own Verification procedure calls for — **self-review caught and fixed a real bug in the fixture itself before reporting**: the first draft's `expected` state used `genesis.copy(...)` without also overriding `score`, so the fixture's own expected `legalBallsBowled` would have stayed at the genesis default (0) instead of the actual post-delivery value (1), which would have failed the smoke test for a fixture-construction reason, not a runner defect — fixed by explicitly copying `score` too. **Honest environment note, impossible to avoid:** no Java/Kotlin/Gradle toolchain exists anywhere in this session, so this cannot actually be *executed* on any target, let alone the two this task's Verification procedure names — cross-platform parity is satisfied *by construction* instead (the runner and its fixture use only `commonTest`/`commonMain` declarations, no `expect`/`actual`, nothing platform-specific), the same caveat carried by every `shared/` task since `TASK-0016`. **Scope note for `TASK-0032`:** full-state equality fits the `EX-*` worked examples cleanly but some `C*` cases are narrower (e.g. a bare legality-classification check with no full innings context) and may need an adapted comparison shape — flagged, not pre-solved here. `TASK-0032` (load `C01…C55` + `EX-01…13` as fixture files) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0032` (Load `C01…C55` + `EX-01…13` as fixture files, `§21-§22`): Merged — 68/68 fixtures, plus a real regression found and fixed in already-committed `TASK-0029` code.** Implemented `specs/conformance/{README.md, C01…C55, EX-01…EX-13}.json` (68 files, verified by count and by parsing every one with `node -e "JSON.parse(...)"`) and `shared/src/commonTest/.../conformance/{FixtureSchema.kt, FixtureSchemaTest.kt}`. Three fixture kinds, not one rigid shape — flagged and designed deliberately, not discovered as a problem partway through: `worked_example` (`EX-*`, full `InningsFoldState` equality, reusing `TASK-0029`'s `applyDelivery`), `delivery_outcome` (most `C01…C49`, a narrow `expected` object containing only the fields each row's own table column set actually specifies — never fabricated context), and `rejection` (`C50…C55`, checked via `TASK-0017`'s `validateDelivery()`). `C47` (filed under `§21.8` but itself a `V5` rejection) modeled with `kind=rejection` for semantic consistency rather than forced into `delivery_outcome`. **Real regression found and fixed, not merely a fixture bug:** transcribing `EX-03` exposed that `TASK-0029`'s `InningsFolder.applyDelivery()` deferred the over-completion reset (`overNumber += 1`, fresh `legalBallCount`/`runsThisOver`/`isMaidenSoFar`) to the *start of the next delivery*, but `§13.1`'s own text is explicit that "a fresh `OverState` begins" **immediately**, as part of the completing delivery's own processing — confirmed by both `§13.1`'s literal wording and `EX-03`'s own worked-example text ("legalBallCount → 6 = ballsPerOver ⇒ over complete... fresh OverState begins"). Fixed in `InningsFolder.kt`: the reset now happens the instant `overResult.isOverComplete` is true, with `bowlerId` carried forward as a placeholder (purely descriptive, feeds no computation in this file) until the scorer confirms the next over's bowler via a separate, out-of-scope action. **Cascading fix applied, not left inconsistent:** `InningsFolderTest.kt`'s `ex03_boundary_six_completes_over_and_rotates_strike`, `ex04_single_on_final_ball_cancels_to_no_rotation`, and `ex12_undo_across_an_over_boundary_reverts_everything_together` all asserted the old (buggy) `legalBallCount = 6` immediately post-completion; corrected to `legalBallCount = 0` with an inline citation of why. `InningsCorrectorTest.kt` and `ConformanceRunnerSmokeTest.kt` checked and confirmed unaffected (neither exercises an over-completing delivery). `EX-10` (mankad), `EX-11` (retired hurt), `C28` (standalone penalty), `C42…C44` (mankad/timed-out/retired-out, all standalone events) marked `"executable": false` with a `"blockedBy"` note rather than forced through `applyDelivery()`, which cannot fold non-`DeliveryInput` events (a gap `TASK-0029` already flagged, now enumerated concretely by section). `EX-13` similarly flagged — its dozens-of-deliveries multi-over narrative isn't a practical literal fixture; cross-referenced to `TASK-0030`'s own small-scale structural reproduction instead. **Honest scope note carried forward from `TASK-0031`:** the JSON loader itself remains designed, not wired — no `kotlinx-serialization-json` dependency exists (no Gradle build exists for `shared/` at all). `FixtureSchema.kt`'s `check*` functions are real, complete logic that composes the existing pipeline functions correctly and would need no changes once a loader exists; `FixtureSchemaTest.kt` proves this by hand-constructing objects matching six representative fixtures (`C01/C02/C05/C13/C16/C31/C36/C50`) and confirming both that they pass and that a deliberately-wrong expectation is actually caught (not vacuously green). `TASK-0033` (local event-log durability) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0033` (Local event-log durability, write-ahead, crash recovery, `offline-first-specification.md §3`): Merged, with a deliberate, user-confirmed scope reduction — the first task in this backlog to hit a toolchain gap categorically larger than "not yet installed."** This task's own Files/components field named `apps/android/src/main/kotlin/persistence/` and `apps/web/src/persistence/` — neither `apps/android` nor `apps/web` exists anywhere in this repository, and this environment has no Android SDK, no Gradle, and no browser runtime to build or verify either against, even in principle (unlike `TASK-0042`'s `backend/` bootstrap, which only needed `npm`, genuinely present here). Flagged explicitly and put to the user with three options before proceeding; **confirmed: contract-only, `commonMain`/`commonTest`**, deferring the real Android `SQLite`/`PowerSync` and Web `IndexedDB`/`PowerSync` adapters to a follow-up task once those app projects are actually bootstrapped. Implemented `persistence/DurableEventLogWriter.kt` (`isValidNextDeviceSeq`, `DurableEventLogWriter.commit()` — wraps `TASK-0016`'s `EventLogPort` with `§3.3`'s write-ordering invariant, throwing on an out-of-sequence `device_seq` as the "defect, not silently renumbered" §3.3 itself specifies) and `persistence/RecoveryLoader.kt` (`recoverInningsState()` — composes `EventLogPort.readAll()` with `TASK-0029`'s `foldInnings()`, exactly the mechanism `§3.4` itself cites as "restated precisely from `live-scoring.md §18.1`"). **Honest scope note on `§3.1`'s other half** ("the UI confirms only after the durable write completes"): enforced by Kotlin's own `suspend` semantics at the call site, not something `DurableEventLogWriter` can add on top structurally — documented as a calling-convention contract, not claimed as independently enforced. Verified via `commonTest/.../persistence/{InMemoryEventLogPort.kt, DurableEventLogWriterTest.kt}` — a test double backed by an external `MutableList`, where constructing a *second* instance against the *same* backing list simulates a process crash-and-restart; a committed event is confirmed to survive exactly that simulation (the durability property, without a real SQLite/IndexedDB adapter to test against), plus device_seq monotonicity (sequential/gap/reuse cases, and independent per-stream tracking for the dual-scorer case) and a recovery-fold test reusing `EX-01`/`EX-02`'s own figures. **New dependency flagged, not silently assumed:** these are the first tests in this backlog to call `suspend` functions, requiring `kotlinx-coroutines-test`'s `runTest` — not wired to any real Gradle build, same unexecuted status as everything else in `shared/` since `TASK-0016`, now with one more named missing dependency alongside the already-flagged `kotlinx-serialization-json`. `TASK-0034` (offline command execution model) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0034` (Offline command execution model, local apply, event enqueue, `offline-first-specification.md §4`): Merged.** Implemented `sync/OutboxState.kt` (`OutboxState`, `recordCommit`, `acknowledge`) and `sync/OfflineCommandExecutor.kt` (`executeOfflineDeliveryCommand`). The outbox is modeled as a **pure derivation**, not a separately-mutated store — `§6.1`'s own text: "not a separate, independently-writable store... 'committed' and 'queued for sync' can never diverge" — `OutboxState.pending()` computes directly from `committedEventIdsInOrder` minus `acknowledgedEventIds`, structurally ruling out the divergence `§6.1` warns against, rather than relying on two separate mutations staying in sync by convention. `executeOfflineDeliveryCommand` composes `TASK-0029`'s `applyDelivery` (local projection, pure) + `TASK-0033`'s `DurableEventLogWriter.commit` (durable persistence) + `recordCommit` (outbox) as one function — `§4.2`'s "offline commands execute immediately, fully, against local state... only the transmission... is queued" made structurally checkable: the function's own signature has no network port reachable from it at all, so `FA-15` ("the network is never on this path") holds by construction, not merely by test assertion. **Scope boundary, deliberate:** `§6.2`'s full "what is queued" list (every `§16` event type, publish/notify intents with their own idempotency key) and `§6.5`'s backpressure/chunking policy are not modeled — this task's own Requirement IDs are `§4` only, and `TASK-0035` (Push protocol) is the task that actually consumes and extends this outbox against a real transport, per its own Inputs field ("the local outbox from `TASK-0034`"). Verified via `OfflineCommandExecutorTest.kt`: a 4-delivery "airplane mode, full innings" sequence (deliberately all-even-run values, so no strike rotation fires and every figure stays attributable to one batter — keeping the test focused on execution composition, not re-exercising `TASK-0025`'s already-tested rotation logic) updates local state correctly and enqueues every event; acknowledgment removes an item from `pending()` while leaving the append-only durable log completely untouched (`§3.2`/`§6.4`, two distinct concerns); FIFO commit ordering (`§6.3`) checked directly. **Self-review caught and fixed a real bug in the test itself before reporting:** the first draft used a mixed-parity delivery sequence (`0, 1, 4, 0`) and asserted all figures against batter "A," not accounting for the single (odd run) triggering strike rotation and moving credit to "B" for the remaining two deliveries — corrected to an all-even sequence so the assertions are actually true, rather than silently landing on an assertion that happened to look plausible without being hand-traced. `TASK-0035` (push protocol) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0035` (Push protocol, ordering, idempotency key, `offline-first-specification.md §7.1, §9`): Merged, split cleanly across the client/server boundary — the server half genuinely executed, unlike almost everything else in this backlog.** Client side: `shared/src/commonMain/kotlin/.../sync/PushBatcher.kt` (`formPushBatch` — FIFO batch formation from `TASK-0034`'s `OutboxState.pending()`, capped at `§7.1`'s own `[DEFAULT]` 200; `applyPushOutcomes` — advances the outbox exactly as far as the **contiguous prefix** of `ACCEPTED` outcomes, verified with a dedicated test proving an `ACCEPTED` item *after* a `REJECTED` one in the same batch is correctly left pending, not acknowledged just because the server happened to accept it individually). Server side: `backend/src/sync/ingestPushBatch.ts` (`ingestPushBatch`, `InMemoryMatchEventStore`) — device_seq contiguity and hash-chain continuity checks, plus `§9.1`'s idempotency rule (re-submitting an already-accepted `event_id` is a no-op returning the identical outcome, never a duplicate row). **Genuinely executed, not hand-traced:** `npm install` (0 vulnerabilities), `npx tsc --noEmit` (clean), `npx vitest run` — **16/16 passed** (8 pre-existing from `TASK-0014` + 8 new), including this task's own literal stated Expected Behavior verified directly: "pushing the same `event_id` twice... results in exactly one stored event, not two." **A real cross-task inconsistency found and resolved, not silently left standing:** `TASK-0033`'s Kotlin-side `isValidNextDeviceSeq` deliberately accepted any starting value for a stream's first write (tracking only per-session local state, with no stated starting convention in `§3.3`); the server, checking genuinely shared cross-device history, needs an actual convention for the check to mean anything — this task picks `device_seq = 0` as that convention and documents it as resolving the open question, not contradicting `TASK-0033` silently. **Honest scope note:** `§7.1` step 3 names four checks (schema, `SVC-AUTHORIZER` role check, `device_seq`/hash-chain continuity, full domain re-validation); only the sequence/hash-chain checks are implemented here — `SVC-AUTHORIZER` is `TASK-0014`'s already-built `authorize()`, and full domain re-validation is `DeliveryValidator.kt` (Kotlin, `shared/`), unreachable from this TypeScript module without cross-language FFI this backlog has never set up; a real command handler composes all three, not duplicated into one module. `database/supabase/functions/sync-events/` (the actual Edge Function deployment) remains unbuilt — no Supabase environment exists anywhere in this session to deploy or test one against; the logic in `ingestPushBatch.ts` is written so that wrapping it in a thin Edge Function entrypoint is the only remaining step once one exists. `TASK-0036` (pull protocol & cursor management) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0036` (Pull protocol & cursor management, `offline-first-specification.md §7.3`, `data-specification.md §9.1`): Merged, with a wrong citation in this task's own Requirement IDs field found and corrected, and the same client/server split as `TASK-0035` — the server half genuinely executed again.** **Citation error:** this task's own Requirement IDs field names "§7.2" for "the pull half" — §7.2 is actually "Acknowledgment semantics," a push-side concern; §7.3, "Pull (download)," is the real, authoritative source, used instead and noted in `pullEvents.ts`'s own doc comment rather than silently followed. Client side: `sync/PullCursor.kt` (`PullCursor`, `advancePullCursor` — `§3.2`'s "advances monotonically; never rewound," verified directly) and `sync/PullApplier.kt` (`applyPulledEvents` — `§7.3` step 4: applies idempotently, `§9.4`; advances the cursor past **every** pulled event, whether newly applied or an already-seen duplicate, since skipping the cursor for a duplicate would make it get re-pulled forever — a subtlety verified with its own dedicated test, not left implicit). Server side: `backend/src/sync/pullEvents.ts` (`pullEvents`) plus extending `TASK-0035`'s already-committed `InMemoryMatchEventStore` with server-assigned `event_ordinal` (assigned at insert time, never client-supplied — unlike `device_seq` — matching `system-architecture.md`'s HLC-based canonical ordering) rather than building a second, parallel store. **Genuinely executed again:** `npx tsc --noEmit` clean, `npx vitest run` — **22/22 passed** (16 pre-existing + 6 new), including this task's own literal Expected Behavior verified directly: reconnecting after a simulated "arbitrary offline duration" (more events land server-side between two separate pull calls) resumes from exactly the stored cursor with no gaps and no duplicates, checked by taking the union of both pulls' event ids and confirming the set size matches the count exactly. **Honest scope note carried forward from `TASK-0033`/`TASK-0028`:** `PullCursor.lastPulledEventOrdinal` is a `Double`, not the SQL column's exact `numeric(20,10)` — the same flagged precision simplification already made for `AuditedEvent.eventOrdinal`; sufficient for this task's ordering/monotonicity logic, a real gap only once an arbitrary-precision decimal type is actually chosen. `sync_cursors` itself (`data-specification.md §9.1`) is confirmed device-local-only per its own "Sync model" note ("never itself synchronized to the server as domain data") — consistent with `TASK-0012`'s own decision not to create a server-side table for it. `TASK-0037` (writer-fence enforcement, P1 single-writer) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0037` (Writer-fence enforcement, P1 single-writer, `offline-first-specification.md §10-§11`): Merged — the third consecutive E-17/E-18 task with a genuinely executed backend half.** Server side: `backend/src/sync/writerFence.ts` (`checkWriterFence`, `InMemoryWriterFenceStore`, `ingestPushBatchWithFenceCheck`). `§10.1`'s own text distinguishes this from the per-event device_seq/hash-chain checks (`TASK-0035`) in a way worth getting exactly right: a fence mismatch is "a terminal rejection for the **entire remaining batch**," not one bad event among otherwise-fine ones — `ingestPushBatchWithFenceCheck` checks the fence *first*, and on mismatch returns `STALE_FENCE` for every event in the batch without any of them reaching `TASK-0035`'s per-event validation or the store at all, verified directly (all three events in a three-event batch rejected, zero inserted). Client side: `sync/WriterFenceConflict.kt` (`FenceConflictResolution` — an enum, not a boolean or open string, so there is no way to construct a third value, matching `§11.1`'s own "no third, automatic option exists"; `FenceCache`/`takeOverFence` — the local bookkeeping half of "take over") and `OutboxState.kt` extended with `abandonedEventIds`/`discardLocally()` (`§11.1` option 2 — a trailing field with a default, safe to add without touching any of `TASK-0034`/`0035`/`0036`'s existing `OutboxState()` call sites, verified that a discarded event leaves `pending()` while its record stays in `committedEventIdsInOrder` forever, per `MINV-01` extending to local storage). **Genuinely executed again:** `npx tsc --noEmit` clean, `npx vitest run` — **28/28 passed** (22 pre-existing + 6 new). **Scope decision, flagged rather than silently omitted:** this task's own Files/components names a `database/supabase/migrations/` fence-check function; not built — the actual enforcement point `§7.1` step 3 describes ("the server validates... and returns a per-event outcome") is the application-ingest layer, the same layer `TASK-0035`'s device_seq/hash-chain checks already live in, not a raw SQL trigger; a redundant DB-level check would be defense-in-depth worth having eventually but would join the SQL pile that's never been executable in this session regardless, so it wasn't built speculatively here. The actual lease acquisition/renewal handshake (`§7.6`) — talking to the server to obtain a *new* fence value in the first place — is also out of scope; `takeOverFence` only records the local consequence once a new value is already known. `TASK-0038` (value-level divergence detection & human-surfacing hook) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0038` (Value-level divergence detection & human-surfacing hook, `offline-first-specification.md §10.2`, `data-specification.md §8.5`): Merged — the first E-17/E-18 task with no `shared/commonMain` half at all, entirely `backend/`, and fully genuinely executed end to end.** Implemented `backend/src/sync/divergenceDetector.ts` (`detectDivergences`, `detectAndRecordDivergences`, `InMemoryDivergenceStore`). `§10.2`'s own text is explicit this is server-only — "each stream's writer never sees the other's data while composing it... inherently a post-hoc detection, not an ingest-time one" — and `§8.5`'s own "Sync model" note confirms `divergences` rows are "server-computed... not itself pushed by a client," so unlike every prior sync task there is genuinely nothing for a client-side Kotlin type to do here. `detectDivergences` compares two independent streams' per-`over.ball` field values, producing one `DivergenceRecord` (`OPEN`, both `valueA`/`valueB` retained verbatim, matching `§8.5`'s schema field-for-field) per mismatched field — only at positions **both** streams have reached (an `over.ball` only one stream has recorded is not yet comparable, not treated as a divergence). `detectAndRecordDivergences` wraps it with a duplicate-prevention check against `DivergenceStore.hasUnresolved()`, since `§10.2`'s alignment pass "runs once both streams have reached a common point in a completed sync cycle" — i.e. potentially on every cycle, not once ever — verified directly that re-running the pass against an unchanged, still-open divergence produces zero new rows, matching this task's own Verification procedure ("produces exactly one `divergences` row"). A minimal structural `deepEqual` handles object-valued fields (e.g. a wicket detail), not just primitives — verified with both a genuinely-differing and an identical structured value, confirming neither false negatives nor false positives. **Genuinely executed end to end:** `npx tsc --noEmit` clean (also catching a real syntax slip in a hand-written test — a missing `() => ` arrow — before it ever ran), `npx vitest run` — **36/36 passed** (28 pre-existing + 8 new). **Scope note carried forward from `TASK-0037`:** the `database/supabase/migrations/` half (extending `TASK-0012`'s `divergences` table if needed) is not built here, same "SQL stays unexecutable regardless" reasoning; the table's schema was already fully specified by `TASK-0012`'s own dependency chain per `data-specification.md §8.5`, so this task's job was the detection *logic*, not a schema change. `UX-25`'s actual resolution UI (propose/confirm, `§11.2`) is explicitly out of scope per this task's own Expected Behavior — `DivergenceRecord[]`'s shape is written to be directly consumable by that hook once it exists, not a placeholder needing rework. `TASK-0039` (API: `POST /matches`) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0039` (API: `matches` generic CRUD create, `api-specification.md §4/§5/§10`, `data-specification.md §5.1`): Merged — the first task in the "Worked vertical slice" section (`§5`), with three real corrections to this task's own backlog entry found and fixed, more than any single task so far.** Implemented `backend/src/commands/matches.ts` (`createMatch`, `validateMatchSchema`, `validateMatchBusinessRules`, `InMemoryMatchStore`) and extended `backend/src/authz/errors.ts` with `schemaValidationError`/`businessRuleValidationError`/`staleVersionError` (exporting `ERROR_BASE_URI` so every error constructor shares one source, not duplicated per module). **Correction 1:** the task's own title/Files field says `POST /matches`; `§10.1` states outright "there is no server-assigning `POST /{resource}` for any table in this section" — every resource uses `PUT /{resource}/{id}`, client-supplied id, independently confirmed by `data-specification.md §5.1`'s own note that `matches.id` is "Client-generated — a match is always created offline-first." Implemented as the create half of `PUT` semantics; an update (existing id, `row_version` check) is a natural extension not built here — this task's own Goal is the create case only. **Correction 2:** Context needed cited "§9 (validation layers, error registry)" — §9 is "Versioning"; the real sections are `§4` (Validation, the three-layer model: schema/business-rule/state-dependent) and `§5` (Error codes). **Correction 3, inside the task's own Expected Behavior:** claimed a missing required field returns `422` — per `§4.1`'s own table, field presence/type/format is the **schema** layer (`400`), not business-rule (`422`); `422` is reserved for a well-formed payload violating a domain rule, exercised here by the table's own `CK` constraint (`home_team_id <> away_team_id`). All three corrected in place in the backlog entry itself (struck through, dated), and enforced distinctly in the implementation — verified with dedicated tests for each: a missing field → `400 validation/schema`; an invalid `format` enum value → `400`; `home_team_id = away_team_id` → `422 validation/business-rule`; a duplicate id → rejected, original row provably untouched. **Genuinely executed:** `npx tsc --noEmit` clean, `npx vitest run` — **44/44 passed** (36 pre-existing + 8 new). Removed `backend/src/commands/.gitkeep` (superseded) — its own note described `§11`'s command-endpoints narrowly, but `repository-structure.md §7`'s own table maps all of `api-specification.md` (§10's generic CRUD included) to `backend/src/commands/`, confirming this is the right location, not a scope mismatch. **Honest scope notes:** `database/supabase/functions/` (the thin Edge Function entrypoint) is not built — no Supabase environment exists to deploy or test one against, same standing gap; the `matches` update path, `home_xi`/`away_xi`/`toss_*`/`conditions_profile*`'s write-once-then-lock enforcement (`§10.2`'s own Matches row), and `SVC-AUTHORIZER`'s actual call-site wiring (composed by whichever real command handler exists, `authorize()` already built in `TASK-0014`) are all real, flagged gaps for follow-on work, not silently assumed done. `TASK-0040` (Web: `UX-04 Create Match` screen) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0040` (Web: `UX-04 Create Match` screen, `ux-specification.md UX-04`): Merged — the first task requiring a real `apps/` bootstrap, put to the user with options before proceeding (recommended and confirmed: bootstrap `apps/web/` for real, stub the still-unbuildable shared Kotlin core); also a real contradiction found between this task's own Expected Behavior and UX-04's actual Inputs.** Bootstrapped `apps/web/` for real per `technology-stack.md ADR-T02` (React + TypeScript + Vite SPA/PWA, Vitest + React Testing Library) — `package.json`, `tsconfig.json`, `vite.config.ts`, a `jsdom` test environment. `npm install` needed one real fix: `vitest ^5.0.1` (matching `backend/`'s already-fixed version, `TASK-0042`) requires `vite ^6.4.0 || ^7.0.0 || ^8.0.0`; the initial `vite ^5.4.8` pin was an `ERESOLVE` conflict, bumped to `^7.0.0`, then installed clean at 0 vulnerabilities. **A second, genuinely environment-specific issue found and fixed:** the default vitest `forks` pool failed to spawn worker processes here ("Timeout waiting for worker to respond") — `backend/`'s vitest never hit this (no `jsdom`/browser environment there) — fixed by pinning `pool: "threads"` in `vite.config.ts`, re-verified via the real `npm test` script, not just a one-off manual flag. **Contradiction found:** this task's own Expected Behavior says "submitting the form offline creates the match" (implying a call to `TASK-0039`'s `createMatch()`), but `UX-04`'s own Inputs are `matchLabel`/ownership-toggle/template/format ONLY — it does not collect `home_team_id`/`away_team_id`/`match_timezone`, all `NOT NULL` on the `matches` table (team selection is `UX-06`, timezone is `UX-05`, both later screens in the `UX-04→09` flow). Implemented `createMatchForm.ts`'s `continueFromCreateMatch()` to produce a local `DraftMatch` (client-generated id, matching `matches.id`'s own offline-first contract) instead of fabricating values this screen never has — flagged as a genuine, open integration question for whichever task actually assembles the full multi-screen creation flow into one `PUT` call, not silently resolved by guessing. Logic (`createMatchForm.ts`: `canContinue`, `templateOrganizationMismatch`, `resolveTemplateListState` unifying UX-04's States/Error-handling/Empty-states text into one pure function) kept separate from the React component (`CreateMatchScreen.tsx`) so it's directly unit-testable without rendering, matching this session's established discipline. **Genuinely executed — the first real browser-environment test run in this backlog:** `npx tsc --noEmit` clean, `npm test` — **18/18 passed** (10 pure-logic + 8 component/RTL, covering every `UX-04` Accessibility requirement named: disabled-Continue reason exposed via `aria-describedby`, format selection announced via `role="status"`/`aria-live`, grouped radio semantics via `fieldset`/`legend`). **Honest scope note:** the shared Kotlin core's compiled JS bundle does not exist (no Kotlin/Gradle toolchain, as flagged since `TASK-0016`) — `src/core/sharedCoreStub.ts` re-declares just the one port shape (`IdPort`) this screen needs, with the real bundle's eventual method signatures, so swapping it out later is a substitution, not a redesign; Radix/Tailwind styling (`ADR-T02`) is not applied — this task scoped to structure/semantics/behavior, a design pass is separate work. `TASK-0041` (Android: `UX-04 Create Match` screen) is now unblocked. |
| 0.1.0 | 2026-09-24 | **`TASK-0041` (Android: `UX-04 Create Match` screen, `ux-specification.md UX-04`): Merged — the last explicitly-numbered task in this entire backlog; `§6`'s generation rule takes over for everything from here.** Put to the user with options before proceeding, same as `TASK-0040`'s web-bootstrap decision point, but with a materially different environment this time: no Android SDK, Gradle, or any package manager exists in this session that could install one at all (unlike the web case, where `npm install` genuinely worked) — confirmed via `which gradle`/`which android`/`which sdkmanager` and empty `ANDROID_HOME`/`ANDROID_SDK_ROOT`. **Confirmed: contract-only, plain Kotlin** — no fabricated `apps/android/` Gradle project. Implemented `shared/src/commonMain/kotlin/.../ui/screens/ux04creatematch/CreateMatchForm.kt`, ported field-for-field from `TASK-0040`'s `createMatchForm.ts`, deliberately placed in `shared/src/commonMain` rather than the task's own literal `apps/android/...` path — this logic touches no Android API surface at all (pure form state/validation), which is exactly what Kotlin Multiplatform exists for: a real Android screen could import this file completely unchanged once a Gradle project exists, a substitution rather than a rewrite, unlike the web side which genuinely needed its own separate TypeScript port (no compiled Kotlin/JS bundle exists). **Cross-platform parity (`C-7`) verified by direct mirroring, not independent re-derivation:** `commonTest/.../CreateMatchFormTest.kt` reproduces every one of `TASK-0040`'s own TypeScript test cases input-for-input, expected-output-for-expected-output — the same fixtures on both sides, so a genuine parity gap between the two implementations would surface as one side's test failing while the other's passes. **Self-review caught a real risk before finalizing, consistent with this task's own "no compiler exists" discipline:** the first draft of `templateOrganizationMismatch()` used an early-return `is Ownership.Guest` check and then relied on Kotlin narrowing the remaining code's type to the sealed class's only other subtype (`Organization`) — correct Kotlin behavior almost certainly, but with zero compiler available to confirm it, rewritten to the same explicit, exhaustive `when` pattern `continueFromCreateMatch()` already used safely, removing the reliance on unverified smart-cast behavior entirely. **Honest scope note:** styling/Compose UI, actual Android accessibility-service wiring, and the real Gradle/SDK integration are all out of reach in this environment and not built — this task delivers exactly the parity-critical logic layer, nothing claimed beyond it. **Milestone: every task `TASK-0001`-`TASK-0041` (plus mid-stream `TASK-0042`/`0043`) is now merged** — the entire epic-decomposed backlog (`§3`/`§4`) and the worked vertical slice (`§5`) are complete. Continuing further means minting new tasks per `§6`'s own generation rule: `§6.1` for the remaining generic-CRUD/command endpoints (one task per resource-operation pair, `TASK-0039`'s template), `§6.2` for the remaining 27 UX screens (one task per screen per platform, `TASK-0040`/`0041`'s pattern), `§6.3` for V1/V2/Future scope (not yet decomposable per `FA-8`/`FA-14` until `SPK-01`/`SPK-04` resolve). No task is "now unblocked" in the old sense — the next step is a Plan-stage decision (`ITQ-1`, already an open item: build order for continuing past the vertical slice), not a pre-named task. |
| 0.1.0 | 2026-09-24 | **`TASK-0044` minted** — "API: `matches` update (`PUT /matches/{id}`, existing id)," the first task generated by `§6.1`'s own rule, added directly after that rule's text. Also corrected `§6.1`'s own generation-rule text, which cited "§9-§10" for the validation/response contract — the identical citation error `TASK-0039` had already found and fixed in its own field text (§9 is "Versioning"; the real sections are §4/§5). |
| 0.1.0 | 2026-09-24 | **`TASK-0044` (API: `matches` update, `PUT /matches/{id}`, `api-specification.md §4/§5/§10.1`): Merged.** Extended `backend/src/commands/matches.ts` with `updateMatch()`, `UpdateMatchPayload`, `validateFrozenFields()`, and `MatchStore.update()` (a distinct method from `insert`, even though the in-memory test adapter implements both identically — a real DB adapter uses a different statement, and the interface stays honest about intent). Extended `backend/src/authz/errors.ts` with `notFoundError` (`§5.2`'s `not-found`, 404 — deliberately identical detail text whether a resource truly doesn't exist or RLS merely hides it, per the registry's own anti-enumeration note). **The first task in this backlog to genuinely exercise `§4.1`'s third validation layer:** state-dependent/`409` — a stale `row_version` is rejected with the stored row *provably* untouched (verified by re-reading the store after the rejected call, not merely checking the response), completing coverage of all three `§4.1` layers (`400`/`422`/`409`) across the two `matches` tasks together. **A genuine, flagged approximation, not silently assumed exact:** `§10.2`'s Matches row says `home_xi`/`away_xi`/`conditions_profile*` are "frozen at first ball" — this generic CRUD layer has no visibility into `match_events` (whether a first ball has actually been recorded), so `validateFrozenFields()` instead locks each field once it is first non-null, rejecting any subsequent change to a genuinely different value (`toss_*` excluded entirely — that's `CMD-RECORD-TOSS`, `§11`, not this endpoint). Stricter than the real rule in one respect (blocks a legitimate pre-first-ball correction to an already-set field) but never permits what `§10.2` actually forbids — flagged explicitly as an approximation pending a real first-ball signal, not claimed equivalent to the spec's literal rule. Partial-update semantics implemented throughout (`undefined` in the payload means "leave unchanged," verified with a dedicated test touching only one field); the `home_team_id <> away_team_id` `CK` is re-checked against the *resulting* pair after a partial update, not just the payload's own two fields in isolation, catching the case where changing only one side conflicts with the other's still-unchanged value. **Genuinely executed:** `npx tsc --noEmit` clean, `npx vitest run` — **53/53 passed** (44 pre-existing + 9 new). `TASK-0045`+ remain to be minted per `§6`'s own rule as the user directs. |
