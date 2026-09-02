# Cricket Scoring Book — System Architecture

| | |
|---|---|
| **Document** | System Architecture |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-02 |
| **Upstream** | `docs/foundation/product-foundation.md` v0.1.0 · `docs/discovery/product-discovery.md` v0.1.0 · `docs/specs/software-requirements-specification.md` v0.1.0 · `docs/domain/domain-model.md` v0.1.0 · `docs/specs/cricket-rules-reference.md` v0.1.0 · `docs/domain/glossary.md` v0.1.0 |
| **Downstream** | `docs/architecture/*` (component specs) · implementation backlog |
| **Status** | Architecture and design only. **No production code.** Schema sketches, API surface lists, event catalogues and flow descriptions are design artefacts, not implementations. |

> This document defines the target architecture for the **Cricket Scoring Book** Web App (installable PWA) and Android App with a managed cloud backend. It applies the project's **4 Layers** (Product → Domain → System → Implementation) and defines every area named in the brief: frontend, Android, backend, database, offline storage, sync, authentication, authorization, API, event, audit, observability, backup/recovery, and security boundaries. It is traceable to the SRS (`FR-/DR-/BR-/NFR-/SEC-/OFF-/SYNC-/AUD-`), the foundation objectives (`OBJ-01…11`), and the blocking spikes (`SPK-01…06`).

---

## 0. Reading guide

### 0.1 The 4 Layers

| Layer | Question it answers | This document |
|---|---|---|
| **1. Product Layer** | *Why does the architecture look like this?* Quality attributes, constraints, context, the forces the design must resolve. | §1 |
| **2. Domain Layer** | *What is the software about?* Bounded contexts, the event-sourced match aggregate, domain events/commands/projections, invariants the architecture must preserve. | §2 |
| **3. System Layer** | *How is it structured to run?* Logical components, deployment topology, the 14 named architecture areas, runtime flows, scaling and failure models. | §3 |
| **4. Implementation Layer** | *With what?* Concrete technology selections per component, schema and API sketches, event governance, observability stack, CI/CD, test strategy. | §4 |

Cross-cutting sections: §5 characteristic traceability, §6 consolidated definitions of the 14 required areas, §7 spike impact, §8 ADR log, §9 open questions, §10 change log.

### 0.2 Notation

- **C4-style levels:** §1.5 is a *context* diagram (system + actors + external systems); §3.1 is a *container* diagram (deployable/runnable units); §3.2–§3.15 drill into components.
- Diagrams are ASCII or mermaid; they are illustrative, not normative — the prose is normative.
- `AGG-*`, `ENT-*`, `EVT-*`, `CMD-*`, `SVC-*`, `MINV-*`, `MBR-*` refer to `docs/domain/domain-model.md`. `INV-*`, `<AREA>-NNN` refer to `docs/specs/cricket-rules-reference.md`.
- **RFC-2119** keywords (**MUST** / **SHOULD** / **MAY**) carry their usual meaning for normative statements.

### 0.3 One-paragraph summary

The match **is an append-only stream of domain events** captured on the scorer's device. Every scoring action is a local, durable transaction against a local event log; a **shared, deterministic scoring core** (identical on Web and Android) validates commands and folds events into projections (scorecard, cards, DLS ladder, …). Connectivity is never on the critical path: a **background sync engine** ships events to a **managed Postgres backend (Supabase)** where **row-level security** is the authorization boundary, events are **re-validated, hash-chained and stored immutably**, and server-side projections feed **read-only viewers, competitions and profiles**. Merge is **deterministic** (per-device sequence + hybrid logical clock + dense timeline ordinal); conflicts are **surfaced, never silently resolved**. The event log doubles as the **audit trail** and the **recovery source of truth** — any projection can be dropped and rebuilt.

---

## 1. Product Layer

### 1.1 What the architecture must do

Deliver an **official-standard, offline-first cricket scoring book** on Web and Android such that one scorer can set up, score, correct, reconcile and sign off a complete limited-overs match **with zero connectivity**, produce a reconciling scorecard, and — when a network is available — sync deterministically with other devices, publish to read-only viewers, and feed competitions and player records. The architecture's job is to make the nine required characteristics *structural properties*, not features bolted on later.

### 1.2 Architecture drivers — the nine characteristics as forces

| Characteristic | The force it exerts on the design | Primary architectural response |
|---|---|---|
| **Offline** | No network on the scoring hot path, ever (`OBJ-02`, `NFR-012`, `OFF-*`). | Local-first event log is authoritative for an in-progress match; sync is an asynchronous background reconciliation; app shell + reference data are cached. |
| **Online** | When connected: real-time viewers, cross-device continuation, competition/profile computation, exports, notifications. | A managed backend that is an *eventual destination*, not a dependency; realtime fan-out channel; server-side projections. |
| **Reliable** | Zero ball-events lost across crash / kill / battery-pull (`NFR-009…011`, `SPK-03`); backend degradation must not block scoring (`NFR-014`). | Write-ahead durability before UI confirm; crash-recovery by replay; idempotent, resumable sync; queue-and-retry; no single point of failure on the write path. |
| **Secure** | Low-sensitivity but **high-integrity** data (`A-10`); scorer-only writes; tamper-evidence; multi-tenant isolation (`SEC-*`). | RLS at the data layer as the hard authorization boundary; append-only hash-chained logs; TLS-only; least-privilege clients; consented+logged impersonation. |
| **Scalable** | Many simultaneous Saturday matches + viewer fan-out; multi-season tenant history (`NFR-016…018`). | Stateless functions (horizontal); Postgres read replicas + connection pooling + `match_events` partitioning; realtime degrades to polling under load. |
| **Auditable** | Complete, attributable first-ball-to-sign-off trail; every override reasoned; reconstructable (`AUD-*`, `OBJ-07`). | The domain event log *is* the audit trail (provenance on every event); a separate cross-cutting hash-chained `audit_log`; stored reconciliation reports and sign-off versions. |
| **International-standard** | MCC Laws + ICC SPC + DLS Standard as *configuration*, not forks; Cricsheet interchange; i18n; WCAG 2.2 AA (`DR-*`, `NFR-019/030/043…045`, `SPK-01/05/06`). | A single rules core driven by a versioned configuration registry (`CFG-REG`); a conformance suite as a release gate; an anti-corruption export/import translator; externalised strings and locale-aware formatting. |
| **Multi-device** | A scorer may switch devices; two scorers may score one match; viewers on any device (`FR-167`, `FR-107…111`, `SYNC-*`). | Per-device event streams with stable identity; cloud copy + fence token for handoff; independent dual-scorer streams with divergence detection. |
| **Synchronization capable** | Same events → same result regardless of arrival order; no last-write-wins (`NFR-016/017`, `SYNC-009/010`, `MINV-14`). | Deterministic total order over events (dense ordinal → HLC → device sequence); event-level reconciliation with explicit divergence surfacing; server re-validation on ingest. |

### 1.3 Quality-attribute scenarios (measurable)

| # | Scenario | Source | Target |
|---|---|---|---|
| QA-1 | A delivery is recorded while the process is force-killed within 50 ms of confirm. | `NFR-009/010`, `OFF-003` | On relaunch the delivery is present; 0 loss over ≥ 50 chaos innings. |
| QA-2 | A scorer records a normal delivery on target Android hardware. | `NFR-001/002` | ≤ 2 interactions; UI ack ≤ 100 ms p95. |
| QA-3 | A full offline T20 (~250+ events) reconnects on a 3G-class link. | `NFR-006` | Sync completes ≤ 30 s p95. |
| QA-4 | Two devices' event sets for one match are delivered to the backend in 100 random orders. | `NFR-016`, `SYNC-009` | All 100 merges yield an identical match projection. |
| QA-5 | A client without a scorer role crafts a delivery-write request. | `SEC-003/004/006` | The data layer rejects it regardless of client state. |
| QA-6 | A stored event is altered directly in the datastore. | `AUD-003`, `SEC-012` | Continuous chain-verification flags the affected event within the check interval. |
| QA-7 | The backend region is unavailable for 2 hours during play. | `NFR-014` | Scoring, correction, sign-off and local export continue; queued work drains on recovery. |
| QA-8 | Projections for a match are deleted. | `MBR-07`, `NFR-034` | They are rebuilt from `match_events` with identical values. |
| QA-9 | Viewer fan-out exceeds realtime capacity for a popular match. | `NFR-021` | Viewers fall back to polling with a visible staleness indicator; other matches unaffected. |
| QA-10 | Monthly availability of online services. | `NFR-013` | ≥ 99.5%. |

### 1.4 Constraints (from SRS §2.4 and §3)

| Ref | Constraint | Architectural consequence |
|---|---|---|
| C-1 (`A-05`) | Rules = MCC Laws + ICC SPC; variations are **configuration**. | One rules core + a versioned config registry; no per-competition code branches. |
| C-2 (`A-06`, `SPK-01`) | DLS Standard only, pluggable; manual-target fallback if not licensed. | DLS is a strategy behind a `RainMethod` interface; `NONE` = manual entry; nothing else depends on DLS being present. |
| C-3 (`A-07`, `SPK-06`) | Laws text cited, not copied. | Rules encoded as logic + citations; help text paraphrased or permissioned; no verbatim Law corpus shipped. |
| C-4 (`A-08`, `SPK-05`) | Cricsheet-compatible interchange; lossy fields enumerated. | Export/import through an anti-corruption translator; internal model never conforms to a foreign schema. |
| C-5 (`A-01`) | Offline-first is a hard requirement. | The write path has no network dependency; see §3.7. |
| C-6 (`SPK-02`) | Event log must serve P1 corrections **and** P2 merge without a rewrite. | Per-device append-only streams + dense ordinal + HLC from day one, even though P1 is single-writer. |
| C-7 (`SPK-04`) | Identical scoring behaviour on Web + Android, contract-tested. | A single shared scoring core (§4.2) + a contract-test suite as the parity gate. |
| C-8 (`A-09`) | Backend is managed Postgres + Auth + RLS + Realtime (Supabase). | RLS is the authorization backbone; Edge Functions for command/validation logic; no bespoke server fleet in v1. |
| C-9 (`A-10`) | Low-sensitivity, high-integrity data. | Controls weighted to integrity/attribution/tamper-evidence; still TLS + at-rest encryption + PII minimisation. |
| C-10 (`A-13`) | English-first, localization-ready. | All strings externalised; locale-aware formatting; match-timezone-anchored timestamps. |
| C-11 (`A-14`) | Small team; phased scope. | Managed services over self-hosted; one codebase for the core; P2/P3 seams designed but not built. |

### 1.5 System context (C4 — level 1)

```
                        ┌──────────────────────────────────────────────┐
   Scorer (Head /       │            CRICKET SCORING BOOK               │
   Assistant) ─────────▶│                                              │
                        │   Web App (PWA)      Android App             │
   Organizer / Admin ──▶│        │                  │                  │
                        │        └──────┬───────────┘                  │
   Captain / Manager ──▶│               │                              │
                        │        Managed Backend (Supabase):          │
   Player ─────────────▶│        Auth · Postgres+RLS · Realtime ·     │
                        │        Edge Functions · Storage             │
   Viewer / Fan ───────▶│  (read-only, via share link — no account)   │
                        └───────┬───────────────┬──────────────┬───────┘
                                │               │              │
                     Email / Push         Google Play     Object storage
                     provider             (distribution)  (backups, exports)
                                │
                     External data consumers (V2):
                     Cricsheet-compatible import/export · read-only API · webhooks
```

External systems: email/push delivery, Google Play, a separate-account/region object store for backups and generated exports, and (V2) programmatic consumers via a versioned read API and Cricsheet interchange. **DLS reference tables** and **condition templates** are reference data delivered over-the-air, not a live external dependency.

### 1.6 Key architectural decisions (summary)

| ADR | Decision | Rationale (short) | §8 |
|---|---|---|---|
| ADR-01 | **Event sourcing** for the match; projections are disposable read models. | Domain model already prescribes it; gives audit, replay, deterministic sync, offline correction. | §8 |
| ADR-02 | **Local-first**: the on-device event log is authoritative for an in-progress match. | Offline is a hard requirement; the network cannot be on the write path. | §8 |
| ADR-03 | **One shared scoring core**, not two parallel implementations. | Small team; parity is otherwise unenforceable; contract tests still gate it. | §8 |
| ADR-04 | **Managed backend (Supabase)**; RLS is the authorization boundary. | `A-09`; least operational surface for a small team; defence-in-depth at the data layer. | §8 |
| ADR-05 | **Deterministic event ordering** (dense ordinal → HLC → device seq); **no CRDT value merge, no last-write-wins**. | `SYNC-009/010`; conflicts must be explainable and, for dual-scorer, human-resolved. | §8 |
| ADR-06 | **CQRS**: event log = write model; projections computed by the *same* core on client and server. | Identical results everywhere; server projections power viewers/competitions/profiles. | §8 |
| ADR-07 | **Single-writer per scorer stream in P1**; independent multi-stream dual-scorer in P2 on the same substrate. | `SPK-02`, `C-6`; keeps P1 simple without foreclosing P2. | §8 |
| ADR-08 | **Hash-chained append-only logs** (domain events + audit log) with periodic external anchoring. | Tamper-evidence for a high-integrity record (`AUD-003`, `SEC-012`). | §8 |
| ADR-09 | **Transactional outbox** for integration events to downstream contexts. | Reliable eventual consistency for competitions/profiles/publishing (`MINV-16/17`). | §8 |
| ADR-10 | **DLS behind a `RainMethod` strategy**; `NONE` (manual) is the default until `SPK-01` clears. | Licensing risk isolation (`C-2`). | §8 |

