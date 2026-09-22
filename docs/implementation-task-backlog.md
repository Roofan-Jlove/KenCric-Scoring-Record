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
| Expected behavior | An `UPDATE` attempting to change `matches.reference_data_id` after any `match_events` row exists for that match is rejected at the database layer. |
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
| Files/components expected to change | `database/supabase/migrations/..._create_sync_cursors.sql`, `..._create_writer_fences.sql`, `..._create_outbox.sql`, `..._create_audit_log.sql` |
| Verification procedure | §7 checks 7.1–7.2, 7.4; audit_log grants checked same way as `TASK-0007` |

### E-07 — Auth & RLS foundation

#### TASK-0013 — Supabase Auth (GoTrue) integration & role-claim wiring

| Field | Value |
|---|---|
| Requirement IDs | `SR-A01, SR-A02, SR-A08`; `ADR-T08` |
| Goal | User sign-in issues a JWT whose claims RLS policies can read to resolve `memberships`-based roles. |
| Context needed | `security-specification.md §3`, `technology-stack.md ADR-T08` |
| Dependencies | `TASK-0001`, `TASK-0002` |
| Inputs | `users`, `memberships` tables |
| Expected behavior | A signed-in request's role/org context is derivable entirely from the JWT + `memberships` table, with no client-supplied role claim trusted directly (`SR-B01`). |
| Acceptance criteria | `acceptance-criteria.md §10` (Security) auth entries |
| Tests required | Security tests (`§15`), API tests (`§6`) |
| Files/components expected to change | `infrastructure/supabase-projects/`, `backend/src/authz/` |
| Verification procedure | §7 checks 7.2, 7.4; manual sign-in flow against a local Supabase instance |

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
| Expected behavior | A non-striker run-out additionally emits `EVT-NON-STRIKER-RUN-OUT` alongside the base delivery event, per §16's stated co-emission rule. |
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

#### TASK-0039 — API: `POST /matches` (generic CRUD create)

| Field | Value |
|---|---|
| Requirement IDs | SRS cluster B (Match Setup); `api-specification.md §10` (generic CRUD pattern) |
| Goal | An authenticated, authorized request with a valid match-creation payload creates a `matches` row and returns it. |
| Context needed | `api-specification.md §9` (validation layers, error registry), `§10` |
| Dependencies | `TASK-0005`, `TASK-0014` |
| Inputs | A valid create-match payload per `api-specification.md §10`'s generic schema |
| Expected behavior | A payload missing a required field returns the exact `422` per §9's registry; a valid payload returns `201` with the created row, including server-assigned audit fields. |
| Acceptance criteria | `acceptance-criteria.md §3–§5` (Normal/Boundary/Invalid) entries traced to SRS cluster B |
| Tests required | API tests (`§6`) |
| Files/components expected to change | `backend/src/commands/` (or generic CRUD handler if not command-specific), `database/supabase/functions/` (thin entrypoint) |
| Verification procedure | §7 checks 7.1–7.2, 7.4–7.5 |

#### TASK-0040 — Web: `UX-04 Create Match` screen

| Field | Value |
|---|---|
| Requirement IDs | `ux-specification.md` `UX-04` |
| Goal | A scorer can create a match from the web app, offline or online, reaching `UX-05 Match Setup` on success. |
| Context needed | `ux-specification.md`'s `UX-04` entry (Purpose/Inputs/Actions/Validation/States/Error handling/Empty states/Offline behavior/Accessibility) |
| Dependencies | `TASK-0039`, `TASK-0034` (offline command execution — match creation must work with zero connectivity per `C-1`) |
| Inputs | The API contract from `TASK-0039` |
| Expected behavior | Submitting the form offline creates the match locally and queues the event, per `TASK-0034`'s model — the screen does not block on network. |
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

For each of the 10 remaining generic-CRUD resources (`api-specification.md §10`) and each match-lifecycle command (`§11`) not yet covered: **one task per resource-operation pair** (e.g. `TASK-#### — API: PATCH /teams/{id}`), using exactly `TASK-0039`'s template — Requirement IDs from the resource's SRS cluster, Dependencies on that resource's schema task (§4) plus `TASK-0014`, Expected behavior stated as the validation/response contract from `api-specification.md §9–§10`, Tests required = API tests (`§6`). A command endpoint (§11) additionally depends on the shared-core task(s) implementing the command's effect (e.g. a "record delivery" command endpoint depends on all of E-08–E-14).

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
