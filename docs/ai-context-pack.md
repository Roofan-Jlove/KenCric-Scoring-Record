# Cricket Scoring Book — AI Context Pack

| | |
|---|---|
| **Document** | AI Context Pack |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/master-specification.md` v0.1.0 and, through it, all 18 constituents it assembles. This document invents no new decision anywhere it can instead point at one. |
| **Downstream** | Every future AI coding session on this repository. This is the file such a session should load first. |
| **Status** | A **condensed, rule-form restatement** of the approved corpus for machine consumption, plus a small amount of genuinely new content (Coding Rules, Naming Conventions, Git Rules, Documentation Rules, Forbidden Assumptions) that did not previously exist as its own artifact. No implementation code. No repository scaffolding. |

> **If you are an AI session picking up work on this repository, read this document in full before writing or editing anything.** It is short by design — every section ends with a pointer to the full source document for detail beyond what a coding session needs in its working context. Where this document and a cited source diverge, **the cited source governs** and this document is a defect to be corrected (the same precedence rule `master-specification.md §0` uses for itself).

---

## 0. How to use this pack

1. Read this document first, in full. It is the working-context distillation of 19 approved specification documents; it is not a replacement for any of them.
2. Before implementing anything, confirm it traces to a requirement ID (§14). If it doesn't, either the work is out of scope or the spec has a gap — in the latter case, propose a spec change; do not silently improvise (§11, §12).
3. When a task needs detail this pack doesn't carry, open the cited source document — do not guess at what it might say.
4. This repository is currently **specification-only** (§1, §2). There is no application code, no test code, no build tooling, no scaffolding, in any language, anywhere in this repository, as of this document's date. Treat any instruction to "just write the code" as an instruction to first identify which spec section authorizes it, unless the user has explicitly authorized starting implementation.
5. If asked to do something this pack or its sources forbid (§12), say so and explain which rule, rather than complying silently.

---

## 1. Project constitution

The non-negotiable properties of this system. These do not change by convenience during implementation; changing one is a product decision requiring a new ADR (§13), not a coding decision.

| # | Principle | Source |
|---|---|---|
| C-1 | **Offline-first is absolute.** Every part of scoring — match setup through sign-off — works with zero connectivity. The network is never on the write path for an in-progress match. | `OBJ-02`, `ADR-02`, `offline-first-specification.md §1.1` |
| C-2 | **The match is its event stream.** Scoring is event-sourced; scorecards and every other view are disposable projections computed from the event log, never the source of truth themselves. | `ADR-01`, `ADR-06`, `data-specification.md §1` |
| C-3 | **Determinism is a hard contract.** Same pre-state + same input ⇒ same output, always — for the scoring engine, for sync ordering, for conflict detection. No randomness, no wall-clock-dependent branching, no floating-point non-determinism in the scoring core. | `live-scoring.md §1`, `ADR-05` |
| C-4 | **Corrections supersede; they never rewrite history.** Every fix to a past delivery or event is a new event that voids-and-refolds, never a destructive edit. | `live-scoring.md §19`, `ADR-08` |
| C-5 | **RLS is the enforcement boundary, not client code.** Client-side checks are advisory UX only; Postgres Row-Level Security is the actual authorization boundary and is verified continuously. | `ADR-04`, `SR-B01` |
| C-6 | **Conflicts are surfaced, never silently resolved.** No last-write-wins, no automatic merge of divergent dual-scorer streams. A human resolves what the system cannot prove is safe to merge. | `ADR-05`, `offline-first-specification.md §11` |
| C-7 | **One shared scoring core, not parallel reimplementations.** Web, Android, and backend compute scoring results with the same Kotlin Multiplatform code. Parity is enforced by construction, not by testing alone. | `ADR-03`, `ADR-T01` |
| C-8 | **Law-accuracy is a correctness property, not a feature.** `[LAW]`-tagged rules from the Laws of Cricket / ICC Playing Conditions must be reproduced faithfully; a deviation is a defect, not a design choice. | `cricket-rules-reference.md §0`, `OBJ-01` |
| C-9 | **The record is tamper-evident and fully attributed.** Every write is hash-chained and attributed to an actor; nothing is anonymous, nothing is un-orderable. | `ADR-08`, `SR-I01…I04` |
| C-10 | **Spec precedes code.** This repository is in the SDD (Spec-Driven Development) phase. No feature is implemented ahead of the specification that governs it. | `master-specification.md §0`, this document §0 |

**Full source:** `master-specification.md` §1 and §5, and the ADR list at §13.

---

## 2. Product brief

**What:** An official-standard, offline-first digital cricket scoring book for Web (installable PWA) and Android, backed by a managed cloud backend (Supabase), for scoring live matches ball-by-ball with law-accurate rules, deterministic multi-device sync, and full auditability.

**Who:** Primarily club/school/league scorers (solo or dual-scorer) scoring live matches at the ground, often with unreliable connectivity; secondarily team/tournament administrators, players/viewers consuming scorecards and shares, and platform admins. Full persona and role detail in `product-foundation.md §3–4`.

**Why now:** Existing scoring apps are not simultaneously law-accurate, genuinely offline-capable (not just offline-tolerant), and auditable/correctable without destructive edits. `product-foundation.md §2`.

**Core objectives (`OBJ-01…09`):** law-accurate scoring engine · true offline-first · deterministic sync & dual-scorer reconciliation · automated match mathematics (DLS, NRR, rates) · complete outputs (scorecards, analytics) · cross-platform parity · verifiability & trust · speed of entry (≤2 interactions per normal delivery) · data ownership & portability. `product-foundation.md §5`.

**Current scope state:** MVP / Version 1 / Version 2 / Future, MoSCoW-prioritized, with an explicit 20-step MVP workflow-completeness proof. `product-roadmap.md`. Nothing beyond what that roadmap marks Must/P1 is MVP scope — do not assume a Should/Could item is expected in an MVP-scoped task.

**Repository status:** specification-only — see §0.4 above and `README.md`'s status banner.

**Full source:** `master-specification.md §1`, `product-foundation.md`, `product-roadmap.md`.

---

## 3. Domain glossary

The ubiquitous language. Every term used in the domain model, feature specs, code, and tests **must** use these words with these meanings — do not introduce a synonym for an existing glossary term, and do not reuse a glossary term for something else.

Six categories, all embedded in full in `master-specification.md §14` and canonically owned by `docs/domain/glossary.md`:

- **A. Structural terms** — match, innings, over, delivery, session, playing conditions, profile, and their containment relationships.
- **B. Scoring outcome terms** — run, extra (wide/no-ball/bye/leg-bye/penalty), boundary, strike/non-strike.
- **C. Dismissal terms** — the ten dismissal modes and their legality/run-carrying classification.
- **D. Role & participant terms** — scorer, umpire, captain, player, organization, the RBAC role set.
- **E. Result & interruption terms** — result types, DLS/rain interruption vocabulary, Super Over.
- **F. Record-integrity terms** — event, correction, sign-off, audit, hash chain, divergence.

A term appearing in code (variable, type, or table name) should be traceable to one of these six categories; if it isn't, either the glossary needs an addition (propose it) or the term shouldn't exist.

**Full source:** `docs/domain/glossary.md` v0.1.0; embedded copy at `master-specification.md §14`.

---

## 4. Master specification

`docs/master-specification.md` is **the source of truth**. It assembles all 18 other constituent documents (Product → Domain → Requirements → UX → Architecture → Data → API → Offline/Sync → Security → Testing → Acceptance Criteria), plus a vertical-slice traceability matrix (§12), a consolidated 25-ADR index (§13), the full glossary (§14), and a deduplicated master open-questions register (§15).

**Precedence rule (`§0.1`, restated):** the Master Specification is authoritative for overall structure, scope, and cross-document synthesis; each constituent document remains authoritative for its own detailed text. Where they appear to conflict, that is a defect in the Master Specification to be corrected, not a license to pick whichever is convenient.

**The 18 constituents, in reading order**, are listed with path and version in `master-specification.md §16.1` and mirrored in `docs/README.md`. This context pack does not repeat that table — treat `§16.1` as the authoritative manifest and check it before assuming a document's version.

**Full source:** `docs/master-specification.md` (600+ lines, 17 sections + this one).

---

## 5. Architecture rules

Imperative rules, condensed from `system-architecture.md`, the ADR set, and `offline-first-specification.md`. These bind any future implementation.

1. **MUST** treat the on-device event log as authoritative for an in-progress match; the server is the durable destination, never the write-path dependency (`ADR-02`).
2. **MUST** implement the scoring/rules core once, in Kotlin Multiplatform, consumed by Web (JS/wasm target), Android (JVM target), and backend (JVM target) — never a second reimplementation in TypeScript or elsewhere (`ADR-03`, `ADR-T01`).
3. **MUST** order events deterministically via ordinal → HLC (hybrid logical clock) → device sequence. **MUST NOT** use CRDT merge semantics or last-write-wins for match events (`ADR-05`).
4. **MUST** keep the write model (`match_events`, append-only, hash-chained) and read model (projections: innings/overs/deliveries/scorecards/etc.) structurally separate — CQRS, not a single mutable table set (`ADR-06`, `data-specification.md §1`).
5. **MUST** enforce single-writer-per-scorer-stream in P1 (one authoritative scorer at a time per match) and treat true concurrent dual-scorer streams as a distinct, explicitly-designed P2 capability — never assume P1 concurrency guarantees extend to P2 without checking (`ADR-07`).
6. **MUST** anchor hash-chained logs periodically for external tamper-evidence; **MUST NOT** allow an in-place edit to an already-chained event (`ADR-08`).
7. **MUST** use a transactional outbox for any integration event crossing a bounded-context boundary — never a direct cross-context write in the same transaction as the domain write (`ADR-09`).
8. **MUST** treat DLS (and any future rain method) as a pluggable `RainMethod` strategy behind a stable interface, defaulting to `NONE` (manual targets) until `SPK-01` (licensing) clears — **MUST NOT** hardcode DLS Standard Edition math as if it were unconditionally available (`ADR-10`).
9. **MUST** version and pin reference data (Laws/playing-conditions profile) to a match at its creation; a match's applicable rules **MUST NOT** silently change under it after the first delivery (`ADR-11`).
10. **MUST** treat RLS as the real authorization boundary (`C-5` above); any client-side permission check is UX convenience only and **MUST NOT** be the only gate on a write.
11. **MUST NOT** put the network, PowerSync, or any remote call on the synchronous path of recording a delivery — local persistence completes first; sync is asynchronous and best-effort (`offline-first-specification.md §3–§4`).
12. The nine required architectural characteristics (reliability, offline capability, maintainability, performance, dev productivity, AI-assisted-dev fit, scalability, cost discipline, security) are structural properties of the whole system, not features to bolt on — see `system-architecture.md §5.3`/`master-specification.md §5.3` before treating any of them as optional.

**Full source:** `docs/architecture/system-architecture.md`, `docs/architecture/offline-first-specification.md`, ADR set at `master-specification.md §13`.

---

## 6. Coding rules

No code exists yet (§0.4). These are the rules the first and every subsequent line of implementation code must satisfy, derived from the architecture, testing, and security specifications rather than invented fresh.

1. **Every unit of scoring-core code must trace to a rule ID** (`FMT-*`, and the other `[LAW]`/`[PRD]`/`[CFG]`/`[EDGE]` tags in `cricket-rules-reference.md`, or a `live-scoring.md` section). Code with no traceable rule is either dead weight or an unspecified feature — stop and check the spec, don't invent behavior.
2. **The scoring core (`shared/`, per `repository-structure.md §5`) must be pure and side-effect-free.** No I/O, no wall-clock reads, no randomness inside the pipeline described in `live-scoring.md §2–§19`. Time, identity, storage, and reference-data lookups are injected via ports (`ClockPort`, `IdPort`, `EventLogPort`, `ReferenceDataPort`) — never called directly — so the same core runs identically on JVM, JS, and wasm and is trivially testable against the conformance corpus.
3. **The wire contract is generated from `specs/`, never hand-duplicated.** Request/response types, event schemas, and API clients are generated from the OpenAPI definition and JSON Schemas that live in `specs/` (`repository-structure.md §4`); a hand-written type that duplicates a schema is a drift risk and is not permitted once codegen exists.
4. **No conflict resolution logic may pick a winner automatically** for anything classified as a true conflict in `offline-first-specification.md §10–§11`. Surfacing is mandatory; resolution is a human, attributed action.
5. **No destructive mutation of a past event.** A correction is new code paths that emit a superseding event and refold state (`live-scoring.md §19`), never an `UPDATE`/`DELETE` on an already-committed event row.
6. **Follow `system-architecture.md`'s chosen stack without substitution.** React+TS+Vite (no SSR) for web, native Kotlin+Compose for Android, Supabase for backend/DB/auth, SQLite via PowerSync for local persistence — a different library or framework for one of these slots is an ADR-level decision, not a coding-session choice (§13; ADR-T01…T14).
7. **No abstraction, interface, or configuration flag for a case the spec doesn't require.** Per this repository's general engineering discipline: three similar lines beat a premature abstraction; don't design for a hypothetical Version 2/Future requirement while implementing MVP scope.
8. **Every dismissal, extras, and strike-rotation code path must match its formula in `live-scoring.md` exactly** (the `RunEvent` model, the always-zero-runs vs. may-carry-runs dismissal sets, the `netRotates = (ranRuns mod 2 = 1) XOR (isOverFinalBall)` parity formula) — these are the most failure-prone areas in cricket-scoring software and are specified precisely so implementations don't have to guess.
9. **Backend command handlers live in `backend/`; `database/supabase/functions/*` are thin entrypoints only** that import and delegate — business logic does not live inside a Supabase Edge Function body (`repository-structure.md §8–§9.3`).
10. **No code is "done" without its corresponding test tier** from `testing-strategy.md` (§9 below) passing, including the conformance corpus for anything touching the scoring core.

**Full source:** `docs/architecture/testing-strategy.md`, `docs/specs/live-scoring.md`, `docs/architecture/repository-structure.md §5–§9`.

---

## 7. Naming conventions

1. **Directories** follow `repository-structure.md` exactly: `docs/`, `specs/`, `shared/`, `apps/web/`, `apps/android/`, `backend/`, `database/`, `tests/`, `infrastructure/`, `.github/workflows/`, `scripts/` — do not introduce a sibling top-level directory without updating that document first.
2. **UX screen directories/files** use the screen's own ID as the name: `UX-##-short-name/` (e.g. `UX-07-live-scoring/`), mirrored identically between `apps/web/` and `apps/android/` so a screen's web and Android implementations are trivially cross-referenced (`repository-structure.md §6–§7`).
3. **KMP source sets** use the standard Kotlin Multiplatform names: `commonMain`, `androidMain`, `jsMain`, `jvmMain`, `commonTest` — not custom names — inside `shared/` (`repository-structure.md §5`).
4. **Documentation files** are `kebab-case.md`, one concern per file, living under the `docs/<layer>/` directory matching their SDD layer (`foundation/`, `discovery/`, `domain/`, `specs/`, `roadmap/`, `architecture/`, `ux/`) — see §11 below.
5. **Events and commands** use the existing domain-model naming pattern: events `EVT-SCREAMING-SNAKE-CASE` conceptually, realized in code as PascalCase types (e.g. `EVT-DELIVERY-RECORDED` → `DeliveryRecorded`); commands `CMD-*` → PascalCase command types; queries `QRY-*`; domain services `SVC-*` (`domain-model.md`, referenced at §14 below).
6. **Requirement/rule ID prefixes are reserved words** — never reuse `FR-`, `SR-`, `ADR-`, `OBJ-`, etc. for anything other than their defined scheme in §14. If a new category of traceable item is needed, mint a new, undocumented-elsewhere prefix and register it in §14 rather than overloading an existing one.
7. **Git branches and commits** — see §10.
8. **Code identifiers** (once code exists) follow each language's own idiom: `camelCase` for Kotlin/TypeScript functions and variables, `PascalCase` for types/classes in both, `snake_case` for Postgres/SQL identifiers (tables, columns, functions) per `data-specification.md`'s existing table names (e.g. `match_events`, `delivery_run_events`).

**Full source:** `docs/architecture/repository-structure.md`, `docs/domain/domain-model.md`.

---

## 8. Security rules

Condensed MUST-level rules from the 76-requirement `security-specification.md` (12 clusters, `SR-A`…`SR-L`). This section is a summary for working context, not a substitute for the full document when implementing an actual security-sensitive feature.

1. **Authentication (`SR-A`):** transport encryption everywhere; credential handling delegated to Supabase Auth, never reimplemented; brute-force/enumeration resistance on sign-in; MFA required for elevated roles; offline authentication is cryptographically verifiable, not merely cached.
2. **Authorization (`SR-B`):** RLS is the enforcement boundary (`C-5`); match-scoped roles are distinct from org-wide roles; role composition is additive-only; new members default to least privilege; cross-tenant isolation is enforced at the RLS layer, not the application layer; guest→claimed account transition is one-directional; share-link capability is exactly what the token encodes, nothing more.
3. **Session/Token security (`SR-C`, `SR-D`):** short-lived access tokens, longer-lived rotated refresh tokens with reuse detection; no service-role key ever ships client-side.
4. **Data encryption (`SR-E`) and local-device security (`SR-F`):** encryption in transit and at rest per the spec's classification; local device loss must not expose more than the bounded offline-grace window permits.
5. **API security & input validation (`SR-G`):** every input is validated at the API boundary regardless of client-side validation already performed (defense in depth, matches `api-specification.md`'s 3-layer 400/422/409 model).
6. **Rate limiting & abuse prevention (`SR-H`):** concrete numeric tiers exist per endpoint class — do not add an unthrottled public endpoint.
7. **Audit logging (`SR-I`):** every write is attributed; audit records are append-only, same hash-chain discipline as match events.
8. **Privacy (`SR-J`):** minors' data is role- and relationship-gated; data collection is minimized (names-only is sufficient for scoring).
9. **Backup/recovery security (`SR-K`, `SR-L`):** recovery paths are themselves authenticated and audited — a recovery flow is not a security bypass.
10. **Never** implement a feature that reads as "trust the client" for anything touching authorization, score integrity, or role — see the residual-risk register (`R-S1…R-S8`) for what's already been weighed and accepted vs. what still needs mitigation.

**Full source:** `docs/architecture/security-specification.md` (777 lines, threat model + full `SR-A01`…`SR-L05`).

---

## 9. Testing rules

Condensed from the 16-category `testing-strategy.md` and the 147-criterion `acceptance-criteria.md`.

1. **Determinism is itself a tested property**, not just a design goal — the domain/conformance suite runs the fixed C01–C55 case catalogue plus the 13 worked examples from `live-scoring.md` against every implementation of the scoring core (Web, Android, backend) and asserts byte-identical results (`testing-strategy.md §4`).
2. **Every `[LAW]`-tagged rule on the P1 scoring path has a deterministic test case** — this is a proven coverage claim in `testing-strategy.md §19`, not an aspiration; a change to scoring behavior without a corresponding conformance-case update is incomplete.
3. **No acceptance criterion may depend on subjective interpretation** — the 147 Given/When/Then criteria in `acceptance-criteria.md` all pass an explicit objectivity rule (banned-words list, machine-checkable). Any new acceptance criterion must pass the same rule.
4. **Test category placement follows the pyramid**, not convenience: Unit/Domain tests are the base and dominate the scoring core; Integration/API/Database next; UI/Android/Web next; E2E, Offline (chaos), Sync (convergence), Security, Performance, Accessibility, Regression are the top, deliberately fewer and cross-cutting (`testing-strategy.md §2`).
5. **Offline and sync tests are chaos/convergence tests by design** — they must inject crashes, power loss, and out-of-order network conditions, not just happy-path connectivity toggling (`testing-strategy.md §8–§9`).
6. **Test code location follows the co-location policy** in `repository-structure.md §10.1`: Unit/Domain/Integration/UI/Android/Web tests live with their owning package; only genuinely cross-cutting suites (E2E, offline-chaos, sync-convergence, performance, security) live in the top-level `tests/` directory.
7. **CI gates are consolidated in `testing-strategy.md §21`** and mapped to `.github/workflows/*.yml` in `repository-structure.md §12` — a PR does not merge past a red gate; do not weaken a gate to unblock a merge without the user's explicit sign-off.

**Full source:** `docs/architecture/testing-strategy.md`, `docs/architecture/acceptance-criteria.md`.

---

## 10. Git rules

New content — this session's own established behavior, made explicit and durable so future AI sessions don't have to rediscover it by trial.

1. **Never commit unless explicitly asked.** Producing or editing a document/file is not, by itself, authorization to commit it. This has been the standing behavior for every document in this corpus.
2. **Never push, force-push, or rewrite history without an explicit, scoped request.** A prior scrub of `.agents/skills` from git history (`git filter-branch` + force-push, with a `backup-pre-scrub` branch retained as an undo safety net) was done only because the user explicitly asked for that exact action — it is the precedent for how rare and deliberate that class of operation must remain, not a template for routine use.
3. **Never skip hooks** (`--no-verify`) or bypass signing (`--no-gpg-sign`) unless explicitly requested.
4. **Prefer new commits over amending.** Only amend when the user explicitly asks for it.
5. **Stage specific files by name**, not `git add -A`/`.` — review `git status` after any broad staging before committing, and check file contents before pushing anything that could plausibly contain a secret, even if the filename looks innocuous.
6. **Commit message style** follows this repo's existing convention, visible in `git log`: a short type-scoped subject (`docs:`, `chore:`, `feat:`, `fix:`) in imperative mood, e.g. `docs: documentation index`, `chore: stop tracking .agents/skills` — not a verbose multi-paragraph message for a routine doc change.
7. **Before any destructive git operation** (`checkout`/`restore`/`reset`/`clean`, or anything that could discard uncommitted work), run `git status` first and stash or commit what's found — never assume the working tree is disposable.
8. **Main branch is `main`**; treat force-pushes to it as requiring explicit confirmation every time, never standing authorization from a prior approval.

**Full source:** this session's own operating history (see the repository's actual `git log`); no separate specification document currently owns git workflow — if one is written later (e.g. a `CONTRIBUTING.md`), it supersedes this section for detail.

---

## 11. Documentation rules

New content, extracted from the pattern every one of the 18 constituent documents already follows.

1. **Every specification document opens with a front-matter table**: `Document` / `Version` / `Date` / `Upstream` / `Downstream` / `Status` (or the equivalent fields `system-architecture.md`/`technology-stack.md` use) — see any file under `docs/architecture/` for the pattern.
2. **Versioning is `v0.1.0` for every current draft**, explicitly marked "Draft — for review." Nothing in this corpus is yet an approved `v1.0.0`; do not imply otherwise.
3. **Every document ends with a change log** and, where applicable, a numbered "open items" section using a document-specific question prefix (§14 lists them) — new open questions get appended there, not scattered inline.
4. **ID tagging is mandatory** wherever a document makes a rule, requirement, or decision — see §14 for the full scheme. A sentence making a normative claim ("the system must…") with no ID attached is a documentation defect.
5. **Every new top-level document is wired into both indexes** on the same turn it's created: the constituent table + reading order in `docs/README.md`, and the documentation table in the root `README.md`. This document did the same to itself (§16 pointer below).
6. **Cross-document consistency is checked by cross-reference, not by copy-paste.** When a fact (a count, an ID range, a table name) is needed in a new document, prefer citing the owning document over duplicating the number — numbers drift, citations don't.
7. **The Master Specification's `§16.1` manifest table is the single authoritative version list** — if a document's version changes, `§16.1` (and this document's §4, if it's listed there) must be updated in the same change.
8. **No document claims application code, tests, or scaffolding exist unless they actually do** — every document in this corpus to date explicitly states "no implementation code" / "no code or scaffolding created" where relevant, and that statement is verified (e.g. by `ls -d` on the directories a structure document proposes) before being written.

**Full source:** the pattern is distributed across all 18 constituents; there is no single document that owned it before this one.

---

## 12. Forbidden assumptions

Things an AI coding session on this repository must **not** assume, because the spec either explicitly rules them out or leaves them open pending a named blocker. Each is paired with why it's wrong and where to check instead.

| # | Do not assume… | Because… | Check instead |
|---|---|---|---|
| FA-1 | Conflicts can be auto-resolved (last-write-wins, "just take the newer one") | `C-6`: conflicts are always surfaced to a human, never silently merged | `offline-first-specification.md §10–§11` |
| FA-2 | There is only ever one scorer per match | P2 dual-scorer with independent multi-stream writers is a designed capability, not a hypothetical | `ADR-07`, `offline-first-specification.md §10` (dual-scorer divergence) |
| FA-3 | DLS Standard Edition math is freely available to implement | `SPK-01` (licensing) is unresolved; the system defaults to `RainMethod = NONE` (manual targets) until it clears | `ADR-10`, `product-foundation.md` `A-06` |
| FA-4 | Laws of Cricket / DLS text can be reproduced verbatim in-app | `SPK-06` is unresolved; text must be paraphrased and cited, not copied | `product-foundation.md` `A-07`, `cricket-rules-reference.md` intro |
| FA-5 | The offline "queue" holds pending commands waiting to execute | Commands execute immediately against local state; only the resulting **event** is queued for transmission | `offline-first-specification.md §4` (explicit clarification) |
| FA-6 | Any fixed format (e.g. "an over is always 6 balls", "20 overs") is a safe hardcode | Format/law parameters are `[CFG]` values under a named playing-conditions profile, pinned per match, not global constants | `cricket-rules-reference.md §0`, `ADR-11` |
| FA-7 | Client-side permission checks are sufficient authorization | RLS is the real boundary; client checks are advisory only | `C-5`, `SR-B01` |
| FA-8 | A requirement not explicitly Must/P1 is in MVP scope | MoSCoW prioritization is explicit and deliberate; Should/Could items are later releases | `product-roadmap.md` |
| FA-9 | It's fine to invent an endpoint, event field, or schema column that "seems missing" | `specs/` (once populated) and `api-specification.md`/`data-specification.md` are the single source; a real gap is a spec change, not a silent addition | `api-specification.md §9.1` ("the spec is the single source"), `data-specification.md` |
| FA-10 | Soft-deletion behaves the same for every table | It's a deliberate three-way policy — never / soft-deactivate / hard-delete — decided per table | `data-specification.md §1` |
| FA-11 | Match events can be edited or deleted once committed | Append-only, hash-chained; corrections are new superseding events | `C-4`, `live-scoring.md §19` |
| FA-12 | It's safe to write application code because "the spec is basically done" | This repository is still SDD-phase; implementation needs explicit user authorization to begin, independent of how complete the spec corpus is | `C-10`, §0.4 above |
| FA-13 | Git history can be rewritten or force-pushed as a routine cleanup step | That is an exceptional, explicitly-authorized-only action; see §10.2 and the `.agents/skills` scrub precedent | §10 above |
| FA-14 | A single open question (`*Q-*`, `SPK-*`) can be quietly resolved by picking a reasonable default in code | Open items are tracked precisely so they're resolved as product/legal/architecture decisions, not buried in an implementation choice | `master-specification.md §15` |
| FA-15 | "Offline-first" means "works offline as a fallback when online fails" | It is the opposite: the device is authoritative for its own unsynced work; online is the enhancement, not the default path | `offline-first-specification.md §1.1` |

**Full source:** synthesized from the ADR set, `offline-first-specification.md`, `product-foundation.md` assumptions (`A-01…A-27`), and `master-specification.md §15`'s open-questions register — none of these are new decisions, only restatements for a coding session's working context.

---

## 13. Decision records

25 ADRs across two documents, consolidated once already at `master-specification.md §13` — this section points there rather than duplicating the table a second time.

- **Pattern ADRs `ADR-01…11`** (`system-architecture.md §8`) — the *shape* of the system: event sourcing, local-first, one shared core, managed backend + RLS boundary, deterministic ordering, CQRS, single-writer P1 / multi-stream P2, hash-chained anchored logs, transactional outbox, pluggable rain-method strategy, versioned/pinned reference data. Summarized as rules at §1 and §5 above.
- **Technology ADRs `ADR-T01…14`** (`technology-stack.md §4`) — *what it's built with*: KMP core, React+TS+Vite web, native Kotlin+Compose Android, Supabase backend/DB/auth, PowerSync+SQLite local storage, contract-first REST/RPC API, GitHub Actions CI/CD, layered testing, Sentry+Grafana+Checkly+PostHog monitoring, markdown+Astro docs.
- **Reading them together:** pattern ADRs answer *what shape*; technology ADRs answer *built with what*. They pair up (e.g. `ADR-01` event sourcing ↔ `ADR-T01` the KMP core that implements it ↔ `ADR-T09` the sync substrate that transports it) — neither set is complete without the other.

A new ADR is required (not a routine code change) whenever an implementation session wants to deviate from any of the 25 decisions above, or from a Project Constitution item (§1).

**Full source:** `docs/master-specification.md §13`; full ADR text in `docs/architecture/system-architecture.md §8` and `docs/architecture/technology-stack.md §4`.

---

## 14. Requirement IDs

The master traceability legend. Every normative sentence in this corpus carries one of these prefixes; use this table to know which document owns a given ID before searching for it.

| Prefix | Meaning | Count / range | Owning document |
|---|---|---|---|
| `OBJ-01…11` | Core product objectives | 11 | `foundation/product-foundation.md §5` |
| `A-01…27` | Explicit assumptions | 27 | `foundation/product-foundation.md §9` |
| `Q-*` (`A1…F27`, `Q-D1…D6`) | Open clarification / discovery questions | ~30+ | `foundation/product-foundation.md §11`, `discovery/product-discovery.md` |
| `SPK-01…06` | Blocking research spikes (DLS licensing, event-log substrate, Android offline durability, cross-platform rules core, interchange format, MCC Laws permission) | 6 | `foundation/product-foundation.md`, referenced throughout |
| `FR-001…168` | Functional requirements | 168 | `specs/software-requirements-specification.md §4` |
| `DR-001…036` | Domain rules | 36 | `specs/software-requirements-specification.md §5` |
| `BR-001…034` | Business rules | 34 | `specs/software-requirements-specification.md §6` |
| `NFR-001…045` | Non-functional requirements | 45 | `specs/software-requirements-specification.md` |
| `SEC-001…018` | Security requirements (SRS-level; superset detailed by `SR-*` below) | 18 | `specs/software-requirements-specification.md` |
| `OFF-001…022` | Offline requirements | 22 | `specs/software-requirements-specification.md §9` |
| `SYNC-001…016` | Synchronization requirements | 16 | `specs/software-requirements-specification.md §10` |
| `AUD-001…015` | Audit requirements | 15 | `specs/software-requirements-specification.md §11` |
| `[LAW]` / `[PRD]` / `[CFG]` / `[EDGE]` | Cricket-rule classification tags, ~640 requirements across ~34 domain areas (e.g. `FMT-*` for match formats) | ~640 | `specs/cricket-rules-reference.md` |
| `MINV-01…18` | Domain model invariants | 18 | `domain/domain-model.md` |
| `MBR-01…12` | Domain model business rules | 12 | `domain/domain-model.md` |
| `EVT-*` | Domain events (~70) | ~70 | `domain/domain-model.md` |
| `CMD-*` | Domain commands (~55) | ~55 | `domain/domain-model.md` |
| `QRY-*` | Domain queries (~20) | ~20 | `domain/domain-model.md` |
| `SVC-*` | Domain services | 13 | `domain/domain-model.md` |
| `UX-01…28` | Screens/workflows | 28 | `ux/ux-specification.md` |
| `C01…C55` | Live-scoring conformance case catalogue | 55 | `specs/live-scoring.md §21` |
| `EX-01…13` | Live-scoring fully worked examples | 13 | `specs/live-scoring.md §22` |
| `INV-001…018` | Live-scoring reconciliation touchpoints | 18 | `specs/live-scoring.md §20` |
| `LSQ-1…5` | Live-scoring open items | 5 | `specs/live-scoring.md §24` |
| `OFQ-1…5` | Offline-first open items | 5 | `architecture/offline-first-specification.md §20` |
| `DSQ-1…5` | Data specification open items | 5 | `architecture/data-specification.md §13` |
| `APQ-1…5` | API specification open items | 5 | `architecture/api-specification.md §20` |
| `SQ-1…5` | Security specification open items | 5 | `architecture/security-specification.md §17` |
| `TQ-1…5` | Testing strategy open items | 5 | `architecture/testing-strategy.md §23` |
| `ACQ-1…4` | Acceptance criteria open items | 4 | `architecture/acceptance-criteria.md §12` |
| `RSQ-1…5` | Repository structure open items | 5 | `architecture/repository-structure.md §17` |
| `SR-A01…L05` | Security requirements, 12 clusters A–L | 76 | `architecture/security-specification.md §3–§14` |
| `R-S1…S8` | Security risk register | 8 | `architecture/security-specification.md §2` |
| `ADR-01…11` | Pattern architecture decisions | 11 | `architecture/system-architecture.md §8` |
| `ADR-T01…14` | Technology decisions | 14 | `architecture/technology-stack.md §4` |
| `TASK-####` | A unit of work through the AI development harness's eight-stage workflow | Open-ended, sequential, never reused | `ai-development-harness.md §4` |
| `RCR-####` | A Requirement Change Request — the only mechanism by which an approved requirement's text may change | Open-ended | `ai-development-harness.md §3 (T3), §11` |
| `REG-####` | A logged regression, with mandatory root-cause routing (implementation vs. spec vs. test defect) | Open-ended | `ai-development-harness.md §10` |
| `FB-####` | A collected post-release feedback item, feeding the continuous product-development loop's Observe/Collect Feedback stage | Open-ended | `ai-development-harness.md §13.2` |
| `HQ-1…8` | AI development harness open items | 8 | `ai-development-harness.md §16` |
| `ITQ-1…4` | Implementation task backlog open items | 4 | `implementation-task-backlog.md §8` — **disambiguation note:** originally numbered `HQ-6…7` in this document too, colliding with the harness's own `HQ-*` range; renamed, no other document referenced the old numbers |
| `DR-01…36` (testing) | Individual traceability rows, testing strategy | 36 | `architecture/testing-strategy.md §22` — **note:** this reuses the `DR-*` shape in a different document; disambiguate by document, not by prefix alone |

**Disambiguation note:** `DR-*` is used in two different documents for two different things (SRS Domain Rules vs. testing-strategy's individual trace rows) — always cite the owning document alongside the ID, never the bare ID.

**Full source:** every document listed in this table's right column; the consolidated cross-document trace is `master-specification.md §12` (vertical-slice traceability by `OBJ-*`).

---

## 15. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial draft. Synthesizes Project Constitution, Product Brief, Coding Rules, Naming Conventions, Git Rules, Documentation Rules, and Forbidden Assumptions as new content; condenses Architecture Rules, Security Rules, and Testing Rules from existing specifications; and indexes Domain Glossary, Master Specification, Decision Records, and Requirement IDs by pointer to their owning documents. |
| 0.1.0 | 2026-09-22 | §14 legend updated to register `TASK-*`, `RCR-*`, `REG-*`, and `HQ-*`, minted by the new companion document `docs/ai-development-harness.md` per this document's own §7 naming-convention rule (new traceable-item categories are registered, not left ad hoc). |
| 0.1.0 | 2026-09-23 | §14 legend updated to register `FB-*` (feedback items) and the `HQ-*` count bumped to 8, following `ai-development-harness.md §13`'s new continuous post-release product-development loop. |
| 0.1.0 | 2026-09-23 | §14 legend updated to register `ITQ-*`, and to fix a real ID collision this legend itself failed to catch: `implementation-task-backlog.md §8` had independently minted its own `HQ-6/7` before the harness's `HQ-6…8` existed, and neither got checked against the other when the harness's were registered. Renamed the backlog's to `ITQ-1…4`, per this document's own §7 naming-convention rule. Caught while implementing `TASK-0004`, not during original authoring — a live demonstration of why the rule (check the legend before minting) exists. |