---

## 2. Domain Layer

### 2.1 Bounded contexts & context map

Six bounded contexts (`docs/domain/domain-model.md` §1). **CTX-SCORING is the core domain**; the rest support or are generic.

```
        ┌───────────────────────────── CTX-SCORING (core) ─────────────────────────────┐
        │  AGG-MATCH : event-sourced. Owns the match timeline, state machine,          │
        │  reconciliation, DLS, tie-breakers, corrections, sign-off.                   │
        └────▲───────────▲───────────▲──────────────────┬───────────────┬──────────────┘
             │ templates │ PlayerId  │ OrgId, roles     │ domain events │ domain events
             │ fixtures  │ TeamId    │                  ▼               ▼
   CTX-COMPETITION   CTX-PARTICIPANTS   CTX-IDENTITY   CTX-PROFILES   CTX-PUBLISHING
   (seasons,          (registry,         (orgs, users,  (career/team   (share links,
    standings, NRR,    squads, merge)     roles, guest   aggregates,    live viewer,
    disputes)                             → account)     claims)        notifications)
        ▲                                                    ▲               ▲
        └──────────────── EVT-MATCH-FINALISED ───────────────┴───────────────┘
```

- **Published language** between contexts = the domain event set (§2.3). Downstream contexts subscribe; they never reach into `AGG-MATCH`.
- **Upstream→downstream:** CTX-IDENTITY, CTX-PARTICIPANTS, CTX-COMPETITION are *suppliers* to CTX-SCORING (ids, roles, templates). CTX-PROFILES, CTX-PUBLISHING, and CTX-COMPETITION-standings are *customers* of CTX-SCORING's events.
- **Anti-corruption:** Cricsheet import/export goes through `SVC-EXPORT-TRANSLATOR`; the internal model never adopts a foreign schema (`C-4`).
- **Architectural mapping:** each context becomes a schema namespace + a set of tables + (for downstream contexts) an outbox consumer. CTX-SCORING additionally has the on-device runtime (the shared core + local store + sync engine).

### 2.2 The core: `AGG-MATCH` as an event-sourced aggregate

- **The match is its ordered, append-only event stream** (`MBR-01`). "The score is 142/3" is shorthand for "the projection over the active stream yields 142/3." No side channel asserts match facts (`MBR-06`).
- **Consistency boundary = the whole match.** One `AGG-MATCH` is the unit of transactional consistency; commands against it are serialised per logical time (`MBR-03`).
- **Write model:** the event log (`match_events`), one **stream per scorer** (`scorer_stream_id`); P1 has exactly one stream, P2 has two independent streams plus a reconciliation stream.
- **Read models (projections):** scorecard, batting/bowling card lines, fall-of-wickets, partnerships, run-rate ladder, DLS par ladder, powerplay plan, commentary feed, live-state, reconciliation report, audit view. **All are pure functions of the active (non-superseded, non-void) event set** (`MINV-02`) and are **droppable and rebuildable** (`MBR-07`).
- **Corrections** are new `EVT-*Corrected` / insert / void events linked by `supersedes`; never mutations (`MINV-01`, `MBR-04`). `SVC-CASCADE-RECOMPUTER` recomputes projections and emits a cascade summary.
- **Determinism:** the same log yields the same projections on any build (`NFR-034`) — the basis of offline/online convergence *and* audit reconstruction.
- **Guest identity continuity:** a guest match keeps its `MatchId`, timeline and provenance after claim; claiming only *adds* an owner/org (`MBR-02`, `MINV-15`).

### 2.3 Domain events, commands, projections (CQRS)

**Two event planes:**

| Plane | What | Where it lives | Consumers |
|---|---|---|---|
| **Domain events** (`EVT-*`, ~70 types) | The event-sourced write model of `AGG-MATCH` — deliveries, wickets, interruptions, DLS revisions, reviews, corrections, sign-offs, dual-scorer events. | `match_events` (client local store + Postgres), per-device stream, hash-chained. | The scoring core's projection functions (client and server). |
| **Integration events** | Coarse facts published when a match crosses a milestone: `MatchFinalised`, `MatchResultAmended`, `AppearanceClaimApproved`, `StandingsRecomputed`, `ShareLinkRevoked`. | `outbox` table (written in the same transaction as the state change) → dispatcher. | CTX-COMPETITION, CTX-PROFILES, CTX-PUBLISHING, notifications, search, webhooks (V2). |

**Command → event flow (authoritative on the client):**

```
UI intent ─▶ CMD-* ─▶ Scoring Core: load current projection, check invariants
                        (INV-001…018, MINV-*, state machine, config profile)
                     │
              accept ─┴─▶ emit EVT-* ─▶ append to local log (durable, hash-linked)
                                     ─▶ update projection in memory
                                     ─▶ UI confirms
              reject ───▶ typed error to UI (no event emitted)
```

The **server re-validates** every event on ingest (schema, auth, sequence, hash chain, conditions-freeze) and MAY reject, but it does **not** re-derive events — the client is the deriver (`SYNC-005`, `SEC-014`). This keeps the engine single-sourced (the shared core) while still enforcing integrity server-side.

### 2.4 Domain services & where they run

All 13 `SVC-*` are **stateless, pure, part of the shared scoring core**, and therefore run **identically on client and server**:

| Service | Runs on client for… | Runs on server for… |
|---|---|---|
| `SVC-STRIKE-RESOLVER`, `SVC-EXTRAS-DECOMPOSER`, `SVC-INNINGS-END-EVALUATOR`, `SVC-POWERPLAY-PLANNER`, `SVC-MILESTONE-DETECTOR` | live scoring, projections, offline. | rebuilding server projections; validation cross-checks. |
| `SVC-RESULT-DERIVER` | live result, `MINV-13` check. | authoritative result on sign-off ingest; competition feed. |
| `SVC-DLS-CALCULATOR` (behind `RainMethod`) | offline revised target / par (`OFF-008`). | server par ladder for viewers; benchmark job. |
| `SVC-CASCADE-RECOMPUTER` | correction cascades + summary. | server projection refresh after ingesting corrections. |
| `SVC-RECONCILER` | interval + pre-sign-off reconciliation report (`AUD-006`). | server re-check before accepting a sign-off. |
| `SVC-DIVERGENCE-DETECTOR` | *(P2)* local view when two logs are on one device. | *(P2)* authoritative divergence set from two streams. |
| `SVC-EXPORT-TRANSLATOR` | offline PDF/CSV. | Cricsheet export/import, server-side PDF for share/email. |
| `SVC-AUTHORIZER` | advisory UI gating only. | **command authorization** (with RLS as the hard boundary). |

### 2.5 Invariants the architecture must preserve

| Invariant(s) | Mechanism in the architecture |
|---|---|
| `INV-001…010` (totals, ball/bowler/batter/partnership/boundary/extras identities) | `SVC-RECONCILER` runs on every interval checkpoint and pre-sign-off; server re-runs before accepting sign-off; failures block finality (`BR-007`). |
| `INV-011`, `MINV-04` (strike continuity) | `SVC-STRIKE-RESOLVER` derives the striker for delivery *n*; unexplained discontinuity ⇒ reconciliation FAIL; overrides are themselves events. |
| `INV-012/013`, `MINV-08` (over legality, bowler rules) | Enforced in the core at command time; guardrail overrides require a reason and are logged (`AUD-005`). |
| `INV-017`, `MINV-03` (timeline monotonicity, dense ordinal) | Per-device monotonic `device_seq`; dense `event_ordinal` for inserts; HLC for causal order; server rejects non-monotone batches. |
| `MINV-01` (append-only) | No UPDATE/DELETE privilege on `match_events` for any app role; hash chain; RLS INSERT-only policy. |
| `MINV-02`, `MBR-07` (projections are pure & disposable) | Projections are never the system of record; rebuild job; DR property (§3.14). |
| `MINV-05`, `MBR-05/12` (conditions freeze, reference-data pinning) | `EVT-PLAYING-CONDITIONS-FROZEN` at first delivery; match pins `conditions_profile_version` + `dls_table_version`; later `[CFG]` change only via reasoned `EVT-PLAYING-CONDITIONS-AMENDED`. |
| `MINV-11` (single authoritative target source) | Target resolver: latest active DLS revision → else manual override → else `opponent_total + 1`; exactly one authoritative at a time. |
| `MINV-13`, `MBR-11` (result re-derivable) | `SVC-RESULT-DERIVER` on client and server; stored result that does not re-derive ⇒ reconciliation FAIL. |
| `MINV-14` (dual-scorer mutual confirmation) | Two independent streams; `divergences` rows; resolution requires both `proposedBy` and `confirmedBy`; sign-off blocked while OPEN (`SYNC-013/014`). |
| `MINV-15` (guest isolation) | Guest match has `organization_id = null`, no server footprint until `EVT-GUEST-MATCH-CLAIMED` (`SEC-016`). |
| `MINV-16/17/18` (cross-context consistency) | Eventually consistent via outbox consumers; standings/career/merge recompute from FINAL, non-disputed sources only. |

### 2.6 Ubiquitous language in the architecture

Component, table, event, channel and API names **MUST** use the glossary terms (`docs/domain/glossary.md`): *Match, Innings, Over, Delivery, Extra, Wicket, Free hit, Target, Par score, Result, Divergence, Provenance, Sign-off, Reconciliation, Snapshot, Playing Conditions Profile, Playing Conditions freeze*. E.g. the ingest endpoint is `/sync/events` carrying `Delivery`/`Wicket`/`Interruption` events, not "actions" or "rows"; the read model is a `ScorecardSnapshot`, not a "cache blob".

---

## 3. System Layer

### 3.1 Logical container architecture (C4 — level 2)

```
┌───────────────────────────── CLIENT DEVICE (Web PWA or Android) ─────────────────────────────┐
│                                                                                             │
│  ┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐   ┌───────────────────────┐ │
│  │ UI layer    │──▶│ Application layer │──▶│ Shared Scoring Core │──▶│ Local Persistence     │ │
│  │ (Compose /  │   │ (view-models,    │   │ (pure, deterministic│   │  • Event log (append) │ │
│  │  React)     │◀──│  use-cases,      │◀──│  rules engine +     │   │  • Projection cache   │ │
│  │             │   │  command bus)    │   │  13 SVC-* services) │   │  • Reference data     │ │
│  └─────────────┘   └───────┬──────────┘   └────────────────────┘   │  • Outbox queue       │ │
│                            │                                        │  • Auth session       │ │
│                            ▼                                        └──────────┬────────────┘ │
│                    ┌────────────────┐                                          │              │
│                    │  Sync Engine   │◀─────────────────────────────────────────┘              │
│                    │ (push/pull,    │      TLS (HTTPS + WebSocket)                             │
│                    │  HLC, cursors, │─────────────────┐                                       │
│                    │  fence tokens) │                 │                                       │
│                    └────────────────┘                 │                                       │
└──────────────────────────────────────────────────────┼───────────────────────────────────────┘
                                                       │
┌──────────────────────── MANAGED BACKEND (Supabase project per env) ───────────┼──────────────┐
│                                                                              ▼               │
│  ┌────────────┐  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────────────┐ │
│  │  Auth      │  │  API gateway     │  │  Edge Functions    │  │  Realtime service          │ │
│  │ (GoTrue):  │  │  • PostgREST     │  │  (Deno): sync      │  │  • match:{id} (viewers)    │ │
│  │  JWT,      │  │    (RLS reads)   │  │  ingest+validate,  │  │  • scoring:{id} (co-scorer)│ │
│  │  refresh,  │  │  • RPC endpoints │  │  sign-off          │  │  • org:{id} (dashboards)   │ │
│  │  MFA(admin)│  │                  │  │  materialise,      │  │  presence                  │ │
│  └─────┬──────┘  └────────┬─────────┘  │  export, competition│ └──────────────┬─────────────┘ │
│        │                  │            │  recompute, admin  │                │               │
│        │                  │            └─────────┬──────────┘                │               │
│        ▼                  ▼                      ▼                           ▼               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL  (RLS = authorization boundary)                                           │  │
│  │  • match_events (append-only, hash-chained, partitioned)   • audit_log (append-only)  │  │
│  │  • match_snapshots (materialised projections)             • outbox (integration evts) │  │
│  │  • orgs / memberships / players / teams / competitions / fixtures / standings         │  │
│  │  • dls_revisions / divergences / sign_offs / reconciliation_reports                   │  │
│  │  • reference_data (versioned) / share_links / api_keys / exports                      │  │
│  │  connection pooling (Supavisor)   read replicas   pg_cron scheduled jobs              │  │
│  └───────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                      │                                                      │
│  ┌───────────────┐   ┌───────────────▼────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │ Object Storage │   │ Outbox dispatcher      │   │ Notification      │   │ Observability │  │
│  │ • exports      │   │ → competition recompute│   │ dispatch (email/  │   │ logs/metrics/ │  │
│  │ • org logos    │   │ → profile recompute    │   │ push)             │   │ traces/alerts │  │
│  │ • backups (2nd │   │ → search index         │   └──────────────────┘   └───────────────┘  │
│  │   region/acct) │   │ → webhooks (V2)        │                                             │
│  └───────────────┘   └────────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Container responsibilities:**

| Container | Responsibility | Stateful? |
|---|---|---|
| **UI layer** | Rendering, input capture, accessibility, offline/last-synced indicators. Advisory authorization (hide/disable). | No (derives from projection). |
| **Application layer** | Command bus, use-cases, orchestration, session/grace handling, outbox enqueue. | Transient. |
| **Shared Scoring Core** | Deterministic rules engine + 13 `SVC-*`; validates `CMD-*`, folds `EVT-*` into projections. **Identical on both platforms.** | No — pure. |
| **Local Persistence** | Durable event log, projection cache, reference data, outbox, auth session. Write-ahead before UI confirm. | **Yes — the client system of record for in-progress matches.** |
| **Sync Engine** | Idempotent, resumable push/pull; HLC stamping; cursor/high-water tracking; fence-token handoff; conflict/divergence surfacing. | Transient + cursors. |
| **Auth (GoTrue)** | Credentials, JWT issue/refresh/revoke, MFA for admin. | Yes. |
| **API gateway** | PostgREST (RLS-guarded reads) + RPC command endpoints. | No. |
| **Edge Functions** | Event ingest + re-validation, sign-off materialisation, exports, competition/profile recompute triggers, admin ops, share-link management. | No (Postgres holds state). |
| **Realtime service** | Fan-out of projection deltas to viewers; co-scorer live channel; presence. | Connection state only. |
| **PostgreSQL** | System of record for synced data; RLS; partitioned `match_events`; scheduled jobs. | **Yes — backend system of record.** |
| **Outbox dispatcher** | At-least-once delivery of integration events to downstream consumers. | Cursor. |
| **Object Storage** | Generated exports, org/player images, backup archives (separate region/account). | Yes. |
| **Notification dispatch** | Email/push for assignments, results, follows. | Queue. |
| **Observability** | Structured logs, metrics, traces, alerts, synthetic checks. | Yes (its own stores). |

### 3.2 Frontend architecture (Web PWA)

**Shape:** a layered, offline-first single-page PWA. Strict dependency direction: `UI → Application → Domain (shared core) → Persistence`; the core depends on nothing.

```
UI components (scorebox, scorecard, admin consoles, viewer)
   │  hooks / view-models (subscribe to projection; dispatch CMD-*)
