# Cricket Scoring Book — Repository Structure

| | |
|---|---|
| **Document** | Repository Structure Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/master-specification.md` v0.1.0 — **exclusively**. Every directory below is justified by a section of the Master Specification (cited inline); nothing here introduces a concern the Master Specification doesn't already establish. |
| **Downstream** | Actual repository scaffolding (not created by this document), `.github/workflows/` CI configuration, each app/package's own build tooling |
| **Status** | A **proposed repository layout with the responsibility of every directory explained**. **No implementation code, no scaffolding, no build files created.** This document does not run `mkdir`, does not write a `package.json`/`build.gradle.kts`/`config.toml`, and does not create a single source file — it is the design that such actions would follow. |

> Every directory below traces to a Master Specification section. Where the Master Specification's own summary is insufficient to fix a structural detail (e.g. exactly how the shared core's build output reaches the web app), this document follows the Master Specification's own §0 precedence rule and reads the cited constituent document for the missing precision — never inventing a concern neither source establishes.

---

## 1. Purpose and method

### 1.1 Derivation, not invention

Every top-level directory answers one question: **which Master Specification section's content has to live in code, and where does that code have to sit for the architecture (§5), data model (§6), API contract (§7), offline/sync protocol (§8), security boundaries (§9), and test strategy (§10) to hold true once implemented?** Nothing below is a generic "best practice" folder added for its own sake — §14 maps every Master Specification section to the exact directory that will eventually realise it, and that mapping is this document's real content.

### 1.2 The one honest constraint this layout is built around

The chosen stack (`master-specification.md §5.2`) is **polyglot by necessity**, not by accident: Kotlin Multiplatform (`ADR-T01`) for the shared core and Android, TypeScript for the web app and backend Edge Functions, SQL for the database. No single build tool spans all three natively. This document does not pretend otherwise — §15 states plainly where two separate build ecosystems meet and how they're coordinated, rather than forcing an artificial unified tool that doesn't fit the stack `master-specification.md §5.2` already committed to.

---

## 2. Top-level layout

```
/
├── docs/                    Documentation                    (§3  — unchanged, already exists)
├── specs/                   Specifications                   (§4  — new: machine-readable contracts)
├── shared/                  Shared domain/contracts           (§5  — the KMP scoring core; the most important directory)
├── apps/
│   ├── web/                 Web application                  (§6)
│   └── android/             Android application               (§7)
├── backend/                 Backend                            (§8)
├── database/                Database                           (§9)
├── tests/                   Tests (cross-cutting only)          (§10)
├── infrastructure/          Infrastructure                     (§11)
├── .github/
│   └── workflows/           CI/CD                               (§12)
├── scripts/                 Scripts                            (§13)
└── README.md                (already exists — the repo's own front door)
```

**What is deliberately absent from this list:** a generic `src/` at the repo root (every app/package owns its own `src/`, §10.1's co-location policy explains why), a `lib/`/`utils/` grab-bag (every shared concern has a named home — `shared/` for domain logic, `specs/` for contracts, `infrastructure/` for ops — a miscellaneous folder is exactly what this structure exists to avoid), and any directory for a Version 2/3 feature not yet in the MVP/Version 1 scope (`master-specification.md §1.4`/`§15.5`) — those get added when that work begins, not scaffolded speculatively now.

---

## 3. Documentation — `docs/`

**Traces to:** `master-specification.md §1–§4, §13–§15` (Product, Domain, Requirements, UX, ADRs, Glossary, Open Questions), and the document itself, §0/§16.

**Responsibility:** the narrative, human-authored Spec-Driven-Development record — *why* the product exists, *what* the domain truly is, *what* every requirement says, *what* every screen does, *why* every architectural and technology decision was made, and *what* remains open. This directory is **unchanged by this exercise** — it already exists in full, and every one of its 17 constituents plus `master-specification.md` (the 18th) remains exactly where it is:

```
docs/
├── master-specification.md         The source of truth — read first
├── foundation/product-foundation.md
├── discovery/product-discovery.md
├── domain/
│   ├── glossary.md
│   └── domain-model.md
├── specs/
│   ├── cricket-rules-reference.md
│   ├── software-requirements-specification.md
│   └── live-scoring.md
├── roadmap/product-roadmap.md
├── architecture/
│   ├── system-architecture.md
│   ├── technology-stack.md
│   ├── offline-first-specification.md
│   ├── data-specification.md
│   ├── api-specification.md
│   ├── security-specification.md
│   ├── testing-strategy.md
│   ├── acceptance-criteria.md
│   └── repository-structure.md     ← this document
├── ux/ux-specification.md
└── README.md
```

**Note on the existing `docs/specs/` versus the new repo-root `specs/` (§4):** `docs/specs/` holds **prose** specifications (the cricket-rules reference, the SRS, the ball-processing narrative) — documents a person reads. The new `specs/` at the repo root (§4) holds **machine-readable contracts** derived from that prose — files a build tool reads. The name collision is deliberate-looking but the responsibilities are entirely distinct, and §4 states the boundary precisely so it's never a point of confusion during implementation.

## 4. Specifications — `specs/`

**Traces to:** `master-specification.md §6.1` (the CQRS write/read split and its event schema), `§7.3` (contract-first: "the spec is the single source → typegen for both TS and Kotlin"), `§2.4`/`§10.2` (the `live-scoring.md` case catalogue as the seed of the conformance suite), `system-architecture.md §4.7/§4.8` (OpenAPI + JSON Schema, versioned, shared with clients and tests).

**Responsibility:** the **formal, versioned contract layer** — the machine-consumable artifacts that `shared/`, `apps/web/`, `apps/android/`, and `backend/` all generate code from or validate against, so the wire format, event shape, and API contract have exactly **one** authoritative representation instead of four independently-hand-written ones that could quietly drift apart. This is the direct implementation of the principle `api-specification.md §9.1` states in prose ("the spec is the single source") and `system-architecture.md §4.8` names as event-schema governance.

```
specs/
├── events/                          One JSON Schema file per EVT-*/CMD-* type (live-scoring.md §16.2–16.5)
│   ├── delivery-recorded/
│   │   ├── v1.schema.json
│   │   └── v2.schema.json           A later schema_version, additive-only (system-architecture.md §4.8)
│   ├── non-striker-run-out/
│   ├── striker-overridden/
│   └── …
├── openapi/                         The OpenAPI definition realising api-specification.md's full endpoint catalogue
│   ├── openapi.yaml
│   └── components/                  Shared request/response schemas, error shapes (RFC 7807), the resource models in data-specification.md field-table form, transcribed exactly
└── conformance/                     The live-scoring.md §21–22 corpus, as literal fixture files — C01…C55 + EX-01…EX-13
    ├── cases/
    │   ├── C01-dot-ball.json
    │   ├── C11-boundary-last-ball.json
    │   └── …
    └── worked-examples/
        ├── EX03-EX04-parity-pair.json
        └── …
```

**Who reads what:** `shared/`'s domain/conformance test suite (§5.4, `testing-strategy.md §4`) reads `specs/conformance/` directly — the fixture files there **are** the test vectors, not a copy of them. `apps/web/`, `apps/android/`, and `backend/` each generate typed clients/schemas from `specs/openapi/` and `specs/events/` as a build step (§13's codegen scripts) — no team hand-writes a second copy of a request/response type.

**Governance:** every file here is versioned and reviewed exactly like a `docs/` change; a breaking change to any schema is a major-version bump per `api-specification.md §9.2`'s compatibility policy, enforced in CI (§12).

## 5. Shared domain/contracts — `shared/`

**Traces to:** `master-specification.md §5.2` (`ADR-T01` — Kotlin Multiplatform), `§2.4` (`live-scoring.md`'s deterministic pipeline), `§5.1` (the shared scoring core is what makes cross-platform behaviour identical).

**Responsibility: the single most important directory in the repository.** This is where `live-scoring.md`'s entire deterministic ball-processing pipeline — validation, the `RunEvent` model, wicket resolution, batter/bowler/team/over state, the strike-rotation formula, innings/match-end evaluation, event generation — is implemented **once**, consumed by the Android app (as a JVM dependency), the web app (as a compiled JS/wasm package), and the backend (for server-side re-validation and projection, `system-architecture.md ADR-06`). If this directory is correct, cross-platform parity (`OBJ-06`) is a structural guarantee, not a hope.

```
shared/
├── src/
│   ├── commonMain/kotlin/           Platform-agnostic — no I/O, no clock, no RNG (live-scoring.md §1.1)
│   │   ├── pipeline/                 The 15-step processing pipeline, live-scoring.md §4–§17, one file/module per step
│   │   ├── model/                    DeliveryInput, RunEvent, WicketDetail, InningsState, OverState, BatterCardLine, BowlerCardLine (live-scoring.md §2–§3, §7.1, §9.2)
│   │   ├── services/                 The 13 SVC-* domain services (domain-model.md §12)
│   │   ├── config/                   The CFG-REG resolver and PlayingConditionsProfile (cricket-rules-reference.md §35)
│   │   ├── sync/                     Event-log semantics shared across platforms — ordering (ordinal→HLC→device-seq), idempotency keys (offline-first-specification.md §7, §9)
│   │   └── ports/                    ClockPort, IdPort, EventLogPort, ReferenceDataPort — interfaces only; no implementation (system-architecture.md §4.2)
│   ├── androidMain/kotlin/           Android-specific port adapters (SQLite/SQLDelight or PowerSync-backed EventLogPort, system clock)
│   ├── jsMain/kotlin/                Web-specific port adapters (IndexedDB or PowerSync-web-backed EventLogPort)
│   ├── jvmMain/kotlin/               Backend-specific port adapters (direct Postgres access for server-side re-validation/projection)
│   └── commonTest/kotlin/            The domain/conformance suite (testing-strategy.md §4) — reads specs/conformance/, runs identically against every target
└── build config                     KMP Gradle setup; a Kotlin/JS npm-publishable output consumed by apps/web (§15)
```

**The ports/adapters boundary, explained:** `commonMain` is pure — it has no idea whether it's running on Android, in a browser, or on the server. Every place it needs to know the time, generate an id, read/write the event log, or read reference data, it calls a `Port` interface (`system-architecture.md §4.2`). Each platform (`androidMain`/`jsMain`/`jvmMain`) supplies the concrete adapter. This is *why* the same pipeline code runs identically everywhere — it is deliberately incapable of doing anything platform-specific.

**What is never duplicated here versus `apps/`/`backend/`:** UI code, HTTP routing, and database connection management stay entirely out of `shared/` — this directory's only job is the domain logic `live-scoring.md` specifies, nothing else.

---

## 6. Web application — `apps/web/`

**Traces to:** `master-specification.md §4` (the UX Specification's 28 screens and 7 workflows), `§5.2` (`ADR-T02` — React + TypeScript + Vite, installable PWA), `§8` (offline behaviour every screen must exhibit).

**Responsibility:** the Web PWA — every one of `ux-specification.md`'s 28 screens, rendering from the `shared/` core's projection, running fully offline after first load, installable, keyboard-first.

```
apps/web/
├── src/
│   ├── screens/                      One directory per UX-## screen (ux-specification.md §4) — e.g. screens/UX-10-live-scoring/
│   │   └── UX-##-name/
│   │       ├── Screen.tsx
│   │       ├── Screen.test.tsx        Co-located unit/component test (§10.1)
│   │       └── state.ts               View-model / hooks — reads the shared/ projection, dispatches CMD-* to it
│   ├── components/                   Shared UI primitives used by more than one screen (Radix + Tailwind, ADR-T02) — the run-entry pad, the guardrail-override modal pattern, the connectivity indicator (ux-specification.md §11)
│   ├── core-bridge/                  The thin adapter that loads shared/'s compiled JS/wasm package and exposes it to the UI layer
│   ├── persistence/                  The IndexedDB-backed EventLogPort/ReferenceDataPort adapters shared/jsMain declares as interfaces (offline-first-specification.md §3.6)
│   ├── service-worker/               Workbox config — app-shell precache, versioned reference-data cache (system-architecture.md §3.2)
│   └── i18n/                         Externalised strings (NFR-057)
├── public/                           Static assets, manifest.json (PWA install-ability)
└── build config                      Vite; depends on the shared/ npm-published package and specs/openapi-generated client
```

**Why screens are directories, not a flat file list:** each screen's spec (`ux-specification.md`) already defines nine distinct concerns (Purpose/Inputs/Actions/Validation/States/Error handling/Empty states/Offline behavior/Accessibility) — one file per screen would force all nine into one place; a directory lets the component, its state logic, and its test suite (§10.1's "one suite per screen" rule) sit together without sprawling.

## 7. Android application — `apps/android/`

**Traces to:** `master-specification.md §4` (the same 28 screens, Android ergonomics), `§5.2` (`ADR-T03` — Native Kotlin + Jetpack Compose, MVI).

**Responsibility:** the Android app — the same 28 screens' worth of behaviour, one-handed/thumb-zone-first, consuming `shared/` as a native JVM dependency (not a bridged/compiled artifact, unlike the web app — this is the direct benefit of `ADR-T01`'s Kotlin choice).

```
apps/android/
├── src/main/kotlin/
│   ├── ui/
│   │   └── screens/                  One package per UX-## screen, mirroring apps/web/src/screens/ 1:1 by id
│   │       └── ux##name/
│   │           ├── Screen.kt          Compose UI
│   │           ├── ViewModel.kt        MVI reducer — dispatches CMD-* to shared/
│   │           └── ScreenTest.kt       Co-located Compose UI test (§10.1)
│   ├── persistence/                   The SQLite (SQLDelight, or PowerSync SDK per ADR-T06/T09) EventLogPort adapter for shared/androidMain
│   ├── sync/                          WorkManager-scheduled background sync jobs (offline-first-specification.md §12)
│   └── di/                            Koin wiring (ADR-T03's DI choice)
├── src/androidTest/kotlin/            Instrumented tests — device-lab chaos/perf/TalkBack runs (§10.2)
└── build config                       Gradle module, part of the same multi-project build as shared/ (§15)
```

**Why `apps/android/`'s screens mirror `apps/web/`'s 1:1 by `UX-##` id:** neither app owns the behaviour — `ux-specification.md` does. Keeping the same identifier and directory shape on both platforms makes a screen-level regression (or a missing platform-specific test) immediately visible by comparing the two trees, rather than requiring cross-referencing two differently-organised codebases.

---

## 8. Backend — `backend/`

**Traces to:** `master-specification.md §7.1` (match-lifecycle command endpoints and sync endpoints), `§7.2` (the deliberate asymmetry — most requirements are satisfied by the generic sync push, not a bespoke endpoint), `§9.2` (the security requirements every backend code path must enforce).

**Responsibility: the actual application logic behind every command/RPC endpoint in `api-specification.md §11–§13`** — sign-off materialisation, dispute adjudication, player merge, guest-match claim, invitations, sync-ingest re-validation, the outbox dispatcher, export generation, webhook delivery. This is **not** the same thing as the Supabase Edge Function hosting slot (`database/supabase/functions/`, §9) — see §9.3 for exactly why the two are split, and how they connect.

```
backend/
├── src/
│   ├── commands/                     One module per command-endpoint family (api-specification.md §11): sign-off, dispute, deactivate-member, invitations, player-merge, guest-claim, appearance-claims
│   ├── sync/                         Event-ingest re-validation (schema, SVC-AUTHORIZER checks, device_seq/hash-chain continuity) — the server-side half of offline-first-specification.md §7.1
│   ├── authz/                        SVC-AUTHORIZER's server-side implementation — command-level and state-machine checks, called before RLS is ever reached (security-specification.md §4.1)
│   ├── projection/                   Server-side folding of match_events into match_snapshots/live_state, using shared/'s jvmMain build — the same pipeline, run server-side (master-specification.md §5.1)
│   ├── exports/                      SVC-EXPORT-TRANSLATOR — PDF/CSV/Cricsheet generation (api-specification.md §15)
│   ├── outbox/                       The transactional-outbox dispatcher — delivers integration events to downstream consumers (ADR-09)
│   └── webhooks/                     V2 outbound webhook delivery with HMAC signing and retry (api-specification.md §13.4)
└── tests/                            Backend integration tests — real test-Postgres, not mocked (testing-strategy.md §5)
```

**How this code reaches production:** each command/sync module here is imported by a *thin* entrypoint file in `database/supabase/functions/` (§9) — the entrypoint's only job is to parse the incoming request and call into `backend/src/`; all real logic, and all of backend's own test coverage, lives here, not in the entrypoint.

## 9. Database — `database/`

**Traces to:** `master-specification.md §6` (the 28-table schema, the CQRS write/read split, the two sync models, the soft-deletion policy), `§9.2` (the RLS policy matrix as a security control).

**Responsibility: the schema itself, and the platform-mandated project structure the chosen database tooling requires.**

```
database/
└── supabase/                         The Supabase CLI project root — this exact top-level name and location is required by the CLI tooling (ADR-T04/T05); everything the CLI needs lives under it
    ├── config.toml
    ├── migrations/                    Versioned SQL — realises data-specification.md's 28 tables, one migration per schema change, forward-only (technology-stack.md ADR-T11)
    │   ├── ..._create_match_events.sql          Append-only, hash-chained, partitioned, INSERT-only grants (data-specification.md §6.1)
    │   ├── ..._create_rls_policies.sql           Tenant isolation on every table (security-specification.md SR-B01)
    │   └── …                                     One file per table family in data-specification.md §3–§10
    ├── seed/                          Local-dev and CI seed/fixture data — synthetic only, never real personal data (testing-strategy.md §20)
    ├── functions/                     Thin Edge Function entrypoints ONLY — each imports and delegates to backend/src/ (§8)
    │   ├── sync-events/index.ts        → backend/src/sync
    │   ├── signoff/index.ts            → backend/src/commands
    │   └── …                          One directory per api-specification.md §11–§13 endpoint family
    └── tests/                         pgTAP suite — the RLS policy matrix, constraint tests, append-only grant enforcement (testing-strategy.md §7)
```

### 9.3 Why Database and Backend are split, and how they connect

Two genuinely distinct responsibilities that happen to share one platform-mandated hosting location: **Database** is *what the data must always be true to* (schema, constraints, RLS, migrations) — a concern that exists independent of any particular business-logic language or framework. **Backend** is *what happens when a command arrives* (the actual TypeScript logic implementing `api-specification.md`'s commands). They connect at exactly one seam: `database/supabase/functions/*/index.ts` are **thin, mechanical entrypoints** that the Supabase CLI requires to physically exist at that path, and each one's entire body is "parse the request, call the matching module in `backend/src/`, return its result." This keeps the *logic* testable and organised by responsibility (§8) while still satisfying the *platform's* required physical layout (§9) — neither concern is compromised to accommodate the other.

---

## 10. Tests — `tests/`

**Traces to:** `master-specification.md §10` (the 16-category test strategy) and `§11` (the 147 acceptance criteria those categories verify against).

### 10.1 The co-location policy, stated once

**Unit, Domain/Conformance, Integration, UI, Android, and Web tests are co-located with the code they test** — inside `shared/src/commonTest/`, `apps/web/src/**/*.test.tsx`, `apps/android/src/androidTest/`, `backend/tests/`, `database/supabase/tests/` (§5–§9 above). This is deliberate: a test that only makes sense next to one package should live there, where it's impossible to forget to update when that package changes, and where its own build tool runs it without needing to know about a separate top-level test project.

**This top-level `tests/` directory holds only what doesn't belong to exactly one package** — suites that exercise *multiple* apps/packages together, or need orchestration no single package's build tool provides:

```
tests/
├── e2e/                              End-to-end suites, one per docs/ux/ux-specification.md §5 workflow (W-1…W-7) and offline-first-specification.md §18 scenario — Playwright (web) + instrumented Espresso/Compose (Android), same scenario definition, per-platform implementation (testing-strategy.md §14)
├── offline-chaos/                    The device-lab chaos harness — force-kill/battery-pull/OS-eviction/airplane-toggle orchestration across ≥ 50 simulated innings (testing-strategy.md §8.1)
├── sync-convergence/                 The multi-device event-ordering-sweep harness, spanning backend + multiple simulated client instances (testing-strategy.md §9.1)
├── performance/                      k6 load-test scripts — concurrent matches + viewer fan-out (testing-strategy.md §16)
└── security/                         The pgTAP-independent security suite — auth×authz matrix generator, secret-scan config, penetration-test scope notes (testing-strategy.md §15; security-specification.md §15)
```

### 10.2 Where the acceptance criteria live

`acceptance-criteria.md`'s 147 Given/When/Then entries are not a separate test-code directory — they are the **specification** each co-located and cross-cutting suite above is written *against*. The 54 cricket-edge criteria specifically map onto `shared/src/commonTest/` cases sourced from `specs/conformance/` (§4–§5); the Offline/Sync/Recovery/Security criteria map onto `tests/offline-chaos/`, `tests/sync-convergence/`, and `tests/security/` respectively.

## 11. Infrastructure — `infrastructure/`

**Traces to:** `master-specification.md §5.2` (the hosting choices — `ADR-T10` Supabase Cloud/Cloudflare Pages/Google Play/PowerSync Cloud, `ADR-T13` monitoring stack), `system-architecture.md §3.17` (scaling), `§3.14` (backup/recovery).

**Responsibility:** everything about *where the system runs* and *how its health is observed* — as configuration and infrastructure-as-code, never as secrets (a secret's *reference* lives here; its *value* never does).

```
infrastructure/
├── environments/                     dev / staging / prod environment definitions (system-architecture.md §3.4)
│   ├── dev.env.example
│   ├── staging.env.example
│   └── prod.env.example
├── supabase-projects/                Project-linking config per environment — no keys, only project refs (technology-stack.md ADR-T10)
├── cloudflare/                       Pages project config, DNS/WAF rules (ADR-T10, security-specification.md SR-H01)
├── observability/                    Dashboards-as-code (Grafana), alert rules, Sentry project config (ADR-T13, security-specification.md §15's verification table)
└── backup/                           Backup-verification job schedule/config, restore-drill runbook reference (data-specification.md §13, security-specification.md §13)
```

---

## 12. CI/CD — `.github/workflows/`

**Traces to:** `master-specification.md §5.2` (`ADR-T11` — GitHub Actions) and `§10.4` (the consolidated gate list — every "must pass" gate named across every constituent document).

**Responsibility:** the pipeline that enforces every gate `testing-strategy.md §21` names, mechanically, so passing review is never a matter of remembering to run the right command by hand.

```
.github/workflows/
├── pr.yml                            Every PR: unit+domain 100%, parity corpus, RLS matrix, API contracts, changed-screen UI suites, secret scan, chaos+convergence subsets (testing-strategy.md §21 "Every PR" row)
├── main.yml                          On merge to main: full offline-chaos suite, full sync-convergence sweep, migration dry-run against a prod-like snapshot
├── pre-pilot.yml                     Manually triggered: conformance 100%, accredited-scorer review checklist, WCAG 2.2 AA audit, DLS benchmark (or documented fallback), initial penetration test
├── pre-ga.yml                        Manually triggered: parity ≥ 95%, load test, full penetration test, incident-response tabletop record
└── release.yml                       Android → Play track publish; web → Cloudflare Pages production; database → Supabase CLI migration apply; SBOM + build provenance
```

**Ordering and blocking:** `pr.yml` is the only workflow that blocks a merge; the rest are release-stage gates, matching `docs/roadmap/product-roadmap.md`'s Alpha/Closed-pilot/Open-beta/GA stage boundaries exactly — a workflow file exists for each stage's entry criteria, not as a generic catch-all pipeline.

## 13. Scripts — `scripts/`

**Traces to:** `master-specification.md §7.3`'s contract-first codegen requirement, `§5.2`'s two-ecosystem build reality (§15), and the local-dev needs every other directory above implies.

**Responsibility:** the small set of utility scripts a developer or CI job runs by name, rather than remembering a multi-step manual procedure.

```
scripts/
├── bootstrap.sh                      Local environment setup — installs both the Node/pnpm toolchain and the JVM/Gradle toolchain, links a local Supabase project
├── codegen/
│   ├── openapi-to-ts.sh               specs/openapi/ → typed TS clients (apps/web/, backend/)
│   ├── openapi-to-kotlin.sh           specs/openapi/ → typed Kotlin clients (apps/android/, shared/jvmMain)
│   └── schema-to-types.sh             specs/events/ → typed event payloads on every platform
├── build-core-web.sh                 Builds shared/'s Kotlin/JS target and publishes it as the npm package apps/web/ depends on (§15)
├── db/
│   ├── reset.sh                       Drop and recreate the local database/supabase/ instance from migrations + seed
│   └── new-migration.sh               Scaffolds a new, correctly-timestamped migration file
├── conformance-runner.sh             Runs shared/'s domain/conformance suite against specs/conformance/ and prints the parity-matrix summary
└── release/
    ├── changelog.sh                   Generates a release changelog from conventional commits, mapped to the requirement IDs they close
    └── version-bump.sh
```

## 14. Master Specification section → repository location

**The complete cross-reference — every section of `master-specification.md`, mapped to exactly where its content is realised in code.**

| Master spec section | Repository location |
|---|---|
| §1 Product Specification | `docs/foundation/`, `docs/discovery/` (unchanged; no code artefact) |
| §2 Domain Specification | `shared/src/commonMain/` (the pipeline itself); `specs/conformance/` (its test corpus) |
| §3 Requirements Specification | Realised across every directory below; traced via each requirement's own id, never a single folder |
| §4 UX Specification | `apps/web/src/screens/`, `apps/android/src/main/kotlin/ui/screens/` |
| §5 Architecture Specification | The top-level layout itself (§2 of this document) *is* §5's realisation |
| §6 Data Specification | `database/supabase/migrations/` |
| §7 API Specification | `specs/openapi/` (the contract), `backend/src/commands/` + `database/supabase/functions/` (the implementation) |
| §8 Offline/Sync Specification | `shared/src/commonMain/sync/` + platform port adapters, `backend/src/sync/`, `database/supabase/functions/sync-events/` |
| §9 Security Specification | `database/supabase/migrations/..._create_rls_policies.sql`, `backend/src/authz/`, `infrastructure/observability/` (audit-chain alerting) |
| §10 Testing Specification | `tests/` (cross-cutting) + every package's co-located test directory (§10.1) |
| §11 Acceptance Criteria | The fixture/assertion content **inside** every test file above — not a separate directory (§10.2) |
| §12 Traceability Matrix | No dedicated directory — it is the *reading aid* connecting every row above; enforced by requirement-id references in code comments and commit messages, not a folder |
| §13 ADRs | `docs/architecture/system-architecture.md §8`, `docs/architecture/technology-stack.md §4` (unchanged; this document's own §1–§13 are downstream *consequences* of those ADRs, not a restatement of them) |
| §14 Glossary | Naming convention enforced throughout every directory above (screen ids, event names, table names all use the glossary's exact terms) — no code directory, a naming discipline |
| §15 Open Questions | Tracked in `docs/master-specification.md §15` itself; a resolved question updates the relevant source document and, where it changes scope, this document's own directories (§17) |

## 15. Build tooling and workspace policy

### 15.1 Two ecosystems, honestly coordinated, not forced into one

**Kotlin/Gradle ecosystem:** `shared/` and `apps/android/` are modules of one Gradle multi-project build (a single `settings.gradle.kts` at the repo root including both) — this is standard, idiomatic Kotlin Multiplatform practice and needs no bridging.

**Node/TypeScript ecosystem:** `apps/web/` and `backend/` are packages in one workspace (pnpm or npm workspaces) — they share TypeScript tooling, lint config, and the codegen output from `specs/` (§13).

**The seam between them:** `shared/`'s Kotlin/JS build target is published as an npm package (`scripts/build-core-web.sh`, run in CI before the web build step) and consumed by `apps/web/` as an ordinary npm dependency. This is the one place the two ecosystems touch, and it is a **one-directional, build-time** dependency (JS consumes a Kotlin build artefact) — never the reverse, and never a live cross-ecosystem process at runtime.

### 15.2 What this means for a new contributor

Two toolchains must be installed (JVM+Gradle, Node+pnpm), and `scripts/bootstrap.sh` (§13) sets up both — this is stated as a real cost of the chosen stack (`ADR-T01`'s KMP core is what necessitates it), not hidden behind a false claim of "one command builds everything."

---

## 16. What this document deliberately does not do

No directory above has been created. No `package.json`, `build.gradle.kts`, `config.toml`, `settings.gradle.kts`, or workflow YAML has been written. No dependency has been chosen at a version-pin level (that's a build-setup decision, not a structural one). No source file — not even a placeholder — exists yet. This document is the **plan** those actions would follow once implementation is authorised to begin (`docs/roadmap/product-roadmap.md`'s MVP gate), consistent with every document this project has produced so far and with this task's explicit instruction.

## 17. Open items

| # | Item | Current default | Resolution path |
|---|---|---|---|
| RSQ-1 | Exact pnpm-workspace vs. npm-workspace choice for the Node ecosystem (§15.1) | Not decided — either satisfies the structure | Web + backend leads, before scaffolding begins |
| RSQ-2 | Whether `apps/web/`'s screen-level tests live inside each `screens/UX-##-name/` directory (as drawn in §6) or in a parallel `apps/web/tests/` mirroring the same ids | Co-located, per §10.1's general policy | Confirm against the chosen test runner's conventions during scaffolding |
| RSQ-3 | Whether `specs/openapi/` is hand-authored first and code generated from it, or generated *from* `backend/`'s route definitions and treated as documentation output | Hand-authored first — contract-first per `ADR-T07` | Already decided by `ADR-T07`; restated here only because it constrains scaffolding order (specs/ before backend/) |
| RSQ-4 | Where Version 2 additions (competitions/fixtures CRUD beyond the generic pattern, dual-scorer-specific UI) land once that work begins | Not scaffolded now (§2's stated policy) | Extend this document when Version 2 build starts, per `docs/roadmap/product-roadmap.md` |
| RSQ-5 | Monorepo tooling for cross-ecosystem task orchestration (e.g. Turborepo/Nx) vs. plain scripts + CI-stage sequencing | Plain scripts (§13) + CI staging, no additional tool assumed | Revisit only if build-time coordination pain is observed in practice |

## 18. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial repository structure specification, derived exclusively from `docs/master-specification.md`. §1–§2 purpose, method, and the top-level layout. §3–§13 define the responsibility of every requested directory: Documentation (`docs/`, unchanged), Specifications (`specs/` — new: the machine-readable contract layer distinct from `docs/`'s prose specs), Shared domain/contracts (`shared/` — the KMP scoring core, given the most detailed treatment as the repository's central directory, with the ports/adapters boundary explained), Web application (`apps/web/`), Android application (`apps/android/`, mirroring web's screen structure 1:1 by `UX-##` id), Backend (`backend/`) and Database (`database/`) with an explicit rationale for why they're split and how they connect through a thin-entrypoint seam, Tests (`tests/` — cross-cutting only, with the co-location policy stated as the general rule), Infrastructure (`infrastructure/`), CI/CD (`.github/workflows/`, one file per roadmap release stage), and Scripts (`scripts/`). §14 a complete master-specification-section-to-repository-location cross-reference table. §15 an honest two-ecosystem build-tooling policy (Gradle for Kotlin, workspace-based for TypeScript, one build-time seam between them). §16 an explicit statement of what was not done (no scaffolding, no code, no config files). §17 five open items. No implementation code, no scaffolding, no directories created. |
