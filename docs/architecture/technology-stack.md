# Cricket Scoring Book — Technology Stack Recommendation

| | |
|---|---|
| **Document** | Technology Stack Recommendation & Decision Records |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-03 |
| **Upstream** | `docs/architecture/system-architecture.md` v0.1.0 · `docs/specs/software-requirements-specification.md` v0.1.0 · `docs/foundation/product-foundation.md` v0.1.0 · `docs/roadmap/product-roadmap.md` v0.1.0 |
| **Downstream** | `docs/architecture/adr/` (full ADRs) · implementation backlog · CI/CD setup |
| **Status** | Evaluation and decisions only. **No code. No project scaffolding. Nothing is installed or initialised by this document.** |

> Recommends a concrete technology stack for the Web PWA + Android app + managed backend, evaluates credible alternatives for each of 13 categories against 8 weighted criteria, and records an Architecture Decision Record (**ADR-T01…ADR-T14**) for every major choice. It refines — and stays consistent with — `system-architecture.md §4.1` and its pattern ADRs (ADR-01…11).

---

## 1. How to read this document

### 1.1 Evaluation method

Each category (§3) lists **credible options**, scores them **1–5** against the eight criteria below, gives a weighted view for close calls, then states a recommendation with a full ADR in §4.

**Scoring:** 5 = clear strength · 4 = good · 3 = adequate · 2 = weak · 1 = disqualifying for this project. Scores are *relative to this project's needs*, not absolute product quality.

### 1.2 The eight criteria and their weights

Weights (1–5) are derived from the foundation objectives, SRS non-functional requirements, and the team constraint (`A-14`: small team, AI-assisted SDD, phased scope).

| Criterion | Weight | Why this weight | Anchored in |
|---|---:|---|---|
| **Reliability** | 5 | It is an *official record*. Zero ball-events lost is a release gate; a wrong scorecard destroys trust. | `OBJ-07`, `NFR-009…011`, `SPK-03` |
| **Offline capability** | 5 | Offline-first is a hard requirement, not a feature — the entire write path must work with no network. | `OBJ-02`, `NFR-012`, `OFF-001…022` |
| **Maintainability** | 4 | A small team must own this for years; one shared core, few moving parts, standard idioms. | `A-14`, `C-11`, `NFR-034/053` |
| **Developer productivity** | 4 | Phased delivery with a small team; time-to-pilot matters. | `A-14`, roadmap MVP gate |
| **AI-assisted development** | 4 | The methodology is explicitly AI-assisted SDD; stack choices that maximise LLM output quality compound. | `A-14` |
| **Performance** | 3 | Budgets are real (`≤100 ms` input ack, `≤3 s` cold start, `≤30 s` T20 sync) but modest; not a hyperscale workload. | `NFR-001…007` |
| **Long-term scalability** | 3 | Multi-tenant SaaS eventually, but pilot is tiny (5 clubs) and growth is gradual; must not *foreclose* scale. | `OBJ-10`, `NFR-016…018` |
| **Cost** | 3 | Bootstrapped; every recommended tier is free/cheap at pilot. Matters, but never outweighs correctness or reliability. | `A-14`, `R1 §11` A4 |

**Consequence of the weighting:** where a choice trades cost or raw performance for reliability, offline correctness, or maintainability, this document takes that trade.

### 1.3 Relationship to the architecture document

`system-architecture.md` defines *what* the components are and *how they interact* (event sourcing, local-first, RLS as the boundary, deterministic sync). This document chooses the *technologies that realise them* and records the decisions. Where the two ever diverge, the architecture document's **patterns** win and this document's **product choices** are the reversible part (see §5.2 exit paths).

### 1.4 What "AI-assisted development" means as a scoring axis

LLM output quality tracks **training-data volume** and **API stability**. Concretely this rewards: TypeScript everywhere; React and its mainstream libraries; Kotlin + Jetpack Compose; PostgreSQL/SQL over proprietary query languages; REST + OpenAPI over bespoke protocols; GitHub Actions; Playwright; well-documented platforms (Supabase). It penalises: young or fast-churning APIs, niche languages, proprietary DSLs, and tools with thin public corpora — those are accepted only where another criterion forces the choice, and always with a mitigation (spike, vendor docs, contract tests).

---

## 2. Summary recommendation

| # | Category | Recommendation | One-line rationale | ADR |
|---|---|---|---|---|
| 1 | **Shared scoring core** *(cross-cutting)* | **Kotlin Multiplatform** library (JVM + JS/wasm targets) | One deterministic engine for both platforms; parity gated by a contract corpus. | ADR-T01 |
| 2 | **Web frontend** | **React + TypeScript + Vite**, SPA/PWA (no SSR meta-framework), Radix + Tailwind (shadcn pattern), Zustand + TanStack Query, Workbox | Deepest ecosystem + best AI-assisted output + strongest a11y primitives; SSR would fight offline-first. | ADR-T02 |
| 3 | **Android** | **Native Kotlin + Jetpack Compose**, single-activity, MVI, Koin DI, WorkManager | Best perf/tooling/durability on target hardware; Kotlin aligns with the shared core. | ADR-T03 |
| 4 | **Backend platform** | **Supabase** (managed Postgres + GoTrue Auth + PostgREST + Realtime + Edge Functions/Deno + Storage) | Postgres + RLS is the authorization boundary; bundled services; OSS + self-hostable exit. | ADR-T04 |
| 5 | **Database** | **Supabase-managed PostgreSQL** — RLS everywhere, `match_events` partitioned, `pg_cron`, PITR | Relational system-of-record fits reconciliation/standings/audit; SQL has the largest corpus. | ADR-T05 |
| 6 | **Local database** | **SQLite on both platforms** — provided by the PowerSync SDK (native SQLite on Android, wa-sqlite/OPFS on web); **SQLDelight** if sync goes custom | One SQL dialect client-side; durable; matches the shared-core data layer. | ADR-T06 |
| 7 | **API** | **REST/RPC over HTTP + JSON, contract-first** — OpenAPI + JSON Schema shared with clients and tests; PostgREST for RLS reads; Edge Functions for commands | JSON/OpenAPI has the largest corpus and typegen for both TS and Kotlin; tRPC excludes Kotlin, GraphQL adds needless weight. | ADR-T07 |
| 8 | **Authentication** | **Supabase Auth (GoTrue)** — email/password + magic link + OAuth, TOTP MFA for admin; additive RBAC modelled in app tables with `SECURITY DEFINER` helpers | Native JWT↔RLS integration is the deciding feature; bundled; self-hostable. | ADR-T08 |
| 9 | **Synchronization** | **PowerSync** as the sync substrate (local store + resumable delta transport + upload queue) **with event-log semantics — ordering (ordinal→HLC→seq), reconciliation, divergence — in the shared core**; **custom HTTPS event-log sync documented as the fallback** | De-risks the two scariest spikes (`SPK-02` substrate, `SPK-03` mobile durability) for a small team; append-only is PowerSync's easy path; reversible because the domain model is per-device event streams. | ADR-T09 |
| 10 | **Hosting** | **Supabase Cloud** (backend) + **Cloudflare Pages** (web PWA) + **Google Play** (Android) + **PowerSync Cloud** (sync) — every piece has a documented self-host / exit path | Managed-first for a small team; static PWA needs no render platform; one primary region initially. | ADR-T10 |
| 11 | **CI/CD** | **GitHub Actions** — PR gates: lint → unit → conformance (100%) → parity corpus → build → preview env → e2e + chaos subset + convergence; release: Play track publish + Cloudflare Pages + Supabase CLI migrations | Ubiquitous, best-documented, integrates with every tool in this stack; OIDC for keyless deploys. | ADR-T11 |
| 12 | **Testing** | **Layered**: bespoke *conformance / parity / offline-chaos / sync-convergence / DLS-benchmark* harnesses + **Kotest/JUnit5 + property tests** (core) · **Vitest + RTL + Playwright + axe** (web) · **JUnit5 + Turbine + Compose test + Firebase Test Lab** (Android) · **pgTAP** (RLS) · **k6** (load) | The project-specific harnesses are the real quality gates; the rest are mainstream, well-documented tools. | ADR-T12 |
| 13 | **Monitoring** | **Sentry** (errors + client perf, all three runtimes) + **Grafana Cloud** (OTel metrics/traces/logs, dashboards, alerts) + **Checkly** (Playwright synthetics incl. the "offline T20 then sync" canary) + **PostHog** (privacy-respecting, opt-outable product telemetry + feature flags; EU/self-host) | Vendor-neutral OTel path; real free tiers; covers errors, SLOs, synthetics and the feedback loop without one expensive single vendor. | ADR-T13 |
| 14 | **Documentation** | **Markdown-in-repo as the source of truth** + **Astro Starlight** (rendered site) + **OpenAPI/JSON Schema → Scalar** (API) + **MADR ADRs** in `docs/architecture/adr/` + **Mermaid** diagrams + **Dokka/TypeDoc** (code reference), all built by CI | Keeps the existing `docs/` practice; contract-first API docs; everything version-controlled and AI-friendly. | ADR-T14 |

**Language/type spine:** **TypeScript** (web + Edge Functions + tooling) and **Kotlin** (Android + shared core), with **JSON Schema** as the neutral contract between them. Two languages, one shared core, one contract registry.

**Indicative cost** (order-of-magnitude, §5.1): pilot **≈ $0–75/mo** (+ $25 one-time Play) · public beta **≈ $150–500/mo** · GA **≈ $1,000–4,000/mo** scaling with tenants; self-hosting Supabase + PowerSync becomes cost-effective above a threshold reached well after GA.

---

## 3. Category evaluations

Comparison tables score 1–5 per criterion (see §1.2). **R**=Reliability, **Off**=Offline, **Mnt**=Maintainability, **Prf**=Performance, **DX**=Developer productivity, **AI**=AI-assisted dev, **Scl**=Long-term scalability, **$**=Cost. A **weighted total** (using §1.2 weights) is shown for the close calls.

### 3.0 Cross-cutting: the shared scoring core

The core is not one of the 13 categories but it constrains several, so it is settled first.

