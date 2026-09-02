# KenCric Scoring Record — Documentation

Spec-Driven Development (SDD) documents for the **Cricket Scoring Book** project.

| Document | Path | Version | Purpose |
|---|---|---|---|
| **Project Foundation** | [`foundation/product-foundation.md`](foundation/product-foundation.md) | 0.1.0 | 4Ds *Describe* / Product layer — vision, problem, users, roles, objectives, scope, success criteria, assumptions, risks, open questions. |
| **Product Discovery** | [`discovery/product-discovery.md`](discovery/product-discovery.md) | 0.1.0 | 4Ds *Describe → Decompose → Develop → Deliver* — personas, journeys, JTBD, user stories, and all requirement sets (FR / NFR / BR / CSR / ONR / OFR / WEB / AND / ADM / SCR / CTR / VWR) with unique IDs. |
| **Domain Specification** | [`specs/cricket-rules-reference.md`](specs/cricket-rules-reference.md) | 0.1.0 | Single source of truth for cricket rules — ~640 classified requirements (`[LAW]` / `[PRD]` / `[CFG]` / `[EDGE]`) across 34 domain areas. Every feature spec defers to its IDs. |
| **Domain Glossary** | [`domain/glossary.md`](domain/glossary.md) | 0.1.0 | Ubiquitous language — every term used in the model, specs, code and tests, with its model carrier. |
| **Formal Domain Model** | [`domain/domain-model.md`](domain/domain-model.md) | 0.1.0 | DDD model derived from the Domain Specification — bounded contexts, aggregates, entities, value objects, relationships, state machines, invariants (`MINV-*`), business rules (`MBR-*`), ~70 events, ~55 commands, ~20 queries, 13 domain services, full traceability. |
| **Software Requirements Specification** | [`specs/software-requirements-specification.md`](specs/software-requirements-specification.md) | 0.1.0 | Consolidated SRS derived from Foundation + Discovery + Domain — `FR` (168), `DR` (36), `BR` (34), `NFR` (45), `SEC` (18), `OFF` (22), `SYNC` (16), `AUD` (15), each with Description / Rationale / Priority / Dependencies / Trace / Acceptance criteria; assumptions isolated as `A-01…A-27`; full traceability to `OBJ-01…11` and every discovery ID. Requirements only — no design or code. |
| **Product Roadmap** | [`roadmap/product-roadmap.md`](roadmap/product-roadmap.md) | 0.1.0 | Release plan derived from Foundation + Discovery — feature map (areas A–P), feature dependencies, MVP boundary with an end-to-end workflow completeness proof, release roadmap (MVP / Version 1 / Version 2 / Future, mapped to P1–P3 and Alpha–Post-GA), risk register, and per-release acceptance criteria. Planning only — no code or design. |
| **System Architecture** | [`architecture/system-architecture.md`](architecture/system-architecture.md) | 0.1.0 | Target architecture for the Web PWA + Android app + managed backend, applying the 4 Layers (Product / Domain / System / Implementation). Defines frontend, Android, backend, database, offline storage, sync, authentication, authorization, API, event, audit, observability, backup/recovery and security-boundary architecture; C4 context + container diagrams; runtime flows; ADR log; spike impact. Design only — no production code. |
| **Technology Stack** | [`architecture/technology-stack.md`](architecture/technology-stack.md) | 0.1.0 | Recommended stack for all 13 categories (web frontend, Android, backend, database, local DB, API, auth, sync, hosting, CI/CD, testing, monitoring, documentation), each evaluated against 8 weighted criteria (reliability, offline, maintainability, performance, developer productivity, AI-assisted dev, scalability, cost), with 14 full ADRs (ADR-T01…T14), a 3-scale cost model, and vendor exit paths. Evaluation and decisions only — nothing initialised. |

## Reading order

1. Foundation — *what problem, for whom, and why*.
2. Discovery — *who the users are and every requirement, uniquely identified*.
3. Domain Specification — *what is true in the cricket domain and what the scoring record must contain*.
4. Domain Glossary + Formal Domain Model — *as what objects, with what identity, state, and behaviour*.
5. Software Requirements Specification — *every requirement consolidated, prioritised, traced, and given acceptance criteria*.
6. Product Roadmap — *what ships when: MVP → Version 1 → Version 2 → Future*.
7. System Architecture — *how it is built: the 4 Layers, and every architecture area from frontend to security boundaries*.
8. Technology Stack — *what it is built with: evaluated options and an ADR per decision*.

## Status

All are **v0.1.0 drafts for review**. Blocking items before spec build:

- **SPK-01** — DLS licensing / IP (blocks the DLS sections; fallback = manual targets only).
- **SPK-05** — confirm Cricsheet-compatible interchange format.
- Foundation clarification questions **A1, A2, B5–B8, D16, E21, E22**.
- Accredited-scorer ratification pass over every `[LAW]` / `[EDGE]` item in the Domain Specification.

## Planned additions (`docs/specs/`, `docs/architecture/`)

Per `discovery/product-discovery.md` §3.3: `match-setup.md`, `squads-and-lineups.md`, `live-scoring.md`, `innings-and-match-state.md`, `dls-and-reduced-overs.md`, `tie-breakers.md`, `corrections-audit-signoff.md`, `scorecards-and-analytics.md`, `sharing-notifications-viewer.md`, `data-portability.md`, `administration.md`, `nfrs-and-quality-gates.md`.

`architecture/system-architecture.md` is the umbrella architecture and `architecture/technology-stack.md` records the stack decisions. Component drill-downs still to be written under `architecture/`: `supabase-schema.md`, `realtime-sync.md`, `offline-first-strategy.md`, `state-management.md`, `api-contracts.md`, and `architecture/adr/` (full ADRs — pattern ADR-01…11 from the architecture doc, technology ADR-T01…T14 from the stack doc).