Application services  (command bus, match session, export service, sync controller)
   │
Shared Scoring Core (JS/wasm build)  ── pure; no I/O
   │
Ports:  EventLogPort · ReferenceDataPort · ClockPort · IdPort
   │  adapters
Local Persistence (IndexedDB)  +  Service Worker (app shell + asset cache)  +  Sync Engine
```

- **Rendering model:** the in-memory **projection** is the single source of UI truth for a match; it is rebuilt by folding the local event log on load and updated incrementally as `EVT-*` are appended. UI state (navigation, panel layout, filters) is separate and may use a lightweight store; domain state is never duplicated into it.
- **PWA / offline:** a service worker precaches the app shell and static assets (cache-first), and uses stale-while-revalidate for versioned reference data. `navigator.storage.persist()` is requested to avoid eviction. The app is fully functional with the network disabled after first load (`NFR-046`, `FR-163`, `WEB-001/007`).
- **Scorebox UX:** keyboard-first with configurable hotkeys; a landscape multi-pane layout on large screens (controls + live card + ball log simultaneously); portrait fallback; print CSS for the scorecard and linear sheet; screen wake-lock while scoring; high-contrast / large-text / sunlight themes (`FR-153/164`, `WEB-002…005`, `NFR-019/024`).
- **Accessibility:** semantic landmarks, focus management, screen-reader labels, full keyboard nav on core flows — WCAG 2.2 AA gated (`NFR-019`).
- **Charts / outputs:** rendered client-side from the projection with a dependency-free charting approach so they work offline (`OFF-009`, `FR-119`).
- **Concurrency guard:** if another tab or device holds the writer fence for the open match, the UI switches to read-only with a "take over" prompt (§3.7).
- **Feature flags:** a client-side flag service (values delivered via reference data / config) gates DLS UI (`C-2`), dual-scorer, competitions, etc., matching the roadmap buckets.

### 3.3 Android architecture

**Shape:** single-activity Jetpack Compose app, MVI (unidirectional data flow), clean-architecture layering, with the **same shared scoring core** consumed as a native library.

```
Compose UI (one Activity, screens as composables; thumb-zone scoring layout)
   │  MVI: State ← Reducer ← Intent ; side-effects via Effect handlers
ViewModels  (per screen; expose immutable State; no domain logic)
   │
Use-cases / Interactors
   │
Shared Scoring Core (Kotlin Multiplatform target — same source as Web)  ── pure
   │
Repositories  (MatchRepository, ReferenceDataRepository, SyncRepository)
   │
Local store (SQLite via SQLDelight)  +  WorkManager sync workers  +  Keystore-backed secure prefs
```

- **Durability (`SPK-03`, `NFR-009…011`, `AND-004/005`):** every `EVT-*` is written inside a single SQLite transaction in WAL mode with an explicit `fsync` (durable commit) **before** the ViewModel emits the "confirmed" state. An optional append-only journal file provides belt-and-braces recovery. On cold start the app replays the event log to reconstruct the projection (`OFF-004`).
- **Process death:** state survives via the durable log, not just `SavedStateHandle`. During active scoring a wake-lock (and, if needed, a lightweight foreground service) reduces the chance of eviction mid-over; correctness never depends on it.
- **Background sync:** `WorkManager` jobs with network + battery constraints, exponential backoff, and unique work names per match; progress and unsynced count surfaced in the UI (`AND-006/023`, `OFF-005/021`).
- **One-handed UX:** portrait layout with primary actions in the thumb zone; large, well-spaced targets usable with thin gloves; optional haptics; undo gesture; sunlight mode; TalkBack labels and dynamic text scaling (`AND-002/003/008/009/012/021`, `NFR-020/021`).
- **Platform integration:** OS share sheet for links/exports; minimal permissions (no location/contacts); Play distribution with in-app update prompts; local backup/restore via the Storage Access Framework (`AND-013/016/017/018`, `SEC-008`).
- **Offline auth:** cached session in Keystore-backed encrypted storage; configurable offline grace period (`AND-022`, `OFF-013`).

### 3.4 Backend architecture

**Style:** managed BaaS (Supabase) — Postgres-centric, stateless compute, RLS-enforced. No bespoke server fleet in v1 (`C-8`, `C-11`).

| Backend capability | Realised by | Notes |
|---|---|---|
| **Identity & sessions** | Supabase Auth (GoTrue) | email+password, JWT + refresh, admin MFA, revocation. |
| **Authorization** | Postgres **RLS** + `SVC-AUTHORIZER` in Edge Functions | RLS is the hard boundary; functions add command/state checks. |
| **Reads (resources)** | PostgREST auto-API behind RLS | lists/detail for matches, competitions, standings, profiles — read-only for clients. |
| **Commands / bulk** | Edge Functions (Deno) | `POST /sync/events`, sign-off materialise, exports, share links, recompute, admin ops — RPC-style, idempotent. |
| **Event ingest & re-validation** | `sync-ingest` Edge Function | schema, auth, per-device monotonicity, hash-chain continuity, conditions-freeze, gap detection; per-event accept/reject (`SYNC-005`, `SEC-14`). |
| **Server-side projection** | `signoff-materialise` + on-ingest refresh, using the **shared core** | writes immutable `match_snapshots` per sign-off version; refreshes in-progress snapshots for fast viewer load. |
| **Realtime** | Supabase Realtime | `match:{id}` projection deltas to viewers; `scoring:{id}` co-scorer + presence; `org:{id}` dashboards. |
| **Downstream propagation** | `outbox` table + dispatcher (trigger/queue + scheduled drainer) | competitions, profiles, search, notifications, webhooks. At-least-once; consumers idempotent. |
| **Scheduled work** | `pg_cron` / scheduled functions | retention/anonymisation, backup verification, chain verification, competition recompute sweeps, notification digests. |
| **Files** | Supabase Storage buckets | `exports`, `org-assets`, `player-photos`, `backups` (mirrored to a separate region/account). |
| **Reference data** | `reference_data` table, versioned; delivered OTA | DLS tables, condition templates, app config; matches pin the version at creation (`BR-032`). |

**Statelessness & scale:** every Edge Function is stateless and horizontally scalable; all state is in Postgres or Storage. The scaling pressure point is Postgres — addressed in §3.17.

### 3.5 Database architecture

**Principle:** the **event logs are the system of record**; everything else is either *reference/identity data* (small, mutable, backed up) or *materialised projections* (large, disposable, rebuildable). See §4.6 for the table sketch.

**Table families:**

| Family | Tables (sketch) | Mutability | Isolation |
|---|---|---|---|
| **Scoring write model** | `match_events` (append-only, hash-chained, **partitioned**), `matches` (header + pinned versions + claim status), `sign_offs` (versioned), `reconciliation_reports`, `dls_revisions`, `divergences` (P2) | `match_events` INSERT-only (no UPDATE/DELETE grant); others append/controlled-update | `organization_id` (null for guest) + match-role RLS |
| **Scoring read model** | `match_snapshots` (full projection JSON per sign-off version + periodic in-progress), `live_state` (hot projection for viewers) | replace/rebuild | derived; same tenant scoping |
| **Identity & tenancy** | `organizations`, `memberships` (user × org × roles[]), `users` (auth mirror), `invitations`, `api_keys`, `impersonation_consents` | mutable | self / org-admin RLS |
| **Participants** | `teams`, `players`, `squads`, `player_merges` | mutable | org RLS |
| **Competition** | `competitions`, `divisions`, `fixtures`, `standings` (materialised), `disputes` | mutable / materialised | org RLS |
| **Profiles** | `appearance_claims`, `career_stats` (materialised), `team_records` (materialised) | claims mutable; stats rebuilt | player/org RLS + minor redaction view |
| **Publishing** | `share_links` (token hash, match, revoked_at), `notifications`, `follows` | mutable | owner / token RLS |
| **Cross-cutting** | `audit_log` (append-only, hash-chained), `outbox`, `exports`, `reference_data` (versioned), `feature_flags` | append-only / controlled | admin + owner RLS; audit read-restricted |

**`match_events` key columns (contract sketch, not DDL):** `event_id` (client UUID, unique — idempotency), `match_id`, `scorer_stream_id`, `device_id`, `device_seq` (bigint, monotonic per device), `hlc` (hybrid logical clock), `event_ordinal` (dense decimal — timeline position, inserts between neighbours), `type`, `event_version`, `payload` (jsonb), `supersedes` (event_id, nullable), `actor_user_id` (or anon surrogate), `provenance` (jsonb: app_version, platform, os, device, build_hash), `recorded_at` (device clock), `server_received_at`, `prev_hash`, `hash`. **Uniqueness:** `event_id`; `(match_id, scorer_stream_id, device_id, device_seq)`. **Indexes:** `(match_id, scorer_stream_id, event_ordinal)`, `(match_id, device_id, device_seq)`, partial/GIN on `payload` where queried.

**Partitioning:** `match_events` partitioned by hash of `match_id` (even write distribution) or by month (age-out friendliness) — decided in `SPK-02` follow-up; either keeps per-match reads on one or few partitions.

**Materialisation strategy:** `standings` and `career_stats` carry a `source_version` (max event/sign-off id consumed) so recompute is incremental and idempotent (`MINV-16/17`).

**Reference-data pinning:** `matches.conditions_profile_version` and `matches.dls_table_version` are set at creation and never change; recompute always reads the pinned version (`BR-032`, `MBR-12`, `MINV-05`).

### 3.6 Offline storage

| Concern | Web (PWA) | Android |
|---|---|---|
| **Engine** | IndexedDB (object stores) + Cache Storage (service worker) | SQLite (SQLDelight), WAL mode |
| **Event log** | store `events` (keyPath `event_id`; index `[match_id+scorer_stream_id+event_ordinal]`, `[match_id+device_id+device_seq]`) | table `match_events` mirroring §3.5 columns; append in one durable transaction |
| **Projection cache** | store `snapshots` (per match; replaceable) | table `match_snapshots_local` |
| **Reference data** | store `reference_data` (versioned) | table `reference_data` |
| **Outbox** | store `outbox` (unsynced events + pending publish/notify intents, ordered) | table `outbox` |
| **Auth/session** | `auth_session` store (refresh token guarded; claims snapshot for offline authz) | Keystore-backed EncryptedSharedPreferences |
| **Blobs** | `blobs` store / Cache Storage (generated exports) | app files dir (exports, backup archives) |
| **Durability rule** | write event + advance outbox in one IDB transaction before UI confirm | write event inside one SQLite transaction with `fsync` before UI confirm |
| **At rest** | browser-managed; request persistent storage | OS file-based encryption (`SEC-007`); SQLCipher only if a later threat model requires it |
| **Eviction / limits** | `navigator.storage.persist()`; usage view; purge synced-and-final matches (`OFF-016`, `FR-155`) | storage usage view; retention policy purge |
| **Retention** | keep a match's log until the server acknowledges durable receipt of every event; then eligible for purge per policy | same |
| **Recovery** | on load, fold `events` → projection; reconcile outbox vs server high-water | on cold start, replay `match_events` → projection |
| **Portability** | signed local backup archive (event logs + metadata) exportable/importable offline, lossless round-trip (`FR-149`, `OFF-011`) | same, via SAF |

The local event log is **authoritative for an in-progress match** (`ADR-02`). Projections on device are a cache and may be discarded and rebuilt at any time (`MBR-07`).

### 3.7 Sync architecture

**Model:** per-device **append-only streams** merged into a per-match **deterministic total order**, then projected by the shared core. No operational transform, no CRDT value merge. Conflicts are either impossible (single writer) or **surfaced** (dual-scorer). (`SYNC-*`, `NFR-016…019`, `MINV-03/14`, `ADR-05/07`.)

**Identifiers & ordering:**

| Field | Purpose |
|---|---|
| `event_id` (client UUID) | Idempotency — re-sending never duplicates (`SYNC-008`). |
| `device_id` + `device_seq` | Per-device monotonic order; gap/overlap detection on ingest (`SYNC-006`, `OFF-006`). |
| `hlc` (hybrid logical clock) | Causal + wall-clock-bounded ordering across devices without trusting raw device clocks (`SYNC-007`, `OFF-015`). |
| `event_ordinal` (dense decimal) | Position in the match timeline; an inserted correction gets a value strictly between its neighbours (`MINV-03`). |
| **Canonical order** | sort by `event_ordinal`, tie-break `hlc`, tie-break `(device_id, device_seq)`. Every client and the server use this exact order ⇒ identical projection (`SYNC-009`). |

**Push (`POST /sync/events`):** client batches outbox events (gzip, capped size). Server validates each: JSON Schema for the `type`+`event_version`; `SVC-AUTHORIZER` + RLS (scorer role on the match); `device_seq` monotonic and contiguous for that `device_id` (gap → reject with the expected next seq); `hash` chains from `prev_hash`; conditions-freeze rules; ordinal sanity. Accepted events are appended to `match_events` in one transaction and the new high-water marks returned. Rejected events return a structured per-event error; the client surfaces them and does not advance the outbox past a rejection.

**Pull (`GET /sync/changes`):** client sends its per-`(match, device/stream)` high-water marks; server returns newer events from other devices/streams for matches the client may read. Client applies them, re-folds the projection, and updates cursors. Realtime notifies that new events exist (a nudge), so the client pulls promptly while online; Realtime is **not** the durability path.

**Single-writer (P1):** one `scorer_stream_id`. The client acquires a **fence token** (a monotonically increasing lease on the match writer role, stored server-side). Concurrent writes from a second device present a stale fence → server rejects the batch → that device goes read-only with "another device is scoring — take over?". Taking over bumps the fence; the previous device is fenced out. This gives multi-device *continuity* (`FR-167`) without P1 needing merge.

**Dual-scorer (P2):** two named streams, each an independent append-only log, both stored. `SVC-DIVERGENCE-DETECTOR` aligns the two by over/ball and writes `divergences` rows for any field mismatch (runs, extras, wicket, striker). Resolution = one scorer proposes an agreed version, the other confirms; on confirmation a `divergence-resolved` event is appended to **both** streams (or a shared reconciliation stream), converging the projection. Sign-off is blocked while any `OPEN`/`PROPOSED` divergence remains, overridable only with a reason + dual attestation (`SYNC-011…014`, `MINV-14`, `BR-008`).

**Conflict philosophy:** never last-write-wins; never silently drop an event (`SYNC-010`). Structural ties resolve by the stable deterministic tie-break (explainable). Value conflicts either can't occur (P1) or become a human-resolved divergence (P2).

**Transport & performance:** HTTPS for push/pull (resumable via cursors, tolerant of flaky links); WebSocket (Realtime) for change nudges and viewer deltas. Batching + gzip + delta encoding to hit `NFR-006` (full offline T20 ≤ 30 s on 3G). Sync never blocks a scoring input (`OFF-019`, `OFF-023`).

**Sync flow (sequence sketch):**

```
Device A (offline scoring)         Backend                      Device B (viewer / co-scorer)
──────────────────────────         ───────                      ────────────────────────────
append EVT (durable) ─┐
  ... network returns  │