**Need:** one deterministic rules engine (state machines, `CFG-REG` resolver, 13 `SVC-*`, `EVT-*` folds, `INV-*`/`MINV-*` checks, `RainMethod`, Cricsheet translator) that produces **identical results on Web and Android** for identical inputs (`NFR-047/048`, `SPK-04`).

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **Kotlin Multiplatform** (JVM + JS/wasm) | 5 | 5 | 4 | 4 | 4 | 3 | 4 | 5 | One Kotlin source → native on Android, JS/wasm on web. Mature enough (stable since 2023). Web consumes a generated JS bundle. |
| **Rust core** (wasm on web, UniFFI on Android) | 5 | 5 | 3 | 5 | 2 | 2 | 4 | 5 | Maximal determinism and speed. Rarer skills, slower iteration, thinner LLM corpus for the FFI glue. |
| **TypeScript core** (native on web; JS engine embedded on Android) | 4 | 4 | 3 | 2 | 4 | 5 | 3 | 4 | Shares with web perfectly; but running JS on Android (e.g. via a JS runtime) risks the `≤100 ms` budget on low-end devices (`risk 10`). |
| **Spec + two implementations** (TS + Kotlin), contract-tested only | 3 | 5 | 1 | 4 | 3 | 4 | 3 | 5 | Two engines to keep in lockstep forever. Unmaintainable at team size; drift is `risk 7`. |

**Recommendation → Kotlin Multiplatform** (**ADR-T01**). It is the only option that gives *one* source, *native* performance on the constrained platform (Android), and an acceptable web story, without a niche language. The contract corpus (§3.12) still gates parity regardless of the choice, so this is reversible toward Rust if wasm perf ever demands it.

### 3.1 Web frontend

**Need:** an installable **PWA** that scores fully offline, keyboard-first scorebox, multi-pane large-screen layout, **WCAG 2.2 AA** on core flows (`NFR-019`), print output, offline charts, no SSR requirement (the app is not content/SEO-driven; public pages can be a separate tiny surface later).

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **React + TypeScript + Vite (SPA/PWA)** | 4 | 5 | 4 | 4 | 5 | 5 | 4 | 5 | Largest ecosystem for PWA/a11y/offline; best LLM output; Vite is fast and simple. No SSR to fight offline-first. |
| **SvelteKit** | 4 | 4 | 4 | 5 | 4 | 3 | 4 | 5 | Smaller bundles, less boilerplate, great perf. Smaller a11y-primitive ecosystem; thinner LLM corpus; SvelteKit leans SSR. |
| **SolidJS + Vite** | 4 | 4 | 3 | 5 | 3 | 2 | 3 | 5 | Excellent runtime perf. Small ecosystem/community; weak LLM support; hiring risk. |
| **Angular** | 4 | 4 | 4 | 3 | 3 | 4 | 5 | 5 | Batteries-included, strong for large teams. Heavier, slower iteration for a small team; more ceremony. |
| **Next.js (React + SSR)** | 3 | 3 | 3 | 4 | 5 | 5 | 4 | 4 | Great DX, but SSR/RSC complexity is pure cost for an offline-first SPA; service-worker + RSC interplay is a known friction. |

**Supporting choices:** **Radix primitives + Tailwind** (the shadcn/ui copy-in pattern) — the strongest accessible-primitive foundation and extremely LLM-friendly; **Zustand** for UI state + **TanStack Query** for server-cache reads (domain state comes from the core projection); **Workbox** via `vite-plugin-pwa`; **visx** or **Recharts** for offline, styleable, reasonably accessible charts (final styling per the `dataviz` guidance); **Playwright** for e2e including offline/service-worker simulation.

**Recommendation → React + TypeScript + Vite SPA/PWA, Radix + Tailwind, no SSR meta-framework** (**ADR-T02**). SvelteKit is the only serious challenger and loses on ecosystem depth, a11y primitives and AI-assisted output — the three things that most help a small team hit a hard accessibility gate on schedule.

### 3.2 Android

**Need:** offline-first app for Android 10+ on **mid-range hardware**, one-handed portrait scorebox, `≤100 ms` input ack, durable local writes surviving crash/kill/battery-pull (`SPK-03`), background sync, TalkBack. Must consume the shared core.

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **Native Kotlin + Jetpack Compose** | 5 | 5 | 4 | 5 | 4 | 4 | 4 | 5 | Best perf on low-end devices, best lifecycle/WorkManager/durability control, Kotlin = same language as the core. Compose API churn is the one minus. |
| **KMP + Compose Multiplatform** (share UI too) | 4 | 5 | 3 | 4 | 3 | 3 | 3 | 5 | Only pays off if iOS is added (out of scope, `foundation §7`); CMP-web is Canvas-based and unusable for our a11y needs, so web stays React anyway. Immature for the gain. |
| **Flutter** | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 5 | Good offline DBs (drift), one UI codebase — but the core becomes Dart or an FFI bridge to Rust; loses the Kotlin/Compose ecosystem and the KMP alignment. |
| **React Native** | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 5 | Shares JS with web and the core could be JS — but native durability/background-work is weaker and low-end perf is a real risk against `NFR-002` / `risk 10`. |

**Supporting choices:** single-activity, **MVI** (unidirectional), **Koin** DI (KMP-friendly), **WorkManager** for sync, **Turbine** for Flow tests, Compose UI tests, **Firebase Test Lab** (or an on-prem device set) for the chaos/perf gates on real target-tier hardware.

**Recommendation → Native Kotlin + Jetpack Compose** (**ADR-T03**). It maximises the two highest-weighted axes (reliability, offline) on the platform where they are hardest to guarantee, and keeps one language across Android + core.

### 3.3 Backend platform

**Need:** a **PostgreSQL** system-of-record (RLS as the authorization boundary per `ADR-04`; SQL for reconciliation/standings/audit; partitioning for `match_events`), plus auth, realtime, serverless functions and object storage, operable by a **small team**, with a **self-host / exit** path.

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Weighted | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **Supabase** (managed PG + GoTrue + PostgREST + Realtime + Edge/Deno + Storage) | 4 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | **129** | Postgres-native; RLS built for this; bundled services; huge docs/community → best AI-assisted support; OSS + self-hostable. Edge Function cold starts and some platform limits are the minuses. |
| **Firebase** (Firestore + Auth + Functions + FCM) | 4 | 5 | 3 | 4 | 4 | 5 | 4 | 3 | **123** | Best-in-class offline SDKs — but **NoSQL document model fights** relational reconciliation, standings, audit joins and reporting; no self-host; per-read cost with event-heavy data; query limits. |
| **AWS Amplify / AppSync** (GraphQL + Aurora/DynamoDB + Cognito + Lambda) | 5 | 3 | 3 | 4 | 3 | 4 | 5 | 3 | **114** | Scales furthest; but heavy, high cognitive load, slow iteration for a small team; Cognito is awkward; offline story is DIY. |
| **Nhost** (PG + Hasura GraphQL + auth + functions + storage) | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | **117** | Postgres-based like Supabase, GraphQL-first. Smaller company/community → long-term and AI-corpus risk. |
| **Appwrite** (self-hostable BaaS over MariaDB) | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 5 | **110** | Nice DX, fully OSS — but the DB abstraction is weaker than raw Postgres for our RLS/reporting/partitioning needs. |
| **PocketBase** (single Go binary + embedded SQLite) | 3 | 4 | 4 | 4 | 5 | 3 | 2 | 5 | **107** | Superb for tiny projects; **single-node SQLite** is an HA/scale ceiling wrong for a multi-tenant SaaS with competitions. |
| **Convex** (reactive TS backend, built-in sync) | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 3 | **114** | Excellent DX and a real sync story — but proprietary data model (not Postgres), limited self-host, younger vendor; risky for an official-record system-of-record. |
| **Custom: Postgres + NestJS/Go API + own auth** | 4 | 4 | 2 | 4 | 3 | 4 | 5 | 4 | **106** | Maximum control, maximum build and maintenance — directly contradicts `A-14`. |

*(Weighted total = Σ score×weight; weights R5 Off5 Mnt4 Prf3 DX4 AI4 Scl3 $3; max 155.)*

**Recommendation → Supabase** (**ADR-T04**). The requirement for *Postgres + RLS specifically* eliminates Firebase, PocketBase and Convex as the system-of-record; among the Postgres options Supabase wins on DX, community/AI-corpus, and bundling, and its OSS core is a genuine exit. AWS remains the fallback if multi-region write scale ever forces it — a problem we will not have before GA.

### 3.4 Database

**Need:** the **PostgreSQL** instance and its configuration, given the platform choice. (The *local* database is §3.5.)

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **Supabase-managed PostgreSQL** | 4 | n/a | 4 | 4 | 5 | 5 | 4 | 4 | Part of the platform; PITR, read replicas, Supavisor pooling, `pg_cron`, branching for previews. Compute tiers are the cost lever. |
| **Neon (serverless Postgres)** | 4 | n/a | 4 | 4 | 4 | 4 | 4 | 4 | Great branching/autoscale — but Supabase already gives project-per-env; using Neon means integrating auth/realtime/storage separately. |
| **Amazon RDS / Aurora** | 5 | n/a | 3 | 4 | 3 | 4 | 5 | 3 | Most headroom and HA — but ops burden and it decouples from the bundled platform. Revisit at hyperscale. |
| **Self-managed Postgres (VPS/k8s)** | 4 | n/a | 2 | 4 | 2 | 4 | 4 | 4 | Only sensible if/when self-hosting the whole Supabase stack for cost or data-residency. |

**Key configuration decisions (from `system-architecture.md §3.5`):** `match_events` **partitioned** (hash of `match_id` vs monthly — `AQ-2`); **RLS on every tenant row**; **materialised projections** (`match_snapshots`, `standings`, `career_stats`) with a `source_version` watermark; **PITR** + daily logical snapshots to a separate region/account; extensions `pg_cron` (jobs), `pgcrypto` (hash chains), `pg_partman` (partition upkeep). No `pgvector` need today.

**Recommendation → Supabase-managed PostgreSQL** (**ADR-T05**), with the configuration above. It is inseparable from ADR-T04; RDS/Aurora is the named escalation path.

### 3.5 Local database

**Need:** durable on-device storage for the event log, projection cache, reference data, outbox and session — surviving crash/kill/reboot (`OFF-003/004`, `NFR-009…011`, `SPK-03`) — on **both** web and Android, ideally one query dialect.

| Option (scope) | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **SQLite via PowerSync SDK** (native on Android, wa-sqlite/OPFS on web) | 5 | 5 | 4 | 4 | 4 | 3 | 4 | 4 | One SQL dialect client-side; PowerSync's SDK owns the durable persistence — **this is the `SPK-03` de-risk**. Ties local DB to the sync choice (ADR-T09). Smaller LLM corpus. |
| **SQLDelight (Android) + Dexie/IndexedDB (web)** | 4 | 5 | 3 | 4 | 4 | 4 | 4 | 5 | Two client stores, two mental models; IndexedDB is universal and transactional but no SQL. Pragmatic if sync is custom. |
| **SQLDelight (Android) + sqlite-wasm/OPFS (web)** | 4 | 5 | 3 | 3 | 3 | 3 | 4 | 5 | One dialect both sides — but browser sqlite-wasm/OPFS is newer, larger bundle, historically Safari-quirky. Revisit as it matures. |
| **PGlite (Postgres-wasm) on web + SQLDelight Android** | 4 | 5 | 3 | 3 | 3 | 2 | 4 | 5 | "Same engine as the server" is appealing; ~3 MB wasm and young. Not for v1. |
| **RxDB (web) + native (Android)** | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 4 | Nice reactive layer + replication protocol — but web-centric; no first-class Kotlin story. |

