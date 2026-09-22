# Cricket Scoring Book — Master Specification

| | |
|---|---|
| **Document** | Master Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Assembles** | All 17 approved constituent documents, listed with their own versions in §16.1 |
| **Status** | The source of truth for the system's structure, scope, and cross-cutting decisions. **No application code — implementation has not begun.** This document itself is newly assembled and is, like every constituent it draws from, a draft for review; assembling the set does not itself constitute sign-off of any individual constituent. |

> This is the entry point. Read this document first. Every section below is a complete, standalone-readable synthesis of its constituent document(s) — sufficient to understand the whole system without opening anything else — plus a precise pointer to the full authoritative text. Three sections exist **only here**: §12's vertical-slice traceability matrix, §13's consolidated ADR index, and §15's deduplicated master open-questions register — none of the 17 constituents assembles these across the whole project themselves.

---

## 0. How to read this document, and the precedence rule

### 0.1 Precedence — stated once, honestly

**This document is authoritative for structure, scope, cross-cutting synthesis, and navigation.** For the full, detailed text of any individual requirement, rule, screen, table, endpoint, or test case, **the cited constituent document is authoritative** — this document's per-section summaries are drawn from them and must never be read as superseding them. If a summary here and its source ever disagree, the source wins, and that disagreement is itself a defect in this document to be fixed, not a new decision. This is not a hedge — it is the only honest way to keep one index true over a system this detailed without duplicating (and inevitably drifting from) ~17,000 lines of already-precise specification.

### 0.2 The four layers, restated as the document's own spine

Every section below descends from the same four layers the whole project uses (`foundation` methodology, `system-architecture.md §0.1`): **Product** (§1) → **Domain** (§2) → **System** (§5–§10, architecture through security) → **Implementation-readiness** (§10–§11, testing and acceptance criteria) — with **Requirements** (§3) and **UX** (§4) as the bridge between Product/Domain and System, and §12–§15 as cross-cutting synthesis over the whole stack.

### 0.3 Approval and versioning model