POST /sync/events  ────┼─────────▶ validate each event
  [batch, fence F]     │           ├─ ok  → append to match_events (txn), advance high-water
                       │           │        write outbox integration events if milestone
                       │           └─ bad → per-event error (e.g. seq gap, stale fence)
      200 {highWater, accepted[], rejected[]} ◀─┘
advance outbox to highWater
                                   Realtime: "match:{id} changed" ───────────▶ pull deltas
                                   GET /sync/changes?since=... ◀───────────── apply, re-project
```

### 3.8 Authentication

| Aspect | Design |
|---|---|
| **Provider** | Supabase Auth (GoTrue). Email + password (`FR-002`); magic-link optional. |
| **Tokens** | Short-TTL JWT access token (in memory) + longer-TTL refresh token (secure storage: Android Keystore-backed encrypted prefs; Web: guarded IndexedDB entry, or `httpOnly` `SameSite` cookie where the topology allows). |
| **Session revocation** | `FR-012`, `SEC-002` — server-side refresh-token invalidation; a revoked session's next refresh fails and the client drops to guest-capable mode (local scoring still works). |
| **Offline grace (`FR-003`, `OFF-013`, `AND-022`)** | On login the client stores an encrypted refresh token **and** a signed **claims snapshot** (`sub`, org roles, expiry). While offline and within the configurable grace window, local authorization trusts the claims snapshot; cloud calls queue. Past the window: local guest scoring continues; cloud actions require re-auth. |
| **Guest mode** | No auth at all. A device-local `originDeviceId` identifies the guest match; it has no server identity until `EVT-GUEST-MATCH-CLAIMED` binds it to the claiming account (`SEC-016`, `MINV-15`, `MBR-02`). |
| **MFA** | Optional, and **required for platform-admin** roles (V2). |
| **Service-to-service** | Edge Functions use the service-role key server-side only; it is never in a client bundle. User-initiated actions still run through a user-scoped client so RLS applies. |
| **API keys (V2)** | Org-scoped, `prefix.secret` form, secret hashed at rest, rotation with a grace window, per-key rate limits (`SEC-017`). |

### 3.9 Authorization

**Model:** additive RBAC (`SEC-005`, `R1 §4`) — 12 roles; a user's capability set is the **union** of their roles **per organization**. Match-level roles (Head Scorer, Assistant Scorer) are assignments on the match within its org.

**Enforcement points — defence in depth:**

```
1. Client (advisory)      hide/disable UI. NOT a security boundary (SEC-003).
        │
2. Edge Function          SVC-AUTHORIZER: command-level + state-machine + guest rules
   (SVC-AUTHORIZER)       + impersonation-consent checks. Returns allow/deny+reason.
        │
3. Postgres RLS  ◀── the hard boundary (SEC-004)
   • every tenant table: USING (organization_id IN my_orgs())
   • match_events INSERT: has_match_role(match_id, 'HEAD_SCORER'|'ASSISTANT_SCORER')  (SEC-006, BR-003)
   • match_events UPDATE/DELETE: no policy → impossible (append-only, MINV-01)
   • audit_log: INSERT via SECURITY DEFINER only; SELECT restricted to authorized roles
   • minors' fields: served through a redacting view unless guardian/authorized (SEC-013)