**Durability contract (both platforms):** every event append + outbox advance is **one transaction, durably committed (WAL + fsync) before the UI confirms** (`system-architecture.md §3.6`). On Android an optional append-only journal file is a redo source. On cold start the app replays the log to rebuild the projection.

**Recommendation → SQLite on both platforms, delivered by the PowerSync SDK if ADR-T09 is adopted; otherwise SQLDelight (Android) + a deliberate Dexie-vs-sqlite-wasm choice for web** (**ADR-T06**). The PowerSync path is preferred because it converts "build and prove durable mobile persistence" into "configure and verify."

### 3.6 API

**Need:** contracts consumable by a **TypeScript** client and a **Kotlin** client; a sync surface; RLS-guarded resource reads; a handful of RPC command endpoints; realtime channels; a V2 public read API. (Full surface: `system-architecture.md §4.7`.)

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **REST/RPC over HTTP+JSON, contract-first (OpenAPI + JSON Schema)** | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | Largest corpus; typegen for **both** TS and Kotlin; PostgREST covers reads; JSON Schema doubles as event/command contracts and test fixtures. Verbose vs alternatives. |
| **GraphQL** (pg_graphql / Hasura / Apollo) | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 4 | Flexible reads — but adds a schema/caching/N+1 layer we don't need; our reads are mostly pre-computed projections; offline caching of GraphQL is fiddly. |
| **tRPC** | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 5 | Superb end-to-end types — **TypeScript only**, so it cannot serve the Kotlin client. Possible for a web-only admin surface later, not the shared API. |
| **gRPC / Connect** | 5 | 4 | 3 | 5 | 3 | 3 | 5 | 4 | Great typing/codegen for TS *and* Kotlin, efficient — but heavier infra, and Supabase Edge Functions are HTTP/JSON-oriented; overkill for this surface. |

**Supporting choices:** OpenAPI as the single source → `openapi-typescript` (web) and a Kotlin client (Ktor + `kotlinx.serialization`) generated in CI; **JSON Schema** for every `EVT-*`/`CMD-*` with upcasters; **RFC 7807** errors; `Idempotency-Key` on commands, `event_id` on events; **Scalar** or Redoc to render the spec.

**Recommendation → REST/RPC over HTTP + JSON, contract-first** (**ADR-T07**). tRPC is disqualified by the Kotlin client; GraphQL and gRPC add weight the surface does not justify.

### 3.7 Authentication

**Need:** JWTs whose claims **Postgres RLS policies can read** (`auth.uid()` in policies); email/password + magic link + OAuth; **TOTP MFA for admin**; an **offline grace** window (cache session + a verifiable claims snapshot); cost-sensitive; self-host desirable. RBAC (12 additive roles) is modelled in **our** tables regardless.

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **Supabase Auth (GoTrue)** | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 5 | **Native JWT↔RLS integration is the deciding feature**; bundled (no extra vendor/cost); OSS/self-hostable; email/password, magic link, OAuth, TOTP MFA. Fewer enterprise features (SAML SSO is Pro+). |
| **Clerk** | 4 | 3 | 4 | 4 | 5 | 4 | 4 | 3 | Best prebuilt UI + orgs/RBAC — but per-MAU cost climbs, RLS needs "third-party auth" wiring, Android SDK less mature than web. |
| **Auth0** | 5 | 3 | 3 | 4 | 3 | 4 | 5 | 2 | Mature and scalable — cost and complexity are high; RLS is bring-your-own-JWT. |
| **AWS Cognito** | 4 | 3 | 2 | 3 | 2 | 3 | 5 | 4 | Scales; notoriously awkward DX; only sensible if the whole stack goes AWS. |
| **Keycloak / Ory (self-host)** | 4 | 3 | 2 | 4 | 3 | 3 | 4 | 4 | Full control — but self-hosting an IdP from day one is ops burden a small team should avoid now. |
| **Supertokens** | 4 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | OSS, self-hostable, reasonable DX — smaller ecosystem; still bring-your-own-JWT for RLS. |

**Offline design (`system-architecture.md §3.8`):** on login, store an encrypted refresh token **and a signed claims snapshot**; while offline within the configurable grace window, local authorization trusts the snapshot (verified with a shipped public key) and cloud calls queue; past the window, guest scoring continues and cloud actions require re-auth. Guest mode uses a device-local id with no server identity until claimed.

**Recommendation → Supabase Auth (GoTrue)** (**ADR-T08**). The JWT↔RLS integration removes an entire class of integration and staleness bugs; everything else is either more expensive, less integrated, or premature. Revisit trigger: an enterprise SSO/SCIM sales requirement → put **WorkOS** in front of GoTrue.

### 3.8 Synchronization

**The highest-stakes decision.** `system-architecture.md` commits to **per-device append-only event streams** merged into a **deterministic total order** (dense `event_ordinal` → HLC → `device_seq`), projected by the shared core, with **conflicts surfaced, never last-write-wins** (`SYNC-009/010`, `MINV-14`). The question here is *what builds the transport, the local store, the upload queue and the connectivity handling underneath that model* — build it, or adopt it.

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Weighted | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **PowerSync** (substrate) + event-log semantics in the shared core | 5 | 5 | 4 | 4 | 4 | 3 | 4 | 3 | **128** | Battle-tested durable local SQLite on Android + web (**de-risks `SPK-03`**); resumable delta transport (**helps `NFR-006`**); upload queue with ordering; **KMP + JS SDKs** match our stack; **Supabase-native**. Append-only is its easy path. Minuses: a paid dependency (FSL license → Apache-2 after 2 yrs; self-hostable), smaller LLM corpus, row-sync not event-log-native (small, managed impedance). |
| **Custom HTTPS event-log sync** (our endpoints + our local store) | 4 | 5 | 3 | 4 | 3 | 4 | 4 | 5 | **125** | Perfect fit to our model; no vendor, no per-usage cost. But **we build and prove** durable mobile persistence, resumable transport, retry, backpressure — weeks of specialist work and the core of `SPK-02`/`SPK-03` risk on a small team. |
| **ElectricSQL** (Postgres→client shape sync) + own write path | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 4 | **112** | Excellent OSS read-path sync, self-hostable; but post-2024 it syncs *reads* only — writes are entirely ours; newer; no first-class Kotlin client. |
| **Replicache / Zero (Rocicorp)** | 4 | 4 | 4 | 4 | 5 | 3 | 4 | 4 | **117** | Proven optimistic-mutation + server-reconciliation model close to ours; superb web DX — but **JS-centric, no native Kotlin client**, and Zero is young. |
| **Firebase Firestore offline** | 4 | 5 | 3 | 4 | 4 | 5 | 4 | 3 | **117** | Best turnkey offline SDK — but pulls the whole backend to NoSQL (see §3.3) and gives us **no control over deterministic ordering or divergence surfacing**. |
| **CRDTs (Yjs / Automerge)** | 3 | 5 | 3 | 3 | 3 | 3 | 3 | 5 | **101** | **Rejected in `ADR-05`**: automatic value-merge yields match states *no scorer authored* — unacceptable for an official record. Restated here. |
| **Turso / libSQL embedded replicas** | 3 | 3 | 4 | 4 | 4 | 3 | 4 | 4 | **101** | SQLite with built-in replication — but tuned for "mostly online with blips", not multi-hour fully-offline sessions with a queued write log. |

*(Weights as §3.3; max 155.)*

**Analysis.** PowerSync and custom score within a hair of each other — the weighting makes it a judgement call, not a formula. The deciding factors for a **small, AI-assisted team building an official-record system**:

1. **It collapses two spikes into verification tasks.** `SPK-02` (a substrate that serves P1 corrections *and* P2 merge) and `SPK-03` (zero-loss mobile durability under chaos) are the project's top technical risks. PowerSync's SDKs have solved durable local persistence and resumable sync for years (its parent has a decade in offline mobile). We still *verify* against our chaos gate — but we don't *invent* it.
2. **Append-only is PowerSync's happy path.** We model `match_events` as per-match append-only buckets; no update/delete conflict machinery is needed. Our deterministic ordering, projections, reconciliation and divergence detection stay in the shared core *either way* — PowerSync never touches domain semantics.
3. **Stack alignment.** KMP SDK (Android + core) and JS SDK (web), first-class Supabase source, Supabase-Auth integration — no impedance with the rest of this document.
4. **Reversibility is real.** Because the domain model is per-device event streams (`ADR-07`), replacing PowerSync with custom HTTPS sync later changes an adapter, not the domain, the projections, or the audit model.

**The risk to name honestly:** our sync semantics are unusual enough that a generic row-sync tool *could* be the wrong abstraction and we end up fighting it. **Mitigation:** `SPK-02` is re-scoped to *"prototype our event-log model on PowerSync and run it through the chaos + convergence harnesses before MVP build starts."* If it fights us, we fall to **custom HTTPS event-log sync** — which the architecture already fully specifies (`§3.7`) — with no domain-model change.

**Recommendation → PowerSync as the sync substrate, event-log semantics (ordering, reconciliation, divergence) in the shared core; custom HTTPS event-log sync as the documented fallback and the `SPK-02` decision gate** (**ADR-T09**).

### 3.9 Hosting

**Need:** managed-first for a small team; a **static PWA** (no SSR → no render platform needed); **Google Play** for Android (`AND-017`); one primary region near the first geography (`R1 §11` A2); backups to a separate region/account; documented self-host exits.