Each constituent keeps its own version number and its own review status (§16.1's manifest). This master specification is re-published whenever a constituent's version changes materially enough to affect its summary here — the manifest's version column is the single place to check whether this document is current against its sources.

---

## 1. Product Specification

**Source:** `docs/foundation/product-foundation.md` v0.1.0 (vision, users, objectives, scope, success criteria, assumptions, risks) + `docs/discovery/product-discovery.md` v0.1.0 §1 DESCRIBE (personas, jobs-to-be-done, journeys).

### 1.1 Vision and problem

An official-standard, **offline-first** digital cricket scoring book for **Web (installable PWA)** and **Android**, replacing paper scorebooks and connectivity-dependent apps for club, league, and representative cricket. The core problem: existing tools either require connectivity clubs and grounds don't reliably have, or sacrifice Law-accuracy and audit integrity for convenience. This product's bet is that offline-first, Law-accurate, and trustworthy are not in tension if the architecture is built around them from the start — which is why every subsequent document in this set treats them as structural, not aspirational.

### 1.2 Target users

Primary: **club/league volunteer scorers** (persona `PER-01`, "Val" — offline, one-handed, Android) and **accredited/professional scorers** (`PER-02`, "Priya" — dual-scorer, DLS, laptop+phone). Secondary: organizers, captains/managers, analysts, players. Tertiary: umpires, commentators, spectators, developers. Twelve additive roles in total (`security-specification.md §4.2`'s permission matrix is the operational realisation).

### 1.3 Core objectives (`OBJ-01…11`)

`OBJ-01` Law-accurate engine · `OBJ-02` Offline-first · `OBJ-03` Deterministic sync/dual-scorer · `OBJ-04` Match mathematics · `OBJ-05` Complete outputs · `OBJ-06` Cross-platform parity · `OBJ-07` Verifiability/trust · `OBJ-08` Speed of entry · `OBJ-09` Data ownership/portability · `OBJ-10` Multi-tenant · `OBJ-11` Accessibility/i18n. **These eleven objectives are the spine of §12's traceability matrix** — every requirement, architectural decision, and test in this project traces back to at least one of them.

### 1.4 Scope

**In (MVP → GA):** limited-overs setup, ball-by-ball scoring for every lawful delivery/dismissal, innings/match-state management, reduced overs/DLS, tie-breakers, corrections, reconciliation, sign-off, scorecards/analytics, export, sharing, org/RBAC, and (post-pilot) dual-scorer reconciliation, competitions, profiles. **Out (`foundation §7`):** ball-tracking/Hawk-Eye, video streaming, official DRS technology, betting/fantasy, AI commentary, a full club-admin suite, native iOS v1, wearables, spectator social features, multi-sport, a historical-stats encyclopedia, proprietary rain methods beyond DLS Standard, P2P LAN sync, hardware consoles.

### 1.5 Success criteria (the measurable bar)

100% cricket-rules conformance-suite pass; DLS within published tolerance; zero ball-events lost across the chaos test; full-T20 sync ≤ 30 s on 3G; ≥ 5 clubs / ≥ 100 matches in pilot; SUS ≥ 80; WCAG 2.2 AA on core flows; cross-platform parity ≥ 95%; Cricsheet round-trip with zero material difference; 100% first-ball-to-sign-off audit trails. Every number here has an owning metric and gate in `docs/roadmap/product-roadmap.md §4`.

---

## 2. Domain Specification

**Source:** `docs/specs/cricket-rules-reference.md` v0.1.0 (~640 rules, 37 areas) + `docs/domain/domain-model.md` v0.1.0 (DDD model) + `docs/domain/glossary.md` v0.1.0 (ubiquitous language, embedded in full at §14) + `docs/specs/live-scoring.md` v0.1.0 (the deterministic ball-processing pipeline).

### 2.1 The one governing model

**The match is its event stream.** Every domain document in this set is a facet of that one sentence: the cricket-rules reference fixes *what is true* about a delivery; the domain model fixes *what objects* carry that truth (`AGG-MATCH`, `ENT-DELIVERY`, `EVT-*`); `live-scoring.md` fixes the *exact deterministic algorithm* that turns an input into those objects. Scorecards, cards, partnerships, fall-of-wickets, run-rate, and DLS ladders are all disposable projections — never independent facts.

### 2.2 Bounded contexts and aggregates

Six contexts: **`CTX-SCORING`** (core domain, `AGG-MATCH`), `CTX-IDENTITY` (`AGG-ORGANIZATION`), `CTX-PARTICIPANTS` (`AGG-PLAYER`, `AGG-TEAM`), `CTX-COMPETITION` (`AGG-COMPETITION`, `AGG-CONDITIONS-PROFILE`, `AGG-MATCH-TEMPLATE`), `CTX-PROFILES` and `CTX-PUBLISHING` (generic, read-model only). `AGG-MATCH` is event-sourced; every other aggregate is conventional. 13 domain services (`SVC-STRIKE-RESOLVER` through `SVC-AUTHORIZER`) carry the stateless behaviour that doesn't belong to one entity — the same 13 are what `live-scoring.md` operationalises into exact rules.

### 2.3 The cricket-rules reference

~640 requirements across 37 areas (formats, team/player/official, match lifecycle, innings/over/ball, runs/strike/extras, every extra sub-type, free hit, wickets and all 12 dismissal modes, bowling/batting/partnership figures, powerplays, reviews, declarations/follow-on, results/target/DLS, Super Over, scorecard content, commentary, corrections, cross-cutting invariants `INV-001…018`, and the `CFG-REG` configuration registry), each tagged `[LAW]`/`[PRD]`/`[CFG]`/`[EDGE]` so implementers know exactly which authority governs each rule. This is the single source of truth for cricket semantics — every other document defers to it on that question, never restates it independently.

### 2.4 `live-scoring.md` — the deterministic pipeline

One processing pipeline (validate → classify legality → decompose runs/extras via the `RunEvent` model → resolve wicket → update batter/bowler/team/over state → resolve strike (the parity/XOR formula) → resolve free-hit-next → evaluate innings/match-end → emit event → audit) that covers every legal and illegal delivery combination **by construction**, not by enumeration — plus a 55-case conformance-test catalogue and 13 fully worked examples that seed the conformance suite (`testing-strategy.md §4`) and this document's own §11 acceptance criteria (§6 of `acceptance-criteria.md`).

---

## 3. Requirements Specification

**Source:** `docs/specs/software-requirements-specification.md` v0.1.0.

### 3.1 What it contains

**354 requirements** in eight identifier schemes, each with Description, Rationale, Priority (`MoSCoW · Phase`), Dependencies, Trace, and Given/When/Then acceptance criteria:

| Scheme | Count | Covers |
|---|---|---|
| `FR-001…168` | 168 | Functional — 16 lettered clusters A–Q, from identity through client-platform specifics |
| `DR-01…36` | 36 | Domain rules — one per cricket-rules area, pointing to its authoritative `<AREA>-NNN` ids |
| `BR-001…034` | 34 | Business rules — ownership, lifecycle, integrity policy |
| `NFR-001…045` | 45 | Non-functional — performance, reliability, scalability, usability, compatibility, interoperability, maintainability, i18n, privacy |
| `SEC-001…018` | 18 | Security — elaborated in full by `security-specification.md`'s 76 `SR-*` |
| `OFF-001…022` | 22 | Offline — elaborated in full by `offline-first-specification.md` |
| `SYNC-001…016` | 16 | Synchronization — elaborated in full by `offline-first-specification.md §7–§11` |
| `AUD-001…015` | 15 | Audit — elaborated by `live-scoring.md §17`, `data-specification.md §10.1`, `security-specification.md §11` |

### 3.2 The non-negotiable rule this document enforces

**No requirement is invented silently.** Every one carries a `Trace` field to its originating discovery/domain/foundation id; any consolidation of several source ids into one is explicitly labelled `(consolidated)`; anything inferred to make an upstream intent enforceable is labelled `(derived)` with its basis stated. Assumptions are isolated in their own section (`A-01…A-27`) and never buried inside a requirement's own text.

### 3.3 Phasing

`P1` (pilot/MVP — a real club must be unable to score and file a match without it) → `P2` (post-pilot: dual-scorer, competitions, profiles, connected ecosystem) → `P3` (multi-day, advanced analytics, deep integrations), mapped one-to-one onto `docs/roadmap/product-roadmap.md`'s MVP/Version 1/Version 2/Future buckets.

## 4. UX Specification

**Source:** `docs/ux/ux-specification.md` v0.1.0.

### 4.1 What it contains

**28 screens** (`UX-01`…`UX-28`, grouped A–G: Identity & Access, Home, Match Setup, Live Scoring, Outputs, Connectivity, Records & Config), each fully specified across Purpose, Inputs, Actions, Validation, States, Error handling, Empty states, Offline behavior, and Accessibility requirements — plus **7 cross-screen workflows** (`W-1…W-7`, from a first offline match through multi-device handoff) and an information-architecture navigation map. Interaction and information-architecture specification only — no visual design, no UI code.

### 4.2 Cross-cutting conventions (stated once, governing all 28 screens)

A canonical state model (`Loading/Empty/Populated/Error/Offline/Guardrail-blocked/Destructive-confirm/Read-only`), consistent error/empty-state conventions, an offline visual language (§2.4), the guardrail-and-override pattern, the Undo-vs-Correction distinction, a WCAG 2.2 AA accessibility baseline, and a shared sync-label vocabulary — these are what make all 28 screens feel like one product rather than 28 independent designs, and they are exactly what `acceptance-criteria.md`'s objectivity rule (§1.2) draws on for every UI-adjacent criterion.

### 4.3 Platform posture

Web is two-handed, keyboard-first, multi-pane-capable; Android is one-handed, thumb-zone-first, gloved-touch-target-sized — both driven by the same shared scoring core (§5.2), so behavior is identical even where ergonomics differ.

## 5. Architecture Specification

**Source:** `docs/architecture/system-architecture.md` v0.1.0 (the 4-Layers architecture) + `docs/architecture/technology-stack.md` v0.1.0 (the evaluated, chosen stack).

### 5.1 The architecture in one paragraph

The match **is an append-only stream of domain events** captured on the scorer's device. Every scoring action is a local, durable transaction against a local event log; a **shared, deterministic scoring core** (identical on Web and Android) validates commands and folds events into projections. Connectivity is never on the critical path: a **background sync engine** ships events to a **managed Postgres backend**, where **row-level security** is the authorization boundary, events are **re-validated, hash-chained and stored immutably**, and server-side projections feed read-only viewers, competitions, and profiles. Merge is **deterministic**; conflicts are **surfaced, never silently resolved**. The event log doubles as the **audit trail** and the **recovery source of truth**.

### 5.2 The chosen stack

| Layer | Choice | ADR |
|---|---|---|
| Shared scoring core | Kotlin Multiplatform (JVM + JS/wasm) | `ADR-T01` |
| Web | React + TypeScript + Vite, installable PWA, Radix + Tailwind | `ADR-T02` |
| Android | Native Kotlin + Jetpack Compose, MVI | `ADR-T03` |
| Backend | Supabase (Postgres + GoTrue Auth + PostgREST + Realtime + Edge Functions + Storage) | `ADR-T04` |
| Database | Supabase-managed PostgreSQL, RLS everywhere | `ADR-T05` |
| Local database | SQLite (via PowerSync, or SQLDelight fallback) | `ADR-T06` |
| API | REST/RPC over HTTP+JSON, contract-first | `ADR-T07` |
| Auth | Supabase Auth (GoTrue) | `ADR-T08` |
| Sync | PowerSync substrate + event-log semantics in the core; custom HTTPS as the fallback | `ADR-T09` |
| Hosting | Supabase Cloud + Cloudflare Pages + Google Play + PowerSync Cloud | `ADR-T10` |
| CI/CD | GitHub Actions | `ADR-T11` |
| Testing | Layered — bespoke domain harnesses + Kotest/Vitest/Playwright/pgTAP/k6 | `ADR-T12` |
| Monitoring | Sentry + Grafana Cloud + Checkly + PostHog | `ADR-T13` |
| Documentation | Markdown-in-repo + Astro Starlight + OpenAPI/Scalar + MADR ADRs | `ADR-T14` |

### 5.3 The nine required characteristics, each a structural property, not a feature

Online · Offline · Reliable · Secure · Scalable · Auditable · International-standard · Multi-device · Synchronization-capable — `system-architecture.md §1.2` maps each to the specific architectural mechanism that makes it true by construction, and §5 traces each to the SRS requirements it satisfies.

### 5.4 Security boundaries

Ten numbered trust-zone crossings (`B1`…`B10`, device-store↔app through CI/CD-and-secrets), each with its controls — the backbone `security-specification.md §2` builds its full STRIDE threat model on top of.

### 5.5 Repository structure

**Source:** `docs/architecture/repository-structure.md` v0.1.0. Derived exclusively from this Master Specification, it maps every section above to the exact directory that realises it in code: `docs/` (Documentation, unchanged), `specs/` (a new machine-readable contract layer — OpenAPI, JSON Schema, the conformance corpus — distinct from `docs/`'s prose), `shared/` (the KMP scoring core, the repository's central directory), `apps/web/` and `apps/android/`, `backend/` and `database/` (split by responsibility, joined at a thin-entrypoint seam), `tests/` (cross-cutting suites only — everything else is co-located with its package), `infrastructure/`, `.github/workflows/`, and `scripts/`. No code or scaffolding exists yet; this is the plan implementation will follow once authorised.

---

## 6. Data Specification

**Source:** `docs/architecture/data-specification.md` v0.1.0.

### 6.1 The organising principle

**CQRS, explicitly.** One append-only write model (`match_events`, §6.2) and a family of disposable read-model tables (§7), never conflated — the single most common schema-design mistake for an event-sourced system, avoided by stating the rule once and applying it to all 28 tables.

### 6.2 The 28 tables, by family

| Family | Tables |
|---|---|
| Identity & Tenancy | `users`, `organizations`, `memberships` |
| Participants | `teams`, `players`, `squad_members` |
| Match & Officials | `matches`, `officials`, `match_officials`, `reference_data` |
| **Event store (write model)** | **`match_events`** — append-only, hash-chained, partitioned, `INSERT`-only grants |
| Scoring read model | `innings`, `overs`, `deliveries`, `delivery_run_events` (Runs & Extras, normalised), `wickets`, `partnerships`, `batter_card_lines`, `bowler_card_lines` |
| Sign-off & snapshots | `sign_offs`, `reconciliation_reports`, `match_snapshots`, `dls_revisions`, `divergences` |
| Sync records | `sync_cursors`, `writer_fences`, `outbox` |
| Audit records | `audit_log` — append-only, hash-chained, `SECURITY DEFINER`-insert-only |

### 6.3 Three deliberate, stated conventions

**Identity strategy:** every offline-creatable table uses a client-generated `uuid` primary key — no "renumbering on sync" ever needed. **Two sync models, not one:** event-sourced (`match_events` only, the full ordering/hash-chain/fence apparatus) versus a lighter CRUD-entity model (client uuid + optimistic-concurrency `row_version`, everything else) — matched to actual stakes, not applied uniformly. **Soft deletion where appropriate, and explicitly nowhere else:** never on `match_events`/`audit_log` (structurally impossible by grant); soft-deactivate/merge on `users`/`memberships`/`players` (historical references must resolve); ordinary hard delete on pure bookkeeping (`sync_cursors`, `writer_fences`).

## 7. API Specification

**Source:** `docs/architecture/api-specification.md` v0.1.0.

### 7.1 The endpoint taxonomy

| Kind | Style | §§ |
|---|---|---|
| Generic CRUD resource | REST, RLS-guarded, idempotent `PUT`-to-create with a client-supplied id | §10 of the API spec |
| Match lifecycle command | RPC, server-side domain logic beyond a field upsert (sign-off, dispute, merge, claim, invitations) | §11 |
| Sync (event-sourced) | RPC, batch, idempotent, cursor-based — the offline-first backbone | §12 |
| Event / audit | Read-only history browse, plus V2 outbound webhooks for integration events | §13 |
| Output / export / sharing / admin / public | Mixed | §14–§18 |

### 7.2 Why a generic CRUD pattern instead of ~40 bespoke endpoints

One pattern — `GET` list / `GET` one / `PUT` create-or-update / `DELETE` — applied via a resource table (organizations, teams, players, matches-header, condition-templates, competitions, fixtures, …) covers every simple field-upsert requirement; full bespoke treatment is reserved for the ~25 endpoints that carry genuine server-side logic. This is the same efficiency principle `live-scoring.md` used for cricket rules and `testing-strategy.md` used for test suites: general rules for completeness, bespoke depth exactly where it's earned.

### 7.3 Cross-cutting conventions

Bearer JWT / share-token / API-key authentication; the three-layer authorization model (client-advisory → `SVC-AUTHORIZER` → RLS); three validation layers mapped to `400`/`422`/`409` precisely; an RFC 7807 error registry; keyset-only pagination; a fixed filter-operator vocabulary; two idempotency mechanisms (`event_id` for sync, `Idempotency-Key` for commands); three disambiguated meanings of "version" (API contract / event schema / row optimistic-concurrency).

### 7.4 The deliberate asymmetry

Every endpoint traces to a requirement; **not** every requirement has an endpoint — `FR-042…105` (the entire live-scoring action set) is satisfied entirely by the generic `/sync/events` push, never a bespoke endpoint per action, because building one would duplicate `live-scoring.md`'s own rules a second time at the API layer.

## 8. Offline/Sync Specification

**Source:** `docs/architecture/offline-first-specification.md` v0.1.0.

### 8.1 The governing principle

**The device is the source of truth for its own unsynced work. The server is the durable destination. Synchronization reconciles the two without ever inventing, discarding, or silently overwriting a fact.** Every one of this document's sixteen topics is a specific instance of that sentence.

### 8.2 The sixteen topics, and the two rules that matter most

Local data ownership, local persistence, offline command classification (**commands execute immediately and fully against local state — only their resulting events are queued for transmission**, never a "queue of pending commands"), local-vs-server validation, the event queue, the sync protocol, retry, idempotency (no expiry, ever), conflict detection, conflict resolution (**never automatic, never last-write-wins** — a human decides, always, explicitly), reconnection, partial synchronization (a proven-safe normal state, not an error), failed synchronization (one correction mechanism, uniform whether an event was ever accepted or not), device recovery (honestly bounded loss, never overclaimed as "zero"), duplicate prevention, and data integrity.

### 8.3 The four "exactly what happens" scenarios

Offline (every offline command runs immediately, outbox grows unbounded, no server contact attempted) · During reconnection (automatic push→pull→divergence-recheck→UI-update, fully re-entrant to interruption) · After synchronization (what's bidirectionally guaranteed true, and the explicit note that editability never depends on sync status) · Two devices, same match (both sub-cases: single-scorer fence handoff with an orphaned-tail decision, and dual-scorer independent-stream divergence resolution — neither ever auto-merged).

---

## 9. Security Specification

**Source:** `docs/architecture/security-specification.md` v0.1.0.

### 9.1 The weighting principle

**Low-sensitivity, high-integrity data** (`A-10`): authorization, tamper-evidence, and attribution are the primary surface; confidentiality controls are standard and never skipped, but are not where engineering effort concentrates. Every one of the 76 requirements below is weighted accordingly.

### 9.2 What it contains

**76 `SR-XXX` requirements** across twelve clusters (Authentication, Authorization/Roles/Permissions, Session Management, Token Security, Data Encryption, Local-Device Security, API Security & Input Validation, Rate Limiting & Abuse Prevention, Audit Logging, Privacy, Backup Security, Recovery Security), a **formal STRIDE threat model** over the architecture's 10 trust boundaries with a stated residual risk per boundary (never a false "fully mitigated" claim), and a likelihood/impact risk register. A full 14-actor × 20-capability permission matrix operationalises "Roles" and "Permissions" concretely for the first time in this document set.

### 9.3 The honest residual-risk statement, worth repeating here

A sophisticated on-device attacker with valid scorer credentials could fabricate a *plausible* event no purely technical control alone catches — the true backstop is human reconciliation (dual-scorer comparison, sign-off review), not an engineering guarantee. This is stated explicitly in the threat model rather than papered over, consistent with this whole project's practice of never overclaiming a guarantee the design doesn't actually provide.

### 9.4 Extends, never renumbers, the SRS

`SEC-001…018`/`AUD-001…015` (§3) remain exactly as approved; the `SR-*` catalogue is their detailed specification, using a distinct id scheme so nothing collides.

## 10. Testing Specification

**Source:** `docs/architecture/testing-strategy.md` v0.1.0.

### 10.1 The adapted pyramid

Unit (§3) → **Domain/Conformance** (§4 — unusually large for this project, because cricket-law correctness *is* the product) → Integration (§5) → API/Database/Offline/Sync/Conflict (§6–§10, this project's distinctive cross-cutting layer) → UI/Android/Web (§11–§13) → End-to-end (§14) — with Security/Performance/Accessibility/Regression applied at every applicable layer, not a layer of their own.

### 10.2 The domain/conformance suite — four techniques, all required

Fixed case catalogue (`live-scoring.md`'s 55 cases, used verbatim) + worked-example replay (all 13 dimensions in one assertion) + property-based generation (combinatorial cases no fixed list reaches) + golden-file full-match replay — and the **identical corpus run against both the JVM and JS/wasm builds** of the shared core **is** the cross-platform parity mechanism, not a separate suite.

### 10.3 The explicit answer to "every critical cricket rule has a deterministic test case"

"Critical" is defined precisely (every `[LAW]`-tagged rule + every `INV-*`/`MINV-*` invariant + every dismissal-credit rule), and a full area-by-area table against `cricket-rules-reference.md`'s 34 areas shows: the **entire P1 core scoring path** (deliveries, extras, wickets, strike, overs, innings, results, corrections) has deterministic coverage **today**; `DLS`/`DRS`/multi-day are honestly stated as deferred, matching the project's own `SPK-01`/P2/P3 decisions — never a silent gap.

### 10.4 The consolidated CI/CD gate list

Every "must pass" gate named across every prior document, in one place (`testing-strategy.md §21`), mapped to its pipeline stage: PR (unit+domain 100%, RLS matrix, API contracts, secret scan), `main` (full chaos + convergence, migration dry-run), pre-pilot (conformance 100%, accredited-scorer review, WCAG AA, DLS benchmark or fallback, initial pen-test), pre-GA (parity ≥ 95%, load test, full pen-test, incident-response tabletop).

## 11. Acceptance Criteria

**Source:** `docs/architecture/acceptance-criteria.md` v0.1.0.

### 11.1 The objectivity rule — the defining feature of this section

Every criterion is Given/When/Then, and every `Then` clause must resolve to an exact value, an exact status/error code, a named boolean state transition, or a citation to an already-fixed deterministic rule — **never** a subjective word (`should, appropriate, reasonable, intuitive, nice, acceptable, …`) without an immediately-following exact definition that removes the ambiguity. UI "feel" judgements are explicitly **out of scope by design**, because they cannot satisfy this rule at all.

### 11.2 What it contains — 147 criteria, by category

| Category | Count (approx.) | Treatment |
|---|---|---|
| Normal | 16 | Representative, one per notable feature per FR cluster |
| Boundary | 15 | The exact limit value, and the exact value one unit past it, both asserted |
| Invalid | 16 | Exact rejection status/error code, and proof of no partial state change |
| **Cricket edge** | **54** | **Exhaustive** — the full `live-scoring.md` `C01…C55` catalogue converted, plus 5 richest worked examples |
| Offline | 8 | Selected, reformatted, cited to `offline-first-specification.md` |
| Synchronization | 8 | Selected, reformatted, cited |
| Recovery | 7 | Selected, reformatted, cited |
| Security | 12 | Selected, reformatted, cited to `security-specification.md`'s 76 `SR-*` |

### 11.3 The applicability matrix

Stated explicitly: not every one of the eight case categories applies to every FR cluster (Cricket-edge is dominant for Live Scoring; Security is dominant for Administration; Cricket-edge and Synchronization essentially don't apply to Settings) — forcing all eight onto every feature would pad the catalogue with meaningless entries, so the matrix says plainly which combinations are real.

---

## 12. Traceability Matrix

**New content — assembled here for the first time.** Every constituent document traces *downward* to its neighbours (a requirement to its acceptance criteria, an endpoint to its requirement). None of them, individually, traces a complete **vertical slice** — objective through implementation-readiness — across the whole stack in one row. This section is that missing horizontal view, built from the 11 foundation objectives (`OBJ-01…11`, §1.3) as the spine, since every other requirement in this project already traces back to one of them.

### 12.1 The full chain, by objective

| `OBJ` | Requirements (§3) | Domain capability (§2) | Architecture mechanism (§5) | Data (§6) | API (§7) | Test category (§10) | Acceptance criteria (§11) |
|---|---|---|---|---|---|---|---|
| **01** Law-accurate engine | `DR-01…36`, `FR-042…072`, `BR-009…043`, `NFR-053/054` | `CTX-SCORING`, `AGG-MATCH`, `SM-MATCH/INNINGS/DELIVERY`, all 13 `SVC-*` | Shared scoring core (`ADR-T01`), event-sourced write model (`ADR-01`) | `match_events`, `deliveries`, `delivery_run_events`, `wickets`, `overs` | `POST /sync/events` (no bespoke per-action endpoints, by design) | Domain/Conformance (100% gate) | §6 Cricket edge (all 54) |
| **02** Offline-first | `OFF-001…022`, `NFR-009…015` | `MBR-01/06/07` | Local-first (`ADR-02`), PowerSync substrate (`ADR-T09`) | Local mirror of `match_events`, `sync_cursors`, `writer_fences` | Sync endpoints (§12 of the API spec) | Offline chaos test | §7 Offline |
| **03** Deterministic sync / dual-scorer | `SYNC-001…016`, `FR-113…120` | `MINV-14`, `MBR-03` | Deterministic ordering (`ADR-05`), CQRS (`ADR-06`) | `match_events` (`scorer_stream_id`/`device_seq`/`hlc`/`event_ordinal`), `divergences` | `POST /sync/fence`, `GET /sync/changes` | Sync convergence + Conflict tests | §8 Sync, §10 Security (fence-adjacent) |
| **04** Match mathematics | `DR-27…30/36`, `FR-078…091` | `SVC-RESULT-DERIVER`, `SVC-DLS-CALCULATOR` | `RainMethod` pluggable strategy (`ADR-10`) | `innings.target`, `dls_revisions` | (via §12's sync path — no bespoke DLS endpoint) | Domain tests, DLS benchmark | §6 Cricket edge (DLS-related rows), §4 Boundary |
| **05** Complete outputs | `FR-112…138` | `QRY-SCORECARD-AT`, `QRY-LIVE-STATE` | Read-model projections (`ADR-06`) | `batter_card_lines`, `bowler_card_lines`, `partnerships`, `match_snapshots` | `GET /matches/{id}/scorecard`, `/ball-by-ball`, `/live` | Domain golden-file, UI tests | §3 Normal (J cluster), §4 Boundary |
| **06** Cross-platform parity | `NFR-047/048` | The shared scoring core itself is the mechanism | `ADR-01/T01`, `SPK-04` | — | — | Domain parity corpus (run on both builds) | Implicit across §6 — every cricket-edge criterion is a parity assertion by construction |
| **07** Verifiability / trust | `FR-097…112`, `AUD-001…015`, `BR-003…008` | `MINV-01/02/03`, `MBR-04` | Hash-chained append-only logs (`ADR-08`), audit architecture | `audit_log`, provenance fields on `match_events` | `GET /matches/{id}/audit-trail`, `/reconciliation-reports` | Audit-chain verification (scheduled + CI) | §5 Invalid (H cluster), §10 Security (SEC-12) |
| **08** Speed of entry | `NFR-001…005` | — | Durable-before-confirm principle | — | — | Performance tests | Implicit — input-latency assertions across §6 |
| **09** Data ownership / portability | `FR-010/011/171…182`, `NFR-049…052` | `SVC-EXPORT-TRANSLATOR` | Anti-corruption export/import layer | `exports` (referenced), local backup mechanism | `POST /matches/{id}/exports`, `POST /users/me/export` | Interoperability check | §7 Offline (backup round-trip), §3 Normal (N cluster) |
| **10** Multi-tenant | `FR-005…009`, `ADM-*`, `NFR-020…022` | `AGG-ORGANIZATION`, `CTX-IDENTITY` | RLS as the boundary (`ADR-04`), trust boundary `B5` | `organizations`, `memberships` | Generic CRUD (§10 of the API spec) | RLS policy matrix (Database tests) | §10 Security (SEC-02/03) |
| **11** Accessibility / i18n | `FR-183…185`, `NFR-037…045/057…059` | — | — | — | — | Accessibility tests | `docs/ux/ux-specification.md §2.7`'s baseline, applied to every screen |

### 12.2 Coverage note

`OBJ-06` and `OBJ-08` have no dedicated data/API row **by design** — parity is a property of the shared core proven by running the identical test corpus twice (§10.2), and speed-of-entry is a property of the durability contract measured by instrumentation, not a distinct table or endpoint. This mirrors the asymmetric-mapping principle already stated in §7.4 and §3.2: a real requirement does not always need its own dedicated artefact at every layer to be genuinely, verifiably satisfied.

### 12.3 Document dependency graph

```
foundation ──▶ discovery ──▶ domain-model ──▶ SRS ──▶ roadmap
   │              │              │  ▲            │       │
   │              │              │  │            │       │
   └──────────────┴──▶ cricket-rules-reference ──┘       │
                              │                           │
                              ▼                           ▼
                        glossary                  system-architecture ──▶ technology-stack
                              │                           │                      │
                              ▼                           ▼                      ▼
                        live-scoring ◀──────── offline-first-specification ◀─────┘
                              │                           │
                              ▼                           ▼
                    ux-specification            data-specification ──▶ api-specification
                              │                           │                      │
                              └───────────────┬───────────┴──────────────────────┘
                                               ▼
                                  security-specification ──▶ testing-strategy ──▶ acceptance-criteria
                                               │                                          │
                                               └──────────────────┬───────────────────────┘
                                                                   ▼
                                                       master-specification (this document)
```

---

## 13. Architecture Decision Records

**New content — the consolidated index.** 25 ADRs exist across two documents; neither lists them alongside the other. Full text remains in the source; this is the one-place lookup.

### 13.1 Pattern ADRs (`system-architecture.md §8`)

| ID | Decision | One-line rationale |
|---|---|---|
| `ADR-01` | Event sourcing for the match | Audit, replay, deterministic sync, offline correction all follow from one design choice |
| `ADR-02` | Local-first: the on-device event log is authoritative for an in-progress match | Offline is a hard requirement; the network cannot be on the write path |
| `ADR-03` | One shared scoring core, not two parallel implementations | Small team; parity is otherwise unenforceable |
| `ADR-04` | Managed backend (Supabase); RLS is the authorization boundary | Least operational surface for a small team; defence-in-depth at the data layer |
| `ADR-05` | Deterministic event ordering (ordinal → HLC → device seq); no CRDT, no last-write-wins | Conflicts must be explainable and, for dual-scorer, human-resolved |
| `ADR-06` | CQRS: event log = write model; projections computed by the same core on client and server | Identical results everywhere |
| `ADR-07` | Single-writer per scorer stream in P1; independent multi-stream dual-scorer in P2 on the same substrate | Keeps P1 simple without foreclosing P2 |
| `ADR-08` | Hash-chained append-only logs with periodic external anchoring | Tamper-evidence for a high-integrity record |
| `ADR-09` | Transactional outbox for integration events | Reliable eventual consistency for downstream contexts |
| `ADR-10` | DLS behind a `RainMethod` strategy; `NONE` (manual) is the default until `SPK-01` clears | Licensing risk isolation |
| `ADR-11` | Reference data versioned and pinned per match at creation | A match's rules never change under it; reproducible recompute |

### 13.2 Technology ADRs (`technology-stack.md §4`)

| ID | Decision | One-line rationale |
|---|---|---|
| `ADR-T01` | Shared scoring core: Kotlin Multiplatform | One implementation, native Android performance, reversible toward Rust if needed |
| `ADR-T02` | Web: React + TypeScript + Vite, no SSR meta-framework | Deepest ecosystem for PWA/a11y/offline; SSR would fight offline-first |
| `ADR-T03` | Android: Native Kotlin + Jetpack Compose | Best performance/lifecycle control on the constrained platform |
| `ADR-T04` | Backend: Supabase | Postgres+RLS specifically required; best DX/community among that field |
| `ADR-T05` | Database: Supabase-managed PostgreSQL | Inseparable from `ADR-T04`; RDS/Aurora is the named escalation |
| `ADR-T06` | Local database: SQLite via PowerSync SDK (SQLDelight fallback) | Durable mobile persistence owned by a proven SDK — the direct `SPK-03` de-risk |
| `ADR-T07` | API: REST/RPC over HTTP+JSON, contract-first | Largest corpus; typegen for both TS and Kotlin; tRPC excludes Kotlin |
| `ADR-T08` | Authentication: Supabase Auth (GoTrue) | JWT↔RLS integration is the deciding feature |
| `ADR-T09` | Synchronization: PowerSync substrate + event-log semantics in the core; custom HTTPS fallback | De-risks the two scariest spikes for a small team; reversible by design |
| `ADR-T10` | Hosting: Supabase Cloud + Cloudflare Pages + Google Play + PowerSync Cloud | Managed-first; every piece has a documented self-host exit |
| `ADR-T11` | CI/CD: GitHub Actions | Ubiquitous, best-documented, native OIDC |
| `ADR-T12` | Testing: layered — bespoke correctness harnesses + mainstream tools | The bespoke harnesses are the real bar; the rest maximise productivity |
| `ADR-T13` | Monitoring: Sentry + Grafana Cloud (OTel) + Checkly + PostHog | Four focused tools with real free tiers beat one expensive console |
| `ADR-T14` | Documentation: markdown-in-repo + Astro Starlight + contract-first API docs + MADR ADRs | Keeps the existing practice; API docs cannot drift from the contract |

### 13.3 Reading the two sets together

Pattern ADRs (`ADR-*`) answer *what shape the system has*; technology ADRs (`ADR-T*`) answer *what it's built with*. `ADR-01` (event sourcing) is realised by `ADR-T01` (the KMP core that implements it) and `ADR-T09` (the sync substrate that transports it) — this pairing repeats throughout; neither set is complete without the other.

## 14. Glossary

**Source:** `docs/domain/glossary.md` v0.1.0, embedded here in full — short, foundational, and exactly the vocabulary every other section above assumes.

> The shared vocabulary. Every term used in the domain model, feature specs, code, tests and conversation **must** use these words with these meanings.

### A. Structural terms

| Term | Meaning |
|---|---|
| **Match** | One contest between two Teams, governed by one Playing Conditions Profile, producing one Result. |
| **Format** | The shape of a match: innings per side, over limits, ball rules, permitted endings. |
| **Playing Conditions Profile** | The complete resolved set of configurable rule values (`[CFG]`) in force for a match, frozen at first delivery. |
| **Innings** | One period in which one Team bats and the other bowls, ending by a defined reason. A match has 1 or 2 innings per side. |
| **Over** | A set of legal deliveries (6 by default) bowled from one end by one bowler; ends changed each over. |
| **Block** (The Hundred) | 5 or 10 consecutive legal balls bowled by one bowler; replaces the "no two consecutive overs" rule. |
| **Delivery** | The atomic scoring event: one ball bowled (legal or illegal) with its full outcome. |
| **Ball** | Informal synonym for Delivery; "legal ball" = a delivery that counts toward the over. |
| **Super Over** | A one-over-per-side tie-breaker mini-innings pair, max 2 wickets each. |
| **Match Timeline** | The ordered log of every domain event for a match (deliveries + non-delivery markers). |

### B. Scoring outcome terms

| Term | Meaning |
|---|---|
| **Run** | A unit of score. Off the bat → credited to the striker; otherwise an extra. |
| **Boundary** | 4 (ball reaches boundary along ground / after bouncing) or 6 (over the boundary on the full from the bat). |
| **Extra / Sundry** | A run not credited to a batter: bye, leg-bye, wide, no-ball, penalty. |
| **Bye** | Runs when a legal delivery passes the striker untouched; legal ball; team extra. |
| **Leg-bye** | Runs off the striker's body (not bat) when a shot or evasion was attempted; legal ball; team extra. |
| **Wide** | An illegal delivery out of the striker's reach; 1-run penalty + any runs, all wides; re-bowled. |
| **No-ball** | An illegal delivery (foot fault, throw, dangerous, fielding breach, etc.); penalty + runs; re-bowled; may trigger a free hit. |
| **Penalty runs** | 5 runs awarded to a side for an infringement by the other; no ball faced. |
| **Free hit** | The delivery after a qualifying no-ball on which the striker can be out only run out / obstructing / hit the ball twice. |
| **Short run** | A run not completed because a batter did not ground bat/person behind the crease; not scored. |
| **Overthrow** | Extra runs (incl. a boundary) resulting from a wild throw / wilful fielder act. |
| **Dot ball** | A legal delivery from which no run is scored. |
| **Maiden** | An over conceding no runs off the bat and no wides/no-balls (byes/leg-byes allowed). |
| **Dead ball** | The ball is not in play; no runs or dismissals may occur. |

### C. Dismissal terms

| Term | Meaning |
|---|---|
| **Wicket** | A dismissal; also the physical stumps+bails ("the wicket is put down"). Count of dismissals = wickets lost. |
| **Dismissal Mode** | One of: bowled, caught, caught & bowled, LBW, run out, non-striker run out (mankad), stumped, hit wicket, obstructing the field, hit the ball twice, timed out, retired out. |
| **Bowler credit** | Whether the dismissal is attributed to the bowler's figures (bowled, caught, LBW, stumped, hit wicket only). |
| **Fall of Wicket (FoW)** | The record of each dismissal: team score, wicket number, batter, over.ball. |
| **Retired – not out / retired hurt** | A batter leaves the crease for an unavoidable cause; not a dismissal; may resume. |
| **Retired out** | A batter leaves for any other cause without opposing-captain consent; counts as a wicket, no bowler credit. |
| **Absent** | A batter unavailable to bat at all; not a dismissal; does not count toward wickets. |
| **All out** | An innings ends because the batting side has no further available batters (usually 10 dismissed; fewer with absent/retired-not-out). |

### D. Role & participant terms

| Term | Meaning |
|---|---|
| **Team** | One of the two sides in a match; links to a canonical competition team or is ad-hoc. |
| **Squad** | The pool of players a team may pick from. |
| **Playing XI / Nominated Side** | The (usually) 11 players nominated to play, given before the toss. |
| **Player** | A person who plays; has a canonical registry identity where linked. |
| **Striker / Non-striker** | The batter facing / at the bowler's end. |
| **Batter** | A player currently or previously batting in an innings. |
| **Bowler** | A player bowling / who has bowled in an innings. |
| **Wicket-keeper** | The one player per side positioned behind the stumps; may change during an innings. |
| **Captain** | The one acting captain per side; makes toss, declaration, follow-on, review decisions. |
| **Substitute fielder** | A non-XI player fielding for an absent fielder; may not bat/bowl/keep/captain. |
| **Concussion replacement** | A sanctioned like-for-like replacement who takes a full part; replaced player takes no further part. |
| **Impact / replacement player** | A competition-specific full replacement (default disabled). |
| **Runner** | A substitute who runs for an injured batter (not in the Laws; default disabled). |
| **Umpire** | One of two on-field officials; also third/fourth/reserve and match referee. |
| **Scorer** | One of the (usually two) officials keeping the record; may be Head Scorer or Assistant/Co-Scorer. |

### E. Result & interruption terms

| Term | Meaning |
|---|---|
| **Toss** | The pre-match coin toss; winner elects to bat or field; sets initial innings order. |
| **Target** | The score the side batting last must reach to win: opponent total + 1, or DLS-revised. |
| **Result** | The outcome of the match: win (by runs / wickets / innings / DLS / Super Over), tie, draw, no result, abandoned, awarded. |
| **Draw** | A multi-innings match where time expired with no positive result. Distinct from a tie. |
| **Tie** | Scores exactly level with the side batting last having completed its innings (or aggregates level). |
| **No result** | A limited-overs match that did not reach the minimum overs for a result and cannot be decided by DLS. |
| **Abandoned** | A match called off; optionally "without a ball bowled". |
| **Declaration** | The batting captain closes an innings early (formats not limited by overs). |
| **Forfeiture** | A captain gives up an innings; it counts as completed. |
| **Follow-on** | Requiring the side that trailed by ≥ the margin to bat again immediately (two-innings formats). |
| **Interruption** | A stoppage (rain, bad light, etc.) with a start and end time; may cause overs lost. |
| **DLS Revision** | A versioned recalculation of target/par using the Duckworth–Lewis–Stern method after an interruption. |
| **Par score** | The score the side batting second must equal at a given point to be level on DLS. |
| **Net Run Rate (NRR)** | A competition tie-break metric: runs-per-over for minus against, all-out counted as full quota. |
| **Powerplay** | A phase with tighter fielding restrictions; recorded per delivery as a phase label. |
| **Review (DRS)** | A challenge to an on-field decision; outcome is upheld / overturned / umpire's call. |

### F. Record-integrity terms

| Term | Meaning |
|---|---|
| **Event** | An immutable fact that happened in the domain, named in the past tense. |
| **Command** | A request to change state, which may be accepted (emitting events) or rejected. |
| **Amendment / Correction** | A superseding event that changes a prior record without deleting it. |
| **Superseding** | The relationship from an amendment to the original event it replaces. |
| **Cascade** | The downstream recomputation and re-evaluation triggered by an amendment (esp. strike continuity). |
| **Reconciliation** | Checking that all derived figures satisfy the invariants; done at each interval and at sign-off. |
| **Sign-off** | The Head Scorer's act of making a match `FINAL`; may require counter-signature. |
| **Provenance** | Who/what/when/where a piece of the record came from (scorer, device, app version). |
| **Snapshot / Scorecard-at** | A materialised view of the match state as at a given event ordinal or timestamp. |
| **Divergence** | A per-delivery disagreement between two independent scorer logs of the same match. |
| **Playing Conditions freeze** | The rule that `[CFG]` values are fixed at the first delivery and only changed by explicit amendment. |

---

## 15. Open Questions

**New content — the consolidated, deduplicated master register.** Across every constituent document, roughly 130 individual open items exist. Transcribing all of them verbatim here would itself become unmaintainable — this section groups them by theme and blocking severity, names the genuinely critical few in full, and points to each source document's own list for the rest.

### 15.1 Blocking spikes (`SPK-01…06`) — the highest-priority unresolved items in the whole project

| Spike | Question | Blocks | Fallback already designed |
|---|---|---|---|
| `SPK-01` | DLS licensing/IP — legal basis for implementing DLS Standard Edition | `DR-36`, `FR-083…094`, `NFR-034` | `RainMethod = NONE`; manual target entry only (already the Must·P1 default) |
| `SPK-02` | Can the append-only, per-device-sequenced event log serve P1 corrections **and** P2 merge without a rewrite? | The entire sync/correction/audit substrate | Re-scoped by `ADR-T09` to: prototype on PowerSync, pass the chaos + convergence harnesses, **before** MVP build begins |
| `SPK-03` | Offline durability on Android — does write-ahead persistence + crash recovery meet the chaos-test bar on target-tier hardware? | `NFR-009…011` — an MVP exit gate | PowerSync's SDK is the chosen de-risk (`ADR-T06/T09`) |
| `SPK-04` | How is identical scoring behaviour guaranteed on Web + Android? | `NFR-047/048` — the parity gate | One shared KMP core (`ADR-T01`) + a contract-test corpus (`testing-strategy.md §4.2`) |
| `SPK-05` | Confirm Cricsheet-compatible JSON/YAML as the export target; enumerate lossy fields | `FR-171…176`, `NFR-050…052` | `SVC-EXPORT-TRANSLATOR` as an anti-corruption layer; PDF/CSV satisfy the portability minimum if this slips |
| `SPK-06` | What in-app rule/help text needs MCC permission vs. can be paraphrased? | `NFR-035` | Rules encoded as logic + citations by default; paraphrase-only fallback |

### 15.2 Foundation-level scope and market questions (`foundation §11`, `A1…F27`) — still open

| Group | Refs | Theme | Current working assumption |
|---|---|---|---|
| Market & positioning | `A1…A4` | Primary segment, first geography, endorsement goal, business model | Club/league volunteer scorers, English-first, phased delivery (`A-13/A-14`) |
| Scope & formats | `B5…B11` | Multi-day in v1?, automated DLS?, dual-scorer in v1?, tournaments in v1?, analytics depth, manual commentary | Limited-overs only v1 (`A-27`); manual DLS fallback (`A-19`); dual-scorer P2 (`A-03`); competitions P2 |
| Users & roles | `C12…C14` | Guest scoring mandatory?, umpire/commentator roles in v1?, player self-service in v1? | Guest = yes (`A-12`); umpire/commentator light/P2 (`A-26`) |
| Platform & technical | `D15…D19` | Android+Web only for v1?, confirm Supabase, PWA acceptable?, self-hosting needed?, shared-core delivery approach | Yes/Yes/Yes/No/KMP — all assumed per `A-04/A-09`, `ADR-T01` |
| Data, standards & legal | `E20…E23` | Interchange target, who owns DLS/MCC licensing pursuit, data-ownership model, minors' jurisdictions | Cricsheet (`A-08`, pending `SPK-05`); ownership model per `BR-001/025` |
| Delivery & process | `F24…F27` | Team size/skills, season deadline, pilot "done" definition, budget envelope | Small AI-assisted team (`A-14`); pilot definition already fixed in `docs/roadmap/product-roadmap.md §4.2` |

*(Full text of every individual question remains in `foundation §11`; this table is the status view, not a replacement.)*

### 15.3 New questions surfaced during discovery (`Q-D1…D6`)

Super Over in P1 or fast-follow (`Q-D1`, assumed P1 per `A-20`) · org-first vs. per-match team creation (`Q-D2`, assumed per-match per `A-24`) · counter-signature required for "official" in the pilot (`Q-D3`, assumed no per `A-21`) · wagon wheels expected day one (`Q-D4`, assumed no per `A-22`) · a pilot-mandated export format beyond Cricsheet (`Q-D5`, assumed no per `A-25`) · notifications table-stakes for the pilot (`Q-D6`, assumed no per `A-23`).

### 15.4 Implementation-level open items, by document

| Document | Item count | The most significant, named in full | Full list |
|---|---|---|---|
| `system-architecture.md` | 11 (`AQ-1…11`) | `AQ-1` shared-core tech confirmation (KMP vs. Rust vs. spec+2-impls); `AQ-9` whether Supabase's PITR retention meets the needed RPO | `system-architecture.md §9` |
| `technology-stack.md` | 9 (`TSQ-1…9`) | `TSQ-2` PowerSync cloud vs. self-host at each stage; `TSQ-1` first market/region for hosting | `technology-stack.md §5.5` |
| `live-scoring.md` | 5 (`LSQ-1…5`) | `LSQ-1` hit-wicket validity off a wide — flagged `[OPEN]`, pending accredited-scorer ratification | `live-scoring.md §24` |
| `offline-first-specification.md` | 5 (`OFQ-1…5`) | `OFQ-4` external hash-chain-anchoring cadence/target | `offline-first-specification.md §20` |
| `data-specification.md` | 5 (`DSQ-1…5`) | `DSQ-1` `match_events` partitioning key (hash vs. monthly) | `data-specification.md §13` |
| `api-specification.md` | 5 (`APQ-1…5`) | `APQ-3` numeric rate-limit tiers not yet validated against real traffic | `api-specification.md §20` |
| `security-specification.md` | 5 (`SQ-1…5`) | `SQ-2` whether org-admin MFA becomes `Must` before GA | `security-specification.md §17` |
| `testing-strategy.md` | 5 (`TQ-1…5`) | `TQ-5` authoring owner/date for the `DR-23/29/30` partial-coverage gaps | `testing-strategy.md §23` |
| `acceptance-criteria.md` | 4 (`ACQ-1…4`) | `ACQ-2` DLS/DRS/multi-day criteria blocked on the same spikes as §15.1 | `acceptance-criteria.md §12` |

### 15.5 The shortlist — what genuinely needs a decision before implementation starts

Everything above matters; this is the subset that actually **blocks** the next step:

1. **`SPK-02`'s prototype-and-gate** (§15.1) — must run and pass before MVP build begins; every other sync/offline/correction guarantee in this document set depends on its outcome.
2. **`SPK-01`/`SPK-06`** (legal: DLS licensing, MCC text permission) — resolve or formally accept the fallback with pilot leagues before Version 1's DLS feature is built.
3. **`A1/A2/A4`** (primary segment, geography, business model) — shapes tenancy limits and role modelling; currently assumed, not confirmed.
4. **`B6/B7/B8`** (DLS in v1, dual-scorer in v1, tournaments in v1) — currently resolved by assumption into the roadmap's bucket placement; a change here moves features between MVP/V1/V2.
5. **`D16/D19`** (Supabase confirmation, shared-core delivery approach) — architecturally committed (`ADR-T01/T04`) but never formally signed off against the original foundation question.

---

## 16. Document manifest and governance

### 16.1 The constituent set, with versions

| # | Document | Path | Version |
|---|---|---|---|
| 1 | Project Foundation | `foundation/product-foundation.md` | 0.1.0 |
| 2 | Product Discovery | `discovery/product-discovery.md` | 0.1.0 |
| 3 | Domain Specification (cricket rules) | `specs/cricket-rules-reference.md` | 0.1.0 |
| 4 | Domain Glossary | `domain/glossary.md` | 0.1.0 |
| 5 | Formal Domain Model | `domain/domain-model.md` | 0.1.0 |
| 6 | Software Requirements Specification | `specs/software-requirements-specification.md` | 0.1.0 |
| 7 | Product Roadmap | `roadmap/product-roadmap.md` | 0.1.0 |
| 8 | System Architecture | `architecture/system-architecture.md` | 0.1.0 |
| 9 | Technology Stack | `architecture/technology-stack.md` | 0.1.0 |
| 10 | UX Specification | `ux/ux-specification.md` | 0.1.0 |
| 11 | Live Scoring Specification | `specs/live-scoring.md` | 0.1.0 |
| 12 | Offline-First Specification | `architecture/offline-first-specification.md` | 0.1.0 |
| 13 | Data Specification | `architecture/data-specification.md` | 0.1.0 |
| 14 | API Specification | `architecture/api-specification.md` | 0.1.0 |
| 15 | Security Specification | `architecture/security-specification.md` | 0.1.0 |
| 16 | Testing Strategy | `architecture/testing-strategy.md` | 0.1.0 |
| 17 | Acceptance Criteria Catalog | `architecture/acceptance-criteria.md` | 0.1.0 |
| 18 | Repository Structure Specification | `architecture/repository-structure.md` | 0.1.0 |

**This document is #19** — `docs/master-specification.md`, v0.1.0, assembling all 18 above.

### 16.2 How this document is maintained

When a constituent's version changes in a way that affects its §1–§11 summary here, this document's own version is bumped and the affected section rewritten — never left to silently drift. The manifest above is the single place to check currency: if a constituent's live version number exceeds what's listed, this master specification is due for re-sync on that section.

### 16.3 What "the source of truth" means in practice

For any question of the form *"what does this system do"* or *"what has this project decided and why"* — start here, and this document's navigation gets you to the exact authoritative paragraph. For the literal text of a requirement, rule, screen spec, table, endpoint, or test case — the cited constituent is where that text actually lives, and stays the only place it is edited.

---

## 17. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial Master Specification, assembling all 17 approved constituent documents into the 15-section structure requested: Product (§1), Domain (§2), Requirements (§3), UX (§4), Architecture (§5), Data (§6), API (§7), Offline/Sync (§8), Security (§9), Testing (§10), Acceptance Criteria (§11), Traceability Matrix (§12), ADRs (§13), Glossary (§14), Open Questions (§15). §0 states the precedence rule explicitly (this document is authoritative for structure/scope/synthesis; constituents remain authoritative for their own detailed text) so "source of truth" is honoured without duplicating ~17,000 lines of already-precise content. Three genuinely new syntheses exist only in this document: §12's vertical-slice traceability matrix tracing all 11 foundation objectives end-to-end through requirements, domain capability, architecture, data, API, test category, and acceptance criteria, plus a document-dependency graph; §13's consolidated 25-ADR index (11 pattern + 14 technology) with a reading note on how the two sets pair; §15's deduplicated master open-questions register (blocking spikes, foundation-level scope questions, discovery-level questions, a per-document implementation-level item count with the most significant named, and a five-item shortlist of what genuinely blocks the next step). §16 the document manifest with every constituent's version, and how this document stays current against them. No application code — implementation has not begun. |