```

- **Role source of truth:** the `memberships` table. RLS helpers (`my_orgs()`, `has_match_role()`) are `SECURITY DEFINER`, audited, and read `memberships` directly — avoiding stale-claim risk. JWT may still carry a compact `{org: roles}` hint for fast client UI decisions only.
- **Guest → owned:** on claim, `organization_id` and owner are set; from then org RLS governs the match (`SEC-016`).
- **Impersonation (`SEC-011`, `AUD-007`, `FR-161`):** requires a stored `impersonation_consents` row; issues a token carrying both `act` (admin) and `sub` (impersonated); every action is double-attributed in `audit_log`; time-boxed; refused without consent.
- **Share links (`SEC-009`, `BR-022`):** an unguessable token → a scoped, read-only, revocable capability to one match's **viewer projection only**. Served by a dedicated public path that reads `match_snapshots`/`live_state` for that match id; no raw events, no write path, aggressive rate limits.
- **Public read API / competition pages (V2):** served from purpose-built, redacted projections; API-key auth; rate-limited; stable ids only.

### 3.10 API architecture

**Hybrid, deliberately:**

| Surface | Style | Examples | Auth |
|---|---|---|---|
| **Sync API** | RPC, batch, idempotent, cursor-based, resumable | `POST /sync/events`, `GET /sync/changes`, `POST /sync/fence` | JWT (scorer role via RLS) |
| **Resource reads** | REST (PostgREST) behind RLS, read-only for clients | `GET /rest/v1/matches`, `/competitions`, `/standings`, `/players` | JWT + RLS |
| **Command endpoints** | RPC (Edge Functions), `POST`, typed request/response, `Idempotency-Key` | `POST /matches/:id/signoff`, `/exports`, `/share-links`, `/share-links/:id/revoke`, `/competitions/:id/recompute`, `/appearance-claims/:id/approve`, `/admin/impersonate` | JWT + `SVC-AUTHORIZER` + RLS |
| **Realtime** | WebSocket channels | `match:{id}` (viewer deltas), `scoring:{id}` (co-scorer + presence), `org:{id}` (dashboards) | channel authz vs membership or share token |
| **Public API + webhooks (V2)** | Versioned REST `/api/v1`, read-only; outbound webhooks | `GET /api/v1/matches/:id`, `/competitions/:id/standings`; `match.finalised` webhook | API key; HMAC-signed webhooks |
| **Interchange** | File in/out via translator | Cricsheet-compatible export/import (`SPK-05`) | JWT |

**Contracts & governance:**
- **OpenAPI** for REST/RPC; **JSON Schema** for every `EVT-*` type and every `CMD-*` payload, versioned, in a schema registry, **shared with clients and the conformance/contract-test suites**.
- **Versioning:** URL-versioned public API; event schemas carry `event_version` with **upcasters** applied on read (client and server) so old logs always project.
- **Errors:** RFC 7807 `problem+json`; batch endpoints return per-item error arrays.
- **Idempotency:** `event_id` for events; `Idempotency-Key` header for command endpoints.
- **Compatibility rule:** only additive changes within a major version; a removed/renamed field is a new major version + an upcaster.

### 3.11 Event architecture

**Domain events (`EVT-*`)** — the event-sourced write model:

- ~70 types across match lifecycle, ball & wicket, interruption/DLS/review, correction, and dual-scorer (`docs/domain/domain-model.md` §9).
- **Immutable, ordered, hash-chained, per-device-streamed.** A correction is a new `EVT-*Corrected` / insert / void referencing `supersedes` (`MINV-01`, `MBR-04`).
- **Projections** (scorecard, cards, FoW, partnerships, run-rate ladder, DLS par ladder, powerplay plan, commentary, live-state, reconciliation report, audit view) are pure folds over the **active** (non-superseded, non-void) event set (`MINV-02`) and are rebuildable at any time (`MBR-07`).
- **Ordering:** dense `event_ordinal` (timeline), `hlc` (causal), `device_seq` (per device) — see §3.7.
- **Determinism & replay:** same log ⇒ same projection on any build (`NFR-034`); underpins convergence, audit reconstruction, and recovery.

**Integration events** — cross-context propagation:

- Written to an **`outbox`** table **in the same transaction** as the triggering state change (e.g. accepting a sign-off) — the transactional outbox pattern (`ADR-09`).
- A **dispatcher** (DB trigger enqueue + scheduled drainer) delivers at-least-once to consumers: competition recompute, profile/career recompute, search indexing, notifications, webhooks (V2). Consumers are **idempotent** (keyed on the integration event id).
- Downstream contexts are **eventually consistent** and only ever consume FINAL, non-disputed facts (`MINV-16/17`).

**Event catalogue governance:** every type has a versioned JSON Schema; the **conformance suite** (`NFR-033`) replays canonical event logs and asserts the resulting projections; the **sync-convergence suite** replays shuffled multi-device logs and asserts identical merges (`QA-4`).

### 3.12 Audit architecture

**Three layers:**

| Layer | Contents | Properties |
|---|---|---|
| **Domain audit** = the `match_events` log itself | Every scoring fact and correction, with `actor_user_id` + `provenance` (`app_version, platform, os, device, build_hash`) and `supersedes` chains. | Append-only; hash-chained per stream; the human-readable **audit view** (`AUD-004`) is a projection over it. |
| **Cross-cutting `audit_log`** | Auth events (login, refresh-fail, revoke), membership/role changes, **impersonation** start/stop + every impersonated action (double-attributed), guardrail & reconciliation **overrides** with reasons (mirrored from `match_events` for a single pane), **sign-offs** + versions + reconciliation state, **exports**, share-link create/revoke, admin/platform actions (feature flags, rollout, reference-data publish), retention/anonymisation runs, dispute locks + adjudications, player merges. | Append-only; **hash-chained** (`prev_hash`/`hash` over a canonicalised record); INSERT only via a `SECURITY DEFINER` function; no UPDATE/DELETE grant to any app role. |
| **Reconciliation reports** | One per interval checkpoint and one at each sign-off, enumerating every `INV-*` as `PASS`/`FAIL(detail)`. | Immutable; linked to the match + sign-off version (`AUD-006`, `INV-018`). |

- **Tamper-evidence (`AUD-003`, `SEC-012`):** per-record hash chains; a scheduled **chain-verification job** re-hashes and checks continuity; the latest chain heads are periodically **anchored** to a separate append-only store (or signed) so even a privileged DB operator cannot silently rewrite history without detection.
- **Anonymisation-safe hashing:** the chain hashes an `actor_ref` (a stable surrogate key), **not** raw PII. On account deletion the `actor_ref` is remapped to an anonymised surrogate *in place* (`AUD-014`, `BR-023`); the canonicalisation is documented so hashes remain verifiable after anonymisation.
- **DLS revision audit (`AUD-009`):** each revision records inputs (overs lost, wickets, score, time), method/table version, actor, timestamp, and supersede/revert links — applies to manual targets too while `SPK-01` is open.
- **Cascade summaries (`AUD-010`):** a correction that triggers `SVC-CASCADE-RECOMPUTER` stores which projections changed and any strike-continuity breaks, alongside the correcting event.
- **Export (`AUD-013`):** an authorised role can export a match's full trail (events + provenance + overrides + reconciliation reports + sign-offs) as JSON + a rendered PDF.
- **Operator views (`AUD-015`):** dashboards read a PII-free projection of audit/telemetry data.

### 3.13 Observability

| Pillar | Design |
|---|---|
| **Logs** | Structured JSON with correlation ids (`request_id`, `match_id`, `sync_batch_id`, `event_id`); **no PII** (`NFR-035`, `AUD-015`). Edge Function + Postgres logs → log drains → a log store. Client logs: on-device ring buffer, opt-in upload on crash/error. |
| **Metrics** | Sync: p50/p95 sync duration (`NFR-006` ≤ 30 s/T20 on 3G), events/batch, reject rate by reason, outbox depth, high-water lag. Reliability: crash-free session rate, **event-loss incidents (target 0, `NFR-009`)**, recovery success, durable-write latency. Client perf: input→ack (`NFR-002` ≤ 100 ms), cold start (`NFR-005` ≤ 3 s), scorecard render (`NFR-004` ≤ 1 s), interactions/delivery (`NFR-001` ≤ 2). Backend: function latency/error rate, Postgres connections/locks/replication lag, Realtime connections + fan-out lag (**viewer freshness p95 < 10 s**), storage usage. Business/quality: matches scored, sign-offs, reconciliation-override rate, **conformance-suite pass % (must be 100%)**, **parity-matrix score (≥ 95%)**, availability (`NFR-013` ≥ 99.5%). |
| **Traces** | OpenTelemetry across Edge Functions → Postgres; client spans for `score → persist → sync`. |
| **Dashboards** | Per-environment; a **release-health** board mapped to roadmap gates; a **pilot** board (per-match error rate, time-per-delivery distribution, override reasons — feeds Build→Verify→Feedback→Improve). |
| **Alerting** | SLO burn (availability, sync p95, error rate); **event-loss = page immediately**; **audit chain-verification failure = page**; backup-verification failure; replication lag; storage/quota thresholds. |
| **Synthetic checks** | A scripted "score a T20 offline, then sync" canary; the **DLS benchmark job** each release; the **conformance suite** in CI (blocks release below 100%); the **sync-convergence** suite. |
| **Feedback telemetry** | Privacy-respecting, disclosed, opt-outable (`NFR-042`): time-per-delivery, undo/correction rate, override rate per guardrail, offline duration per match, crash/recovery events. Aggregate-only. |

### 3.14 Backup & recovery

**Core property:** the **event logs are the recoverable truth**; every projection is rebuildable (`MBR-07`, `NFR-034`). Backup therefore protects the **event logs + audit log + the small set of non-derived tables** (orgs, memberships, players, teams, competitions, `reference_data`, `sign_offs`, `share_links`, `api_keys`).

| Scope | Mechanism |
|---|---|
| **Backend PITR** | Continuous WAL archiving with a configurable retention window (point-in-time restore). |
| **Backend snapshots** | Daily logical export to object storage in a **separate region/account**; schema + migrations version-controlled; reference-data snapshots. |
| **Backup verification** | Scheduled restore-and-verify job (checks row counts, hash-chain continuity, a sample projection rebuild); failure alerts. |
| **Client cloud backup** | "Auto-backup each match as scored" (`ONR-007`) is just normal sync — once acknowledged, the match is durable server-side. |
| **Client local backup** | Signed archive of selected matches' event logs + metadata; restorable offline on another device; lossless round-trip (`FR-149`, `OFF-011`). |
| **Projection rebuild** | On corruption or a bad projection deploy: drop `match_snapshots` / `standings` / `career_stats` and rebuild from `match_events` — fast, deterministic. |

**Recovery scenarios (RPO / RTO targets):**

| Scenario | Behaviour | RPO / RTO |
|---|---|---|
| Device lost, match synced | Re-login on a new device, pull. | 0 / minutes |
| Device lost, match **not** synced | Loss limited to the unsynced tail; mitigated by local backup files + "sync now" nudges + (V1+) periodic cloud checkpoint. | ≤ last checkpoint / minutes |
| Backend region outage | Clients keep scoring offline (`NFR-014`); failover to standby; queued work drains on recovery. | minutes (PITR) / hours |
| Data corruption / bad projection deploy | Rebuild projections from `match_events`. | 0 / minutes–hours |
| Bad reference-data publish | Central hot-fix; in-progress matches keep the pinned version (`BR-032`). | 0 / minutes |
| Bad client release | Feature-flag off or staged rollback; client downgrade **must not** lose unsynced local data (`OFF-012`, `SEC-018`). | 0 / minutes |
| GDPR erasure | Anonymise `actor_ref` in place; purge personal tables; Final matches retained (`BR-023`); backups age out per retention, propagating erasure. | n/a |

**Drills:** quarterly restore drill (`ADM-110`); a documented incident runbook; a status/maintenance banner mechanism (`ADM-111`).

### 3.15 Security boundaries

Trust zones and the checks at each crossing:

| # | Boundary | Controls at the crossing |
|---|---|---|
| B1 | **Device local store ↔ app** | OS sandbox + file-based encryption (`SEC-007`); guest data has no server identity (`SEC-016`); secure storage for refresh token/claims. |
| B2 | **Client ↔ Backend (public internet)** | **TLS only** (`SEC-001`), no plaintext downgrade; JWT auth; rate limiting (`SEC-010`); request validation; RFC 7807 errors. **All client input is untrusted** → the server re-validates every event (`SEC-014`, `SYNC-005`). |
| B3 | **Auth (GoTrue) boundary** | Credential hashing, token issue/refresh/revoke, admin MFA, lockout/backoff on abuse. |
| B4 | **API gateway / Edge ↔ Postgres** | **RLS is the hard authorization boundary** (`SEC-004`). Edge Functions use the service role only for server-side work and pass a user-scoped client for user actions; `SECURITY DEFINER` helpers are minimal and audited. |
| B5 | **Tenant ↔ Tenant** | `organization_id` isolation via RLS on every row; no cross-tenant joins in client-reachable views; per-consumer API keys (`SEC-017`). |
| B6 | **Realtime channel join** | Authorized against match/org membership or a valid, unrevoked share token; viewers receive a **read-only projection stream**, never raw events with PII beyond names. |
| B7 | **Public / anon surface** (share-link viewer, public competition pages, public read API) | Served from **redacted, purpose-built projections**; no write paths; unguessable tokens (`SEC-009`); aggressive rate limits; minors' fields redacted (`SEC-013`). |
| B8 | **Admin / platform plane** | Separate roles, MFA, every action audited and double-attributed; impersonation needs stored consent and is time-boxed (`SEC-011`); feature-flag / rollout / reference-data controls restricted (`SEC-018`). |
| B9 | **Backups / exports store** | Encrypted at rest, separate credentials, separate region/account, access-logged, retention-bound. |
| B10 | **CI/CD & secrets** | Service keys never in client bundles; secrets in a manager; build provenance / SBOM; **conformance + contract/parity tests gate release**; signed releases. |

**Data classification:** low-sensitivity, **high-integrity** (`A-10`) → controls weighted to integrity, attribution and tamper-evidence, while still encrypting in transit and at rest and minimising PII (names-only default, `NFR-037`).

**Threat → control map (from `R1 §10` risks):**

| Threat | Controls |
|---|---|
| Tampered or unauthorised score edits (risk 15) | Append-only + hash chain + external anchoring (`AUD-003`); RLS scorer-only INSERT, no UPDATE/DELETE (`SEC-006`, `MINV-01`); full audit. |
| Sync corruption via naive merge (risk 4) | Deterministic total order; **no last-write-wins**; server re-validation; divergences surfaced, never dropped (`SYNC-009/010`). |
| Data loss on mobile crash (risk 5) | Write-ahead durable commit before UI confirm; replay recovery; chaos test as a release gate (`SPK-03`). |
| Cross-tenant leakage (risk 15) | RLS on every tenant row; redacted public projections; channel-join authz. |
| Minors' data exposure (risk 16) | Redacting views; guardian/role-gated access (`SEC-013`, `NFR-039`). |
| DLS / MCC IP (risks 2, 3) | Licensing gate (`SPK-01`); `RainMethod` pluggable; rules as logic + citations, no verbatim corpus (`SPK-06`). |
| Abuse of public/API endpoints (risk 9) | Rate limiting, quotas, graceful degradation to polling (`SEC-010`, `NFR-021`). |

### 3.16 Key runtime flows

**A. Score a delivery offline**

```
Scorer taps "4" ─▶ CMD-RECORD-DELIVERY ─▶ Core: check state, INV-*, config profile, guardrails
   ok ─▶ emit EVT-DELIVERY-RECORDED ─▶ append to local log (durable, hash-linked) + enqueue outbox
       ─▶ fold into projection (score, striker via SVC-STRIKE-RESOLVER, over/ball, run rate)
       ─▶ UI confirms (≤100 ms)                     [no network involved]
```

**B. Sign-off**

```
Head Scorer signs ─▶ Core runs SVC-RECONCILER (INV-001…018) ─▶ FAIL → block (BR-007) unless reasoned override (AUD-005)
   PASS/override ─▶ emit EVT-MATCH-SIGNED-OFF (version n) + store reconciliation report locally
   online now/later ─▶ /sync/events ships all events ─▶ POST /matches/:id/signoff
       server: re-run SVC-RECONCILER on the merged log; SVC-RESULT-DERIVER; if consistent →
         write immutable match_snapshot (version n) + sign_off row + outbox: MatchFinalised
   outbox dispatcher ─▶ competition recompute (standings/NRR) ─▶ profile/career recompute ─▶ notifications
```

**C. Viewer follows a live match**

```
Viewer opens share link ─▶ public path validates token (unrevoked) ─▶ subscribe Realtime match:{id}
   scorer syncs events ─▶ server refreshes live_state projection ─▶ Realtime pushes delta
   viewer offline OR source offline ─▶ show "last updated X ago" + offline indicator (FR-138)
   fan-out over capacity ─▶ client falls back to periodic GET of the snapshot (NFR-021)
```

**D. Dual-scorer reconciliation (P2)**

```
Scorer A stream, Scorer B stream (independent, both synced)
  ─▶ SVC-DIVERGENCE-DETECTOR aligns by over/ball ─▶ writes divergences[] (OPEN)
  ─▶ A proposes agreed version (PROPOSED, proposedBy=A)
  ─▶ B confirms (CONFIRMED, confirmedBy=B) ─▶ emit divergence-resolved into both streams
  ─▶ projections converge; sign-off unblocked when no OPEN/PROPOSED remain (SYNC-014, MINV-14)