| Piece | Recommendation | Alternatives considered | Why |
|---|---|---|---|
| **Backend** | **Supabase Cloud** (Pro tier at pilot) | Self-hosted Supabase (VPS/k8s); AWS | Managed = least ops; self-host is the exit when cost or data-residency demands it. |
| **Web PWA** | **Cloudflare Pages** | Netlify, Vercel, GitHub Pages, Supabase Storage+CDN | Generous free tier, fast global edge, simple for a pure static bundle; no SSR tax. Netlify is an equivalent fallback; Vercel only if we ever adopt Next.js (we don't). |
| **Android** | **Google Play** — internal → closed → open → production tracks mapped to roadmap stages | (mandatory) | Required distribution; staged rollout + in-app updates. |
| **Sync service** | **PowerSync Cloud** (free tier at pilot) | Self-hosted PowerSync (Docker) | Managed initially; self-host caps cost at scale and is a clean exit. |
| **Object storage / CDN** | **Supabase Storage** (exports, images) + **separate region/account bucket** for backups | Cloudflare R2, S3 | Bundled + RLS-aware; backups deliberately isolated. |
| **Region** | Single primary region near the first market; read replicas later (`system-architecture.md §3.17`) | Multi-region from day one | Offline-first masks write latency; multi-region write is a post-GA concern. |
| **DNS / edge** | Cloudflare | Route 53, etc. | Pairs with Pages; WAF/rate-limiting at the edge for public surfaces. |

**Scoring (managed-first vs self-host-first):** managed-first wins **Reliability 4 / Maintainability 5 / DX 5 / Cost 4-at-pilot**; self-host-first wins **Cost 4-at-GA / control** but costs **Maintainability 2 / DX 2** now. The weighting favours managed-first until a cost/residency trigger flips it.

**Recommendation → Supabase Cloud + Cloudflare Pages + Google Play + PowerSync Cloud, single region, every piece with a documented self-host/exit path** (**ADR-T10**).

### 3.10 CI/CD

**Need:** run the project's quality gates mechanically — **conformance suite (100%)**, **cross-platform parity corpus**, **offline chaos**, **sync convergence**, **RLS policy matrix**, **DLS benchmark** (`system-architecture.md §4.11`); build web + Android + KMP core; ephemeral preview environments; keyless deploys; Play + Cloudflare + Supabase publishing.

| Option | R | Off | Mnt | Prf | DX | AI | Scl | $ | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **GitHub Actions** | 4 | n/a | 4 | 4 | 5 | 5 | 4 | 4 | Ubiquitous; largest marketplace + LLM corpus; native OIDC for keyless cloud deploys; first-party actions for Supabase CLI, Gradle, Play Publisher, Cloudflare. Generous free minutes; self-hosted runners for device/perf jobs. |
| **GitLab CI** | 4 | n/a | 4 | 4 | 4 | 4 | 4 | 4 | Strong, integrated — but the repo/ecosystem gravity is GitHub (`gh` CLI is already in the environment). |
| **CircleCI** | 4 | n/a | 3 | 4 | 3 | 3 | 4 | 3 | Good macOS/Android support historically; extra vendor, thinner free tier. |
| **Buildkite** | 5 | n/a | 3 | 5 | 3 | 3 | 5 | 3 | Best for heavy self-hosted fleets — overkill now. |

**Pipeline shape (`system-architecture.md §4.10`):**
- **PR:** lint/typecheck → unit → **conformance (100% required)** → **parity corpus** → build (web bundle, Android artifact, KMP core) → ephemeral preview (Cloudflare Pages preview + a Supabase branch/preview project) → Playwright e2e + a chaos subset + convergence subset.
- **main:** full offline-chaos suite (self-hosted runners + device lab), migrations dry-run against a prod-like snapshot, deploy **staging** → smoke → manual promote.
- **release:** Android → Play track via Gradle Play Publisher; web → Cloudflare Pages production; DB → Supabase CLI migrations; tag + generated changelog + SBOM (Syft) + build provenance (GitHub attestations).
- **Secrets:** GitHub OIDC → cloud; service-role key only in a protected `production` environment; Renovate/Dependabot for dependency hygiene.

**Recommendation → GitHub Actions** (**ADR-T11**), with self-hosted runners for the Android device/chaos/perf jobs.

### 3.11 Testing

**Need:** the gates in `system-architecture.md §4.11`. The **project-specific harnesses are the real quality bar**; the rest are mainstream tools chosen for documentation depth.

| Layer | Recommended tools | Alternatives | Notes |
|---|---|---|---|
| **Shared core — conformance** | Bespoke harness driving canonical `(config, command-sequence) → expected projection` cases; **JUnit5 + Kotest** on JVM; the *same corpus* executed against the JS/wasm build | hand-rolled runner only | Every `CSR-*`/`DR-*` + worked examples; accredited-scorer-reviewed; **100% to release** (`NFR-033`). |
| **Shared core — invariants** | **Property-based testing** (Kotest property / jqwik): generate random legal command sequences, assert `INV-001…018` + `MINV-*` hold | example-based only | Finds edge cases humans miss; complements the conformance corpus. |
| **Cross-platform parity** | One corpus, two runners (JVM + JS); CI publishes the **parity-matrix** metric (`≥ 95%`, `NFR-047/048`) | manual spot-checks | The mechanism that makes ADR-T01 safe. |
| **Web unit/component** | **Vitest + React Testing Library** | Jest | Vitest is faster and Vite-native. |
| **Web e2e + offline** | **Playwright** (offline mode, service-worker, IndexedDB assertions) + **axe-core** for WCAG 2.2 AA | Cypress | Playwright's offline/SW control and multi-browser support fit the PWA gates. |
| **Android unit** | **JUnit5 + Turbine + Compose UI test** | Robolectric | — |
| **Android device / chaos / perf** | **Firebase Test Lab** (or an on-prem target-tier device set) driven by adb automation | AWS Device Farm | Runs the **offline chaos test** (force-kill, battery pull, OS eviction, airplane toggling, ≥ 50 innings, **0 loss**) and the `NFR-002` latency budget on real hardware (`SPK-03`). |
| **Sync convergence** | Bespoke harness: replay shuffled multi-device event logs → assert identical merged projection; conflicts surfaced never dropped (`SYNC-009/010`) | — | CI (headless) + against staging; P2 gate. |
| **Dual-scorer divergence** | Bespoke: seeded disagreements surface, never silently merge (`FR-116…119`) | — | P2 gate. |
| **DLS benchmark** | Bespoke: fixed rain-scenario set vs reference outputs, tolerance-checked | — | Each DLS change / release. |
| **RLS policy matrix** | **pgTAP** assertions: no cross-tenant read/write; `match_events` not updatable/deletable | hand-rolled SQL | Every migration (`SEC-004/006`). |
| **Load / availability** | **k6** (Grafana Cloud k6): concurrent live matches + viewer fan-out, graceful degradation | Artillery, Locust | Pre-beta / pre-GA (`NFR-013/016/021`). |
| **Interop** | Cricsheet schema validation + export→import round-trip fidelity | — | Each export/import change (`NFR-030/031`). |
| **Audit chain** | Bespoke continuous verification: hash chains continuous; anonymisation preserves verifiability (`AUD-003`) | — | Continuous + CI. |

**Recommendation → the layered strategy above** (**ADR-T12**): mainstream tools (Kotest/JUnit5, Vitest, Playwright, pgTAP, k6, Firebase Test Lab) plus the five bespoke harnesses (conformance, parity, chaos, convergence, DLS benchmark) that no off-the-shelf tool provides.

### 3.12 Monitoring

**Need:** errors across **three runtimes** (React, Kotlin/Android, Deno/edge); OTel metrics/traces/logs tied to SRS gates (sync p95, **event-loss = 0**, input latency, viewer freshness, conformance %, parity, availability); **synthetics** including an "offline T20 then sync" canary; **privacy-respecting, opt-outable** feedback telemetry (`NFR-042`); low cost; no single-vendor lock-in on the instrumentation path.

| Concern | Recommendation | Alternatives | Why |
|---|---|---|---|
| **Error + client performance** | **Sentry** (React, Kotlin/Android, Deno SDKs; session replay; perf) | Bugsnag, Rollbar, Crashlytics | Only one with strong SDKs for all three runtimes + real free/Team tiers. Crashlytics is Android-only. |
| **Metrics / traces / logs** | **Grafana Cloud** (Mimir/Prometheus + Tempo + Loki), OTel-fed, dashboards-as-code, OnCall alerting | Datadog, New Relic, Honeycomb, Axiom | Vendor-neutral OTel ingestion, generous free tier, no lock-in. **Datadog** is the single-pane alternative if budget allows (note the cost). **Honeycomb** if trace-heavy debugging dominates. |
| **Synthetics / uptime** | **Checkly** (runs **Playwright** scripts as monitors → reuse the "offline T20 then sync" canary) | Better Stack, Grafana Synthetic Monitoring, UptimeRobot | Playwright-native synthetics mean one script serves e2e *and* production canary. |
| **Product / feedback telemetry + feature flags** | **PostHog** (OSS, **EU hosting or self-host**, analytics + flags + replay in one; opt-out honoured) | Amplitude + LaunchDarkly (two vendors), Unleash (flags only) | Doubles as the client feature-flag service (roadmap buckets, DLS gate). Privacy posture fits `NFR-042` and minors'-data care. |
| **Backend platform telemetry** | Supabase built-in logs/metrics (Logflare) → drained into Grafana Cloud | — | Use what's bundled; supplement, don't replace. |
| **Instrumentation SDK** | **OpenTelemetry** everywhere (functions + clients) | vendor-specific agents | Keeps the metrics/traces path portable between Grafana Cloud and any successor. |

**Recommendation → Sentry + Grafana Cloud (OTel) + Checkly + PostHog** (**ADR-T13**). Four focused tools with real free tiers beat one expensive console for a bootstrapped team, and the OTel path keeps the exit open.

### 3.13 Documentation

**Need:** keep the **markdown-in-`docs/`** practice (foundation, discovery, domain, SRS, roadmap, architecture already live there); render it as a searchable site; **contract-first API docs**; ADRs; generated code reference; version-controlled diagrams; AI-friendly formats.

| Concern | Recommendation | Alternatives | Why |
|---|---|---|---|
| **Source of truth** | **Markdown in the repo** (unchanged) | a wiki, Notion, Confluence | Already the practice; reviewable in PRs; diffable; AI-legible. External wikis drift from the code. |
| **Rendered site** | **Astro Starlight** | MkDocs Material, Docusaurus, VitePress, GitBook | Fast, MDX (embed diagrams/components), excellent built-in search/nav, JS-ecosystem alignment with the web team. **MkDocs Material** is the equal-footing fallback if the team prefers a zero-JS docs build. |
| **API reference** | **OpenAPI + JSON Schema (contract-first) → Scalar** (or Redoc) | hand-written endpoint docs | The spec is the single source (also drives clients and tests); the site just renders it. |
| **ADRs** | **MADR** (Markdown Any Decision Record) template in **`docs/architecture/adr/`**; this document seeds ADR-T01…T14 | Nygard template, Log4brains | Lightweight, standard, greppable; one file per decision. |
| **Code reference** | **Dokka** (Kotlin core/Android) + **TypeDoc** (web), generated in CI, published to the site | none | Keeps API docs honest with the code. |
| **Diagrams** | **Mermaid** in markdown (renders on GitHub + Starlight) | Structurizr/PlantUML, Excalidraw, draw.io | Version-controlled, diff-able, highly LLM-friendly. **Structurizr** (C4-as-code) is the option if formal C4 rigor is later wanted. |
| **Runbooks / ops** | Markdown in **`docs/ops/`** (incident runbook, restore drill, on-call) | — | Same practice; referenced from alerts. |
| **Glossary** | Keep **`docs/domain/glossary.md`** canonical; link from everywhere | — | Ubiquitous language must have one home. |

**Recommendation → Markdown-in-repo + Astro Starlight + OpenAPI/JSON Schema → Scalar + MADR ADRs + Mermaid + Dokka/TypeDoc, all built and published by CI** (**ADR-T14**).

---

## 4. Architecture Decision Records

MADR format. **Status** for all: *Proposed (draft, awaiting review)*. **Date:** 2026-09-03. These are technology-selection ADRs; the pattern ADRs (event sourcing, local-first, RLS-as-boundary, deterministic ordering, …) are `system-architecture.md §8` ADR-01…11 and are referenced, not repeated. Full copies to be maintained under `docs/architecture/adr/`.

---

### ADR-T01 — Shared scoring core: Kotlin Multiplatform

**Context.** `NFR-047/048` and `SPK-04` require identical scoring behaviour on Web and Android for identical inputs. The domain logic (state machines, `CFG-REG` resolver, 13 `SVC-*`, `EVT-*` folds, `INV-*`/`MINV-*` checks, `RainMethod`, Cricsheet translator) is intricate and long-lived. The team is small and AI-assisted (`A-14`).

**Decision drivers.** One source of truth for the rules; native performance on the constrained platform (mid-range Android, `NFR-002`); a mainstream language; determinism and replayability (`NFR-034`); reversibility if a purer option is later needed.

**Considered options.** (1) **Kotlin Multiplatform** — JVM target for Android, JS/wasm for web. (2) **Rust core** — wasm on web, UniFFI on Android. (3) **TypeScript core** — native on web, JS engine embedded on Android. (4) **Spec + two implementations** (TS + Kotlin) held together only by contract tests.

**Decision.** **Kotlin Multiplatform.** One Kotlin codebase compiled to a JVM artifact (Android) and a JS/wasm bundle (web). Pure: no I/O, clock, RNG or storage — those enter through ports (`ClockPort`, `IdPort`, `EventLogPort`, `ReferenceDataPort`).

**Consequences.**
- *Positive:* single implementation of the hardest logic; native speed on Android; Kotlin both sides of the Android/core boundary; strong typing; contract corpus still enforces parity as a safety net.
- *Negative:* a build/packaging step to produce and version the web bundle; KMP's JS/wasm toolchain is less trodden than its JVM path; smaller LLM corpus for KMP-specific build issues than for plain Kotlin or TS.
- *Neutral:* web developers consume a generated package, not Kotlin source.

**Confirmation.** The cross-platform **parity corpus** runs the same `(config, command-sequence) → expected projection` cases against the JVM and JS builds in CI; the **parity matrix** metric must be ≥ 95% (target 100% on the scoring core). The **conformance suite** must pass 100% to release.

**Revisit triggers.** wasm/JS build performance misses a client budget; KMP toolchain instability costs more than it saves → migrate the core to **Rust** (wasm + UniFFI); the domain model and contract corpus are unaffected.

**Links.** `system-architecture.md §4.2`, `SPK-04`, `NFR-047/048`, `NFR-034`.

---

### ADR-T02 — Web frontend: React + TypeScript + Vite (SPA/PWA), Radix + Tailwind

**Context.** The web client is an installable **PWA** that scores fully offline (`OFF-*`, `NFR-046`), must meet **WCAG 2.2 AA** on core flows (`NFR-019`), offers a keyboard-first multi-pane scorebox and print output, and renders charts offline. It is not content- or SEO-driven; public marketing/competition pages can be a separate small surface later.

**Decision drivers.** Ecosystem depth for PWA/a11y/offline; AI-assisted output quality; developer productivity for a small team against a fixed accessibility gate; avoiding SSR complexity that fights offline-first.

**Considered options.** React + TS + Vite SPA; SvelteKit; SolidJS; Angular; Next.js (React + SSR).

**Decision.** **React + TypeScript + Vite**, single-page **PWA** (Workbox via `vite-plugin-pwa`), **no SSR meta-framework**. **Radix primitives + Tailwind** (shadcn/ui copy-in pattern) for accessible components; **Zustand** for UI state; **TanStack Query** for server-cache reads; domain state is the core projection object. Charts via **visx** or **Recharts** (offline, styleable).

**Consequences.**
- *Positive:* the largest pool of a11y primitives, offline libraries, examples and LLM training data; fast Vite iteration; shadcn/Radix are especially LLM-friendly; SSR complexity avoided.
- *Negative:* React ships more runtime than Svelte/Solid; bundle discipline needed to hit cold-start/latency budgets; some boilerplate vs Svelte.
- *Neutral:* public pages, if built, use a separate lightweight tool (e.g. Astro) rather than this SPA.

**Confirmation.** Playwright e2e in offline mode (service worker + IndexedDB); **axe-core** checks + manual screen-reader passes against WCAG 2.2 AA; performance-budget checks for cold start (`≤ 3 s`) and input latency (`≤ 100 ms`) in CI.

**Revisit triggers.** Bundle/perf budgets unreachable on target laptops/Chromebooks after optimisation → evaluate **SvelteKit** (SPA mode) for the scorebox specifically.

**Links.** `system-architecture.md §3.2, §4.3`, `NFR-001/004/005/019`, `OFF-*`.

---

### ADR-T03 — Android: Native Kotlin + Jetpack Compose (single-activity, MVI)

**Context.** The primary persona scores one-handed on a **mid-range Android 10+** phone in an offline scorebox. Requirements: `≤ 100 ms` input ack, durable local writes surviving crash/kill/battery-pull (`SPK-03`, `NFR-009…011`), background sync, TalkBack, large gloved-use targets. The app must consume the KMP core (ADR-T01).

**Decision drivers.** Performance on low-end hardware (`risk 10`); fine control of lifecycle, durable persistence and background work; language alignment with the core; tooling and hiring.

**Considered options.** Native Kotlin + Jetpack Compose; KMP + Compose Multiplatform (shared UI); Flutter; React Native.

**Decision.** **Native Kotlin + Jetpack Compose**, single-activity, **MVI** unidirectional flow, **Koin** DI, **WorkManager** for sync. Consumes the KMP core as a JVM artifact.

**Consequences.**
- *Positive:* best performance and lifecycle/durability control on the constrained platform; one language across app + core; first-class WorkManager/Keystore/Play tooling; Compose is increasingly well-supported by LLMs.
- *Negative:* Compose API churn requires occasional migration effort; no UI sharing with web (web stays React) — acceptable, as CMP-web is unsuitable for our a11y needs.
- *Neutral:* iOS remains out of scope (`foundation §7`); if it returns, re-evaluate Compose Multiplatform then.

**Confirmation.** The **offline chaos test** on real target-tier devices (Firebase Test Lab / device set): 0 ball-events lost over ≥ 50 innings across force-kill / battery-pull / OS-eviction / airplane toggling. Input-latency and cold-start budgets measured on the same hardware.

**Revisit triggers.** A funded requirement to ship iOS on the same timeline → evaluate **Compose Multiplatform** or **Flutter** with the core exposed via KMP/FFI.

**Links.** `system-architecture.md §3.3, §4.4`, `SPK-03`, `NFR-002/009…011`, `AND-001…024`.

---

### ADR-T04 — Backend platform: Supabase

**Context.** The system needs a **PostgreSQL** system-of-record (RLS as the authorization boundary per `system-architecture.md ADR-04`; SQL for reconciliation, standings and audit; partitioning for `match_events`), plus auth, realtime, serverless functions and object storage — operable by a small team, with a self-host exit.

**Decision drivers.** Postgres + RLS specifically; bundled services (fewer integrations for a small team); documentation depth and community size (AI-assisted support); cost at pilot; an exit path.

**Considered options.** Supabase; Firebase; AWS Amplify/AppSync; Nhost; Appwrite; PocketBase; Convex; fully custom (Postgres + NestJS/Go + own auth).

**Decision.** **Supabase** — managed Postgres + **GoTrue** auth + **PostgREST** + **Realtime** + **Edge Functions (Deno/TS)** + **Storage**. Managed cloud initially; the OSS core is the self-host exit.

**Consequences.**
- *Positive:* Postgres-native with RLS designed for exactly this; one platform instead of five integrations; the largest docs/community among Postgres BaaS → best AI-assisted output; project-per-environment; OSS + self-hostable.
- *Negative:* Edge Function cold starts and platform quotas need design around (batch endpoints, async export jobs); some advanced auth features are paid tiers; a soft coupling to Supabase idioms (`SECURITY DEFINER` helpers, PostgREST conventions).
- *Neutral:* heavy jobs (large PDF/Cricsheet exports) may later move to a dedicated worker/container (`AQ-10`).

**Confirmation.** The **RLS policy matrix** (pgTAP) proves tenant isolation and `match_events` immutability on every migration; load tests (k6) validate the concurrent-match + viewer-fan-out targets pre-beta; a self-host dry-run before GA proves the exit is real.

**Revisit triggers.** Multi-region **write** scale, data-residency mandates, or cost past a defined threshold → self-host Supabase, or migrate the data tier to **AWS Aurora** behind the same schema and RLS.

**Links.** `system-architecture.md §3.4, §4.5`, `ADR-04`, `A-09`, `SEC-004`, `OBJ-10`.

---

### ADR-T05 — Database: Supabase-managed PostgreSQL

**Context.** Given ADR-T04, the system-of-record for synced data is PostgreSQL. It carries the append-only, hash-chained `match_events` log; materialised projections; identity/tenancy; competition and profile data; and the cross-cutting `audit_log`.

**Decision drivers.** Reproducible, incremental recompute of projections; tenant isolation; large-corpus query language (SQL) for maintainability and AI assistance; point-in-time recovery; partition management for an ever-growing event table.

**Considered options.** Supabase-managed Postgres; Neon; Amazon RDS/Aurora; self-managed Postgres.

**Decision.** **Supabase-managed PostgreSQL**, configured with: `match_events` **partitioned** (strategy per `AQ-2`); **RLS on every tenant row**; **materialised projections** (`match_snapshots`, `standings`, `career_stats`) carrying a `source_version` watermark for incremental idempotent recompute; **PITR** + daily logical snapshots to a separate region/account; extensions `pg_cron`, `pgcrypto`, `pg_partman`. Matches **pin** `conditions_profile_version` and `dls_table_version` at creation (`BR-032`, `MINV-05`).

**Consequences.**
- *Positive:* one engine for write model, read models, audit and reporting; SQL is maximally maintainable and AI-legible; PITR + replicas available on the platform.
- *Negative:* partition maintenance and materialisation jobs are operational surface to own; compute tier is the main cost lever.
- *Neutral:* the *local* database is a separate decision (ADR-T06) and is SQLite, not Postgres.

**Confirmation.** Projection **rebuild-from-log** is exercised in CI (drop `match_snapshots`, rebuild, diff = 0). Backup **restore-and-verify** job runs on a schedule and checks row counts, hash-chain continuity and a sample projection rebuild.

**Revisit triggers.** As ADR-T04 (write scale / residency / cost) → Aurora or self-managed behind the same schema.

**Links.** `system-architecture.md §3.5, §4.6`, `BR-032`, `MINV-05/16/17`.

---

### ADR-T06 — Local database: SQLite on both platforms (via PowerSync; SQLDelight fallback)

**Context.** Both clients need durable local storage for the event log, projection cache, reference data, outbox and session, surviving crash/kill/reboot (`OFF-003/004`, `NFR-009…011`, `SPK-03`). One SQL dialect client-side is desirable for the shared-core data layer.

**Decision drivers.** Durability guarantees; one mental model across platforms; alignment with the sync choice (ADR-T09); bundle size and browser maturity on web.

**Considered options.** SQLite via the **PowerSync SDK** (native on Android, wa-sqlite/OPFS on web); **SQLDelight (Android) + Dexie/IndexedDB (web)**; SQLDelight + **sqlite-wasm/OPFS** on web; **PGlite** (Postgres-wasm) on web; **RxDB**.

**Decision.** **SQLite on both platforms.** If ADR-T09 (PowerSync) is adopted, the **PowerSync SDK provides the local SQLite store** on both — one dialect, durable persistence owned by a proven SDK. If sync goes custom, use **SQLDelight on Android** and make a deliberate **Dexie-vs-sqlite-wasm** choice for web (default Dexie for lower risk, revisit sqlite-wasm as OPFS matures). Durability contract on both: one transaction, WAL + fsync, **committed before the UI confirms**; Android keeps an optional append-only journal; cold start replays the log.

**Consequences.**
- *Positive:* (PowerSync path) one query dialect client-side, durability handled by an SDK with a decade of offline-mobile pedigree — the direct `SPK-03` de-risk.
- *Negative:* couples the local DB to the sync vendor; PowerSync's browser SQLite (wa-sqlite/OPFS) is newer than IndexedDB; smaller LLM corpus for PowerSync-specific issues.
- *Neutral:* the projection cache is disposable regardless of engine (`MBR-07`).

**Confirmation.** The offline chaos test (ADR-T03 confirmation) is the gate. A "kill within 50 ms of confirm → event present on relaunch" case runs on real devices.

**Revisit triggers.** ADR-T09 falls to the custom fallback → local DB becomes SQLDelight + the web sub-decision; OPFS/sqlite-wasm reaches broad maturity → reconsider one dialect on web independently.

**Links.** `system-architecture.md §3.6`, ADR-T09, `SPK-03`, `OFF-003/004`.

---

### ADR-T07 — API: REST/RPC over HTTP + JSON, contract-first (OpenAPI + JSON Schema)

**Context.** The API is consumed by a **TypeScript** client and a **Kotlin** client. Surface: sync endpoints (or the PowerSync protocol + an upload endpoint), RLS-guarded resource reads, a few RPC command endpoints, realtime channels, and a V2 public read API (`system-architecture.md §4.7`).

**Decision drivers.** Both clients must be first-class; the event/command contracts must double as test fixtures; the largest corpus for AI-assisted development; no needless infra.

**Considered options.** REST/RPC over HTTP+JSON, contract-first; GraphQL; tRPC; gRPC/Connect.

**Decision.** **REST/RPC over HTTP + JSON, contract-first.** **OpenAPI** describes REST/RPC; **JSON Schema** defines every `EVT-*` and `CMD-*` (versioned, with upcasters). The spec is the single source → `openapi-typescript` for web and a generated Ktor + `kotlinx.serialization` client for Android, produced in CI. **PostgREST** serves RLS-guarded reads; **Edge Functions** serve commands with `Idempotency-Key`; events carry `event_id`. Errors are **RFC 7807**. Rendered with **Scalar**.

**Consequences.**
- *Positive:* both clients get generated types; JSON Schema fixtures feed the conformance and convergence suites; maximal corpus and tooling; PostgREST removes hand-written read endpoints.
- *Negative:* JSON is more verbose than gRPC and less end-to-end-typed than tRPC; discipline needed to keep the spec authoritative (CI fails on drift / unversioned breaking change).
- *Neutral:* a web-only admin surface *could* later use tRPC internally without affecting the shared API.

**Confirmation.** CI validates the OpenAPI spec, fails on a breaking schema diff without a version bump, and round-trips generated clients against a mock server. Contract tests replay recorded requests/responses.

**Revisit triggers.** Read patterns become highly variable and client-driven → add **pg_graphql** as a read-only adjunct (not a replacement).

**Links.** `system-architecture.md §3.10, §4.7, §4.8`, `NFR-034`, `SYNC-005`.

---

### ADR-T08 — Authentication: Supabase Auth (GoTrue); RBAC in application tables

**Context.** Authorization is enforced at the data layer by **Postgres RLS** (`system-architecture.md ADR-04`, `SEC-004`). RLS policies need JWT claims they can read (`auth.uid()`). Requirements: email/password + magic link + OAuth; **TOTP MFA for admin**; an **offline grace** window; cost-sensitivity; a self-host exit. The 12-role additive RBAC model is modelled in application tables regardless of the provider.

**Decision drivers.** Native JWT↔RLS integration; bundling (no extra vendor/integration/cost); MFA for admin; offline-capable session model; self-hostable.

**Considered options.** Supabase Auth (GoTrue); Clerk; Auth0; AWS Cognito; Keycloak/Ory (self-host); Supertokens.

**Decision.** **Supabase Auth (GoTrue).** Email/password + magic link + OAuth; **TOTP MFA required for platform-admin**. Orgs/roles/memberships live in application tables with `SECURITY DEFINER` helper functions (`my_orgs()`, `has_match_role()`) that RLS policies call. **Offline:** an encrypted refresh token plus a **signed claims snapshot** (verified locally with a shipped public key) authorise local actions within a configurable grace window; cloud calls queue; guest scoring never needs auth.

**Consequences.**
- *Positive:* the JWT↔RLS path is seamless and removes a class of staleness/integration bugs; nothing extra to run or pay for; self-hostable with the rest of Supabase; full control of the RBAC model in our own schema.
- *Negative:* enterprise SSO/SAML and SCIM are paid tiers or absent; admin UI for auth is basic; we own the RBAC tables and their tests.
- *Neutral:* API keys for the V2 public API are a separate mechanism (hashed, scoped, rotatable) not part of GoTrue.

**Confirmation.** pgTAP tests assert every RLS policy against forged/again-scoped tokens; an offline-grace test proves local authorization works within the window and degrades correctly past it; an MFA-required test blocks admin endpoints without a second factor.

**Revisit triggers.** A customer requires SAML SSO / SCIM provisioning → front GoTrue with **WorkOS** (or migrate to **Clerk**) while keeping the RBAC tables and RLS unchanged.

**Links.** `system-architecture.md §3.8, §3.9`, `SEC-002/004/005/011`, `FR-002/003/012`, `OFF-013`.

---

### ADR-T09 — Synchronization: PowerSync substrate + event-log semantics in the shared core

**Context.** The sync model is fixed by the architecture: **per-device append-only event streams**, a **deterministic total order** (dense `event_ordinal` → HLC → `device_seq`), projection by the shared core, **conflicts surfaced never last-write-wins** (`SYNC-009/010`, `MINV-14`). The open question is what provides the local store, the resumable delta transport, the upload queue and the connectivity handling beneath that model — build it (`SPK-02`/`SPK-03` risk) or adopt it. This is the project's highest-stakes technology decision.

**Decision drivers.** De-risking `SPK-02` (a substrate serving P1 corrections *and* P2 merge) and `SPK-03` (zero-loss mobile durability under chaos) for a small team; fit to an append-only event model; stack alignment (KMP + JS SDKs, Supabase source); reversibility; cost.

**Considered options.** **PowerSync** (substrate) + semantics in the core; **custom HTTPS event-log sync**; **ElectricSQL** (read-path) + own writes; **Replicache/Zero**; **Firebase Firestore offline**; **CRDTs (Yjs/Automerge)**; **Turso/libSQL embedded replicas**.

**Decision.** Adopt **PowerSync** as the sync substrate: it provides the durable local **SQLite** store (ADR-T06), the resumable/compressed delta transport, the ordered upload queue and connectivity handling. The **event-log semantics stay in the shared core**: deterministic ordering, `SVC-RECONCILER`, `SVC-DIVERGENCE-DETECTOR`, projection folds. `match_events` is modelled as per-match **append-only** buckets; the client uploader calls an Edge Function that re-validates and appends (`SYNC-005`, `SEC-014`). **Custom HTTPS event-log sync (fully specified in `system-architecture.md §3.7`) is the documented fallback.**

**Consequences.**
- *Positive:* the two scariest spikes become *verification* rather than *invention*; append-only is PowerSync's easy path (no update/delete conflict machinery); KMP + JS SDKs and Supabase-native integration fit the stack exactly; PowerSync's streaming updates can also serve the live-viewer channel.
- *Negative:* a paid dependency (FSL license, converts to Apache-2 after 2 years; self-hostable via Docker); smaller LLM corpus; a row-sync tool applied to an event-log model — a small, managed impedance; a per-usage cost line from public beta onward.
- *Neutral:* domain semantics, projections and the audit model are untouched by the choice — that is what makes it reversible.

**Confirmation.** `SPK-02` is **re-scoped** to: *prototype the event-log model on PowerSync and pass the offline-chaos harness (0 loss over ≥ 50 innings) and the sync-convergence harness (shuffled multi-device logs → identical merge) before MVP build begins.* If it fails, execute the custom-HTTPS fallback with **no domain-model change**.

**Revisit triggers.** the prototype fights the event-log model; PowerSync cost or roadmap diverges from ours; self-hosting becomes necessary and its operational cost exceeds building custom → switch to the custom fallback (an adapter change, per `system-architecture.md ADR-07`).

**Links.** `system-architecture.md §3.7, ADR-05, ADR-07`, `SPK-02`, `SPK-03`, `SYNC-001…016`, `NFR-006/016/017`, `MINV-14`.

---

### ADR-T10 — Hosting: Supabase Cloud + Cloudflare Pages + Google Play + PowerSync Cloud

**Context.** A small team needs managed hosting. The web client is a **static PWA** (no SSR). Android ships through **Google Play** (`AND-017`). Backups must be isolated from the primary. Every managed piece should have a documented self-host / exit path.

**Decision drivers.** Minimum operational surface now; no paying for render infrastructure a static PWA does not need; staged Android rollout; a single primary region (offline-first masks write latency); clean exits.

**Considered options.** Managed-first (Supabase Cloud, Cloudflare Pages, Play, PowerSync Cloud) vs self-host-first (Supabase + PowerSync on VPS/k8s from day one); web host alternatives (Netlify, Vercel, GitHub Pages).

**Decision.** **Supabase Cloud** (backend) · **Cloudflare Pages** (web PWA, with preview deployments per PR) · **Google Play** (Android — internal → closed → open → production tracks mapped to roadmap stages) · **PowerSync Cloud** (sync). **Single primary region** near the first market; **backups to a separate region/account bucket**; Cloudflare for DNS/edge WAF on public surfaces. Read replicas and multi-region are post-GA.

**Consequences.**
- *Positive:* near-zero ops at pilot; generous free tiers; edge-fast static hosting; staged rollout built in.
- *Negative:* several managed vendors to monitor and budget; egress/compute costs grow with scale; a region choice must be made early (depends on `R1 §11` A2).
- *Neutral:* self-hosting Supabase and PowerSync is the deliberate escalation, cost-effective only well past GA.

**Confirmation.** A **self-host dry-run** of Supabase + PowerSync before GA proves the exit path. Backup **restore drills** run quarterly (`ADM-110`).

**Revisit triggers.** cost past a defined monthly threshold; data-residency requirements; multi-region write latency → self-host, or move the data tier to a cloud-provider-native stack.

**Links.** `system-architecture.md §3.17`, ADR-T04, ADR-T09, `NFR-013`, `foundation §11` A2.

---

### ADR-T11 — CI/CD: GitHub Actions

**Context.** The pipeline must run the project's quality gates mechanically (conformance 100%, parity corpus, offline chaos, sync convergence, RLS matrix, DLS benchmark), build web + Android + KMP core, provide ephemeral preview environments, deploy to Play + Cloudflare + Supabase, and use keyless credentials.

**Decision drivers.** Ecosystem/marketplace breadth; documentation and LLM corpus; native OIDC for keyless deploys; first-party actions for every tool in this stack; cost at team size; self-hosted runners for device/perf jobs.

**Considered options.** GitHub Actions; GitLab CI; CircleCI; Buildkite.

**Decision.** **GitHub Actions.** PR gates: lint/typecheck → unit → conformance (100%) → parity corpus → build → ephemeral preview (Cloudflare Pages preview + Supabase branch/preview) → Playwright e2e + chaos/convergence subsets. `main`: full chaos suite on **self-hosted runners** + device lab, migration dry-run against a prod-like snapshot, deploy staging → smoke → manual promote. Release: Play track publish (Gradle Play Publisher), Cloudflare Pages production, Supabase CLI migrations, tag + changelog + **SBOM (Syft)** + **build provenance (GitHub attestations)**. Secrets via **OIDC**; service-role key only in a protected `production` environment; **Renovate/Dependabot**.

**Consequences.**
- *Positive:* ubiquitous, best-documented, integrates with every tool here; keyless deploys; free minutes cover PR load; self-hosted runners handle Android/device jobs.
- *Negative:* hosted macOS/Android minutes are pricier — mitigated by self-hosted runners; complex matrix pipelines need maintenance.
- *Neutral:* the repo is expected to live on GitHub (consistent with the `gh` tooling already in the environment).

**Confirmation.** A green pipeline that blocks merge on any failing gate; a release that publishes to all three targets from a tag with no manual keys.

**Revisit triggers.** the project moves off GitHub; device-farm/self-hosted-runner cost or maintenance becomes disproportionate → reconsider GitLab CI or a dedicated Android CI.

**Links.** `system-architecture.md §4.10, §4.11`.

---

### ADR-T12 — Testing: layered strategy with bespoke correctness harnesses

**Context.** Correctness *is* the product (`OBJ-01/07`). The SRS defines verification gates (`system-architecture.md §4.11`): conformance, cross-platform parity, offline chaos, sync convergence, dual-scorer divergence, DLS benchmark, RLS matrix, accessibility, performance budgets, load, interoperability, audit-chain verification. No single off-the-shelf tool covers the domain-specific ones.

**Decision drivers.** The bespoke harnesses are the real bar; everything else should be a mainstream, well-documented tool to maximise productivity and AI assistance.

**Considered options.** Per layer — see §3.11.

**Decision.**
- **Bespoke harnesses:** conformance (every `CSR-*`/`DR-*` + worked examples, accredited-scorer-reviewed, **100% to release**), cross-platform parity (one corpus, JVM + JS runners, publishes the parity matrix), offline chaos (real devices), sync convergence (shuffled multi-device replay), dual-scorer divergence, DLS benchmark, continuous audit-chain verification.
- **Mainstream tools:** **Kotest/JUnit5 + property testing** (core invariants); **Vitest + React Testing Library** (web unit); **Playwright + axe-core** (web e2e, offline, WCAG 2.2 AA); **JUnit5 + Turbine + Compose UI test** (Android unit); **Firebase Test Lab** or an on-prem device set (Android chaos/perf on target hardware); **pgTAP** (RLS policy matrix, every migration); **k6** (load / viewer fan-out, pre-beta/pre-GA); Cricsheet schema + round-trip checks (interop).

**Consequences.**
- *Positive:* the correctness gates are explicit, automated and release-blocking; the mainstream tools have deep docs and LLM support; property tests find invariant violations humans miss.
- *Negative:* the bespoke harnesses are real software to build and maintain; the device lab is operational cost and setup.
- *Neutral:* the conformance corpus is co-owned with `cricket-rules-reference.md` and grows as `[EDGE]` cases are confirmed.

**Confirmation.** CI blocks merge/release on any failing gate; the parity matrix and conformance pass-rate are published as monitored metrics (ADR-T13).

**Revisit triggers.** a device-cloud alternative proves cheaper/faster for the chaos suite; property-testing coverage plateaus → add fuzzing of the event-ingest endpoint.

**Links.** `system-architecture.md §4.11`, `NFR-009/016/017/033/047/048`, `SPK-03`.

---

### ADR-T13 — Monitoring: Sentry + Grafana Cloud (OTel) + Checkly + PostHog

**Context.** Observability must cover errors across **three runtimes** (React, Kotlin/Android, Deno/edge); metrics/traces/logs tied to SRS gates (sync p95, **event-loss = 0**, input latency, viewer freshness, conformance %, parity, availability ≥ 99.5%); **synthetics** including an "offline T20 then sync" canary; and **privacy-respecting, opt-outable** feedback telemetry (`NFR-042`, minors'-data care). Budget is tight; the instrumentation path must not lock in.

**Decision drivers.** Coverage of all three runtimes; vendor-neutral instrumentation (OTel); real free tiers; a feedback-telemetry tool with an EU/self-host option; reuse of Playwright scripts as production canaries.

**Considered options.** See §3.12 (Sentry vs Bugsnag/Rollbar/Crashlytics; Grafana Cloud vs Datadog/New Relic/Honeycomb/Axiom; Checkly vs Better Stack/Grafana SM; PostHog vs Amplitude+LaunchDarkly).

**Decision.** **Sentry** (errors + client performance, all three SDKs) · **Grafana Cloud** (Mimir/Tempo/Loki, **OpenTelemetry**-fed, dashboards-as-code, alerting) · **Checkly** (Playwright-script synthetics — the "offline T20 then sync" canary, DLS benchmark schedule) · **PostHog** (opt-outable product telemetry + **feature flags** for roadmap buckets and the DLS gate; EU hosting or self-host). Supabase built-in logs drained into Grafana Cloud. Hard pages for **event-loss**, **audit-chain verification failure**, **backup-verification failure**; SLO-burn alerts for availability, sync p95, error rate.

**Consequences.**
- *Positive:* full coverage for a bootstrapped budget; OTel keeps the metrics/traces path portable; one Playwright script serves e2e and canary; PostHog also removes the need for a separate flag service.
- *Negative:* four tools to wire and keep in budget as usage grows; correlation across tools needs consistent IDs.
- *Neutral:* **Datadog** is the single-pane escalation if the team later prefers one console and accepts the cost.

**Confirmation.** Dashboards exist for every SRS gate metric before the stage whose gate depends on it; a deliberately induced event-loss in staging pages within the check interval; the offline-sync canary runs green on a schedule.

**Revisit triggers.** tool sprawl or cost outweighs the free-tier benefit → consolidate onto Datadog or Grafana Cloud's fuller suite; PostHog EU/self-host no longer meets privacy needs → self-host it.

**Links.** `system-architecture.md §3.13, §4.9`, `NFR-013/035/042`, `AUD-003/015`.

---

### ADR-T14 — Documentation: Markdown-in-repo + Astro Starlight + contract-first API docs + MADR ADRs

**Context.** The SDD documents already live as markdown in `docs/` (foundation, discovery, domain, glossary, SRS, roadmap, architecture, this document). They need a searchable rendered site, contract-first API reference, an ADR home, generated code reference, and version-controlled diagrams — all AI-legible.

**Decision drivers.** Keep the existing practice (reviewable in PRs, diffable, no drift from code); contract-first API docs; lightweight standard ADRs; JS-ecosystem alignment for the docs build; LLM-friendly diagram format.

**Considered options.** Site: Astro Starlight vs MkDocs Material vs Docusaurus vs VitePress vs GitBook. API: OpenAPI→Scalar/Redoc vs hand-written. Diagrams: Mermaid vs Structurizr/PlantUML vs Excalidraw.

**Decision.** **Markdown in the repo is the source of truth.** Rendered with **Astro Starlight** (MDX, fast, strong search; **MkDocs Material** is the equal fallback). API reference is **contract-first**: the **OpenAPI + JSON Schema** spec (also driving clients and tests) rendered with **Scalar**. ADRs use the **MADR** template in **`docs/architecture/adr/`** (this document seeds ADR-T01…T14). Code reference via **Dokka** (Kotlin) + **TypeDoc** (web), generated in CI. Diagrams in **Mermaid**; `docs/domain/glossary.md` stays the canonical ubiquitous-language home; runbooks in `docs/ops/`. CI builds and publishes the site.

**Consequences.**
- *Positive:* one workflow (PRs) for docs and code; API docs cannot drift from the contract; Mermaid and markdown are highly LLM-friendly; the site is a thin render over existing files.
- *Negative:* a docs build to maintain in CI; Dokka/TypeDoc output needs curation to stay useful.
- *Neutral:* public-facing product docs, if needed later, can reuse the same Starlight site or a separate Astro surface.

**Confirmation.** CI builds the site on every PR and fails on broken links or an invalid OpenAPI spec; ADR count and status are visible in the site nav.

**Revisit triggers.** non-technical stakeholders need collaborative editing → mirror selected pages to a wiki with the repo staying canonical; C4 rigor is mandated → add **Structurizr** (C4-as-code) alongside Mermaid.

**Links.** `docs/README.md`, `system-architecture.md §4.8`.

---

## 5. Cross-cutting analysis

### 5.1 Indicative cost model

Order-of-magnitude monthly figures for **planning only** — not quotes. Assumes the recommended stack, one primary region, small team.

| Component | Pilot (5 clubs, ~100 matches/season, low concurrency) | Public beta (public sign-up, hundreds of matches, moderate concurrency) | GA (multi-tenant SaaS, many concurrent live matches + viewer fan-out) |
|---|---|---|---|
| Supabase | $0 (Free) – $25 (Pro) | $25 – $150 (Pro + compute/replica add-ons) | $300 – $1,500 (compute tiers, read replicas, PITR retention) |
| PowerSync | $0 (Free tier) | $35 – $150 (usage) | $150 – $600 (usage) or self-host (~$40–150 infra) |
| Cloudflare Pages + DNS/WAF | $0 | $0 – $20 | $20 – $100 (egress, WAF rules) |
| GitHub Actions | $0 (free minutes) | $0 – $60 (macOS/Android minutes; offset by self-hosted runners) | $50 – $200 |
| Sentry | $0 (Dev) – $26 (Team) | $26 – $89 | $89 – $400 (event volume) |
| Grafana Cloud | $0 (Free) | $0 – $100 (Pro) | $200 – $800 (series/log volume) |
| Checkly | $0 (Hobby) | $0 – $40 | $40 – $150 |
| PostHog | $0 (Free) | $0 – $50 (usage) | $50 – $300 or self-host |
| Firebase Test Lab / device lab | pay-as-you-go, minimal | $10 – $50 | $50 – $200 (or amortised on-prem devices) |
| Object storage / backups (2nd region) | ~$1 – $5 | $5 – $25 | $25 – $150 |
| Google Play | **$25 one-time** | — | — |
| Domain | ~$1 – $2 (amortised) | ~$2 | ~$2 |
| **Rough monthly total** | **≈ $0 – $75** (+ $25 one-time) | **≈ $150 – $500** | **≈ $1,000 – $4,000**, scaling with tenants |

**Cost levers:** Supabase compute tier and read replicas; PowerSync usage (self-host caps it); observability data volume (sampling, retention); Android CI minutes (self-hosted runners). **Self-hosting Supabase + PowerSync** becomes cost-effective at a scale reached **well after GA** and is the documented escalation, not a launch choice.

### 5.2 Vendor risk and exit paths

| Dependency | Lock-in risk | Exit path | Effort to exit |
|---|---|---|---|
| **Supabase** | Medium — PostgREST/RLS/GoTrue idioms, Edge Function runtime | OSS core self-hostable; or migrate the data tier to Aurora behind the same schema + RLS; replace Edge Functions with a small API service | Medium (schema + RLS port cleanly; functions are rewrites) |
| **PowerSync** | Medium — sync protocol + client SDKs | Self-host the PowerSync service (Docker); **or** the fully-specified custom HTTPS event-log sync (`system-architecture.md §3.7`) — an adapter swap, no domain change | Low–Medium (by design — `ADR-07`, `ADR-T09`) |
| **Kotlin Multiplatform** | Low — it's a compiler target, not a service | Re-implement the core in Rust (wasm + UniFFI); contract corpus guarantees behaviour | Medium (bounded: one pure library) |
| **Cloudflare Pages** | Very low — static bundle | Netlify / any static host in an afternoon | Trivial |
| **GitHub Actions** | Low — YAML workflows | Port to GitLab CI / another runner | Low–Medium |
| **Sentry / Grafana Cloud / Checkly / PostHog** | Low — **OpenTelemetry** is the instrumentation contract; PostHog/Grafana self-hostable | Repoint OTel exporters; self-host PostHog/Grafana | Low |
| **Astro Starlight** | Very low — plain markdown source | MkDocs Material / any SSG | Trivial |
| **Google Play** | High (platform reality) | none (mandatory for Android distribution) | n/a |

**Design principle that makes exits cheap:** the domain (event-sourced match, per-device append-only streams, projections as pure folds, RLS-scoped schema, OpenAPI/JSON-Schema contracts) is **vendor-neutral**. Every vendor sits behind an adapter or a standard interface.

### 5.3 How the stack de-risks the spikes

| Spike | Stack contribution |
|---|---|
| **SPK-01 — DLS licensing** | `RainMethod` is a strategy in the KMP core; `NONE` (manual target) ships by default; no technology choice depends on DLS. Unaffected by this document. |
| **SPK-02 — Event-log & provenance substrate** | **ADR-T09 re-scopes SPK-02** to "prototype the event-log model on PowerSync and pass the chaos + convergence harnesses before MVP build." PowerSync provides the substrate; the custom fallback is fully specified. |
| **SPK-03 — Offline durability on Android** | ADR-T06 + ADR-T09: durable local SQLite persistence is owned by the PowerSync SDK (decade of offline-mobile pedigree); ADR-T12's chaos harness on real devices is the gate. |
| **SPK-04 — Cross-platform rules core** | ADR-T01 (one KMP core) + ADR-T12 (parity corpus, published matrix). The choice is reversible toward Rust. |
| **SPK-05 — Interchange format** | ADR-T07: `SVC-EXPORT-TRANSLATOR` is an anti-corruption layer in the core; JSON-Schema contracts; internal model never conforms to Cricsheet. PDF/CSV satisfy the minimum if Cricsheet slips. |
| **SPK-06 — MCC Laws text permission** | ADR-T14: rules are encoded as logic + citations; the conformance corpus is worked examples, not Law text; help text paraphrased. |

### 5.4 Setup sequence (when the time comes — not now)

For reference only; **this document initialises nothing**. Rough order once build is authorised:
1. Repository + `docs/` site (Starlight) + ADR folder + JSON-Schema registry skeleton.
2. Supabase project-per-environment; schema migrations for the non-derived tables + RLS + pgTAP policy tests.
3. KMP core skeleton with ports; the conformance-corpus harness (empty, wired to CI at 100%-required).
4. PowerSync prototype against `match_events` buckets → run the chaos + convergence harnesses → **SPK-02 decision gate** (proceed on PowerSync, or execute the custom-HTTPS fallback).
5. GitHub Actions pipeline with the gate set from step 3–4.
6. Web (Vite/React/PWA) and Android (Compose) shells consuming the core and the sync SDK.
7. Observability wiring (OTel → Grafana Cloud; Sentry SDKs; the offline-sync canary in Checkly).

### 5.5 Open questions (carried into implementation)

| # | Question | Blocks | Owner |
|---|---|---|---|
| TSQ-1 | Confirm the first market/region (`foundation §11` A2) to pick the primary hosting region. | ADR-T10 | product |
| TSQ-2 | PowerSync: cloud vs self-host at each stage; confirm KMP SDK maturity against our chaos gate. | ADR-T09 | architecture |
| TSQ-3 | Web local store if the custom-sync fallback is taken: Dexie/IndexedDB vs sqlite-wasm/OPFS. | ADR-T06 | architecture + web |
| TSQ-4 | Charts library final pick (visx vs Recharts) after a spike against the `dataviz` guidance and a11y needs. | ADR-T02 | web |
| TSQ-5 | DI on Android: Koin (KMP-aligned) vs Hilt (Android-idiomatic). | ADR-T03 | android |
| TSQ-6 | Observability: stay multi-tool (Sentry+Grafana+Checkly+PostHog) or consolidate on Datadog once budget is known. | ADR-T13 | architecture + ops |
| TSQ-7 | Docs site: Astro Starlight vs MkDocs Material — team preference. | ADR-T14 | team |
| TSQ-8 | Device lab: Firebase Test Lab vs an on-prem target-tier device set for the chaos/perf gates. | ADR-T12 | qa + android |
| TSQ-9 | Carried from SRS §13 / architecture §9: `SPK-01` (DLS), `SPK-05` (Cricsheet), foundation A1/A4/D16/E21. | multiple | product/legal |

---

## 6. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-03 | Initial technology-stack recommendation. §1 evaluation method — eight weighted criteria (Reliability 5, Offline 5, Maintainability 4, Developer productivity 4, AI-assisted dev 4, Performance 3, Long-term scalability 3, Cost 3) derived from foundation objectives, SRS NFRs and `A-14`. §2 summary recommendation table for all 13 categories + a cross-cutting shared-core decision. §3 per-category evaluations with 1–5 scored comparison tables and weighted totals for the close calls (backend, synchronization). §4 fourteen ADRs (ADR-T01…T14) in MADR format — shared core (Kotlin Multiplatform), web (React+TS+Vite PWA), Android (native Kotlin + Compose), backend (Supabase), database (Supabase PostgreSQL), local DB (SQLite via PowerSync / SQLDelight fallback), API (REST/RPC contract-first, OpenAPI+JSON Schema), auth (Supabase GoTrue + RBAC in app tables), synchronization (PowerSync substrate + event-log semantics in the core; custom HTTPS fallback as the SPK-02 gate), hosting (Supabase Cloud + Cloudflare Pages + Google Play + PowerSync Cloud), CI/CD (GitHub Actions), testing (layered — bespoke conformance/parity/chaos/convergence/DLS harnesses + Kotest/Vitest/Playwright/pgTAP/k6), monitoring (Sentry + Grafana Cloud/OTel + Checkly + PostHog), documentation (markdown-in-repo + Astro Starlight + OpenAPI/Scalar + MADR + Mermaid). §5 cost model at three scales, vendor-risk/exit-path table, spike de-risking, setup sequence, nine open questions. Evaluation and decisions only — no code, no scaffolding, nothing initialised. |

