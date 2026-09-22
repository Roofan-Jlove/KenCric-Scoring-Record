# KenCric Scoring Record

An official-standard, **offline-first** digital cricket scoring book for **Web (installable PWA)** and **Android**, backed by a managed cloud backend.

> **Status:** Spec-Driven Development (SDD) phase — this repository currently contains the design corpus only. No application code yet.

## Documentation

All planning and design lives in [`docs/`](docs/). **Start with [`docs/master-specification.md`](docs/master-specification.md)** — it assembles the 18 core documents below into one source of truth across 15 sections and is sufficient on its own to understand the whole system; the remaining rows are downstream artifacts (AI operating docs, task backlog, verification and release-readiness reports) built on top of it. [`docs/README.md`](docs/README.md) is the full per-document index.

| Document | What it is |
|---|---|
| [`docs/master-specification.md`](docs/master-specification.md) | **The source of truth** — assembles all 18 documents below (Product → Domain → Requirements → UX → Architecture → Data → API → Offline/Sync → Security → Testing → Acceptance Criteria → Repository Structure), plus a vertical-slice traceability matrix, a consolidated ADR index, the glossary, and a master open-questions register. |
| [`docs/foundation/product-foundation.md`](docs/foundation/product-foundation.md) | Vision, users, roles, objectives, scope, assumptions, risks, open questions. |
| [`docs/discovery/product-discovery.md`](docs/discovery/product-discovery.md) | Personas, journeys, JTBD, and every requirement set with unique IDs. |
| [`docs/specs/cricket-rules-reference.md`](docs/specs/cricket-rules-reference.md) | Single source of truth for cricket rules (~640 classified requirements). |
| [`docs/domain/glossary.md`](docs/domain/glossary.md) · [`docs/domain/domain-model.md`](docs/domain/domain-model.md) | Ubiquitous language and the formal DDD model. |
| [`docs/specs/software-requirements-specification.md`](docs/specs/software-requirements-specification.md) | Consolidated SRS — `FR / DR / BR / NFR / SEC / OFF / SYNC / AUD` with acceptance criteria. |
| [`docs/roadmap/product-roadmap.md`](docs/roadmap/product-roadmap.md) | Release plan: MVP → Version 1 → Version 2 → Future. |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | Target architecture (4 Layers), from frontend to security boundaries. |
| [`docs/architecture/technology-stack.md`](docs/architecture/technology-stack.md) | Evaluated stack options and an ADR per decision. |
| [`docs/ux/ux-specification.md`](docs/ux/ux-specification.md) | All 28 screens and workflows for Web + Android, with states, offline behavior, and accessibility requirements. |
| [`docs/specs/live-scoring.md`](docs/specs/live-scoring.md) | Deterministic ball-by-ball scoring engine specification — one pipeline covering every legal and illegal delivery, with a conformance-test catalogue. |
| [`docs/architecture/offline-first-specification.md`](docs/architecture/offline-first-specification.md) | Deterministic offline persistence and multi-device sync rules — ownership, queue, protocol, retry, idempotency, conflict resolution, recovery. |
| [`docs/architecture/data-specification.md`](docs/architecture/data-specification.md) | Complete 28-table schema — every field, type, key, constraint, index, and its audit/version/sync/soft-delete treatment. |
| [`docs/architecture/api-specification.md`](docs/architecture/api-specification.md) | Complete API contract — every endpoint, method, schema and error code, each traced to a requirement and a domain capability. |
| [`docs/architecture/security-specification.md`](docs/architecture/security-specification.md) | 76 security requirements with acceptance criteria, a permission matrix, and a STRIDE threat model with a risk register. |
| [`docs/architecture/testing-strategy.md`](docs/architecture/testing-strategy.md) | Complete pre-implementation test strategy across 16 categories, a traceability matrix, and deterministic test-case coverage for every critical cricket rule. |
| [`docs/architecture/acceptance-criteria.md`](docs/architecture/acceptance-criteria.md) | 147 Given/When/Then acceptance criteria across Normal, Boundary, Invalid, Cricket-edge, Offline, Sync, Recovery and Security cases — all objectively checkable. |
| [`docs/architecture/repository-structure.md`](docs/architecture/repository-structure.md) | The proposed repository layout, derived exclusively from the Master Specification — `docs/`, `specs/`, `shared/` (KMP scoring core), `apps/web/`, `apps/android/`, `backend/`, `database/`, `tests/`, `infrastructure/`, `.github/workflows/`, `scripts/` — with the responsibility of every directory explained. No code or scaffolding yet. |
| [`docs/ai-context-pack.md`](docs/ai-context-pack.md) | **Load this first for any AI coding session.** Condensed, rule-form version of the whole corpus — Project Constitution, Product Brief, Domain Glossary, Architecture/Coding/Naming/Security/Testing/Git/Documentation rules, Forbidden Assumptions, Decision Records, and a full Requirement-ID legend. |
| [`docs/ai-development-harness.md`](docs/ai-development-harness.md) | The repeatable AI workflow — Context → Prompt → Plan → Implement → Test → Verify → Review → Update Context — with prompt templates, a task schema, verification checks, human approval gates, a regression process, and the guarantee that an AI session never silently changes an approved requirement. Also defines the continuous post-release loop (Observe → Collect Feedback → Describe → Decompose → Specify → Plan → Implement → Test → Verify → Release → Observe), the per-change checklist, and twenty standing enforcement rules. |
| [`docs/implementation-task-backlog.md`](docs/implementation-task-backlog.md) | The Master Specification broken into small, dependency-ordered, implementation-ready tasks — 38 tasks fully decomposing the MVP-critical foundation, plus a worked vertical slice and a generation rule for the rest. No implementation. |
| [`docs/architecture/adversarial-verification-report.md`](docs/architecture/adversarial-verification-report.md) | Three adversarial-verification passes (scoring engine, offline-first behavior, security) run against the specification itself, ahead of any implementation — 21 findings with reproducible test cases, none yet fixed. |
| [`docs/release-readiness-assessment.md`](docs/release-readiness-assessment.md) | Sixteen-area release-readiness checklist, blocking/non-blocking issues, known limitations, final risk assessment, and an explicit **NO-GO** recommendation. |
| [`docs/architecture/deployment-plan.md`](docs/architecture/deployment-plan.md) | Production deployment plan — environments, infrastructure, DB/API/Web/Android deployment, configuration, secrets, monitoring, backup, disaster recovery, incident response, deployment procedure, verification checklist, and the corpus's first rollback specification. No deployment performed. |

## Core principles

- **Offline-first** — the entire scoring workflow, setup to sign-off, works with zero connectivity.
- **Event-sourced** — a match *is* its ordered, append-only stream of events; scorecards are disposable projections; corrections are superseding events, never destructive edits.
- **Law-accurate** — MCC Laws of Cricket + ICC Standard Playing Conditions as configuration, verified by a conformance suite.
- **Auditable** — every write is attributed; the record is tamper-evident and reconstructable.
- **Deterministic sync** — the same events yield the same result regardless of arrival order; conflicts are surfaced, never resolved by last-write-wins.

## License

Not yet determined.