```

**E. Cross-device handoff (P1)**

```
Device 1 holds writer fence F. Battery dies.
Device 2 opens the match ─▶ pulls cloud copy ─▶ requests fence ─▶ server issues F+1, invalidates F
Device 1 returns ─▶ next /sync/events with fence F ─▶ rejected (stale) ─▶ UI: read-only + "take over?"
```

### 3.17 Scaling model

| Dimension | Approach |
|---|---|
| **Edge Functions** | Stateless → horizontal autoscale; all state in Postgres/Storage. |
| **Postgres connections** | Connection pooler (Supavisor/PgBouncer) in transaction mode; functions hold connections briefly. |
| **`match_events` growth** | Partitioned (hash of `match_id` or monthly); per-match reads touch one/few partitions; cold partitions archivable to cheaper storage; `match_snapshots` serve most reads so the log is rarely scanned live. |
| **Read load** | Read replicas for PostgREST reads, competition/profile queries, and public pages; primary reserved for writes + sign-off materialisation. |
| **Realtime fan-out** | Per-match channel; server publishes **deltas** not full state; under load, clients degrade to periodic snapshot polling (`NFR-021`); backpressure on publish. |
| **Competition/profile recompute** | Incremental (`source_version` watermark), queued via outbox, idempotent; batch sweeps off-peak. |
| **Exports / PDF** | Async job → Storage → signed URL; never inline in a request. |
| **Multi-region (future)** | Read replicas near users; single primary write region; clients' offline-first nature masks write latency. |
| **Targets** | `NFR-013` ≥ 99.5% monthly; `NFR-016` concurrent-match/viewer target set in planning; `NFR-018` multi-season tenant history within query budget. |

### 3.18 Failure model & graceful degradation

| Failure | System behaviour |
|---|---|
| **No connectivity** | Full scoring, correction, reconciliation, sign-off, local export continue; outbox accumulates; UI shows offline + last-synced (`OFF-021/022`). |
| **Backend degraded/unavailable** | Same as offline for scoring; publish/notify queue and drain on recovery (`NFR-014`, `OFF-018`). |
| **Realtime down** | Viewers fall back to snapshot polling; scoring unaffected (Realtime is not the durability path). |
| **Sync partial failure** | Per-event rejects surfaced; outbox does not advance past a rejection; client retries with backoff; no partial/torn match state (transactional append). |
| **Clock skew** | Detected on ingest via HLC bounds; flagged for review; events **not** dropped or blindly reordered (`SYNC-007`, `OFF-015`). |
| **Two devices, one stream (P1)** | Fence token → later device read-only with take-over prompt; no merge, no loss. |
| **Projection deploy bug** | Rebuild projections from the immutable log; write model untouched. |
| **DLS unavailable (`SPK-01`)** | `RainMethod = NONE`; manual target entry only; DLS UI behind a flag; results still lawful (`FR-084`). |
| **Reference-data error** | Central hot-fix; in-progress matches keep pinned version. |
| **Audit chain verification fails** | Page on-call; freeze the affected scope; investigate from anchored heads + backups. |

---

## 4. Implementation Layer

Concrete selections. **No production code** — technology choices, patterns, sketches. Each selection lists a **recommendation**, the **rationale**, and a **credible alternative** so the decision is reversible.

### 4.1 Technology selections (per container)

| Container | Recommendation | Rationale | Alternative |
|---|---|---|---|
| **Shared scoring core** | **Kotlin Multiplatform (KMP)** library — JVM target for Android, JS/wasm target for Web | One source for the complex cricket logic; native perf on Android; type safety both sides; team can hire for Kotlin. Parity still gated by contract tests. | **Rust core** (wasm for Web, UniFFI bindings for Android) — maximal determinism, but rarer skills. Last resort: **spec + two implementations** (rejected: unmaintainable for a small team, `C-11`). |
| **Web app** | **React + TypeScript**, Vite, Workbox service worker, PWA | Largest ecosystem for PWA + accessibility; TS aligns with the JS core build. | SolidJS / Svelte (smaller, faster) — viable, smaller talent pool. |
| **Web local store** | **IndexedDB** via a thin typed wrapper (e.g. Dexie-style) | Only durable, transactional, large-capacity browser store. | OPFS + SQLite-wasm — promising, heavier, newer. |
| **Web state** | Domain state = the projection object (from the core); **UI state** = a small store (Zustand-style) | Keeps one source of domain truth; avoids state duplication. | Redux Toolkit — more ceremony than needed. |
| **Web charts** | A dependency-light SVG/canvas chart approach, offline-capable | `OFF-009` requires charts with no network. | A full chart lib bundled locally — heavier. |
| **Android app** | **Kotlin, Jetpack Compose**, single-activity, MVI | Modern, testable, first-class offline + lifecycle handling. | Fragments + XML — legacy. |
| **Android local store** | **SQLite via SQLDelight** (typed, multiplatform-friendly) | Deterministic SQL, KMP-compatible, explicit control over transactions/`fsync`. | Room — fine, less KMP-aligned. Realm — opaque sync semantics we don't want. |
| **Android background work** | **WorkManager** | Guaranteed, constraint-aware, survives reboot. | Foreground service alone — heavier, not for deferrable sync. |
| **Backend platform** | **Supabase** (managed Postgres + Auth/GoTrue + Realtime + Edge Functions + Storage) | `A-09`, `C-8`, `C-11`; least ops for a small team; RLS gives a real data-layer boundary. | Self-managed Postgres + a framework (NestJS/…): more control, far more ops. |
| **Server functions** | **Edge Functions (Deno / TypeScript)** | Share JSON-Schema + types with the clients; stateless; quick deploys. | A container service for heavy jobs (exports) if function limits bite. |
| **Realtime** | **Supabase Realtime** (Postgres changes + broadcast + presence) | Built-in; channel authz; degrades to polling. | Dedicated pub/sub (Ably/Pusher) if fan-out outgrows it. |
| **Object storage** | **Supabase Storage**, backups mirrored to a **separate region/account** bucket | Signed URLs, RLS-aware. | S3-compatible external bucket. |
| **Auth** | **GoTrue** (in Supabase) | Integrated with RLS via JWT. | Auth0/Clerk if enterprise SSO is later required. |
| **Schema registry** | A versioned folder of **JSON Schemas** in the repo, published as a package to clients + tests | Single source for events/commands/API. | A hosted registry — overkill for v1. |
| **Observability** | **OpenTelemetry** → hosted backend (traces + metrics); log drain → log store; uptime/synthetics | Vendor-neutral instrumentation. | Cloud-provider-native stack. |
| **CI/CD** | Git-based pipeline: lint → unit → **conformance suite** → **contract/parity** → build → preview env → e2e/chaos → deploy | Quality gates from the SRS are mechanical. | — |

### 4.2 Shared scoring core (the parity mechanism — `SPK-04`)

- **Contents:** the deterministic rules engine (state machines `SM-MATCH`/`SM-INNINGS`/`SM-DELIVERY`/…), the config resolver over `CFG-REG`, all 13 `SVC-*`, the `EVT-*` fold functions producing every projection, the `INV-*`/`MINV-*` checks, `RainMethod` (`DLS` | `NONE`), and the Cricsheet anti-corruption translator.
- **Purity:** no I/O, no clock, no RNG, no storage. Time, ids and persistence enter through **ports** (`ClockPort`, `IdPort`, `EventLogPort`, `ReferenceDataPort`); platforms supply adapters.
- **Distribution:** built once per platform (JVM artifact for Android; JS/wasm bundle for Web) from the same source; version-pinned; the build hash is stamped into `provenance` on every event.
- **Parity gate:** a **contract-test corpus** — canonical `(config, input command sequence) → expected projection + expected reconciliation report` cases — is executed against **both** platform builds in CI. The **parity matrix** score (≥ 95%, target 100% on the scoring core) is published as a metric (`NFR-047/048`). The conformance suite (`NFR-033`, every `CSR-*` + worked examples) runs against the core and must pass 100% to release.
- **Config, not forks:** competition variations (wide interpretation, powerplay model, bowler cap, free-hit on/off, last-man-stands, impact player, The Hundred blocks) are `CFG-REG` values resolved into an immutable `PlayingConditionsProfile`, frozen at first delivery (`MINV-05`).

### 4.3 Web implementation notes

- **Build:** Vite; code-split by route (scorebox / scorecard / admin / viewer); the core as a pinned internal package.
- **Service worker:** precache app shell + fonts + icons; runtime cache (stale-while-revalidate) for versioned reference data; a `SKIP_WAITING` update flow with a "reload to update" prompt; **never** cache API mutations.
- **Persistence:** one IndexedDB database, object stores per §3.6; all event appends + outbox advance in a single transaction; `navigator.storage.persist()` requested on first match.
- **Offline authz:** the signed claims snapshot is verified locally (public key shipped with the app) to gate role-based UI while offline.
- **Print:** dedicated print stylesheets for scorecard + linear sheet (`WEB-005`).
- **i18n:** message catalogues loaded per locale; `Intl` for dates/numbers; timestamps rendered in the match timezone (`NFR-044/045`).
- **Concurrency:** a `BroadcastChannel` + IndexedDB lock coordinates multiple tabs; only one tab holds the writer role.

### 4.4 Android implementation notes

- **Modules:** `:core` (KMP scoring core), `:data` (SQLDelight, repositories, sync), `:domain` (use-cases), `:ui` (Compose), `:app`.
- **Durability:** SQLite WAL; the event-append transaction issues an explicit checkpoint/`fsync` before returning; an optional newline-delimited append-only journal file written first as a redo source; startup replay verifies the projection against the log tail.
- **Sync workers:** `WorkManager` unique periodic + expedited one-off on connectivity; batches capped; backoff; surfaces progress + unsynced count via a `Flow` to the UI.
- **Lifecycle:** MVI state persisted to SQLite continuously, not just `onSaveInstanceState`; wake-lock while a match is actively being scored.
- **Security:** refresh token + claims snapshot in Keystore-backed `EncryptedSharedPreferences`; `android:allowBackup="false"` for app-private data (backups are the explicit signed-archive feature); minimal permissions.
- **Accessibility:** Compose semantics for TalkBack; `fontScale` respected; contrast-checked sunlight theme.

### 4.5 Backend implementation (Supabase mapping)

| Concern | Implementation |
|---|---|
| **Schema & migrations** | SQL migrations in the repo; one schema namespace per bounded context; RLS policies co-located with tables; `SECURITY DEFINER` helper functions (`my_orgs()`, `has_match_role()`, audit-insert) reviewed and covered by policy tests. |
| **Event ingest** | `sync-ingest` Edge Function: validate (JSON Schema by `type@version`) → authorize (`SVC-AUTHORIZER` + RLS via user-scoped client) → check `device_seq` contiguity + `hash` chain + conditions-freeze → append in one `INSERT ... ON CONFLICT (event_id) DO NOTHING` transaction → return high-water + per-event results. |
| **Sign-off materialise** | `signoff` Edge Function: fold the merged log with the shared core → run `SVC-RECONCILER` + `SVC-RESULT-DERIVER` → on success write `match_snapshots(version)` + `sign_offs(version)` + `reconciliation_reports` + `outbox: MatchFinalised`, all in one transaction. |
| **Outbox dispatch** | Trigger enqueues; a scheduled `outbox-drainer` function delivers to consumers with ret/backoff; consumers keyed idempotent. |
| **Competition/profile recompute** | Functions consuming `MatchFinalised`/`MatchResultAmended`; incremental via `source_version`; write `standings` / `career_stats`. |
| **Exports** | `exports` function enqueues a job; a worker builds PDF/CSV/Cricsheet via `SVC-EXPORT-TRANSLATOR` → Storage → signed URL → notify. |
| **Share links** | `share-links` function creates `{token_hash, match_id, expires_at}`; a public `viewer` function/path resolves a token to the match's `live_state`/`match_snapshots` only. |
| **Admin** | `admin/*` functions gated by platform-admin role + MFA + audit; impersonation checks `impersonation_consents`. |
| **Scheduled** | `pg_cron`: chain-verification, backup-verification, retention/anonymisation, recompute sweeps, notification digests. |
| **Reference data** | `reference_data` rows versioned; an admin publish function bumps versions; clients pull via `/sync/changes` or a dedicated endpoint; matches pin at creation. |

### 4.6 Database schema sketch (tables + key columns — not DDL)

> Illustrative field lists to fix the contract. Types/constraints/indexes are decided in implementation.

- **`organizations`**(`id`, `name`, `branding`, `created_at`)
- **`memberships`**(`user_id`, `organization_id`, `roles[]`, `status`, `created_at`) — RLS anchor
- **`users`**(`id`, `email`, `display_name`, `is_minor`, `guardian_user_id?`) — mirror of auth
- **`teams`**(`id`, `organization_id`, `name`, `canonical_ref?`)
- **`players`**(`id`, `organization_id`, `name`, `dob?`, `photo_ref?`, `merged_into?`)
- **`squads`**(`team_id`, `player_id`, `role_hint?`)
- **`matches`**(`id`, `organization_id?` (null=guest), `origin_device_id`, `claim_status`, `format`, `conditions_profile_version`, `dls_table_version`, `rain_method`, `state`, `created_at`)
- **`match_events`**(`event_id`, `match_id`, `scorer_stream_id`, `device_id`, `device_seq`, `hlc`, `event_ordinal`, `type`, `event_version`, `payload`, `supersedes?`, `actor_ref`, `provenance`, `recorded_at`, `server_received_at`, `prev_hash`, `hash`) — **append-only, partitioned, hash-chained**
- **`match_snapshots`**(`match_id`, `snapshot_version`, `as_of_event_ordinal`, `projection` (jsonb), `created_at`, `immutable=true`)
- **`live_state`**(`match_id`, `projection` (jsonb), `updated_at`) — hot read model for viewers
- **`sign_offs`**(`match_id`, `version`, `signed_by`, `counter_signatures[]?`, `reconciliation_state`, `signed_at`, `supersedes_version?`)
- **`reconciliation_reports`**(`match_id`, `checkpoint`, `results[]` (`inv_id`, `status`, `detail`), `created_at`)
- **`dls_revisions`**(`id`, `match_id`, `inputs` (jsonb), `method_version`, `outputs` (jsonb), `status`, `supersedes?`, `actor_ref`, `created_at`)
- **`divergences`**(`id`, `match_id`, `over_ball`, `field`, `version_a`, `version_b`, `status`, `proposed_by?`, `confirmed_by?`, `resolved_event_id?`) — P2
- **`competitions`**(`id`, `organization_id`, `format`, `conditions_profile_version`, `points_model`, `nrr_rule`, `bonus_model`)
- **`fixtures`**(`id`, `competition_id`, `home_team_id`, `away_team_id`, `scheduled_at`, `match_id?`, `scorer_assignments[]`)
- **`standings`**(`competition_id`, `team_id`, `points`, `nrr`, `bonus`, `source_version`)
- **`appearance_claims`**(`id`, `player_id`, `match_id`, `status`, `approved_by?`)
- **`career_stats`**(`player_id`, `scope`, `aggregates` (jsonb), `source_version`)
- **`share_links`**(`id`, `match_id`, `token_hash`, `created_by`, `expires_at?`, `revoked_at?`)
- **`api_keys`**(`id`, `organization_id`, `prefix`, `secret_hash`, `scopes[]`, `rotated_at?`, `revoked_at?`) — V2
- **`impersonation_consents`**(`id`, `subject_user_id`, `admin_user_id`, `granted_at`, `expires_at`, `reason`)
- **`audit_log`**(`id`, `category`, `actor_ref`, `target_ref`, `action`, `detail` (jsonb), `reason?`, `prev_hash`, `hash`, `created_at`) — **append-only, hash-chained**
- **`outbox`**(`id`, `integration_event_type`, `payload` (jsonb), `created_at`, `dispatched_at?`, `attempts`)
- **`reference_data`**(`kind`, `version`, `payload` (jsonb), `published_at`) — DLS tables, condition templates, app config
- **`exports`**(`id`, `match_id?`, `format`, `status`, `storage_ref?`, `requested_by`, `created_at`)
- **`feature_flags`**(`key`, `value`, `scope`, `updated_by`, `updated_at`)

### 4.7 API surface catalogue

| Method · Path | Purpose | Auth | Idempotency |
|---|---|---|---|
| `POST /sync/events` | Batch-append a device's `EVT-*`; per-event validate/accept/reject | JWT + RLS (scorer) | `event_id` |
| `GET /sync/changes` | Pull events since caller's high-water marks | JWT + RLS | cursor |
| `POST /sync/fence` | Acquire/renew the writer fence for a match | JWT + RLS | fence value |
| `GET /rest/v1/{matches,competitions,standings,players,fixtures}` | Resource reads | JWT + RLS | — |
| `POST /matches/:id/signoff` | Materialise sign-off (server re-reconcile) | JWT + `SVC-AUTHORIZER` | `Idempotency-Key` |
| `POST /matches/:id/corrections` *(optional server assist)* | Accept a correction batch (still client-derived) | JWT + RLS | `event_id` |
| `POST /exports` | Request PDF/CSV/Cricsheet export job | JWT | `Idempotency-Key` |
| `POST /share-links` · `POST /share-links/:id/revoke` | Create / revoke a viewer link | JWT + owner | `Idempotency-Key` |
| `GET /viewer/:token` | Public read-only viewer projection | share token | — |
| `POST /competitions/:id/recompute` | Force standings/NRR recompute | JWT + organizer | `Idempotency-Key` |
| `POST /appearance-claims/:id/approve` | Approve a claim | JWT + authorised role | `Idempotency-Key` |
| `POST /admin/impersonate` · `/admin/feature-flags` · `/admin/reference-data` | Platform-admin ops | JWT + platform-admin + MFA | `Idempotency-Key` |
| `Realtime: match:{id}` / `scoring:{id}` / `org:{id}` | Projection deltas / co-scorer / dashboards | channel authz | — |
| `GET /api/v1/...` (V2) | Public read API | API key + rate limit | — |
| `POST` webhook `match.finalised` (V2) | Outbound, HMAC-signed | shared secret | delivery id |

### 4.8 Event & schema governance

- **Every `EVT-*` and `CMD-*`** has a JSON Schema at `schemas/events/<type>/<version>.json` in the repo, published as a versioned package consumed by clients, Edge Functions, and the test suites.
- **Upcasters:** a pure function per `(type, from_version → to_version)` in the shared core; applied on every read so historical logs always project (`NFR-034`).
- **Compatibility:** additive-only within a major; removal/rename ⇒ new major + upcaster; CI fails on a breaking schema diff without a version bump.
- **Canonicalisation:** a documented deterministic serialisation (key order, number formatting) used for `hash` computation so chains verify identically on every platform and after anonymisation (hashes cover `actor_ref`, not PII).
- **Conformance corpus:** canonical logs + expected projections, versioned alongside the rules reference; a new confirmed `[EDGE]` case adds a `CSR-*` entry and a corpus case before the fix ships.

### 4.9 Observability stack

- **Instrumentation:** OpenTelemetry SDKs in Edge Functions and clients; trace context propagated on `/sync/*` calls.
- **Metrics store + dashboards:** a hosted metrics backend; dashboards as code; the "release-health" and "pilot" boards from §3.13.
- **Logs:** Supabase log drains → a log store with correlation-id search; client crash/error bundles uploaded on consent.
- **Alerting:** SLO-burn rules; hard pages for event-loss, audit-chain failure, backup-verification failure.
- **Synthetics:** a headless "offline T20 then sync" canary per environment; the DLS benchmark job; the conformance + convergence suites in CI.

### 4.10 CI/CD, environments, release management

- **Environments:** `dev` → `staging` → `prod`, each its own Supabase project; ephemeral preview environments per pull request.
- **Pipeline:** lint → unit → **conformance suite (100% required)** → **contract/parity matrix** → build (web bundle, Android artifact, core artifacts) → deploy preview → e2e + **offline chaos** + **sync convergence** → migrations dry-run → deploy.
- **Release controls:** feature flags per roadmap bucket; staged rollout for Android; web SW update prompt; one-click rollback; **client downgrade must preserve unsynced local data** (`OFF-012`, `SEC-018`).
- **Migrations:** forward-only, reviewed, tested against a prod-like snapshot; RLS policy tests are part of the suite.
- **Secrets:** in a manager; service-role key server-only; SBOM + provenance on build artifacts; signed releases.

### 4.11 Test strategy (maps to SRS verification gates)

| Test type | What it proves | SRS gate |
|---|---|---|
| **Cricket-rules conformance suite** | Every `CSR-*` / `DR-*` + worked examples; accredited-scorer-reviewed. | `NFR-033`; 100% to release. |
| **Cross-platform contract / parity** | Identical projections on Web and Android for the corpus. | `NFR-047/048`; matrix ≥ 95%. |
| **Offline chaos test** | 0 ball-events lost across force-kill / battery-pull / OS-eviction / airplane toggling over ≥ 50 innings on target hardware. | `NFR-009…011`; `SPK-03`; pre-pilot gate. |
| **Sync convergence** | Shuffled multi-device logs → identical merged projection; conflicts surfaced, never dropped. | `NFR-016/017`; `SYNC-009/010`; P2 gate. |
| **Dual-scorer divergence** | Seeded disagreements surface and never silently merge. | `FR-116…119`; P2 gate. |
| **DLS benchmark** | Revised targets/par within published rounding tolerance vs reference. | `FR-083…091`; each DLS change. |
| **RLS policy matrix** | No row readable/writable outside the actor's role scope; `match_events` not updatable/deletable. | `SEC-004/006`; each auth/policy change. |
| **Audit chain verification** | Hash chains continuous; anonymisation preserves verifiability. | `AUD-003`; continuous + CI. |
| **Accessibility audit** | WCAG 2.2 AA on core web flows; keyboard; screen reader; contrast; one-handed. | `NFR-019`; pre-pilot / pre-GA. |
| **Performance budgets** | Input latency, cold start, chart render, battery, sync duration on target hardware. | `NFR-001…007`; every build. |
| **Load / availability** | Concurrent live matches + viewer fan-out; graceful degradation. | `NFR-013/016/021`; pre-beta / pre-GA. |
| **Interoperability** | Cricsheet schema validation + round-trip fidelity. | `NFR-030/031`; each export/import change. |

---

## 5. Characteristic traceability

How each required characteristic is made structural, with the mechanism and the SRS references it satisfies.

| Characteristic | Mechanisms (this doc) | SRS / objective refs |
|---|---|---|
| **Online** | Managed backend as an eventual destination (§3.4); Realtime viewer fan-out + co-scorer channel (§3.10); server-side projections, competitions, profiles, exports, notifications (§3.4, §3.11). | `FR-137/138`, `FR-123…129`, `ONR-*`, `OBJ-05/10` |
| **Offline** | Local-first authoritative event log (§3.6, ADR-02); shared core runs fully on device (§4.2); service-worker/app-cache; outbox; offline DLS/exports/charts; offline auth grace (§3.8). | `NFR-012`, `OFF-001…022`, `OBJ-02` |
| **Reliable** | Write-ahead durable commit before UI confirm (§3.3, §3.6); crash-recovery by replay; idempotent resumable sync (§3.7); queue-and-retry; transactional append (no torn state); chaos test as a gate (§4.11). | `NFR-009…015`, `OFF-003/004`, `SPK-03`, `OBJ-02` |
| **Secure** | RLS as the hard authorization boundary (§3.9, B4); scorer-only INSERT, no UPDATE/DELETE on `match_events` (§3.5); TLS-only, server re-validation of all input (§3.15 B2); least-privilege client (SEC-003); consented+logged impersonation; 10 enumerated trust boundaries (§3.15). | `SEC-001…018`, `NFR-023…030`, `OBJ-07` |
| **Scalable** | Stateless functions (§3.4); `match_events` partitioning + snapshots serving reads (§3.5, §3.17); read replicas; connection pooling; Realtime delta publish + polling degradation; incremental recompute via `source_version`. | `NFR-016…018/021`, `OBJ-10` |
| **Auditable** | Event log *is* the audit trail with provenance on every event (§3.12); separate hash-chained `audit_log`; stored reconciliation reports + sign-off versions; external anchoring; anonymisation-safe hashing; audit export. | `AUD-001…015`, `NFR-025`, `OBJ-07` |
| **International-standard** | One rules core + versioned `CFG-REG` (config, not forks) (§4.2); conformance suite gate; `RainMethod` strategy for DLS (`SPK-01`); Cricsheet anti-corruption translator (`SPK-05`); externalised strings, locale formatting, match-timezone timestamps; WCAG 2.2 AA gate. | `DR-01…36`, `NFR-019/030/040/041/043…045`, `SPK-01/05/06`, `OBJ-01/11` |
| **Multi-device** | Per-device streams with stable identity (§3.7); cloud copy + fence-token handoff (flow E); independent dual-scorer streams (P2); viewers on any device via share link. | `FR-167`, `FR-107…111`, `SYNC-*`, `OBJ-03/06` |
| **Synchronization capable** | Deterministic total order (dense ordinal → HLC → device seq) (§3.7); server re-validation on ingest; conflicts surfaced never last-write-wins; convergence test as a gate (§4.11). | `NFR-016…019`, `SYNC-001…016`, `MINV-03/14`, `OBJ-03` |

---

## 6. Consolidated architecture definitions

A crisp, self-contained statement of each area named in the brief (detail in §3–§4).

1. **Frontend architecture (Web).** React + TypeScript **installable PWA**, layered `UI → Application → Shared Core → Persistence` with a strict inward dependency rule. The in-memory **projection** (folded from the local event log by the shared core) is the single source of UI truth for a match; UI/navigation state is separate. Service worker precaches the app shell and versioned reference data; the app is fully functional offline after first load. Keyboard-first scorebox with a multi-pane large-screen layout, print stylesheets, screen wake-lock, high-contrast/sunlight themes, WCAG 2.2 AA on core flows. Charts render client-side with no network. A tab/device **writer fence** prevents concurrent writes. (§3.2, §4.3)

2. **Android architecture.** Kotlin, single-activity **Jetpack Compose**, **MVI**, clean-architecture layers, consuming the **same shared scoring core** (KMP JVM target). **SQLite (SQLDelight) in WAL mode with an explicit durable commit before every UI confirmation**; optional append-only journal; cold-start recovery by replay. `WorkManager` background sync with constraints + backoff; unsynced count surfaced. One-handed thumb-zone layout, large gloved-use targets, haptics, TalkBack, sunlight theme. Minimal permissions, Play distribution, SAF backup/restore, Keystore-backed session storage. (§3.3, §4.4)

3. **Backend architecture.** Managed **Supabase** project per environment: **Auth (GoTrue)**, **Postgres with RLS**, **Realtime**, **Edge Functions (Deno)**, **Storage**. Stateless compute; all state in Postgres/Storage. Edge Functions handle event ingest + re-validation, sign-off materialisation, exports, competition/profile recompute, share-link management, admin ops. A **transactional outbox** + dispatcher propagates integration events to downstream contexts. Scheduled jobs (`pg_cron`) run retention, chain/backup verification, and recompute sweeps. No bespoke server fleet in v1. (§3.4, §4.5)

4. **Database architecture.** Postgres is the **backend system of record for synced data**. Table families: scoring write model (`match_events` — append-only, hash-chained, **partitioned**; `matches`, `sign_offs`, `dls_revisions`, `reconciliation_reports`, `divergences`), scoring read model (`match_snapshots` immutable per sign-off version, `live_state`), identity/tenancy, participants, competition, profiles, publishing, and cross-cutting (`audit_log`, `outbox`, `reference_data` versioned, `feature_flags`). **RLS on every tenant row** keyed on `organization_id` + role. Materialised projections carry a `source_version` watermark for incremental, idempotent recompute. Matches **pin** their conditions-profile and DLS-table versions at creation. (§3.5, §4.6)

5. **Offline storage.** Web: **IndexedDB** (event log, projection cache, reference data, outbox, session, blobs) + Cache Storage for the app shell. Android: **SQLite** mirroring the same stores. The **local event log is authoritative for an in-progress match**; projections on device are a rebuildable cache. Every event append + outbox advance is a single durable transaction completed **before** the UI confirms. Persistent-storage requested; usage view + purge of synced-and-final matches; a match's log is retained until the server acknowledges durable receipt. Signed local **backup archives** are exportable/importable offline with lossless round-trip. (§3.6)

6. **Sync architecture.** Per-device **append-only streams** merged into a **deterministic total order** — sort by dense `event_ordinal`, tie-break **HLC**, tie-break `(device_id, device_seq)` — then projected by the shared core, giving identical results everywhere. **Push** (`POST /sync/events`) is idempotent (`event_id`) and server-re-validated (schema, auth, per-device monotonicity, hash chain, conditions-freeze) with per-event accept/reject; **pull** (`GET /sync/changes`) is cursor-based; Realtime only *nudges*. **P1 is single-writer** per scorer stream, guarded by a **fence token** for clean multi-device handoff. **P2 dual-scorer** keeps two independent streams; `SVC-DIVERGENCE-DETECTOR` produces `divergences`; resolution needs propose + confirm and emits a convergence event into both streams; sign-off is blocked while divergences are open. **Never last-write-wins; never silently drop an event.** (§3.7, §4.7)

7. **Authentication.** **Supabase Auth (GoTrue)**: email + password, short-TTL JWT + refresh token in secure storage, server-side revocation, admin MFA (V2). **Offline grace**: a signed **claims snapshot** + encrypted refresh token let the client authorize locally for a configurable window with cloud calls queued; past the window, guest scoring continues and cloud actions need re-auth. **Guest mode** uses a device-local id with no server identity until claimed. Service-role key is server-only. Org API keys (V2) are hashed, scoped, rotatable. (§3.8)

8. **Authorization.** **Additive RBAC**, capabilities = union of roles **per organization**; Head/Assistant Scorer are match-level assignments. Three enforcement points: client (advisory only), Edge Function `SVC-AUTHORIZER` (command + state + guest + impersonation-consent checks), and **Postgres RLS as the hard boundary** — every tenant table scoped by `organization_id` + role; `match_events` INSERT requires a match scorer role; no UPDATE/DELETE policy exists (append-only); minors' fields served through a redacting view; share links grant a read-only, revocable, viewer-projection-only capability. Impersonation requires stored consent and is fully double-attributed. (§3.9, §3.15)

9. **API architecture.** Hybrid: an idempotent, cursor-based **Sync API** (RPC) as the offline-first backbone; **PostgREST** resource reads behind RLS; **RPC command endpoints** (Edge Functions) with `Idempotency-Key`; **Realtime** channels for viewer deltas / co-scorer / dashboards; a versioned **public read API + signed webhooks** (V2); Cricsheet interchange through an anti-corruption translator. Contracts: **OpenAPI** + **JSON Schema** for every event and command, versioned in a registry shared with clients and tests; additive-only within a major version; **RFC 7807** errors; upcasters applied on read. (§3.10, §4.7, §4.8)

10. **Event architecture.** Two planes. **Domain events** (`EVT-*`, ~70 types) are the immutable, ordered, hash-chained, per-device-streamed write model of `AGG-MATCH`; all projections are pure folds over the **active** event set and are rebuildable anytime; corrections are superseding events; ordering uses dense ordinal + HLC + device seq. **Integration events** are written to a **transactional `outbox`** in the same transaction as the state change and delivered at-least-once by a dispatcher to eventually-consistent downstream contexts (competitions, profiles, publishing, notifications, webhooks). Every type is a versioned JSON Schema; the conformance and convergence suites replay canonical logs. (§3.11, §4.8)

11. **Audit architecture.** Three layers: (a) the **`match_events` log itself** is the scoring audit trail — provenance (`actor_ref`, app/platform/os/device/build) and `supersedes` chains on every event, hash-chained per stream; the human-readable audit view is a projection over it. (b) A **cross-cutting `audit_log`** — append-only, hash-chained, INSERT-only via `SECURITY DEFINER` — captures auth events, role changes, impersonation (double-attributed), overrides with reasons, sign-offs + versions, exports, admin/platform actions, retention runs, disputes, merges. (c) **Stored reconciliation reports** per checkpoint and sign-off, enumerating every `INV-*` as PASS/FAIL. Tamper-evidence via hash chains + a scheduled verification job + periodic **external anchoring** of chain heads. Hashing covers a stable `actor_ref`, so account-deletion anonymisation is done in place without breaking verifiability. (§3.12)

12. **Observability.** Structured, PII-free logs with correlation ids; OpenTelemetry traces across functions → Postgres and `score → persist → sync` on the client; metrics tied directly to SRS gates (sync p50/p95, **event-loss = 0**, input latency ≤ 100 ms, cold start ≤ 3 s, viewer freshness p95 < 10 s, conformance 100%, parity ≥ 95%, availability ≥ 99.5%); release-health and pilot dashboards; hard pages for event-loss, audit-chain failure and backup-verification failure; synthetic "offline T20 then sync" canary + DLS benchmark + conformance/convergence suites; privacy-respecting, opt-outable feedback telemetry. (§3.13, §4.9)

13. **Backup / recovery.** The **event logs are the recoverable truth**; projections are always rebuildable. Backend: **PITR** (continuous WAL) + daily logical snapshots to a **separate region/account** + a scheduled restore-and-verify job. Client: normal sync is the cloud backup; a signed **local backup archive** covers the unsynced case. Defined RPO/RTO per scenario (device loss, region outage, corruption, bad reference data, bad release, GDPR erasure); projection corruption is fixed by rebuild from `match_events`; quarterly restore drills; documented runbook + status banner. (§3.14)

14. **Security boundaries.** Ten enumerated trust-zone crossings (§3.15): device store↔app; **client↔backend (all input untrusted, TLS-only, re-validated)**; auth boundary; **Edge↔Postgres where RLS is the hard boundary**; tenant↔tenant isolation; Realtime channel-join authz; the **public/anon surface** (redacted viewer/competition/API projections, no write path, unguessable tokens); the **admin/platform plane** (MFA, full audit, consented impersonation, restricted release controls); the backups/exports store (separate creds + region); CI/CD & secrets (no client-side service keys, conformance+parity gates, signed releases). Data is low-sensitivity / high-integrity → controls weighted to integrity, attribution and tamper-evidence, with encryption in transit and at rest and names-only PII minimisation. (§3.15)

---

## 7. Spikes and their architectural impact

| Spike | Architectural dependency | Design stance now | If unresolved |
|---|---|---|---|
| **SPK-01** — DLS licensing/IP | `SVC-DLS-CALCULATOR`, `RainMethod`, DLS UI, par ladder | DLS is a **strategy behind `RainMethod`**; nothing else depends on it; `dls_table_version` pinned per match; benchmark job ready. | Ship `RainMethod = NONE`; manual target entry (`FR-084`) only; DLS UI behind a flag. Architecture unchanged. |
| **SPK-02** — Event-log & provenance model | The entire sync + correction + audit substrate | **Per-device append-only streams + dense `event_ordinal` + HLC + hash chain from day one**, even though P1 is single-writer. This spike must confirm the model supports P2 merge without a rewrite. | Highest-priority architecture spike; MVP build should not start until confirmed. |
| **SPK-03** — Offline durability on Android | §3.3/§3.6 durable-commit design; `NFR-009…011` | WAL + explicit `fsync` before UI confirm + optional journal + replay recovery; **chaos test is a release gate**. | No Alpha exit; revisit persistence approach (e.g. journal-first, or a different embedded store). |
| **SPK-04** — Cross-platform rules core | ADR-03; §4.2 | **One shared core (KMP recommended)** + a contract/parity corpus run on both builds in CI; parity matrix published. | Fall back to spec + two implementations guarded only by the corpus; parity target may slip to V2; single-platform pilot possible. |
| **SPK-05** — Interchange format | `SVC-EXPORT-TRANSLATOR`; `/exports`; import path | Export/import is an **anti-corruption layer**; internal model never conforms to Cricsheet; lossy fields enumerated. | PDF/CSV (`FR-143/144`) satisfy the portability minimum; Cricsheet export slips to V2. |
| **SPK-06** — MCC Laws text permission | In-app rule/help text; conformance oracle | Rules encoded as **logic + citations**; the conformance corpus is worked examples, not the Law text. | Ship paraphrased-only help text; no verbatim Law strings bundled. |

---

## 8. Architecture Decision Records (summary)

Each ADR: **Context → Decision → Consequences → Alternatives rejected.** Full ADRs to be maintained under `docs/architecture/adr/`.

- **ADR-01 — Event sourcing for the match.** *Context:* the domain model defines the match as its event stream; corrections must be non-destructive; audit and replay are objectives. *Decision:* the match is an append-only `EVT-*` log; projections are disposable. *Consequences:* audit/replay/deterministic-sync come "for free"; requires projection rebuild tooling and schema/upcaster discipline. *Rejected:* CRUD state with a change-log side table (can't guarantee reconstructability or `MINV-02`).
- **ADR-02 — Local-first authority.** *Decision:* the on-device event log is authoritative for an in-progress match; the backend is an eventual destination. *Consequences:* offline is structural; sync becomes reconciliation, not the write path. *Rejected:* server-authoritative with an offline cache (fails `NFR-012/014`).
- **ADR-03 — One shared scoring core.** *Decision:* a single pure, deterministic core built to both platforms. *Consequences:* parity is achievable for a small team; a build/packaging step and a contract-test corpus are required. *Rejected:* two hand-maintained engines (drift risk 7; unmaintainable at team size).
- **ADR-04 — Managed backend, RLS as the boundary.** *Decision:* Supabase; authorization enforced at the data layer. *Consequences:* minimal ops; defence-in-depth; ties us to Postgres/RLS idioms. *Rejected:* bespoke API tier as the sole gatekeeper (a client bug or bypass then leaks data).
- **ADR-05 — Deterministic ordering; no LWW, no CRDT value merge.** *Decision:* total order = dense ordinal → HLC → device seq; conflicts surface. *Consequences:* explainable merges; dual-scorer needs a divergence/resolution model. *Rejected:* last-write-wins (`SYNC-010` forbids it); CRDT value merge (produces states no scorer authored — unacceptable for an official record).
- **ADR-06 — CQRS with a shared projector.** *Decision:* the same fold functions run on client and server. *Consequences:* identical viewer/competition/profile results; server must embed the core. *Rejected:* a separate server-side re-implementation of projections (drift).
- **ADR-07 — Single-writer P1, multi-stream P2 on one substrate.** *Decision:* P1 uses one scorer stream + fence tokens; P2 adds independent streams. *Consequences:* P1 stays simple; the substrate (per-device streams, ordinals, HLC) is built once. *Rejected:* building full multi-writer merge for P1 (unneeded complexity/risk); building P1 on a substrate that can't extend (rewrite risk — `SPK-02`).
- **ADR-08 — Hash-chained append-only logs + external anchoring.** *Decision:* `match_events` and `audit_log` are hash-chained; chain heads periodically anchored externally. *Consequences:* tamper-evidence even against a privileged operator; canonicalisation must be exact and stable. *Rejected:* DB triggers alone (a DB admin can disable them).
- **ADR-09 — Transactional outbox for integration events.** *Decision:* integration events written in the same transaction as the state change; a dispatcher delivers at-least-once. *Consequences:* reliable eventual consistency for downstream contexts; consumers must be idempotent. *Rejected:* dual writes to a queue (lost/duplicated events on failure).
- **ADR-10 — DLS as a pluggable strategy, `NONE` default.** *Decision:* `RainMethod` interface; manual target is always available. *Consequences:* licensing risk isolated; alternative methods possible later. *Rejected:* hard-wiring DLS (blocks the whole rain path on `SPK-01`).
- **ADR-11 — Reference data versioned and pinned per match.** *Decision:* matches pin conditions-profile and DLS-table versions at creation. *Consequences:* a match's rules never change under it; recompute is reproducible. *Rejected:* always-latest reference data (`BR-032` violation; non-reproducible results).

---

## 9. Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| AQ-1 | Shared-core technology: **KMP** vs **Rust/wasm** vs spec-and-two-impls. | §4.2 build pipeline; `SPK-04` | architecture |
| AQ-2 | `match_events` partitioning: by **hash(match_id)** (write spread) vs **monthly** (age-out). | §3.5, §3.17 | architecture + backend |
| AQ-3 | HLC parameters: max drift tolerance, skew-flag threshold, whether server timestamps are authoritative on ingest. | §3.7, `SYNC-007` | architecture |
| AQ-4 | Offline authz: verify a **signed claims snapshot** locally vs accept a longer refresh-token grace with no local claim check. | §3.8 | architecture + security |
| AQ-5 | Realtime payload: **projection deltas** vs **event deltas** to viewers (delta size vs client compute). | §3.10, §3.17 | architecture |
| AQ-6 | External anchoring target for audit chain heads (managed transparency log vs signed object in a second account). | §3.12, ADR-08 | security |
| AQ-7 | Do we need field-level encryption for `dob`/guardian links, or is redaction + RLS sufficient given `A-10`? | §3.15, `SEC-013` | security + legal |
| AQ-8 | Web secure storage for the refresh token: `httpOnly` cookie (needs same-site backend) vs guarded IndexedDB. | §3.8 | architecture + security |
| AQ-9 | Confirm Supabase covers PITR retention + separate-region logical backups at the needed RPO, or add an external pipeline. | §3.14 | backend + ops |
| AQ-10 | Exports at scale: Edge Function vs a dedicated worker/container for large PDF/Cricsheet jobs. | §3.4, §4.5 | backend |
| AQ-11 | Carried from SRS §13: `SPK-01` (DLS), `SPK-05` (Cricsheet), and foundation questions A1/A2/D16/D19/E21 all touch this architecture. | §7 | product/legal |

---

## 10. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-02 | Initial system architecture. Applies the 4 Layers: **Product** (§1 — nine characteristics as drivers, quality-attribute scenarios, constraints, C4 context, 11 ADRs summarised); **Domain** (§2 — six bounded contexts, `AGG-MATCH` as an event-sourced aggregate, CQRS event planes, `SVC-*` placement, invariant→mechanism map, ubiquitous language); **System** (§3 — C4 container architecture and the 14 named areas: frontend, Android, backend, database, offline storage, sync, authentication, authorization, API, event, audit, observability, backup/recovery, security boundaries; plus runtime flows, scaling and failure models); **Implementation** (§4 — technology selections with alternatives, the shared scoring core / parity mechanism, per-platform notes, Supabase mapping, schema and API sketches, event/schema governance, observability stack, CI/CD, test strategy). Cross-cutting: §5 characteristic traceability, §6 consolidated definitions of all 14 areas, §7 spike impact (`SPK-01…06`), §8 ADR log (ADR-01…11), §9 open questions (AQ-1…11). Traceable to the SRS (`FR-/DR-/BR-/NFR-/SEC-/OFF-/SYNC-/AUD-`) and `OBJ-01…11`. Architecture and design only — no production code. |

