# KenCric Scoring Record

An official-standard, **offline-first** digital cricket scoring book for **Web (installable PWA)** and **Android**, backed by a managed cloud backend.

> **Status:** Spec-Driven Development (SDD) phase — this repository currently contains the design corpus only. No application code yet.

## Documentation

All planning and design lives in [`docs/`](docs/). Start with [`docs/README.md`](docs/README.md).

| Document | What it is |
|---|---|
| [`docs/foundation/product-foundation.md`](docs/foundation/product-foundation.md) | Vision, users, roles, objectives, scope, assumptions, risks, open questions. |
| [`docs/discovery/product-discovery.md`](docs/discovery/product-discovery.md) | Personas, journeys, JTBD, and every requirement set with unique IDs. |
| [`docs/specs/cricket-rules-reference.md`](docs/specs/cricket-rules-reference.md) | Single source of truth for cricket rules (~640 classified requirements). |
| [`docs/domain/glossary.md`](docs/domain/glossary.md) · [`docs/domain/domain-model.md`](docs/domain/domain-model.md) | Ubiquitous language and the formal DDD model. |
| [`docs/specs/software-requirements-specification.md`](docs/specs/software-requirements-specification.md) | Consolidated SRS — `FR / DR / BR / NFR / SEC / OFF / SYNC / AUD` with acceptance criteria. |
| [`docs/roadmap/product-roadmap.md`](docs/roadmap/product-roadmap.md) | Release plan: MVP → Version 1 → Version 2 → Future. |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | Target architecture (4 Layers), from frontend to security boundaries. |
| [`docs/architecture/technology-stack.md`](docs/architecture/technology-stack.md) | Evaluated stack options and an ADR per decision. |

## Core principles

- **Offline-first** — the entire scoring workflow, setup to sign-off, works with zero connectivity.
- **Event-sourced** — a match *is* its ordered, append-only stream of events; scorecards are disposable projections; corrections are superseding events, never destructive edits.
- **Law-accurate** — MCC Laws of Cricket + ICC Standard Playing Conditions as configuration, verified by a conformance suite.
- **Auditable** — every write is attributed; the record is tamper-evident and reconstructable.
- **Deterministic sync** — the same events yield the same result regardless of arrival order; conflicts are surfaced, never resolved by last-write-wins.

## License

Not yet determined.
