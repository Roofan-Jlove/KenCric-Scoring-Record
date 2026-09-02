# Cricket Scoring Book — Software Requirements Specification (SRS)

| | |
|---|---|
| **Document** | Software Requirements Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-02 |
| **Upstream** | `docs/foundation/product-foundation.md` v0.1.0 · `docs/discovery/product-discovery.md` v0.1.0 · `docs/specs/cricket-rules-reference.md` v0.1.0 · `docs/domain/domain-model.md` v0.1.0 · `docs/domain/glossary.md` v0.1.0 |
| **Downstream** | `docs/specs/*` feature specs · `docs/architecture/*` · `docs/roadmap/product-roadmap.md` |
| **Status** | Consolidation of the approved discovery, domain, and foundation documents. **Requirements specification only — no design, no code, no implementation.** |

---

## 1. Introduction

### 1.1 Purpose

This SRS consolidates every approved requirement for the **Cricket Scoring Book** (project "KenCric Scoring Record") into one traceable specification. It is the single reference from which feature specs (`docs/specs/*`), architecture (`docs/architecture/*`), the roadmap, test suites, and verification gates derive.

It restates — it does not replace — the upstream documents. Where the upstream documents disagree, the **cricket-rules reference** wins on cricket semantics, the **domain model** wins on structure and identity, the **foundation** wins on scope and objectives, and the **discovery** document wins on feature behaviour.

### 1.2 Scope

**In scope:** an official-standard, offline-first digital cricket scoring book for **Web (installable PWA)** and **Android**, covering limited-overs match setup, ball-by-ball scoring for every lawful event and dismissal, innings and match-state management, reduced-overs / DLS handling, tie-breakers, corrections, reconciliation, sign-off, scorecards and analytics outputs, data export/portability, sharing to read-only viewers, multi-tenant organizations with role-based access, and (post-pilot) dual-scorer reconciliation, competitions/standings, and player profiles.

**Out of scope** (per `foundation §7`): automated ball-tracking / Hawk-Eye, video streaming, official DRS technology, betting/fantasy, AI commentary generation, a full club-administration suite, native iOS for v1, wearables, spectator social features, multi-sport support, a historical-stats encyclopedia, proprietary rain methods beyond DLS Standard Edition (pluggable interface only), server-less P2P LAN sync, and dedicated hardware consoles.

### 1.3 Definitions, acronyms & abbreviations

Ubiquitous-language terms (Match, Innings, Over, Delivery, Extra, Wicket, Free hit, Target, Result, Par score, Divergence, Provenance, Sign-off, …) are defined in `docs/domain/glossary.md` and used here with those exact meanings.

| Term | Meaning |
|---|---|
| **MCC Laws** | MCC Laws of Cricket (current code + updates) — the authoritative rule base. |
| **ICC SPC** | ICC Standard Playing Conditions — format-level overlay on the Laws. |
| **DLS** | Duckworth–Lewis–Stern method (Standard Edition) for revised targets after interruptions. |
| **PWA** | Progressive Web App — the installable, offline-capable web client. |
| **RBAC** | Role-based access control (additive; every write attributed and audit-logged). |
| **RLS** | Row-level security (data-layer authorization on the managed backend). |
| **Projection** | A disposable read model (scorecard, cards, FoW, partnerships, run-rate, DLS ladder) recomputed from the event stream. |
| **P1 / P2 / P3** | Delivery phase: P1 = pilot/MVP, P2 = post-pilot, P3 = later. |
| **MoSCoW** | Priority: Must / Should / Could / Won't-yet. |

### 1.4 References

| # | Document | Role in this SRS |
|---|---|---|
| R1 | `docs/foundation/product-foundation.md` v0.1.0 | Vision, users, roles, objectives `OBJ-01…11`, scope, success criteria, assumptions (§9), risks (§10), clarification questions (§11). |
| R2 | `docs/discovery/product-discovery.md` v0.1.0 | Personas, JTBD, journeys; `FR-`, `NFR-`, `BR-`, `CSR-`, `ONR-`, `OFR-`, `WEB-`, `AND-`, `ADM-`, `SCR-`, `CTR-`, `VWR-` requirement sets; prioritisation; spikes `SPK-01…06`; new questions `Q-D1…D6`. |
| R3 | `docs/specs/cricket-rules-reference.md` v0.1.0 | Single source of truth for cricket rules — ~640 classified requirements across 37 areas; invariants `INV-001…018`; configuration registry `CFG-REG`. |
| R4 | `docs/domain/domain-model.md` v0.1.0 | Bounded contexts, aggregates, entities, value objects, state machines, invariants `MINV-01…18`, model business rules `MBR-01…12`, ~70 events `EVT-*`, ~55 commands `CMD-*`, ~20 queries `QRY-*`, 13 domain services `SVC-*`. |
| R5 | `docs/domain/glossary.md` v0.1.0 | Ubiquitous language and each term's model carrier. |
| R6 | `docs/roadmap/product-roadmap.md` v0.1.0 | Release buckets (MVP / V1 / V2 / Future) and gates; downstream of this SRS. |

### 1.5 Document conventions

**Requirement identifier schemes** (each ID is unique and stable within its scheme):

| Prefix | Requirement class | SRS section |
|---|---|---|
| `FR-XXX` | Functional requirement | §4 |
| `DR-XXX` | Domain rule (cricket-law / scoring semantics) | §5 |
| `BR-XXX` | Business rule (ownership, lifecycle, integrity policy) | §6 |
| `NFR-XXX` | Non-functional requirement (quality attribute) | §7 |
| `SEC-XXX` | Security requirement | §8 |
| `OFF-XXX` | Offline requirement | §9 |
| `SYNC-XXX` | Synchronization requirement | §10 |
| `AUD-XXX` | Audit requirement | §11 |

**Every requirement in §4–§11 carries the same six attributes**, in this order:

- **Description** — what the system shall do, RFC-2119 keywords (**shall** / **should** / **may**; "must not" / "shall not" for prohibitions).
- **Rationale** — why it exists, with the driving foundation objective(s) `OBJ-01…11`.
- **Priority** — `MoSCoW · Phase`, e.g. `Must · P1`. Taken from the source requirement; where sources differ or a consolidation spans priorities, the **highest** priority and **earliest** phase among the merged items is used and the split is noted.
- **Dependencies** — other SRS requirement IDs this one needs in place. "—" means none.
- **Trace** — the originating upstream IDs (R2 discovery IDs, R3 cricket-rules area IDs, R4 model `EVT/CMD/ENT/INV/MINV/MBR/SVC` IDs, R1 `OBJ`/risk IDs). **`(consolidated)`** marks a requirement synthesised from several upstream IDs; **`(derived)`** marks a requirement inferred to make an upstream intent enforceable — its basis IDs are always listed. No requirement appears without a Trace.
- **Acceptance criteria** — 2–4 checks in Given / When / Then form. These are release-gate checks, not a test script; per-feature specs expand them.

**No requirement is invented silently.** Section §4–§11 requirements are either a restatement of an upstream requirement, a labelled `(consolidated)` merge of several, or a labelled `(derived)` requirement whose basis is cited. Anything with no upstream basis is not a requirement — it is an **assumption** and lives in §3, or an **open issue** and lives in §13.

**Assumptions are isolated.** §3 is the only place assumptions live. No "assuming X…" clauses are buried in §4–§11; where a requirement depends on an unresolved question, it cites the relevant `A-##` assumption or `SPK-0#` spike in its Trace or Dependencies.

**Priority / phase reference** (`R1 §6`, `R2 §3.1`): a requirement is **P1** only if a real club cannot score and file an official limited-overs match without it. **P2** = post-pilot hardening, dual-scorer, competitions, profiles, connected ecosystem. **P3** = multi-day cricket, advanced analytics, deep integrations.

---

## 2. Overall Description

### 2.1 Product perspective

A new, self-contained product — not a component of a larger system. Two client applications (Web PWA, Android) present an identical **scoring core** whose behaviour is contract-tested for parity (`NFR-047/048`, `SPK-04`). A managed cloud backend (Postgres + Auth + Realtime + Row-Level Security; Supabase per `R1 §9`, subject to `A-09`) provides accounts, tenancy, sync, sharing, realtime viewer fan-out, and server-side competition/profile computation. **Connectivity is never on the critical path for scoring** (`OBJ-02`): the clients are offline-first and the backend is an eventual destination, not a dependency.

The domain is modelled as an **event-sourced match** (`R4`): the match *is* its ordered, append-only stream of domain events; all scorecards, cards, partnerships, fall-of-wickets, run-rate and DLS ladders are disposable projections; corrections are new superseding events, never destructive edits.

### 2.2 User classes and characteristics

From `R1 §3–§4` (12 additive RBAC roles) and `R2 §1.1` (personas `PER-01…13`):

| User class | Characteristics | Primary needs |
|---|---|---|
| **Club/league volunteer scorer** (`PER-01`) | Basic cricket literacy; scores solo from an offline scorebox on a mid-range Android phone, one-handed, standing. | Fast entry, no signal required, never lose work, reconcile first time, email the card the same evening. |
| **Accredited / professional scorer** (`PER-02`) | Association-standard precision; laptop + phone; paired and multi-day matches. | Dual-scorer reconciliation, in-app DLS, defensible audit trail, clean league export. |
| **Assistant / co-scorer** (`PER-03`) | Second independent record for integrity. | Stay in sync, catch divergences within an over, contribute corrections without overwriting. |
| **Competition / league organizer** (`PER-04`) | Runs a season; sets playing conditions; publishes fixtures/tables. | Consistent rules, automatic standings/NRR, dispute trail, low admin. |
| **Team manager / captain** (`PER-05`) | Submits XI; verifies results. | Fast XI submission, one-tap result confirm/dispute, squad form. |
| **Analyst / coach** (`PER-06`) | Season-long analysis. | Ball-by-ball data in an open format, clean export. |
| **Player** (`PER-07`) | Wants a verified personal record. | Claim appearances, career aggregates, milestones. |
| **Umpire** (`PER-08`) | Cross-checks state at intervals. | Quick read of over/score/DLS par; confirm result. |
| **Commentator / media** (`PER-09`) | Club-stream commentary and reports. | Near-real-time card, per-ball commentary, exportable card. |
| **Organization admin** (`PER-10`) | Onboards a club; maintains the registry. | Clean deduped roster, correct roles, branding on cards. |
| **Platform administrator** (`PER-11`) | Internal operations. | Tenant management, feature flags, staged rollout, consented support impersonation, health monitoring. |
| **Fan / parent spectator** (`PER-12`) | Follows via a shared link. | No install, no account, near-real-time card, offline indicator. |
| **Statistician / developer** (`PER-13`) | Consumes data programmatically. | Stable IDs, documented read API, Cricsheet-compatible export. |

### 2.3 Operating environment

- **Android client:** Android 10+ on mid-range hardware; phone screens small→large; basic tablet; portrait one-handed scoring layout (`NFR-044`, `AND-001…024`).
- **Web client:** current evergreen browsers on desktop, laptop, tablet, Chromebook; installable PWA with offline scoring; landscape "scorebox" layout; keyboard-first input (`NFR-045/046`, `WEB-001…022`).
- **Connectivity:** grounds are frequently offline or on patchy 3G; the app must assume "offline" is the normal case (`A-01`).
- **Backend:** managed cloud Postgres with Auth, Realtime, and RLS (`A-09`); web offline store is IndexedDB; Android has a local database with background sync.
- **Time:** one time zone per match; matches may span multiple days (`A-11`).

### 2.4 Design and implementation constraints

| # | Constraint | Source |
|---|---|---|
| C-1 | Authoritative rules = MCC Laws (current code) + ICC Standard Playing Conditions; competition variations are **configuration**, not forks. | `A-05`, `R3 §0.4`, `CFG-REG` |
| C-2 | DLS Standard Edition only; method is pluggable; use is subject to a licence/permission decision (`SPK-01`); if not cleared, the fallback is manual-target entry only. | `A-06`, `NFR-034`, `SPK-01` |
| C-3 | Laws / DLS text is implemented as logic and **cited, not reproduced verbatim** without MCC permission (`SPK-06`). | `A-07`, `NFR-035` |
| C-4 | Interchange format is Cricsheet-compatible JSON/YAML; lossy fields must be enumerated (`SPK-05`). | `A-08`, `NFR-050…052` |
| C-5 | Offline-first is a hard requirement: no connectivity is required for any part of scoring from setup to sign-off. | `A-01`, `OBJ-02`, `NFR-012` |
| C-6 | Event log is append-only and per-device sequenced, and must support P1 corrections **and** P2 deterministic merge / dual-scorer without a rewrite (`SPK-02`). | `R4 MINV-01/03`, `SPK-02` |
| C-7 | Scoring-core behaviour is identical across Web and Android for identical inputs, verified by contract tests (`SPK-04`). | `NFR-047/048` |
| C-8 | Match records are low-sensitivity but high-integrity: tamper-resistance and attribution outrank confidentiality. | `A-10` |
| C-9 | Personal-data collection is minimised; scoring works with names only; minors' data needs special handling. | `A-15`, `NFR-031/033` |
| C-10 | English-first at launch, with a localization-ready structure. | `A-13`, `NFR-057…059` |
| C-11 | Small team; rigorous delivery depends on **phased scope** (P1→P2→P3). | `A-14` |

### 2.5 Assumptions and dependencies

All assumptions are in **§3**. External dependencies: the managed backend platform (`A-09`); a DLS licensing/permission decision (`SPK-01`); MCC text permission (`SPK-06`); the Cricsheet interchange target (`SPK-05`); Google Play distribution; a set of pilot clubs/leagues and a season window (`R1 §11` F25).

### 2.6 Phasing overview

| Phase | Contents | Roadmap bucket (R6) |
|---|---|---|
| **P1** | Guest + accounts + org/RBAC; custom limited-overs setup; full ball-by-ball scoring; innings/state; reduced overs + DLS (or manual fallback); Super Over; corrections + reconciliation + single sign-off; scorecards + standard charts; PDF/CSV + Cricsheet export + local backup; shareable read-only viewer; offline-first; conformance suite. | MVP + Version 1 |
| **P2** | Dual-scorer reconciliation; deterministic sync; competitions/fixtures/standings/NRR; player profiles + claims + aggregates; notifications/push; import + read/realtime API; counter-signature; registry merge; wagon wheel. | Version 2 |
| **P3** | Multi-day / first-class (declaration, follow-on, forfeiture, sessions); advanced analytics (pitch maps, records, deep head-to-head); knockout brackets; deeper integrations; alternative rain methods; impact player. | Future |

---

## 3. Assumptions (identified separately)

These are **assumptions, not requirements**. Each is currently taken as true; if it proves false, the listed requirements and buckets are affected. `A-01…A-15` are the foundation's major assumptions (`R1 §9`) verbatim in intent; `A-16…A-27` are assumptions this SRS must make explicit because an upstream requirement depends on an unresolved spike (`SPK-*`) or clarification question (`R1 §11`, `R2 §3.5`).

| ID | Assumption | Impact if false | Owner / resolution path |
|---|---|---|---|
| **A-01** | Connectivity at grounds is unreliable or absent; **offline-first is a hard requirement**. | Whole architecture premise changes; `OFF-*`, `NFR-009…015` re-scoped. | Confirmed by personas; no action. |
| **A-02** | Scorers have basic cricket literacy; the app assists and enforces the Laws but does not teach from zero. | Onboarding scope expands; `NFR-040/041` targets unrealistic. | Product; validate in pilot usability sessions. |
| **A-03** | Dual scoring = two people, two devices/accounts, one logical match — not two cursors on one device. | `FR-113…120`, `SYNC-*`, `I` area redesigned. | Product; confirm with accredited scorers (`Q-D`/`B7`). |
| **A-04** | Android target is Android 10+ mid-range; web target is evergreen browsers with a keyboard. | `NFR-044/045`, client requirements re-scoped. | Product; confirm device/browser matrix pre-pilot. |
| **A-05** | Authoritative rule base = MCC Laws (current code) + ICC Standard Playing Conditions; competition variations are configuration. | `DR-*` and `CFG-REG` model change from config to forks. | product-spec + accredited scorer ratification. |
| **A-06** | DLS Standard Edition (publicly documented) is acceptable for v1; Professional Edition and alternatives are out unless licensed. **Requires legal confirmation.** | `FR` DLS set (`DR-40`, F-area FRs) drops to manual-target only; `NFR-034` unmet. | **SPK-01** — product/legal; needed before Version 1 DLS build. |
| **A-07** | Reproducing Laws/DLS text verbatim may need MCC permission; encoding rules as logic and citing is acceptable. | In-app help/rule text must be fully paraphrased; `NFR-035` rework. | **SPK-06** — product/legal. |
| **A-08** | A Cricsheet-compatible JSON/YAML target is an acceptable interchange standard. | `FR` export/import set and `NFR-050…052` re-targeted; adapter layer needed sooner. | **SPK-05** — product-spec. |
| **A-09** | Backend is a managed cloud Postgres platform with Auth, RLS, and Realtime (Supabase). | `SEC-*` data-layer requirements, sync design, and ops requirements re-scoped. | `R1 §11` D16 — confirm. |
| **A-10** | Match records are low-sensitivity, high-integrity: tamper-resistance and attribution matter more than confidentiality. | `SEC-*` emphasis shifts toward confidentiality controls. | Product; confirm with pilot leagues. |
| **A-11** | One time zone per match; matches may span multiple days. | `FR-024`, `NFR-059`, multi-day state model change. | Product; confirmed for limited-overs. |
| **A-12** | Users will create accounts for cloud/sharing features; anonymous local-only scoring is permitted. | `FR-001`/guest model or `A` area re-scoped. | `R1 §11` C12 — assumed yes. |
| **A-13** | English-first is acceptable for v1 with a localization-ready structure. | `NFR-057…059`, `FR` locale set pulled earlier. | Product; confirm first geography (`R1 §11` A2). |
| **A-14** | A small team using AI-assisted SDD can deliver a rigorous domain build **if scope is phased**. | Phase gates and bucket contents (R6) must shrink. | Delivery; revisit each phase gate. |
| **A-15** | Minors participate; player-profile features must be designed with child-data protection (GDPR-K / COPPA-style) in mind. | `FR-013`, `NFR-033`, profile visibility rework. | Legal review before Version 2 profiles. |
| **A-16** | The append-only, per-device-sequenced event log proven in `SPK-02` supports P1 corrections **and** P2 deterministic merge without a rewrite. | `FR` corrections model and all `SYNC-*` require rework; Version 2 becomes a rewrite. | **SPK-02** — architecture; before MVP build. |
| **A-17** | Write-ahead persistence + crash recovery can meet the chaos-test definition on target-tier Android hardware. | `NFR-009…011`, `OFF-003/004` unmet; MVP cannot exit. | **SPK-03** — architecture + android. |
| **A-18** | Identical scoring behaviour across Web + Android is achievable via the chosen shared-core approach. | `NFR-047/048` unmet; parity slips; possible single-platform pilot. | **SPK-04** — architecture. |
| **A-19** | Manual-target entry is an acceptable "official record" path for pilot leagues while `SPK-01` is open. | Version 1 blocked on `SPK-01` rather than able to ship a fallback. | Product + pilot leagues (`R1 §11` B6). |
| **A-20** | A native Super Over workflow is not required for the very first shippable; a manually-scored Super Over is acceptable for Alpha. | `FR` Super Over set moves from Version 1 to MVP. | `Q-D1` — product. |
| **A-21** | Single Head-Scorer sign-off is sufficient for a pilot match to be "official"; counter-signature is Version 2. | `FR-107` pulled to P1; sign-off flow rework. | `Q-D3` — product + pilot leagues. |
| **A-22** | Manhattan / worm / run-rate charts are sufficient analytics for the pilot; wagon wheels are not day-one. | `FR` analytics set re-prioritised; wagon wheel pulled to P1. | `Q-D4` — product. |
| **A-23** | A shareable read-only link is sufficient for the pilot; result notifications are Version 2. | `FR` notification set pulled to P1. | `Q-D6` — product. |
| **A-24** | For P1 single matches with no competition, teams/players may be created lightweight per-match (no org required first). | `FR-030/033/034` and guest model re-scoped. | `Q-D2` — product-spec. |
| **A-25** | Pilot leagues do not mandate a results/export format beyond Cricsheet + PDF/CSV. | An extra export adapter becomes P1. | `Q-D5` — product. |
| **A-26** | Umpire and Commentator are light / Phase-2 roles for v1. | `R1 §4` role set and `FR-025` re-scoped. | `R1 §11` C13 — assumed. |
| **A-27** | Limited-overs only for v1; multi-day/first-class is P3 and must not complicate P1 state modelling. | `SM-MATCH`, `FR` innings/state set, and DR areas `DECL`/`FLW` re-scoped into P1. | `R1 §11` B5 — assumed. |

---

## 4. Functional Requirements

Grouped A–Q. Each `FR-XXX` consolidates one or more discovery `FR-`/`SCR-`/`CTR-`/`VWR-`/`ADM-`/`ONR-` items (cited in **Trace**). Discovery `FR-001…190` and the client/role requirement sets map into `FR-001…FR-168` here; some discovery FRs also land in §5 (`DR-`), §6 (`BR-`), §9 (`OFF-`), §10 (`SYNC-`) or §11 (`AUD-`). The mapping is exhaustive — see §12.2.

### 4.A Identity, Accounts & Tenancy

#### FR-001 — Anonymous device-local scoring
- **Description:** The system **shall** allow a user to create, configure, score, correct, reconcile and sign off a complete match entirely on-device with no sign-up and no network.
- **Rationale:** Volunteer scorers must start instantly in an offline scorebox; account friction loses users. (`OBJ-02`, `OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** OFF-001, OFF-002, OFF-013
- **Trace:** discovery FR-001; OFR-013; `MBR-02`; `MINV-15`
- **Acceptance:**
  - Given a fresh install with no account, when the user starts a match offline, then all scoring, correction and sign-off functions are available.
  - Given a guest match, when the user has never signed in, then the match is never shared, synced, or attached to a competition (see BR-022).

#### FR-002 — Account creation, sign-in and credential lifecycle
- **Description:** The system **shall** support email-based account creation, sign-in, password reset, and session revocation.
- **Rationale:** Cloud sync, sharing, tenancy and attribution require an identity. (`OBJ-10`)
- **Priority:** Must · P1
- **Dependencies:** SEC-001, SEC-002
- **Trace:** discovery FR-002, FR-012; ONR-008 *(consolidated)*
- **Acceptance:**
  - Given valid credentials, when the user signs in, then an authenticated session is established and attributable to that user.
  - Given a password-reset request, when completed, then all prior sessions can be revoked.

#### FR-003 — Cached offline session
- **Description:** The system **shall** cache an authenticated session on-device and permit role-permitted use for a configurable grace period without connectivity.
- **Rationale:** A scorer signs in at home and must stay signed in all match day with no signal. (`OBJ-02`)
- **Priority:** Must · P1
- **Dependencies:** FR-002, OFF-020
- **Trace:** discovery FR-003; OFR-020; AND-022; WEB-019 *(consolidated)*
- **Acceptance:**
  - Given a session established online, when the device is offline within the grace period, then all role-permitted actions remain available.
  - Given the grace period has elapsed, when offline, then guest-mode scoring still works and cloud actions queue until re-auth.

#### FR-004 — Claim a guest match
- **Description:** A signed-in user **shall** be able to upload/claim a previously local guest match; claiming adds an owner/organization and may resolve local team/player placeholders without rewriting history.
- **Rationale:** Work started offline as a guest must become a first-class owned record. (`OBJ-09`)
- **Priority:** Must · P1
- **Dependencies:** FR-001, FR-002, FR-005, SYNC-001
- **Trace:** discovery FR-004; BR-022; `EVT-GUEST-MATCH-CLAIMED`; `CMD-CLAIM-GUEST-MATCH`; `MBR-02`
- **Acceptance:**
  - Given a guest match, when claimed, then its MatchId, timeline and provenance are unchanged and an ownership link is added.
  - Given claim resolves a local team to a registered team, when applied, then it is recorded as an event, not an in-place edit.

#### FR-005 — Organizations (tenants)
- **Description:** The system **shall** support organizations that own teams, competitions and matches, with data isolation between organizations.
- **Rationale:** Clubs and leagues are the unit of tenancy and billing. (`OBJ-10`)
- **Priority:** Must · P1
- **Dependencies:** SEC-005
- **Trace:** discovery FR-005; BR-001; `AGG-ORGANIZATION`
- **Acceptance:**
  - Given a match owned by organization X, when a member of organization Y requests it, then access is denied at the data layer.
  - Given an organization, when it is created, then it can own teams, competitions and matches.

#### FR-006 — Multi-organization membership
- **Description:** A user **shall** be able to belong to multiple organizations, each with an independent role set.
- **Rationale:** People score for several clubs/leagues. (`OBJ-10`)
- **Priority:** Must · P1
- **Dependencies:** FR-005, FR-007
- **Trace:** discovery FR-006
- **Acceptance:**
  - Given a user in organizations A and B, when acting in A, then only A's roles apply.

#### FR-007 — Role assignment and revocation
- **Description:** The system **shall** let an authorised organization role assign and revoke the additive RBAC roles of `R1 §4` for members.
- **Rationale:** Access is role-based and every write is attributed. (`OBJ-10`, `OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-005, SEC-005
- **Trace:** discovery FR-007; ADM-002…006; `SVC-AUTHORIZER`
- **Acceptance:**
  - Given an admin revokes a member's Scorer role, when that member next attempts a delivery write, then it is refused.
  - Given a role change, when applied, then it is recorded with actor and timestamp.

#### FR-008 — Email invitations
- **Description:** The system **should** support email invitations carrying a pre-assigned role and an expiry.
- **Rationale:** Low-friction onboarding of scorers and captains. (`OBJ-10`)
- **Priority:** Should · P1
- **Dependencies:** FR-002, FR-007
- **Trace:** discovery FR-008; ONR-015
- **Acceptance:**
  - Given an invitation with role Scorer and a 7-day expiry, when accepted in time, then the account joins with that role.
  - Given an expired invitation, when opened, then it is rejected.

#### FR-009 — Member deactivation preserves authorship
- **Description:** The system **shall** allow deactivation of a member such that they can take no new action but retain authorship of all past events.
- **Rationale:** People leave clubs; the historical record must stay attributable. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-007, AUD-002
- **Trace:** discovery FR-009; BR-024
- **Acceptance:**
  - Given a deactivated member, when they attempt any write, then it is refused.
  - Given past events they authored, when the audit view is opened, then their authorship is still shown.

#### FR-010 — Personal data export
- **Description:** A user **shall** be able to export all of their personal data in a portable format.
- **Rationale:** Data-protection compliance and data ownership. (`OBJ-09`)
- **Priority:** Must · P1
- **Dependencies:** FR-002
- **Trace:** discovery FR-010; NFR-032; ONR-014
- **Acceptance:**
  - Given a user request, when processed, then a machine-readable export of their personal data is produced.

#### FR-011 — Account deletion with defined record handling
- **Description:** A user **shall** be able to delete their account; FINAL match records are retained and the actor is anonymised in the audit trail per the retention policy.
- **Rationale:** Right to erasure without destroying official match history. (`OBJ-09`)
- **Priority:** Must · P1
- **Dependencies:** FR-010, AUD-002, BR-025
- **Trace:** discovery FR-011; BR-025; NFR-032
- **Acceptance:**
  - Given account deletion, when completed, then FINAL matches the user scored still exist and reconcile.
  - Given deletion, when the audit trail is viewed, then the actor appears anonymised, not removed.

#### FR-012 — Actor attribution on every write
- **Description:** The system **shall** record the identity of the acting user for every state-changing action.
- **Rationale:** Every write is attributable; trust depends on it. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** AUD-001
- **Trace:** discovery FR-013; `VO-PROVENANCE`; NFR-025
- **Acceptance:**
  - Given any recorded event, when inspected, then it carries an actor identity (or an anonymised placeholder per BR-025).

#### FR-013 — Guardian-consented minor profiles
- **Description:** The system **should** support guardian-consented accounts and restricted profiles for minors, with reduced profile visibility.
- **Rationale:** Minors play cricket; their data needs special handling. (`OBJ-11`)
- **Priority:** Should · P2
- **Dependencies:** FR-002, FR-108, SEC-013
- **Trace:** discovery FR-014; NFR-033; `A-15`
- **Acceptance:**
  - Given a minor profile, when viewed publicly, then only the permitted reduced field set is shown.

#### FR-014 — Organization API keys
- **Description:** The system **may** support organization-scoped API keys for programmatic data access.
- **Rationale:** Analysts and developers need machine access to their org's data. (`OBJ-09`)
- **Priority:** Could · P2
- **Dependencies:** FR-005, FR-137, SEC-009, SEC-017
- **Trace:** discovery FR-015
- **Acceptance:**
  - Given a revoked key, when used, then the request is rejected.

### 4.B Match Setup & Configuration

#### FR-015 — Create a match from a template
- **Description:** The system **shall** create a match from a competition or playing-conditions template that pre-populates format and `[CFG]` values.
- **Rationale:** Scorers should not re-enter a league's conditions every week. (`OBJ-01`, `OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** FR-017, FR-019, FR-027
- **Trace:** discovery FR-016; `AGG-CONDITIONS-PROFILE`; `AGG-MATCH-TEMPLATE`
- **Acceptance:**
  - Given a template, when a match is created from it, then all format and `[CFG]` values are populated and editable before first ball.

#### FR-016 — Create an ad-hoc match
- **Description:** The system **shall** create a match with fully custom conditions and no template.
- **Rationale:** Friendlies and one-off matches have no league config. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-017, FR-019, FR-027
- **Trace:** discovery FR-017; `CMD-CREATE-MATCH`
- **Acceptance:**
  - Given no template, when the user sets format and conditions manually, then a valid match can be created.

#### FR-017 — Format configuration
- **Description:** The system **shall** let the user configure the match format: T20, ODI/List A, T10, The Hundred, or custom overs, with the format's ball/over rules.
- **Rationale:** The product targets all common limited-overs formats. (`OBJ-01`; `A-27`)
- **Priority:** Must · P1
- **Dependencies:** FR-019, FR-020
- **Trace:** discovery FR-018; DR-01; `VO-FORMAT`; `FMT-*`
- **Acceptance:**
  - Given "The Hundred", when selected, then the 5/10-ball block rule replaces the six-ball over and "no two consecutive overs" is replaced by the block rule.
  - Given "custom", when overs per innings is set, then scoring and innings-end logic use that value.

#### FR-018 — Multi-day / first-class configuration
- **Description:** The system **should** let the user configure a first-class match: two innings per side and sessions.
- **Rationale:** Representative and 2nd-XI cricket includes multi-day. (`OBJ-01`)
- **Priority:** Should · P3
- **Dependencies:** FR-017, FR-074, FR-081
- **Trace:** discovery FR-019; DR-25, DR-26; `A-27`
- **Acceptance:**
  - Given first-class format, when configured, then declaration, follow-on and draw results become available and limited-overs P1 state modelling is unchanged.

#### FR-019 — Overs, powerplay and fielding-restriction configuration
- **Description:** The system **shall** let the user configure overs per innings, powerplay blocks, and fielding-restriction rules.
- **Rationale:** These vary by format and competition and drive on-screen phase labelling. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-017
- **Trace:** discovery FR-020; DR-23; `SVC-POWERPLAY-PLANNER`; `VO-POWERPLAY-PLAN`; `PP-*`
- **Acceptance:**
  - Given a powerplay plan, when overs are reduced mid-innings, then powerplay phase boundaries repartition per the configured model, including mid-over boundaries.

#### FR-020 — Per-bowler over limits
- **Description:** The system **shall** let the user configure the maximum overs per bowler for the match.
- **Rationale:** Every limited-overs competition caps bowler workload. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-017
- **Trace:** discovery FR-021; DR-20; BR-028
- **Acceptance:**
  - Given a cap of 4, when a bowler is selected for a 5th over, then the system blocks it unless overridden with a reason (FR-057).

#### FR-021 — Tie-breaker rule configuration
- **Description:** The system **shall** let the user set the tie-breaker rule: Super Over, repeat Super Over, boundary count-back, or none.
- **Rationale:** Competitions differ on how a tie is resolved. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-017
- **Trace:** discovery FR-022; DR-30; BR-020, BR-042
- **Acceptance:**
  - Given "none", when scores finish level, then the result stands as "tie".
  - Given "Super Over", when scores finish level, then the Super Over workflow (FR-091) is offered.

#### FR-022 — Ball type and new-ball rules
- **Description:** The system **should** let the user record ball type/brand and configure new-ball availability rules.
- **Rationale:** Multi-day and List A cricket track the ball; scorecards note it. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-017
- **Trace:** discovery FR-023; FR-066 (new ball taken); DR-20
- **Acceptance:**
  - Given a new-ball rule at 80 overs, when reached, then the system prompts to record a new ball.

#### FR-023 — Toss capture and innings order
- **Description:** The system **shall** record the toss winner and elected decision and derive the initial innings order from it.
- **Rationale:** The toss determines who bats first; it is recorded before the first ball. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-016, FR-030
- **Trace:** discovery FR-024; BR-026; DR-05; `VO-TOSS`
- **Acceptance:**
  - Given team A wins the toss and elects to bowl, when recorded, then team B is set to bat first.
  - Given the match has a first delivery, when a toss edit is attempted, then it requires a reasoned amendment.

#### FR-024 — Venue, schedule and time zone
- **Description:** The system **shall** record venue, date, scheduled start time, and the single match time zone.
- **Rationale:** Scorecards and audit timestamps must be unambiguous. (`OBJ-05`, `OBJ-11`)
- **Priority:** Must · P1
- **Dependencies:** —
- **Trace:** discovery FR-025; NFR-059; `A-11`
- **Acceptance:**
  - Given a match time zone, when any event is displayed, then its timestamp renders in that zone regardless of the device zone.

#### FR-025 — Match officials
- **Description:** The system **should** record match officials (umpires, scorers, referee).
- **Rationale:** Official scorecards name the officials; sign-off/counter-signature references them. (`OBJ-07`)
- **Priority:** Should · P1
- **Dependencies:** FR-016
- **Trace:** discovery FR-026; `VO-MATCH-OFFICIALS`; `A-26`
- **Acceptance:**
  - Given officials entered, when the scorecard is produced, then they appear in the header.

#### FR-026 — Setup completeness validation
- **Description:** The system **shall** validate setup completeness (format, conditions, both XIs, roles, toss) and **shall not** enable scoring until validation passes.
- **Rationale:** A match becomes editable only after setup validation passes. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-017, FR-023, FR-031, FR-034
- **Trace:** discovery FR-027; BR-002; `SM-MATCH` (Scheduled→Ready)
- **Acceptance:**
  - Given an incomplete XI, when the user tries to start scoring, then it is blocked with the specific missing items listed.

#### FR-027 — Save setup as a named template
- **Description:** The system **should** let the user save a completed match setup as a reusable named template.
- **Rationale:** Speeds recurring fixtures. (`OBJ-08`)
- **Priority:** Should · P1
- **Dependencies:** FR-016
- **Trace:** discovery FR-028; `AGG-MATCH-TEMPLATE`
- **Acceptance:**
  - Given a saved template, when a new match is created from it, then its conditions match the saved values.

#### FR-028 — Minimum-overs-for-result configuration
- **Description:** The system **shall** let the user configure the minimum overs for a valid result, per format/competition.
- **Rationale:** A limited-overs result is valid only if the minimum-overs threshold was met. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-017
- **Trace:** discovery FR-029; DR-27, DR-28; BR-019
- **Acceptance:**
  - Given a 20-over-minimum rule, when the second innings is abandoned at 18 overs, then the result is "no result" unless DLS applies.

#### FR-029 — Competition points, bonus and NRR configuration
- **Description:** The system **should** let an organizer configure the points model, bonus-points model and NRR rules at competition level.
- **Rationale:** Standings must compute strictly per the competition's rules. (`OBJ-04`)
- **Priority:** Should · P2
- **Dependencies:** FR-115
- **Trace:** discovery FR-030; DR-27; BR-039, BR-040
- **Acceptance:**
  - Given a configured bonus-points model, when a result is ingested, then bonus points follow that model exactly.

### 4.C Squads, Lineups & Roles

#### FR-030 — Team squad list
- **Description:** The system **shall** maintain a team squad list of players with names and basic details.
- **Rationale:** The XI is picked from a squad; names are the minimum data. (`OBJ-10`; `A-24`)
- **Priority:** Must · P1
- **Dependencies:** —
- **Trace:** discovery FR-031; `AGG-TEAM`; `VO-SQUAD`; NFR-031
- **Acceptance:**
  - Given a squad, when scoring setup begins, then its players are selectable for the XI.

#### FR-031 — Select the playing XI
- **Description:** The system **shall** let the user select the playing XI (or configured team size) for each side before the toss.
- **Rationale:** The nominated side is fixed before the first ball. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-030
- **Trace:** discovery FR-032; DR-02, DR-03; `VO-NOMINATED-SIDE`
- **Acceptance:**
  - Given a configured size of 11, when 12 players are selected, then the selection is rejected.

#### FR-032 — Mark captain and wicket-keeper
- **Description:** The system **shall** let the user mark exactly one captain and exactly one wicket-keeper per side.
- **Rationale:** Captain and keeper drive toss, declaration, review and dismissal-option logic. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-031
- **Trace:** discovery FR-033; DR-02; BR-009
- **Acceptance:**
  - Given no keeper marked, when setup validation runs, then it fails with "wicket-keeper required".

#### FR-033 — Add an ad-hoc player during setup
- **Description:** The system **shall** let the user add a player not in the squad during setup.
- **Rationale:** Last-minute team changes are routine at club level. (`OBJ-08`; `A-24`)
- **Priority:** Must · P1
- **Dependencies:** FR-030
- **Trace:** discovery FR-034; `Draft` player state in `AGG-PLAYER`
- **Acceptance:**
  - Given an ad-hoc player, when added, then they are selectable for the XI and marked as an unregistered/draft identity.

#### FR-034 — Validate the XI
- **Description:** The system **shall** validate each XI for correct count, exactly one captain, exactly one keeper, and that no player appears in both sides.
- **Rationale:** An invalid XI corrupts every downstream figure. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-031, FR-032
- **Trace:** discovery FR-035; BR-009, BR-010; DR-02, DR-03
- **Acceptance:**
  - Given the same player in both XIs, when validation runs, then it fails identifying the player.

#### FR-035 — Substitute-fielder pool
- **Description:** The system **should** let the user nominate a pool of substitute fielders, who may not bat, bowl or keep (except sanctioned concussion/impact subs).
- **Rationale:** Substitute fielders take the field routinely and affect dismissal attribution. (`OBJ-01`)
- **Priority:** Should · P1
- **Dependencies:** FR-031
- **Trace:** discovery FR-036; DR-03; BR-011; `VO-SUBSTITUTE-APPEARANCE`
- **Acceptance:**
  - Given a substitute fielder, when a bowling change is attempted for them, then it is refused.

#### FR-036 — Concussion-substitute pool
- **Description:** The system **should** let the user nominate a concussion-substitute pool and record a sanctioned like-for-like replacement, after which the replaced player takes no further part.
- **Rationale:** Concussion substitutes are a Laws-sanctioned full replacement. (`OBJ-01`)
- **Priority:** Should · P2
- **Dependencies:** FR-035, FR-108
- **Trace:** discovery FR-037; BR-012; DR-19 (RTHO); `ENT-PLAYER-REPLACEMENT`
- **Acceptance:**
  - Given a concussion replacement is applied, when the replaced player is selected for any action, then it is refused.

#### FR-037 — Impact / replacement-player pool
- **Description:** The system **may** let the user nominate an impact/replacement-player pool where competition config enables it (default disabled).
- **Rationale:** Some competitions use a full mid-match replacement. (`OBJ-01`)
- **Priority:** Could · P3
- **Dependencies:** FR-035
- **Trace:** discovery FR-038; `CFG-REG`; `ENT-PLAYER-REPLACEMENT`
- **Acceptance:**
  - Given the config key is disabled, when an impact player is attempted, then the option is not shown.

#### FR-038 — Canonical player registry
- **Description:** The system **should** maintain an organization-level canonical player registry.
- **Rationale:** Career stats and dedup depend on a stable person identity. (`OBJ-10`)
- **Priority:** Should · P2
- **Dependencies:** FR-005
- **Trace:** discovery FR-039; `AGG-PLAYER`
- **Acceptance:**
  - Given a registered player, when picked for a squad, then their canonical identity is linked.

#### FR-039 — Merge duplicate player records
- **Description:** The system **shall** let an organization admin or platform admin merge duplicate player records, re-pointing all historical appearances to the survivor, with the merge logged.
- **Rationale:** Duplicates fragment career records. (`OBJ-09`)
- **Priority:** Should · P2
- **Dependencies:** FR-038, AUD-002
- **Trace:** discovery FR-040; BR-044; `MINV-18`
- **Acceptance:**
  - Given a merge, when complete, then the losing ID resolves to the surviving ID and no direct references to the losing ID remain.

#### FR-040 — Submit XI against a fixture with a deadline
- **Description:** The system **should** let a captain/manager submit a playing XI against a fixture with a submission deadline.
- **Rationale:** Organizers need team sheets before matches. (`OBJ-10`)
- **Priority:** Should · P2
- **Dependencies:** FR-031, FR-113
- **Trace:** discovery FR-041; CTR-*
- **Acceptance:**
  - Given a deadline, when an XI is submitted before it, then it is accepted and timestamped.

#### FR-041 — Lock lineup at deadline
- **Description:** The system **should** lock a submitted lineup at the deadline and flag and log any post-deadline change.
- **Rationale:** Disputes need a record of who changed the XI and when. (`OBJ-07`)
- **Priority:** Should · P2
- **Dependencies:** FR-040, AUD-002
- **Trace:** discovery FR-042
- **Acceptance:**
  - Given a locked lineup, when changed after the deadline, then the change is flagged and logged with actor and reason.

### 4.D Live Ball-by-Ball Scoring

#### FR-042 — Set the opening striker, non-striker and bowler
- **Description:** The system **shall** require the opening striker, non-striker and bowler to be set before the first delivery of an innings.
- **Rationale:** Strike resolution and bowler figures need a defined start state. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-034, FR-082
- **Trace:** discovery FR-043; DR-10; `SM-INNINGS`
- **Acceptance:**
  - Given an innings with no opening batters set, when a delivery is attempted, then it is blocked.

#### FR-043 — Record runs off the bat
- **Description:** The system **shall** record 0–6+ runs off the bat for a legal delivery, crediting the striker.
- **Rationale:** The atomic scoring outcome. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-042
- **Trace:** discovery FR-044; DR-09, DR-10; `EVT-DELIVERY-RECORDED`; `VO-RUNLINE`
- **Acceptance:**
  - Given 3 runs off the bat, when recorded, then the striker's runs increase by 3 and strike rotates (DR-10).

#### FR-044 — Record a wide
- **Description:** The system **shall** record a wide with any additional runs; the wide is not a legal ball, is re-bowled, and all its runs are extras.
- **Rationale:** Wides are a common extra with specific counting rules. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-043
- **Trace:** discovery FR-045; DR-13; BR-035; `SVC-EXTRAS-DECOMPOSER`
- **Acceptance:**
  - Given a wide + 2 runs, when recorded, then 3 runs are added as extras, the delivery is re-bowled, and the legal-ball count does not increment.

#### FR-045 — Record a no-ball
- **Description:** The system **shall** record a no-ball with runs off the bat or byes, apply the no-ball penalty, mark it not a legal ball, and set free-hit state where the profile requires.
- **Rationale:** No-balls carry a penalty, are re-bowled, and can trigger a free hit. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-043, FR-046
- **Trace:** discovery FR-046; DR-12, DR-17; BR-035; `SVC-EXTRAS-DECOMPOSER`; `MINV-09`
- **Acceptance:**
  - Given a no-ball with 4 off the bat and free-hit enabled, when recorded, then penalty + 4 are counted correctly, the ball is re-bowled, and the next legal delivery is a free hit.

#### FR-046 — Record byes and leg-byes
- **Description:** The system **shall** record byes and leg-byes with their runs, as team extras (not credited to the striker), on a legal delivery.
- **Rationale:** Byes/leg-byes are legal deliveries with runs that must not credit the batter. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-043
- **Trace:** discovery FR-047; DR-14, DR-15; BR-034
- **Acceptance:**
  - Given 2 leg-byes, when recorded, then extras increase by 2, the striker's runs are unchanged, and the legal-ball count increments.

#### FR-047 — Record penalty runs
- **Description:** The system **shall** record 5 penalty runs to the batting or fielding side with a reason; no delivery is faced.
- **Rationale:** Penalty runs for infringements are awarded without a ball. (`OBJ-01`)
- **Priority:** Should · P1
- **Dependencies:** FR-042
- **Trace:** discovery FR-048; DR-16; BR-036; `EVT-PENALTY-RUNS-AWARDED`
- **Acceptance:**
  - Given 5 penalty runs to the batting side, when recorded, then the innings total increases by 5, no batter or bowler figure changes, and the reason is stored.

#### FR-048 — Record boundaries and overthrows
- **Description:** The system **shall** record boundary 4 and 6 (including all-run and overthrow boundaries) and overthrows that add runs (including a boundary) to a delivery.
- **Rationale:** Boundaries and overthrows are common and affect batter and team figures. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-043
- **Trace:** discovery FR-049, FR-050 *(consolidated)*; DR-09; `VO-RUNLINE.boundary/overthrow`
- **Acceptance:**
  - Given 1 run then a 4-run overthrow, when recorded, then 5 runs are added with the correct split between running and the overthrow boundary.

#### FR-049 — Record every dismissal mode
- **Description:** The system **shall** record every dismissal mode: bowled, caught, caught & bowled, LBW, run out, non-striker run out (mankad), stumped, hit wicket, obstructing the field, hit the ball twice, timed out, retired out.
- **Rationale:** Law-accurate scoring requires all modes. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-050
- **Trace:** discovery FR-051; DR-18, DR-19; `ENT-WICKET`; `DismissalMode`
- **Acceptance:**
  - Given each mode in turn, when recorded, then the wicket is stored with that mode and the correct bowler-credit flag (DR-18).

#### FR-050 — Capture dismissal detail
- **Description:** The system **shall** capture, per dismissal: the out batter, which batters had crossed / the end, the fielder(s) involved, and whether the bowler is credited.
- **Rationale:** FoW, cards and bowling figures depend on this detail. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-049
- **Trace:** discovery FR-052; DR-18; BR-030, BR-031; `SVC-STRIKE-RESOLVER`; `MINV-07`
- **Acceptance:**
  - Given a run out with the batters having crossed, when recorded, then the not-out batter is placed at the correct end for the next delivery.

#### FR-051 — Record retired–not out and resumption
- **Description:** The system **shall** record a batter retired–not out (hurt/ill) and their later resumption; this is not a dismissal and does not count as a wicket.
- **Rationale:** Retired–hurt batters routinely resume. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-049
- **Trace:** discovery FR-053; DR-19 (RTHO); BR-030; `MINV-10`; `SM-BATTER-CARD-LINE`
- **Acceptance:**
  - Given a retired–not out batter, when they resume later in the innings, then their card line continues and wickets-lost is unchanged.

#### FR-052 — Automatic strike rotation
- **Description:** The system **shall** rotate the strike automatically on odd runs completed and at the end of an over, and offer confirmation on wickets where the incoming batter's end is ambiguous.
- **Rationale:** Manual strike tracking is the top source of scoring error. (`OBJ-01`, `OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** FR-043
- **Trace:** discovery FR-054; DR-10; `SVC-STRIKE-RESOLVER`; `INV-011`; `MINV-04`; `MBR-09`
- **Acceptance:**
  - Given 1 run on the last ball of an over, when recorded, then the same batter is on strike for the next over (one rotation for the run, one for the over).

#### FR-053 — Legal-ball counting and over completion
- **Description:** The system **shall** count legal deliveries per over and complete an over at the configured ball/block count; wides, no-balls and dismissal deliveries do not increment the count.
- **Rationale:** Over/ball display and bowler figures depend on correct counting. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-044, FR-045
- **Trace:** discovery FR-055; DR-07; `INV-002`, `INV-012`; `MINV-08`
- **Acceptance:**
  - Given 5 legal balls and 2 wides bowled, when the 6th legal ball is recorded, then the over completes.

#### FR-054 — New-bowler prompt at over start
- **Description:** The system **shall** prompt for the next bowler at the start of each over.
- **Rationale:** Bowler must change each over; a prompt prevents omission. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-053
- **Trace:** discovery FR-056; DR-07, DR-20
- **Acceptance:**
  - Given an over completes, when the next delivery is attempted with no bowler chosen, then it is blocked pending a bowler.

#### FR-055 — Consecutive-over guardrail
- **Description:** The system **shall** warn and block a bowler from bowling two overs in succession in the same innings.
- **Rationale:** A Law; violating it invalidates the over. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-054, FR-057
- **Trace:** discovery FR-057; DR-20; BR-027; `INV-013`
- **Acceptance:**
  - Given a bowler who bowled the previous over, when selected again, then the system blocks it unless overridden with a reason.

#### FR-056 — Over-limit guardrail
- **Description:** The system **shall** warn and block a bowler from exceeding the configured maximum overs.
- **Rationale:** Every limited-overs competition caps bowler overs. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-020, FR-057
- **Trace:** discovery FR-058; DR-20; BR-028; `INV-013`
- **Acceptance:**
  - Given a cap of 10 reached, when the bowler is selected again, then it is blocked unless overridden with a reason.

#### FR-057 — Guardrail override with recorded reason
- **Description:** The system **shall** allow an explicit override of any scoring guardrail, requiring a recorded reason, and **shall** log every override.
- **Rationale:** Real matches have edge cases; the record must show where a rule was consciously overridden. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** AUD-005
- **Trace:** discovery FR-059; `CORR-*`; NFR-043
- **Acceptance:**
  - Given a blocked action, when overridden, then a non-empty reason is required and the override appears in the audit trail and the reconciliation report.

#### FR-058 — Substitute fielder on the field
- **Description:** The system **should** record a substitute fielder taking the field and attribute any resulting dismissal (e.g. a catch) correctly, without crediting bat/bowl/keep actions to them.
- **Rationale:** Substitute involvement in dismissals must be attributed accurately. (`OBJ-01`)
- **Priority:** Should · P1
- **Dependencies:** FR-035, FR-050
- **Trace:** discovery FR-060; BR-011; DR-03
- **Acceptance:**
  - Given a catch by a substitute fielder, when recorded, then the fielder is noted and no batting/bowling figure is attributed to them.

#### FR-059 — Undo the last action
- **Description:** The system **shall** undo the last recorded scoring action instantly, on-device, offline.
- **Rationale:** Fast correction of a mis-tap keeps the scorer with live play. (`OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** OFF-002
- **Trace:** discovery FR-061; SCR-*; AND-009
- **Acceptance:**
  - Given a just-recorded delivery, when undo is pressed, then all its derived figures revert and the prior state is restored.

#### FR-060 — Redo an undone action
- **Description:** The system **should** redo an undone action.
- **Rationale:** Symmetry with undo reduces re-entry. (`OBJ-08`)
- **Priority:** Should · P1
- **Dependencies:** FR-059
- **Trace:** discovery FR-062
- **Acceptance:**
  - Given an undone delivery, when redo is pressed before any new entry, then the delivery is reinstated identically.

#### FR-061 — End-of-over checkpoint
- **Description:** The system **should** present an end-of-over checkpoint summarising the over and current figures.
- **Rationale:** A per-over glance catches divergence early. (`OBJ-07`)
- **Priority:** Should · P1
- **Dependencies:** FR-053
- **Trace:** discovery FR-063; `CORR-008` (interval reconciliation)
- **Acceptance:**
  - Given an over completes, when the checkpoint shows, then it lists the over's runs, wickets, and the running score, and can be dismissed in one action.

#### FR-062 — Per-delivery commentary and notes
- **Description:** The system **should** let the scorer attach free-text commentary or a note to any delivery.
- **Rationale:** Commentators and match reports need per-ball text. (`OBJ-05`)
- **Priority:** Should · P1
- **Dependencies:** FR-043
- **Trace:** discovery FR-064; DR-32; `EVT-COMMENTARY-ADDED`
- **Acceptance:**
  - Given a note added to a delivery, when the linear sheet or commentary feed is viewed, then the note appears against that ball.

#### FR-063 — Persistent live-state panel
- **Description:** The system **shall** display, at all times during scoring, the striker, non-striker, bowler, over.ball, score/wickets, extras, run rate, required run rate, runs required, balls remaining, target, and DLS par (DLS par shown only when a DLS revision is in effect).
- **Rationale:** The scorer and any glancing umpire need the full state without navigation. (`OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** FR-043, FR-078
- **Trace:** discovery FR-065; `QRY-LIVE-STATE`; VWR-002…007
- **Acceptance:**
  - Given a live chase, when any delivery is recorded, then runs required and balls remaining update immediately and correctly.

#### FR-064 — Drinks and stoppage capture
- **Description:** The system **should** record drinks breaks and other short stoppages with timestamps.
- **Rationale:** Timings feed over-rate and interruption records. (`OBJ-04`)
- **Priority:** Should · P1
- **Dependencies:** FR-042
- **Trace:** discovery FR-066; DR-05
- **Acceptance:**
  - Given a drinks break recorded, when the match notes are viewed, then the break and its time appear.

#### FR-065 — Wicket-keeper change mid-innings
- **Description:** The system **may** record a change of wicket-keeper during an innings and adjust available dismissal options accordingly (e.g. stumping attribution).
- **Rationale:** Keepers change; stumping credit must follow. (`OBJ-01`)
- **Priority:** Could · P2
- **Dependencies:** FR-032, FR-050
- **Trace:** discovery FR-067; DR-19 (STMP)
- **Acceptance:**
  - Given a keeper change, when a subsequent stumping is recorded, then it is attributed to the current keeper.

#### FR-066 — New ball taken
- **Description:** The system **should** record a new ball being taken.
- **Rationale:** Scorecards and bowling analysis note the new-ball point. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-022
- **Trace:** discovery FR-068; DR-20
- **Acceptance:**
  - Given a new ball recorded at over 35, when the over-by-over view is shown, then the new-ball marker appears at that over.

#### FR-067 — Penalty-with-ball vs penalty-without-ball distinction
- **Description:** The system **should** distinguish "5 penalty runs, ball not counted" from "penalty plus a delivery to be bowled".
- **Rationale:** The two cases differ in whether a legal ball is consumed. (`OBJ-01`)
- **Priority:** Should · P2
- **Dependencies:** FR-047
- **Trace:** discovery FR-069; DR-16
- **Acceptance:**
  - Given each variant, when recorded, then the legal-ball count changes only in the "plus a delivery" case.

#### FR-068 — Dead ball with reason
- **Description:** The system **should** record a dead ball with a reason: no runs and no ball counted.
- **Rationale:** Dead-ball calls must be on the record without affecting figures. (`OBJ-01`)
- **Priority:** Should · P2
- **Dependencies:** FR-042
- **Trace:** discovery FR-070; DR-08
- **Acceptance:**
  - Given a dead ball, when recorded, then no runs, wickets or legal-ball count change and the reason is stored.

#### FR-069 — Non-striker run out before delivery (mankad)
- **Description:** The system **should** record a run out of the non-striker before the ball is delivered.
- **Rationale:** A valid, distinct dismissal with no ball faced and no bowler credit. (`OBJ-01`)
- **Priority:** Should · P2
- **Dependencies:** FR-049
- **Trace:** discovery FR-071; DR-19 (NSRO); BR-031
- **Acceptance:**
  - Given a non-striker run out before delivery, when recorded, then it is a wicket with no ball counted and no bowler credit.

#### FR-070 — Last-man-stands / one-short handling
- **Description:** The system **may** support last-man-stands play and explicit one-short calls where competition config allows.
- **Rationale:** Some club competitions use these variants. (`OBJ-01`)
- **Priority:** Could · P3
- **Dependencies:** FR-017
- **Trace:** discovery FR-072; DR-09 (short run); `CFG-REG`
- **Acceptance:**
  - Given last-man-stands enabled, when the 10th wicket falls, then the last batter may continue batting alone per the configured rule.

### 4.E Innings & Match State

#### FR-071 — End an innings on overs complete
- **Description:** The system **shall** end an innings automatically when the allotted (or revised) overs are complete.
- **Rationale:** Deterministic innings end prevents over-counting error. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-053, FR-077
- **Trace:** discovery FR-073; DR-06; BR-029; `SVC-INNINGS-END-EVALUATOR`; `SM-INNINGS`
- **Acceptance:**
  - Given a 20-over innings, when the final legal ball of over 20 is recorded, then the innings transitions to complete and no further deliveries are accepted.

#### FR-072 — End an innings when all out
- **Description:** The system **shall** end an innings automatically when the batting side is all out, accounting for absent and retired–not out batters in the effective threshold.
- **Rationale:** All out is a primary innings-end condition; the threshold varies. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-049, FR-051
- **Trace:** discovery FR-074; DR-06, DR-18; BR-029, BR-038; `MINV-10`
- **Acceptance:**
  - Given two batters absent, when the 8th wicket falls, then the innings ends all out.

#### FR-073 — End the chase when the target is reached
- **Description:** The system **shall** end the second innings automatically when the batting side reaches or passes its target.
- **Rationale:** The chase ends the instant the target is passed. (`OBJ-01`, `OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-078
- **Trace:** discovery FR-075; DR-27, DR-28; BR-018; `SVC-INNINGS-END-EVALUATOR`
- **Acceptance:**
  - Given a target of 151, when the score reaches 151, then the innings ends and the result is "win by wickets".

#### FR-074 — Innings declaration
- **Description:** The system **should** support a batting captain declaring an innings closed (formats not limited by overs).
- **Rationale:** Multi-day cricket needs declarations. (`OBJ-01`)
- **Priority:** Should · P3
- **Dependencies:** FR-018
- **Trace:** discovery FR-076; DR-25; `EVT-INNINGS-DECLARED`
- **Acceptance:**
  - Given first-class format, when the captain declares, then the innings closes as completed and the match state advances.

#### FR-075 — Innings forfeiture
- **Description:** The system **may** support a captain forfeiting an innings, which counts as a completed innings.
- **Rationale:** A rare but lawful multi-day option. (`OBJ-01`)
- **Priority:** Could · P3
- **Dependencies:** FR-018
- **Trace:** discovery FR-077; DR-25
- **Acceptance:**
  - Given a forfeiture, when recorded, then the innings is treated as completed with its current (possibly zero) score.

#### FR-076 — Record match interruptions
- **Description:** The system **shall** record match interruptions with start time, end time and reason.
- **Rationale:** Interruptions drive over reductions and DLS. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-042
- **Trace:** discovery FR-078; DR-29; `ENT-INTERRUPTION`; `SM-INTERRUPTION`
- **Acceptance:**
  - Given rain stops play, when the interruption is recorded and later resolved, then both timestamps and the reason are stored and available to the DLS/reduced-overs flow.

#### FR-077 — Reduce overs mid-match
- **Description:** The system **shall** let the user reduce the overs for one or both innings during the match.
- **Rationale:** Weather-shortened matches are routine. (`OBJ-01`, `OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-076, FR-019
- **Trace:** discovery FR-079; DR-29; `SVC-POWERPLAY-PLANNER`
- **Acceptance:**
  - Given an over reduction, when applied, then innings-end logic, powerplay boundaries and the live panel use the revised overs.

#### FR-078 — Target computation
- **Description:** The system **shall** compute the chase target as the opponent's total + 1, replaced by the DLS-revised target if a DLS revision is in effect, or by a manual override (FR-084); exactly one source is authoritative at a time.
- **Rationale:** The target drives the whole second innings. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-071, FR-084
- **Trace:** discovery FR-080; DR-28; BR-018; `MINV-11`
- **Acceptance:**
  - Given a first-innings total of 150 and no DLS, when the second innings starts, then the target is 151.
  - Given a later DLS revision, when applied, then the target switches to the DLS value and the source is shown.

#### FR-079 — Result type and margin
- **Description:** The system **shall** record the result type (win by runs, win by wickets, tie, no result, abandoned, win by DLS, win by Super Over, awarded, conceded) and the margin appropriate to that type (runs / wickets / balls remaining).
- **Rationale:** The result is the primary output and must be precise. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-078
- **Trace:** discovery FR-081, FR-082 *(consolidated)*; DR-27; `SVC-RESULT-DERIVER`; `VO-RESULT`; `INV-014`; `MINV-13`
- **Acceptance:**
  - Given a chase completed with 3 wickets and 8 balls to spare, when the result is recorded, then it reads "won by 7 wickets (8 balls remaining)".
  - Given a stored result, when reconciliation runs, then the result re-derives from the innings totals or a FAIL is raised.

#### FR-080 — Over-rate and time penalties
- **Description:** The system **may** record over-rate or time penalties that affect the result.
- **Rationale:** Some competitions apply run/over penalties. (`OBJ-04`)
- **Priority:** Could · P2
- **Dependencies:** FR-079
- **Trace:** discovery FR-083; DR-27
- **Acceptance:**
  - Given a 5-run over-rate penalty, when applied, then the affected side's total and the result reflect it, with the penalty itemised.

#### FR-081 — Follow-on
- **Description:** The system **should** support the follow-on decision and its enforcement (multi-day).
- **Rationale:** A core multi-day mechanic. (`OBJ-01`)
- **Priority:** Should · P3
- **Dependencies:** FR-018
- **Trace:** discovery FR-084; DR-26; `VO-FOLLOW-ON-DECISION`; `INV-016`
- **Acceptance:**
  - Given a first-innings lead ≥ the configured margin, when the captain enforces the follow-on, then the trailing side bats again immediately.

#### FR-082 — Match state machine
- **Description:** The system **shall** model the match lifecycle as an explicit state machine (Scheduled → Ready → In progress → Innings break → … → Final / Abandoned) and only permit actions valid in the current state.
- **Rationale:** State discipline prevents illegal operations and underpins sign-off. (`OBJ-01`, `OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-026
- **Trace:** discovery FR-085; `SM-MATCH`
- **Acceptance:**
  - Given a match in "Innings break", when a delivery is attempted, then it is refused as invalid for the state.
  - Given a match in "Final", when scoring is attempted, then it requires the post-Final correction flow (FR-089).

### 4.F Rain, DLS & Reduced Overs

*All FRs in this cluster except FR-084/FR-085 depend on `SPK-01` (`A-06`). If `SPK-01` is not cleared, the system ships FR-084 (manual target) only and the rest are disabled behind a flag (see §13, C-2).*

#### FR-083 — Compute a DLS revised target
- **Description:** The system **shall**, given overs lost / revised overs and the interruption context, compute a DLS Standard Edition revised target using pinned reference tables.
- **Rationale:** In-app DLS removes the top pain point for accredited scorers. (`OBJ-04`)
- **Priority:** Must · P1 *(gated by `SPK-01`; else deferred to manual FR-084)*
- **Dependencies:** FR-076, FR-077, FR-078, OFF-008, A-06
- **Trace:** discovery FR-086; DR-40; NFR-034; `SVC-DLS-CALCULATOR`; `ENT-DLS-REVISION`
- **Acceptance:**
  - Given a benchmark rain scenario, when DLS computes the revised target, then it is within the published rounding tolerance of the reference output.

#### FR-084 — Manual target entry / override
- **Description:** The system **shall** allow a manual target (or manual par) to be entered with a recorded reason, overriding any computed value.
- **Rationale:** The always-available fallback when DLS is unavailable, disputed, or provided by officials. (`OBJ-04`; `A-19`)
- **Priority:** Must · P1
- **Dependencies:** FR-078, AUD-005
- **Trace:** discovery FR-090; DR-28; `MINV-11`
- **Acceptance:**
  - Given a manual target of 172, when entered with a reason, then the chase logic and result use 172 and the audit trail shows the entry.

#### FR-085 — Live DLS par score
- **Description:** The system **shall** display a live DLS par score and the over-by-over par ladder during a DLS-affected chase.
- **Rationale:** Umpires and scorers check par at intervals. (`OBJ-04`)
- **Priority:** Must · P1 *(gated by `SPK-01`)*
- **Dependencies:** FR-083
- **Trace:** discovery FR-087; DR-40; `VO-PAR-LADDER`; `INV-015`
- **Acceptance:**
  - Given a DLS chase, when the score is below par at the end of an over during a stoppage, then the live panel shows the team is behind par by the correct margin.

#### FR-086 — Recompute par/target on each interruption
- **Description:** The system **shall** recompute the par ladder and revised target on every subsequent interruption.
- **Rationale:** Multiple stoppages compound; each needs a fresh revision. (`OBJ-04`)
- **Priority:** Must · P1 *(gated by `SPK-01`)*
- **Dependencies:** FR-083, FR-076
- **Trace:** discovery FR-088; DR-40; `SM-DLS-REVISION`
- **Acceptance:**
  - Given a second interruption, when resolved, then a new DLS revision supersedes the previous one and the prior remains on record.

#### FR-087 — Version every DLS revision
- **Description:** The system **shall** store every DLS revision with its inputs (overs lost, wickets down, score, time), timestamp and actor, each revision individually reversible.
- **Rationale:** DLS decisions are disputed; every revision must be reconstructable. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-083, AUD-002
- **Trace:** discovery FR-089; BR-021; `ENT-DLS-REVISION`; AUD-009
- **Acceptance:**
  - Given three revisions, when the audit view is opened, then each shows its inputs, time, actor, and can be individually reverted.

#### FR-088 — Determine an abandoned-match result from par
- **Description:** The system **shall** determine an abandoned-match result from par at the last valid ball, subject to the minimum-overs rule, with a manual par input path when DLS is unavailable.
- **Rationale:** Many weather-hit matches are decided this way. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-028, FR-084, FR-085
- **Trace:** discovery FR-091; DR-27; BR-019
- **Acceptance:**
  - Given the second innings is abandoned past the minimum overs and above par, when the result is derived, then it reads "won by DLS (par)" with the margin.
  - Given the minimum overs were not reached, when the result is derived, then it is "no result".

#### FR-089 — DLS calculations function offline
- **Description:** All DLS/par calculations **shall** function fully offline from pinned tables.
- **Rationale:** Rain interruptions happen at offline grounds. (`OBJ-02`)
- **Priority:** Must · P1 *(gated by `SPK-01`)*
- **Dependencies:** FR-083, OFF-008
- **Trace:** discovery FR-092; NFR-012; `SVC-DLS-CALCULATOR`
- **Acceptance:**
  - Given no connectivity, when a DLS revision is requested, then it computes and displays with no network call.

#### FR-090 — DLS calculation breakdown
- **Description:** The system **should** show the DLS calculation breakdown (resources used, inputs, result) for audit and explanation.
- **Rationale:** Transparency defuses disputes. (`OBJ-07`)
- **Priority:** Should · P2
- **Dependencies:** FR-083
- **Trace:** discovery FR-094; DR-40
- **Acceptance:**
  - Given a revision, when its breakdown is opened, then resources-used per side and the derivation of the revised target are shown.

#### FR-091 — Pluggable rain-method interface
- **Description:** The system **should** expose a pluggable rain-method interface with DLS Standard as the initial method.
- **Rationale:** Keeps alternative methods possible without a rewrite; supports the `SPK-01` fallback strategy. (`OBJ-01`)
- **Priority:** Should · P2
- **Dependencies:** FR-083
- **Trace:** discovery FR-093; NFR-034, NFR-056; foundation §7
- **Acceptance:**
  - Given the method is set to "NONE", when a stoppage occurs, then only manual target entry (FR-084) is offered.

### 4.G Tie-breakers / Super Over

#### FR-092 — Super Over workflow
- **Description:** The system **shall** provide a Super Over workflow: nominate three batters and one bowler per side, enforce a two-wicket maximum and one over per side.
- **Rationale:** The standard modern tie-breaker. (`OBJ-01`)
- **Priority:** Must · P1 *(may be MVP-manual per `A-20`)*
- **Dependencies:** FR-021, FR-079
- **Trace:** discovery FR-095; DR-30; BR-041; `ENT-SUPER-OVER`; `MBR-10`
- **Acceptance:**
  - Given a Super Over, when the second wicket falls or the over completes, then that side's Super Over innings ends.

#### FR-093 — Repeat Super Overs
- **Description:** The system **shall** support repeated Super Overs until a result is reached.
- **Rationale:** Current playing conditions repeat the Super Over on a tie. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-092
- **Trace:** discovery FR-096; DR-30; BR-042
- **Acceptance:**
  - Given a tied Super Over, when the tie-breaker is "repeat", then a further Super Over is started.

#### FR-094 — Boundary count-back fallback
- **Description:** The system **should** support a configurable legacy boundary count-back as the tie-breaker where a competition selects it.
- **Rationale:** Some competitions retain the older rule. (`OBJ-01`)
- **Priority:** Should · P1
- **Dependencies:** FR-021
- **Trace:** discovery FR-097; DR-30; BR-042
- **Acceptance:**
  - Given "boundary count-back", when a Super Over ties, then the side with more boundaries in the Super Over (then the match) is the winner, shown with the counts.

#### FR-095 — Super Over statistics isolation
- **Description:** The system **shall** keep Super Over statistics separate from main-match statistics and from all career aggregates.
- **Rationale:** Super Over runs/wickets never count towards aggregates. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-092
- **Trace:** discovery FR-098; DR-30; BR-043; `MINV-12`
- **Acceptance:**
  - Given a Super Over century-maker, when the batting card and career view are shown, then the Super Over runs appear only in the Super Over block.

#### FR-096 — Super Over batting order rule
- **Description:** The system **should** apply the correct batting-order rule for the Super Over (the side that bowled second in the match, or the loser of the previous Super Over, bats first — per playing conditions).
- **Rationale:** Order is fixed by the conditions, not chosen freely. (`OBJ-01`)
- **Priority:** Should · P2
- **Dependencies:** FR-092
- **Trace:** discovery FR-099; DR-30
- **Acceptance:**
  - Given standard conditions, when the Super Over starts, then the side that batted second in the match is set to bat first.

### 4.H Corrections, Audit & Sign-off

*Audit-trail mechanics are specified in §11 (`AUD-*`); this cluster covers the correction and sign-off workflow.*

#### FR-097 — Navigate to any prior delivery
- **Description:** The system **shall** let the scorer navigate to any prior delivery by over/ball or by timeline search.
- **Rationale:** Corrections require finding the ball quickly. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-043
- **Trace:** discovery FR-100; `QRY-SCORECARD-AT`
- **Acceptance:**
  - Given "12.3", when entered in the navigator, then the scorer is taken to that delivery with its full recorded detail.

#### FR-098 — Correct any field of any prior delivery
- **Description:** The system **shall** let the scorer correct any field of any prior delivery (runs, extra type, dismissal, striker, bowler, commentary).
- **Rationale:** Real books need every field editable, not just the last ball. (`OBJ-01`, `OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-097, FR-099, FR-100
- **Trace:** discovery FR-101; DR-33; `CMD-AMEND-DELIVERY`
- **Acceptance:**
  - Given a delivery wrongly recorded as a bye, when corrected to a leg-bye, then all affected figures update and the change is on the audit trail.

#### FR-099 — Corrections are superseding events
- **Description:** The system **shall** preserve the original event and record every correction as a new superseding event linked to the original; it **shall not** mutate or delete events.
- **Rationale:** Tamper-evidence and reconstructability. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** AUD-001
- **Trace:** discovery FR-102; DR-33; BR-004; `MINV-01`, `MINV-03`; `MBR-04`
- **Acceptance:**
  - Given a correction, when the timeline is inspected, then the original event still exists, marked superseded, with a link to the correcting event.

#### FR-100 — Recompute all derived figures after a correction
- **Description:** The system **shall** recompute every projection after a correction/insert/void, detect strike-continuity breaks, and surface the cascade for scorer review.
- **Rationale:** A single correction ripples through cards, partnerships, FoW, run rate and the result. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-099
- **Trace:** discovery FR-103; DR-33; `SVC-CASCADE-RECOMPUTER`; `MINV-02`
- **Acceptance:**
  - Given a corrected run count three overs back, when applied, then the running score, partnerships and any changed strike sequence update and a cascade summary is shown.

#### FR-101 — Reconciliation check
- **Description:** The system **shall** run a reconciliation check evaluating the invariants (total = Σ batter runs + extras; legal balls ↔ overs; wickets ≤ maximum; strike continuity; result re-derivation) and produce a PASS/FAIL(detail) report per invariant.
- **Rationale:** On-screen and exported scorecards must always reconcile. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-100
- **Trace:** discovery FR-104; DR-46; BR-037; `INV-001…018`; `SVC-RECONCILER`; AUD-006
- **Acceptance:**
  - Given a card where the total is one run short of Σ batter + extras, when reconciliation runs, then INV total-identity reports FAIL with the discrepancy.

#### FR-102 — Reconciliation gates sign-off
- **Description:** The system **shall** block match sign-off while any reconciliation check fails, unless an authorised role overrides with a recorded reason.
- **Rationale:** Finality must not be reachable over an unreconciled book without a conscious, recorded decision. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-101, FR-103
- **Trace:** discovery FR-105; BR-007; `MBR-08`
- **Acceptance:**
  - Given a failing reconciliation, when sign-off is attempted, then it is blocked; with an override reason supplied by an authorised role, it proceeds and the override is logged.

#### FR-103 — Head-scorer sign-off to Final
- **Description:** The system **shall** let the Head Scorer sign off a match, transitioning it to Final; the result is provisional until then.
- **Rationale:** A defined act of finality is the trust anchor. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-082, FR-102
- **Trace:** discovery FR-106; BR-005; `VO-SIGN-OFF`; `CMD-SIGN-OFF-MATCH`; `SM-MATCH`
- **Acceptance:**
  - Given a reconciled match, when the Head Scorer signs off, then the match state becomes Final and the sign-off (actor, time, version) is recorded.

#### FR-104 — Counter-signature
- **Description:** The system **should** support a counter-signature by an Assistant Scorer and/or an umpire on sign-off.
- **Rationale:** Some competitions require a second signatory for an "official" record. (`OBJ-07`; `A-21`)
- **Priority:** Should · P2
- **Dependencies:** FR-103
- **Trace:** discovery FR-107; `VO-SIGN-OFF.counterSignatures`
- **Acceptance:**
  - Given counter-signature is required, when only the Head Scorer has signed, then the match is "signed, awaiting counter-signature", not fully Final.

#### FR-105 — Post-Final corrections
- **Description:** The system **shall** require an elevated role, a recorded reason, and re-sign-off for any correction after Final, retaining the prior Final version.
- **Rationale:** Official results change only under controlled, attributable conditions. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-103, AUD-002
- **Trace:** discovery FR-108; BR-006; DR-33; `MBR-04`
- **Acceptance:**
  - Given a Final match, when a correction is made, then the system demands an elevated role and a reason, produces a new sign-off version, and keeps the previous Final retrievable.

#### FR-106 — Dispute lock and adjudication
- **Description:** The system **should** let an organizer/admin lock a match pending dispute resolution and record an adjudication that unlocks or amends it.
- **Rationale:** Contested results need a controlled hold and a recorded ruling. (`OBJ-07`)
- **Priority:** Should · P2
- **Dependencies:** FR-103, FR-005
- **Trace:** discovery FR-112; BR-016; `SM-DISPUTE`
- **Acceptance:**
  - Given a locked match, when any scoring edit is attempted, then it is refused until an adjudication is recorded.

### 4.I Dual-Scorer Reconciliation

*Entire cluster is P2 (`A-03`). Sync mechanics are in §10 (`SYNC-*`).*

#### FR-107 — Assign multiple scorers to a match
- **Description:** The system **shall** allow two or more scorers to be assigned to one match.
- **Rationale:** Independent dual scoring is the integrity standard for representative cricket. (`OBJ-03`)
- **Priority:** Must · P2
- **Dependencies:** FR-007
- **Trace:** discovery FR-113; `VO-SCORER-ASSIGNMENT`
- **Acceptance:**
  - Given a match, when two Head/Assistant Scorers are assigned, then both may open it for scoring.

#### FR-108 — Independent per-scorer ball logs
- **Description:** The system **shall** let each assigned scorer maintain an independent ball log for the same match.
- **Rationale:** Independence is what makes the cross-check meaningful. (`OBJ-03`)
- **Priority:** Must · P2
- **Dependencies:** FR-107, OFF-006
- **Trace:** discovery FR-114; OFR-014; `MBR-03`
- **Acceptance:**
  - Given both scorers offline, when each records the same over differently, then both logs persist independently until exchanged.

#### FR-109 — Divergence list with per-ball comparison
- **Description:** The system **shall** present a divergence list aligning the two logs by over/ball and showing every delivery where runs, extras, wicket or striker differ.
- **Rationale:** Scorers need to see exactly where they disagree. (`OBJ-03`)
- **Priority:** Must · P2
- **Dependencies:** SYNC-011, SYNC-012
- **Trace:** discovery FR-116, FR-117 *(consolidated)*; `SVC-DIVERGENCE-DETECTOR`; `VO-DIVERGENCE`
- **Acceptance:**
  - Given logs differing at 4.2 and 11.5, when the divergence list is opened, then exactly those two deliveries are listed with both versions side by side.

#### FR-110 — Propose-and-confirm reconciliation
- **Description:** The system **shall** let one scorer propose an agreed version of a divergent delivery and **shall** require the other scorer to confirm before it applies; it **shall not** silently overwrite either entry.
- **Rationale:** No scorer's record is discarded without mutual agreement. (`OBJ-03`)
- **Priority:** Must · P2
- **Dependencies:** FR-109, SYNC-013
- **Trace:** discovery FR-118, FR-119 *(consolidated)*; BR-008; `MINV-14`
- **Acceptance:**
  - Given a proposed agreed version, when the second scorer has not confirmed, then neither log changes.
  - Given both scorers confirm, when applied, then both logs converge to the agreed version as a recorded event.

#### FR-111 — Block sign-off on unresolved divergence
- **Description:** The system **shall** block match sign-off while any unresolved divergence remains, overridable only with a reason and dual attestation.
- **Rationale:** A signed dual-scored match must be a reconciled one. (`OBJ-07`)
- **Priority:** Must · P2
- **Dependencies:** FR-102, FR-110
- **Trace:** discovery FR-120; BR-008; `MINV-14`
- **Acceptance:**
  - Given one open divergence, when sign-off is attempted, then it is blocked unless both scorers attest an override reason.

### 4.J Scorecards, Analytics & Commentary

#### FR-112 — Full scorecard
- **Description:** The system **shall** produce a full scorecard: batting card, bowling card, extras breakdown, total, and result, per the scorecard content rules.
- **Rationale:** The scorecard is the primary deliverable of a scored match. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-101
- **Trace:** discovery FR-121; DR-42; `QRY-SCORECARD-AT`; `SCRD-*`
- **Acceptance:**
  - Given a completed innings, when the scorecard is produced, then it reconciles (total = Σ batter + extras) and lists every batter and bowler with correct figures.

#### FR-113 — Linear / ball-by-ball scoresheet
- **Description:** The system **shall** produce a linear (ball-by-ball) scoresheet for each innings.
- **Rationale:** The linear sheet is the traditional running record. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-112
- **Trace:** discovery FR-122; DR-42; `SCRD-*`
- **Acceptance:**
  - Given an innings, when the linear sheet is produced, then every delivery appears in order with runs, extras, wickets, bowler and striker.

#### FR-114 — Bowling analysis
- **Description:** The system **shall** produce a bowling analysis: overs, maidens, runs, wickets, economy, and spells per bowler.
- **Rationale:** Standard scorecard component. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-112
- **Trace:** discovery FR-123; DR-20; `ENT-BOWLER-CARD-LINE`; `INV-003`, `INV-004`
- **Acceptance:**
  - Given a bowler who bowled 4 overs, 1 maiden, 22 runs, 2 wickets, when the analysis is produced, then it shows "4-1-22-2" and economy 5.50.

#### FR-115 — Fall-of-wickets and over-by-over
- **Description:** The system **shall** produce a fall-of-wickets list (score, wicket number, batter, over) and an over-by-over summary.
- **Rationale:** Standard scorecard components used for analysis and reporting. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-112
- **Trace:** discovery FR-124, FR-125 *(consolidated)*; DR-18, DR-21; `INV-006`
- **Acceptance:**
  - Given five wickets fell, when the FoW list is produced, then it has exactly five entries in non-decreasing score order.

#### FR-116 — Partnerships
- **Description:** The system **shall** show partnerships per wicket: runs, balls, and each batter's contribution.
- **Rationale:** Partnership data is expected on every card and drives charts. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-112
- **Trace:** discovery FR-126; DR-22; `INV-007`
- **Acceptance:**
  - Given an innings total of 180, when partnerships are summed across all segments, then the sum equals 180.

#### FR-117 — Batting and bowling metrics
- **Description:** The system **should** compute batting metrics (strike rate, boundary %, dot %, minutes where tracked) and bowling metrics (economy, strike rate, average, dot %).
- **Rationale:** Analysts and reports expect derived rates. (`OBJ-05`)
- **Priority:** Should · P1
- **Dependencies:** FR-112, FR-114
- **Trace:** discovery FR-127, FR-128 *(consolidated)*; DR-20, DR-21
- **Acceptance:**
  - Given a batter with 45 off 30, when metrics compute, then strike rate shows 150.0.

#### FR-118 — Milestone flags
- **Description:** The system **should** flag milestones: fifties, hundreds, five-fors, ten-wicket matches, hat-tricks, and record/notable partnerships.
- **Rationale:** Milestones drive commentary and reports. (`OBJ-05`)
- **Priority:** Should · P1
- **Dependencies:** FR-112
- **Trace:** discovery FR-129; DR-21, DR-22; `SVC-MILESTONE-DETECTOR`; `CMTRY-*`
- **Acceptance:**
  - Given a batter passing 50, when the next delivery is recorded, then a fifty milestone is flagged against that ball and on the card.

#### FR-119 — Standard match charts
- **Description:** The system **should** render the standard match charts: Manhattan (runs per over), worm / cumulative-runs comparison, run-rate vs required-run-rate, and partnership bar chart, with chart-data export.
- **Rationale:** These four are the pilot analytics baseline. (`OBJ-05`; `A-22`)
- **Priority:** Should · P1
- **Dependencies:** FR-112, FR-116
- **Trace:** discovery FR-130, FR-131, FR-132, FR-133 *(consolidated)*; WEB-017; OFR-009
- **Acceptance:**
  - Given a completed T20, when the Manhattan chart renders, then each over's bar equals that over's runs (including extras) and the data can be exported.

#### FR-120 — Wagon wheel and pitch map (manual entry)
- **Description:** The system **may** capture wagon-wheel shot coordinates and pitch-map / beehive line-length data via manual entry, and render them.
- **Rationale:** Deeper analysis some leagues expect; not day-one for the pilot. (`OBJ-05`)
- **Priority:** Could · P2 (wagon wheel) / P3 (pitch map)
- **Dependencies:** FR-043
- **Trace:** discovery FR-134, FR-135 *(consolidated)*; `Q-D4`
- **Acceptance:**
  - Given manually entered shot coordinates for a batter, when the wagon wheel renders, then each scoring shot appears at its entered angle and distance.

#### FR-121 — Commentary feed and match notes
- **Description:** The system **should** maintain a ball-by-ball commentary feed and allow match-level, session-level and day-level notes.
- **Rationale:** Media and reports need a text narrative alongside the numbers. (`OBJ-05`)
- **Priority:** Should · P1
- **Dependencies:** FR-062
- **Trace:** discovery FR-136, FR-137 *(consolidated)*; DR-32; `EVT-COMMENTARY-ADDED`
- **Acceptance:**
  - Given per-ball commentary entered through an innings, when the feed is viewed, then entries appear in ball order with milestone flags inline.

#### FR-122 — Live spectator scorecard
- **Description:** The system **shall** render a live scorecard suitable for spectators (current score, batters, bowler, recent overs, result when reached).
- **Rationale:** Viewers following a shared link need a readable live card. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-063, FR-127
- **Trace:** discovery FR-138; VWR-002…007
- **Acceptance:**
  - Given a live match, when a viewer opens the spectator card, then it shows the current state and refreshes as new deliveries arrive (subject to SYNC/latency).

### 4.K Competitions, Fixtures & Standings

*Cluster is P2.*

#### FR-123 — Create a competition/season
- **Description:** The system **shall** let an organizer create a competition/season with a format and a playing-conditions template, and organise teams into divisions/groups.
- **Rationale:** The competition is the container for fixtures and standings. (`OBJ-10`)
- **Priority:** Must · P2
- **Dependencies:** FR-005, FR-015
- **Trace:** discovery FR-139, FR-140 *(consolidated)*; `AGG-COMPETITION`
- **Acceptance:**
  - Given a competition with two divisions, when created, then teams can be assigned to a division and inherit its conditions template.

#### FR-124 — Fixture list generation and assignment
- **Description:** The system **should** generate a round-robin or knockout fixture list, allow fixture import from a file, and let an organizer assign scorers to fixtures.
- **Rationale:** Organizers should not build a season schedule by hand. (`OBJ-10`)
- **Priority:** Should · P2
- **Dependencies:** FR-123
- **Trace:** discovery FR-141, FR-142, FR-143 *(consolidated)*; `ENT-FIXTURE`; ONR-013
- **Acceptance:**
  - Given eight teams, when a round-robin is generated, then every team plays every other once and no team has two fixtures in the same slot.

#### FR-125 — Automatic result ingestion
- **Description:** The system **shall** ingest signed-off, non-disputed match results into their competition automatically.
- **Rationale:** Removes the "chase scorers for results" problem. (`OBJ-10`)
- **Priority:** Must · P2
- **Dependencies:** FR-103, FR-123
- **Trace:** discovery FR-144; BR-015; `MINV-16`; ONR-009
- **Acceptance:**
  - Given a match reaches Final, when it belongs to a competition, then its result appears in that competition without manual entry.

#### FR-126 — Standings, NRR and bonus points
- **Description:** The system **shall** compute standings from the competition's configured points model, Net Run Rate per its NRR rules, and bonus points per its bonus model — all only from Final, non-disputed matches.
- **Rationale:** Manual NRR is error-prone and disputed. (`OBJ-04`)
- **Priority:** Must · P2
- **Dependencies:** FR-029, FR-125
- **Trace:** discovery FR-145, FR-146, FR-147 *(consolidated)*; DR-27; BR-039, BR-040; `MINV-16`
- **Acceptance:**
  - Given a completed round, when standings recompute, then points, NRR and bonus points match a hand-worked reference for that round.

#### FR-127 — Knockout brackets
- **Description:** The system **may** produce knockout brackets and progression.
- **Rationale:** Cup competitions need a bracket view. (`OBJ-10`)
- **Priority:** Could · P3
- **Dependencies:** FR-124
- **Trace:** discovery FR-148
- **Acceptance:**
  - Given a completed quarter-final, when the bracket updates, then the winner advances to the correct semi-final slot.

#### FR-128 — Disciplinary and penalty entries
- **Description:** The system **may** record disciplinary or penalty entries against a match or team.
- **Rationale:** Discipline records are part of running a season. (`OBJ-07`)
- **Priority:** Could · P2
- **Dependencies:** FR-123
- **Trace:** discovery FR-149
- **Acceptance:**
  - Given a points deduction, when applied to a team, then the standings reflect it with the entry visible in the dispute/discipline trail.

#### FR-129 — Public competition page
- **Description:** The system **should** publish a public competition page (fixtures, results, standings).
- **Rationale:** Clubs and fans expect a public table. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-126, SEC-009
- **Trace:** discovery FR-150; ONR-018
- **Acceptance:**
  - Given a published competition, when the public URL is opened with no account, then current fixtures, results and standings are shown read-only.

### 4.L Profiles, Stats, History & Search

#### FR-130 — Match search and history
- **Description:** The system **shall** let a user search matches by team, competition, venue, date, or player, and browse a chronological match history per team/competition.
- **Rationale:** Finding past matches is a basic need for every persona. (`OBJ-05`)
- **Priority:** Should · P1
- **Dependencies:** FR-112
- **Trace:** discovery FR-157, FR-158 *(consolidated)*; `QRY-*`
- **Acceptance:**
  - Given matches for a team, when the user filters by season, then only that season's matches list, newest first.

#### FR-131 — Player profiles
- **Description:** The system **should** maintain player profiles with a photo and basic bio.
- **Rationale:** Players want a recognisable record. (`OBJ-10`)
- **Priority:** Should · P2
- **Dependencies:** FR-038
- **Trace:** discovery FR-151; `CTX-PROFILES`
- **Acceptance:**
  - Given a profile, when viewed, then it shows the permitted bio fields and the player's verified appearances.

#### FR-132 — Appearance claims
- **Description:** The system **should** let a player claim/link appearances, applied to their record only after approval by an authorised role.
- **Rationale:** Self-service linking, gated by approval, keeps records clean. (`OBJ-07`)
- **Priority:** Should · P2
- **Dependencies:** FR-131, FR-108
- **Trace:** discovery FR-152; BR-014; `VO-APPEARANCE-CLAIM`; `MINV-17`; ONR-014
- **Acceptance:**
  - Given a pending claim, when unapproved, then the appearance does not count toward career aggregates.

#### FR-133 — Career and team aggregates
- **Description:** The system **should** compute career aggregates (batting, bowling, fielding) and team aggregates/records from verified Final matches only, excluding Super Overs.
- **Rationale:** Trust requires aggregates come only from verified data. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-125, FR-132
- **Trace:** discovery FR-153, FR-154 *(consolidated)*; BR-013; `MINV-12`, `MINV-17`
- **Acceptance:**
  - Given a player with three Final matches and one provisional, when career runs are shown, then only the three Final matches contribute.

#### FR-134 — Head-to-head and form
- **Description:** The system **may** provide head-to-head comparisons (player vs player, team vs team) and recent-form summaries for a squad.
- **Rationale:** Coaches and media use match-ups and form. (`OBJ-05`)
- **Priority:** Could · P2
- **Dependencies:** FR-133
- **Trace:** discovery FR-155, FR-156 *(consolidated)*
- **Acceptance:**
  - Given two players with shared matches, when head-to-head is opened, then runs, dismissals and balls between them are shown from Final matches only.

#### FR-135 — Ball-by-ball data filtering
- **Description:** The system **should** let a user filter a match's ball-by-ball data by phase, bowler, batter, or partnership.
- **Rationale:** Analysts slice the innings many ways. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-113
- **Trace:** discovery FR-159
- **Acceptance:**
  - Given a filter "powerplay + spin bowlers", when applied, then only matching deliveries are listed with a subtotal.

#### FR-136 — Record lists
- **Description:** The system **may** provide record lists (highest totals, best figures, biggest partnerships) per scope.
- **Rationale:** Clubs and competitions maintain honour boards. (`OBJ-05`)
- **Priority:** Could · P3
- **Dependencies:** FR-133
- **Trace:** discovery FR-160
- **Acceptance:**
  - Given a competition's Final matches, when the "best bowling" list is opened, then entries are ranked by wickets then runs conceded.

### 4.M Sharing, Notifications & Viewer Access

#### FR-137 — Shareable read-only match link
- **Description:** The system **shall** generate a shareable, unguessable, revocable read-only link for a live or final match, viewable on the web with no account and no install.
- **Rationale:** Fans, opponents and organizers follow matches without onboarding. (`OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-004, SEC-009
- **Trace:** discovery FR-161, FR-162 *(consolidated)*; BR-023; NFR-029; WEB-008; ONR-002
- **Acceptance:**
  - Given a share link, when opened with no account, then the match card is shown read-only.
  - Given the owner revokes the link, when it is next opened, then access is refused.

#### FR-138 — Near-real-time viewer updates with staleness indicator
- **Description:** The system **shall** update the viewer card in near real time while the source is online and **shall** show "last updated X ago" plus an offline indicator when the source is disconnected.
- **Rationale:** Viewers must be able to tell fresh data from stale. (`OBJ-05`, `OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-137, SYNC-002
- **Trace:** discovery FR-163, FR-164 *(consolidated)*; WEB-018; ONR-003
- **Acceptance:**
  - Given the scorer's device goes offline, when a viewer is watching, then within a defined interval the card shows an offline indicator and the last-updated time.

#### FR-139 — Match follow and result notifications
- **Description:** The system **should** let a viewer follow a match for wicket/innings/result alerts, and **should** notify assigned teams/captains when a result is posted.
- **Rationale:** Interested parties want to be told, not to poll. (`OBJ-05`; `A-23`)
- **Priority:** Should · P2
- **Dependencies:** FR-137, FR-141
- **Trace:** discovery FR-165, FR-166 *(consolidated)*; ONR-006
- **Acceptance:**
  - Given a followed match, when a wicket falls, then the follower receives a wicket alert within the notification latency budget.

#### FR-140 — Scorer assignment and deadline notifications
- **Description:** The system **may** notify scorers of assignment, XI submission and deadlines.
- **Rationale:** Reduces missed assignments in a busy season. (`OBJ-10`)
- **Priority:** Could · P2
- **Dependencies:** FR-124
- **Trace:** discovery FR-167
- **Acceptance:**
  - Given a scorer assigned to a fixture, when the assignment is made, then they receive a notification naming the fixture and time.

#### FR-141 — Push notification delivery
- **Description:** The system **should** deliver push notifications on Android and web push where available.
- **Rationale:** Push is the expected delivery channel on mobile. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-139
- **Trace:** discovery FR-168; ONR-019; AND-014
- **Acceptance:**
  - Given push permission granted, when a subscribed event occurs, then a push notification is delivered to the registered device.

#### FR-142 — Embeds and moment deep-links
- **Description:** The system **may** provide an embeddable scorecard widget and the ability to share a specific moment (e.g. a wicket) as a deep link.
- **Rationale:** Club sites and social posts want richer sharing. (`OBJ-05`)
- **Priority:** Could · P3
- **Dependencies:** FR-137
- **Trace:** discovery FR-169, FR-170 *(consolidated)*; WEB-011
- **Acceptance:**
  - Given a wicket deep link, when opened, then the viewer lands on that delivery's context in the linear feed.

### 4.N Import, Export, API & Backup

#### FR-143 — Scorecard PDF export
- **Description:** The system **shall** export a match scorecard as PDF, offline, for locally held matches.
- **Rationale:** The PDF is the artefact emailed to both clubs. (`OBJ-09`)
- **Priority:** Must · P1
- **Dependencies:** FR-112, OFF-010
- **Trace:** discovery FR-172, FR-174 *(consolidated)*; OFR-010; WEB-009
- **Acceptance:**
  - Given a signed-off match with no connectivity, when PDF export is run, then a reconciling scorecard PDF is produced on-device.

#### FR-144 — CSV data export
- **Description:** The system **shall** export match/innings data as CSV, offline.
- **Rationale:** CSV is the lowest-common-denominator analysis format. (`OBJ-09`)
- **Priority:** Must · P1
- **Dependencies:** FR-112, OFF-010
- **Trace:** discovery FR-173, FR-174 *(consolidated)*; NFR-049
- **Acceptance:**
  - Given a completed match, when CSV export is run, then per-delivery and summary rows are produced and open in a spreadsheet without proprietary tooling.

#### FR-145 — Cricsheet-compatible export
- **Description:** The system **should** export a match as a Cricsheet-compatible JSON/YAML document conforming to the published schema.
- **Rationale:** Open interchange for the wider ecosystem. (`OBJ-09`; `A-08`)
- **Priority:** Should · P1 *(gated by `SPK-05`)*
- **Dependencies:** FR-112, SPK-05
- **Trace:** discovery FR-171; NFR-050; `SVC-EXPORT-TRANSLATOR`
- **Acceptance:**
  - Given a completed match, when Cricsheet export is run, then the output validates against the target schema and lists any lossy fields.

#### FR-146 — Cricsheet import with round-trip fidelity
- **Description:** The system **may** import a match from a Cricsheet-compatible document and **should**, for supported fields, guarantee export→import round-trip fidelity with zero material difference.
- **Rationale:** Migrating historical data in and back out without loss. (`OBJ-09`)
- **Priority:** Could · P2 (import) / Should · P2 (round-trip)
- **Dependencies:** FR-145
- **Trace:** discovery FR-175, FR-176 *(consolidated)*; NFR-051; `SVC-EXPORT-TRANSLATOR`
- **Acceptance:**
  - Given a match exported then re-imported, when compared, then supported fields are identical.

#### FR-147 — Read-only API and realtime channel
- **Description:** The system **may** provide a read-only REST API for matches, competitions and profiles, and a real-time subscription channel for live match updates.
- **Rationale:** Developers and club sites need programmatic access. (`OBJ-09`, `OBJ-05`)
- **Priority:** Could · P2
- **Dependencies:** FR-014, FR-148, SEC-009, SEC-017
- **Trace:** discovery FR-177, FR-178 *(consolidated)*; ONR-010
- **Acceptance:**
  - Given a valid API key, when the matches endpoint is called, then only the caller's permitted data is returned.

#### FR-148 — Stable external identifiers
- **Description:** The system **should** expose stable, documented identifiers for players, teams, matches and competitions, stable across releases.
- **Rationale:** External consumers need identifiers that do not churn. (`OBJ-09`)
- **Priority:** Should · P2
- **Dependencies:** —
- **Trace:** discovery FR-179; NFR-052
- **Acceptance:**
  - Given a match ID published in one release, when queried in a later release, then it resolves to the same match.

#### FR-149 — Local backup and restore
- **Description:** The system **should** create a local backup file of one or more matches and restore matches from such a file, without connectivity.
- **Rationale:** Device loss/replacement must not lose an unsynced season. (`OBJ-02`)
- **Priority:** Should · P1
- **Dependencies:** OFF-011
- **Trace:** discovery FR-180, FR-181 *(consolidated)*; OFR-011; AND-018; WEB-009
- **Acceptance:**
  - Given a backup file, when restored on another device, then the matches (including unsynced events) are reconstructed identically.

#### FR-150 — Organization branding on exports
- **Description:** The system **should** apply organization branding (name, logo, colours) to exported outputs.
- **Rationale:** Clubs and leagues want branded cards. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-005, FR-143
- **Trace:** discovery FR-182; ADM-*
- **Acceptance:**
  - Given org branding configured, when a PDF is exported, then the club name, logo and colours appear on the card.

### 4.O Settings, Localization & Preferences

#### FR-151 — Keep the screen awake while scoring
- **Description:** The system **shall** offer a "keep screen awake while scoring" option, with a sensible timeout otherwise.
- **Rationale:** A screen that sleeps mid-over slows entry. (`OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** —
- **Trace:** discovery FR-190; AND-008
- **Acceptance:**
  - Given the option enabled, when a match is being scored, then the screen does not sleep until scoring pauses or the option is turned off.

#### FR-152 — Date/time format and match time zone
- **Description:** The system **shall** let the user choose date/time format and set the match time zone.
- **Rationale:** Unambiguous timestamps across regions and devices. (`OBJ-11`)
- **Priority:** Must · P1
- **Dependencies:** FR-024
- **Trace:** discovery FR-184; NFR-058, NFR-059
- **Acceptance:**
  - Given a match time zone different from the device, when timestamps display, then they render in the match time zone consistently.

#### FR-153 — Accessibility and sunlight scoring modes
- **Description:** The system **shall** offer high-contrast, large-text and sunlight-readable modes for the scoring UI.
- **Rationale:** Scoring happens outdoors in bright light and by users with varied vision. (`OBJ-11`)
- **Priority:** Must · P1
- **Dependencies:** —
- **Trace:** discovery FR-185; NFR-042; WEB-015; AND-012
- **Acceptance:**
  - Given sunlight mode enabled, when scoring, then contrast meets the defined threshold and all primary controls remain legible.

#### FR-154 — Scoring input preferences
- **Description:** The system **should** let the user configure scoring input preferences: button layout, confirmation prompts, and haptics.
- **Rationale:** Scorers have strong personal workflows; speed depends on fit. (`OBJ-08`)
- **Priority:** Should · P1
- **Dependencies:** —
- **Trace:** discovery FR-186; AND-009; WEB-003
- **Acceptance:**
  - Given confirmations turned off for common runs, when a single-run is tapped, then it is recorded without a confirm step.

#### FR-155 — Local storage management
- **Description:** The system **should** let the user view local storage usage, purge synced matches, and set a retention policy.
- **Rationale:** Years of local history must not fill the device. (`OBJ-02`)
- **Priority:** Should · P1
- **Dependencies:** OFF-016
- **Trace:** discovery FR-188; OFR-016; WEB-021; AND-019
- **Acceptance:**
  - Given synced matches older than the retention window, when purge is run, then their local copies are removed and remain retrievable from the cloud.

#### FR-156 — Default template preference
- **Description:** The system **should** let the user set a default competition/condition template for new matches.
- **Rationale:** A scorer who works one league mostly should not pick the template every time. (`OBJ-08`)
- **Priority:** Should · P1
- **Dependencies:** FR-015
- **Trace:** discovery FR-187
- **Acceptance:**
  - Given a default template set, when a new match is started, then it is pre-selected.

#### FR-157 — Interface language selection
- **Description:** The system **should** let the user choose the interface language, with English at launch and a framework for adding more.
- **Rationale:** Localization-ready from the start, English-first for v1. (`OBJ-11`; `A-13`)
- **Priority:** Should · P1
- **Dependencies:** —
- **Trace:** discovery FR-183; NFR-057; WEB-013
- **Acceptance:**
  - Given a second language pack installed, when selected, then all externalised strings render in that language.

#### FR-158 — Notification preferences
- **Description:** The system **should** let the user configure notification preferences per channel and event type.
- **Rationale:** Users want control over what pings them. (`OBJ-05`)
- **Priority:** Should · P2
- **Dependencies:** FR-141
- **Trace:** discovery FR-189
- **Acceptance:**
  - Given "result only" selected, when a wicket falls, then no notification is sent; when the result is posted, one is.

### 4.P Administration (Organization & Platform)

#### FR-159 — Organization administration console
- **Description:** The system **shall** provide an organization-admin surface to onboard the org, invite members, manage roles, maintain the player registry, configure competitions, apply branding, and view dispute trails.
- **Rationale:** Org admins run the club/league on the platform. (`OBJ-10`)
- **Priority:** Must · P2 (Should · P1 for the invite/roles subset)
- **Dependencies:** FR-005, FR-007, FR-038
- **Trace:** discovery ADM-001…020 *(consolidated)*; WEB-016
- **Acceptance:**
  - Given an org admin, when they open the console, then they can invite a member with a role and see it take effect.

#### FR-160 — Platform administration and operations
- **Description:** The system **shall** provide platform-admin operations: tenant management, feature flags, staged rollout, health and sync-backlog monitoring, reference-data updates, and status/maintenance banners.
- **Rationale:** Safe operation of a multi-tenant service. (`OBJ-10`)
- **Priority:** Must · P2 (Should · P1 for staged rollout + reference-data updates)
- **Dependencies:** FR-161, SEC-018
- **Trace:** discovery ADM-101…114 *(consolidated)*; ONR-012, ONR-020; NFR-055, NFR-056
- **Acceptance:**
  - Given a bad release, when a feature flag is turned off, then the affected feature is disabled without a client update.

#### FR-161 — Consented, logged support impersonation
- **Description:** The system **shall** allow platform-admin support impersonation only with explicit user consent, and **shall** fully log every impersonated action.
- **Rationale:** Support sometimes needs to act as a user; it must be consented and attributable. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** AUD-002, SEC-011
- **Trace:** discovery ADM-107; NFR-028; ONR-021; SEC-011; AUD-007
- **Acceptance:**
  - Given no recorded consent, when impersonation is attempted, then it is refused.
  - Given an impersonated session, when actions occur, then each is logged as impersonated with both identities.

#### FR-162 — Backup, restore drill and retention configuration
- **Description:** The system **shall** provide server-side backup, a tested restore procedure, and configurable data-retention policy including audit-actor anonymisation on account deletion.
- **Rationale:** Operational recoverability and compliant retention. (`OBJ-10`, `OBJ-09`)
- **Priority:** Should · P2
- **Dependencies:** FR-011, BR-025
- **Trace:** discovery ADM-110; BR-025; NFR-032
- **Acceptance:**
  - Given a restore drill, when executed, then a point-in-time dataset is recovered and verified.

### 4.Q Client Platform Requirements (Web & Android)

#### FR-163 — Installable offline PWA (Web)
- **Description:** The web client **shall** be an installable PWA that scores fully offline, persists in-progress scoring across reload and browser crash, and warns before navigating away from an unsynced session.
- **Rationale:** The web client must match the offline guarantee, not just the Android one. (`OBJ-02`, `OBJ-06`)
- **Priority:** Must · P1
- **Dependencies:** OFF-001, OFF-002, OFF-004
- **Trace:** discovery WEB-001, WEB-007, WEB-014, WEB-019 *(consolidated)*; NFR-046
- **Acceptance:**
  - Given the PWA installed and offline, when a full match is scored and the tab is closed mid-over, then reopening resumes at the exact last confirmed state.

#### FR-164 — Web scorebox ergonomics
- **Description:** The web client **shall** provide responsive desktop/laptop/tablet/Chromebook layouts including a landscape "scorebox" view, keyboard-first scoring with configurable hotkeys, a multi-pane large-screen layout, and print-optimised scorecard/linear sheet.
- **Rationale:** Professional scorers work on laptops and expect keyboard speed. (`OBJ-08`, `OBJ-06`)
- **Priority:** Must · P1 (Should · P1 for multi-pane and print optimisation)
- **Dependencies:** FR-063
- **Trace:** discovery WEB-002, WEB-003, WEB-004, WEB-005, WEB-006 *(consolidated)*
- **Acceptance:**
  - Given the scorebox view, when a delivery is entered entirely by keyboard, then no pointer interaction is required.

#### FR-165 — Android one-handed offline scoring client
- **Description:** The Android client **shall** be an offline-first app for Android 10+, with a portrait one-handed layout (primary actions in the thumb zone), large gloved-use touch targets, local-DB persistence surviving app kill / low-memory eviction / reboot, write-ahead persistence per event, background sync on reconnect, and state preservation across calls/notifications/app-switch.
- **Rationale:** The primary persona scores one-handed on a mid-range Android phone in an offline box. (`OBJ-02`, `OBJ-08`)
- **Priority:** Must · P1
- **Dependencies:** OFF-003, OFF-004, SYNC-001
- **Trace:** discovery AND-001…007, AND-011 *(consolidated)*; NFR-044
- **Acceptance:**
  - Given an incoming call mid-over, when the scorer returns to the app, then no entry is lost and the cursor is on the next ball.

#### FR-166 — Android platform integration
- **Description:** The Android client **shall** integrate with the OS share sheet for links/exports, request only minimum permissions (no location/contacts unless a feature requires it), distribute via Google Play with in-app update prompts, and provide clear online/offline and last-synced indicators.
- **Rationale:** Store-compliant, privacy-minimal, predictable mobile behaviour. (`OBJ-07`, `OBJ-06`)
- **Priority:** Must · P1 (Should · P1 for in-app update prompts)
- **Dependencies:** FR-137, FR-143
- **Trace:** discovery AND-013, AND-016, AND-017, AND-023 *(consolidated)*
- **Acceptance:**
  - Given the app at first run, when permissions are reviewed, then only those required by enabled features are requested.

#### FR-167 — Cross-device handoff
- **Description:** The system **should** let a match in progress be resumed on a different device via the cloud copy.
- **Rationale:** A scorer whose phone dies mid-match must be able to continue on another device. (`OBJ-02`, `OBJ-03`)
- **Priority:** Should · P2
- **Dependencies:** SYNC-001, SYNC-003
- **Trace:** discovery ONR-011
- **Acceptance:**
  - Given a match synced to the cloud, when opened on a second signed-in device, then scoring continues from the last synced event with conflicts surfaced if both devices wrote.

#### FR-168 — Scoring-core parity across clients
- **Description:** The Web and Android clients **shall** produce identical scoring-core outcomes for identical inputs, verified by shared contract tests, with a tracked parity matrix.
- **Rationale:** A scorecard must not depend on which client scored it. (`OBJ-06`)
- **Priority:** Must · P1
- **Dependencies:** NFR-047, SPK-04
- **Trace:** discovery WEB-022, AND-024 *(consolidated)*; NFR-048
- **Acceptance:**
  - Given the shared contract-test suite, when run on both clients, then results are identical and the parity matrix is ≥ 95%.

---

## 5. Domain Rules

Each `DR-XXX` is an SRS-level requirement that the scoring engine **shall** implement one area of `docs/specs/cricket-rules-reference.md` (R3). The **authoritative detail** — every `[LAW]` / `[PRD]` / `[CFG]` / `[EDGE]` clause, RFC-2119 wording, and per-profile config value — lives under the cited `<AREA>-NNN` IDs in R3 and is not restated here; R3 is the conformance-suite oracle (`NFR-053`). Discovery `CSR-001…060` are the discovery-level statements of the same rules. Priority for the whole cluster is **Must · P1** unless noted (multi-day areas are P3 per `A-27`; DLS is gated by `SPK-01` per `A-06`). All trace to `OBJ-01`, and `OBJ-04` where mathematical.

**Common acceptance criterion for every `DR-XXX`:** *Given the versioned conformance suite's cases for this area, when executed against the engine, then 100% pass and every `[LAW]`/`[EDGE]` case has been reviewed by an accredited scorer.* Area-specific criteria are added per entry.

| ID | Area (R3 §) | The engine shall implement… | Authoritative IDs | Discovery trace | Key invariants | Phase |
|---|---|---|---|---|---|---|
| **DR-01** | Match Formats (§1) | format shapes: innings per side, over/block limits, ball rules, permitted endings; format as a value object. | `FMT-*` | CSR-001…004 | — | P1 |
| **DR-02** | Teams (§2) | two sides per match; squad vs nominated side; canonical vs ad-hoc team link. | `TEAM-*` | CSR-002 | — | P1 |
| **DR-03** | Players (§3) | player identity, XI membership, keeper/captain roles, substitute/concussion/impact/runner constraints, absent status. | `PLYR-*` | CSR-002 | `MINV-10` | P1 |
| **DR-04** | Officials (§4) | umpire/third/fourth/referee and scorer roles; their recorded involvement in decisions. | `OFCL-*` | — | — | P1 |
| **DR-05** | Match Lifecycle & State (§5) | toss, elected decision, initial innings order, and the match lifecycle transitions. | `STATE-*` | CSR-037 | — | P1 |
| **DR-06** | Innings (§6) | innings start/end reasons (overs, all out, target, declaration, forfeiture, time); one or two innings per side. | `INN-*` | CSR-005, CSR-006 | `INV-005`, `MINV-10` | P1 |
| **DR-07** | Overs (§7) | six-ball default over, one bowler per over from one end, end change each over, block variant for The Hundred. | `OVER-*` | CSR-005 | `INV-012`, `MINV-08` | P1 |
| **DR-08** | Balls / Deliveries (§8) | the delivery as the atomic scoring event; legal vs illegal; dead ball; delivery ordinal insertion. | `BALL-*` | CSR-005 | `MINV-03` | P1 |
| **DR-09** | Runs & Boundaries (§9) | runs off the bat, all-run, boundary 4/6, short runs, overthrows, wilful-act awards. | `RUN-*` | CSR-009…011 | `INV-009` | P1 |
| **DR-10** | Strike Rotation & End Changes (§10) | strike change on odd runs and end of over; incoming batter's end after a wicket; logged overrides. | `STRK-*` | CSR-006, CSR-007 | `INV-011`, `MINV-04` | P1 |
| **DR-11** | Extras — General (§11) | classification of every non-batter run as bye / leg-bye / wide / no-ball / penalty; attribution to exactly one bucket. | `EXT-*` | CSR-012 | `INV-010` | P1 |
| **DR-12** | No-ball (§12) | no-ball causes, penalty, runs handling, re-bowl, and free-hit triggering per profile. | `NB-*` | CSR-012 | `MINV-09` | P1 |
| **DR-13** | Wide (§13) | wide causes (incl. profile-varying calls), penalty + additional runs as wides, re-bowl, no legal ball. | `WD-*` | CSR-012 | — | P1 |
| **DR-14** | Bye (§14) | byes off a legal delivery passing the striker untouched; team extra; legal ball counts. | `BYE-*` | CSR-014 | `BR-034` | P1 |
| **DR-15** | Leg-bye (§15) | leg-byes off the body when a shot/evasion was attempted; team extra; legal ball counts; invalid cases. | `LB-*` | CSR-014 | `BR-034` | P1 |
| **DR-16** | Penalty Runs (§16) | 5-run penalties for infringements; award to the opposing side; ball-counted vs not-counted variants. | `PEN-*` | CSR-016 | `BR-036` | P1 |
| **DR-17** | Free Hit (§17) | free-hit set/consume/retain rules; dismissal restriction to run-out / obstructing / hit-twice. | `FH-*` | CSR-017 | `MINV-09`, `BR-033` | P1 |
| **DR-18** | Wickets — General (§18) | one wicket per delivery (except delivery-less TIMED_OUT / RETIRED_OUT); bowler-credit as a pure function of mode; FoW capture. | `WKT-*` | CSR-018 | `INV-005`, `INV-006`, `MINV-06`, `MINV-07` | P1 |
| **DR-19** | Dismissal Modes — detailed (§19) | each mode's specific conditions and edge cases: bowled `BWLD`, caught `CAUT`, LBW `LBW`, stumped `STMP`, run out `RNO`, non-striker run out `NSRO`, hit wicket `HITW`, obstructing `OBSF`, hit ball twice `HBT`, timed out `TIMO`, retired hurt/not-out `RTHO`, retired out `RTOU`. | `BWLD-*`,`CAUT-*`,`LBW-*`,`STMP-*`,`RNO-*`,`NSRO-*`,`HITW-*`,`OBSF-*`,`HBT-*`,`TIMO-*`,`RTHO-*`,`RTOU-*` | CSR-018…028 | `BR-030…033`, `MINV-06` | P1 |
| **DR-20** | Bowling figures (§20) | overs, maidens, runs charged, wickets, economy, spells, wides/no-balls attributable; no-credit modes excluded. | `BOWL-*` | CSR-018, CSR-034 | `INV-003`, `INV-004`, `MINV-07` | P1 |
| **DR-21** | Batting figures (§21) | runs, balls faced (incl. no-balls, excl. wides), 4s/6s, strike rate, dismissal reference, not-out/retired status. | `BAT-*` | CSR-034 | `INV-008`, `INV-009` | P1 |
| **DR-22** | Partnerships (§22) | partnership segments per wicket, runs/balls/contribution, unbroken partnerships, mid-partnership retirements. | `PART-*` | CSR-029, CSR-035 | `INV-007` | P1 |
| **DR-23** | Powerplays & Fielding Restrictions (§23) | powerplay phase model, per-delivery phase label, repartition after over reductions incl. mid-over boundaries. | `PP-*` | CSR-005 | — | P1 |
| **DR-24** | Reviews / DRS (§24) | review request, outcome (upheld / overturned / umpire's call), effect on the dismissal record; player-review counts. | `DRS-*` | — | — | P2 |
| **DR-25** | Declarations & Forfeiture (§25) | captain declaration and forfeiture as innings-completing events (formats not over-limited). | `DECL-*` | — | — | P3 |
| **DR-26** | Follow-on (§26) | follow-on threshold, decision, enforcement, and its effect on innings order and result derivation. | `FLW-*` | — | `INV-016` | P3 |
| **DR-27** | Results (§27) | win by runs / wickets / innings / DLS / Super Over; tie; draw; no result; abandoned; awarded/conceded; margin forms; minimum-overs validity. | `RES-*` | CSR-037…043 | `INV-014`, `INV-016`, `MINV-13` | P1 |
| **DR-28** | Target Calculation (§28) | target = opponent total + 1, DLS-revised, or manual; exactly one authoritative source; par relationship. | `TGT-*` | CSR-044…046, CSR-051 | `MINV-11` | P1 |
| **DR-29** | Reduced overs / interruptions (§29 context) | interruptions with times and reasons; overs lost; revised allocations feeding powerplay and DLS. | `DLS-*` (inputs), `INN-*` | CSR-047 | — | P1 |
| **DR-30** | Super Over / Tie-breakers (§30) | one over per side, 2-wicket max, 3 nominated batters + 1 bowler, repeat until result, boundary-count-back fallback, batting-order rule, stats isolation. | `SO-*` | CSR-052…056 | `MINV-12`, `BR-041…043` | P1 |
| **DR-31** | Cross-cutting invariants (§34) | the reconciliation invariants `INV-001…018` as a required, enumerable PASS/FAIL(detail) report at each interval checkpoint and at sign-off. | `INV-001…018` | CSR-036 | all `INV-*` | P1 |
| **DR-32** | Ball-by-Ball Commentary (§32) | per-delivery commentary structure, auto-generated descriptors, milestone flags inline, manual overrides. | `CMTRY-*` | CSR-035 | — | P1 (auto descriptors P2) |
| **DR-33** | Corrections & Scoring Amendments (§33) | amend / insert / void as superseding events; reason required; cascade recomputation; post-final controls; amendment provenance. | `CORR-*` | CSR-036 | `MINV-01`, `MINV-02`, `MINV-03`; `MBR-04` | P1 |
| **DR-34** | Scorecard content (§31) | header, per-innings blocks, extras breakdown, match notes & result detail, integrity/version block, and the enumerated edge cases (§31.5). | `SCRD-*` | CSR-029…036 | `MINV-02` | P1 |
| **DR-35** | Configuration Registry (§35) | the `[CFG]` key registry: allowed values and per-profile defaults (`LAWS` / `TEST` / `ODI` / `T20I` / `CLUB_LO` / `HUNDRED`); a match's profile is the resolved set, frozen at first ball. | `CFG-REG` (~55 keys) | CSR-001, CSR-005 | `MINV-05`; `BR-017`, `BR-045` | P1 |
| **DR-36** | DLS method (§29 `DLS`) | DLS Standard Edition: resources, revised target, par ladder, resource caps, monotonic par within an uninterrupted phase; offline from pinned tables; individually reversible revisions. | `DLS-*` | CSR-047…051 | `INV-015` | P1 *(gated by `SPK-01`; else manual only — see FR-084, §13)* |

### 5.1 Domain-rule notes

- **DR-31 / DR-33 are the integrity backbone.** They make every other `DR-` checkable (`SVC-RECONCILER`) and every change reconstructable (`SVC-CASCADE-RECOMPUTER`). They are non-negotiable for P1.
- **Config, not forks (C-1, `A-05`).** DR-35 is the mechanism by which competition variations (wide interpretation, powerplay model, bowler cap, free-hit on/off, last-man-stands, impact player) are data, not code branches.
- **`SPK-01` boundary.** If DLS cannot be cleared, DR-36 is not implemented; DR-28 still stands with `target ∈ {opponent+1, MANUAL}` and FR-084 is the only revised-target path.

---

## 6. Business Rules

`BR-XXX` are policy rules about ownership, lifecycle, authority and integrity — distinct from cricket semantics (§5) and quality attributes (§7). Each consolidates one or more discovery `BR-001…045` and/or model `MBR-01…12` (cited in **Trace**). All are **Must**; phase is P1 unless the mechanism it governs is P2/P3.

#### BR-001 — Match ownership
- **Description:** Every match **shall** be owned by exactly one organization, or by a single guest device until claimed.
- **Rationale:** Ownership is the anchor for access control, sharing and competition attachment. (`OBJ-10`)
- **Priority:** Must · P1
- **Dependencies:** FR-005, FR-001
- **Trace:** discovery BR-001; `MINV-15`; `MBR-02`
- **Acceptance:** Given a guest match, when created, then it has no organization owner and cannot be shared until claimed (BR-011).

#### BR-002 — Editability after setup validation
- **Description:** A match **shall** become editable (scoreable) only after setup validation passes.
- **Rationale:** Scoring against an invalid setup corrupts every figure. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-026
- **Trace:** discovery BR-002; `SM-MATCH`
- **Acceptance:** Given incomplete setup, when scoring is attempted, then it is refused with the missing items named.

#### BR-003 — Delivery-write authority
- **Description:** Only users holding Head Scorer or Assistant Scorer on a match **shall** record or correct deliveries.
- **Rationale:** The record's integrity depends on who can write it. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-007, SEC-005, SEC-006
- **Trace:** discovery BR-003; `SVC-AUTHORIZER`; NFR-026
- **Acceptance:** Given a user without a scorer role, when they attempt a delivery write, then the data layer refuses it.

#### BR-004 — Ball-event immutability
- **Description:** Ball events **shall** be immutable; a correction **shall** be a new superseding event referencing the original.
- **Rationale:** Tamper-evidence and full reconstructability. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-099, AUD-001
- **Trace:** discovery BR-004; `MINV-01`; `MBR-01`
- **Acceptance:** Given a corrected delivery, when the timeline is inspected, then the original event is intact and marked superseded.

#### BR-005 — Provisional until sign-off
- **Description:** A match result **shall** be provisional until a Head Scorer signs off; then it is Final.
- **Rationale:** A defined finality point is the trust anchor. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-103
- **Trace:** discovery BR-005; `VO-SIGN-OFF`
- **Acceptance:** Given an unsigned match, when its result is displayed, then it is labelled provisional.

#### BR-006 — Post-Final change control
- **Description:** Post-Final corrections **shall** require an elevated role, a recorded reason, and re-sign-off; the prior Final version **shall** be retained.
- **Rationale:** Official results change only under controlled, attributable conditions. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-105, AUD-002
- **Trace:** discovery BR-006; `MBR-04`
- **Acceptance:** Given a Final match, when amended, then a new sign-off version is produced and the previous Final remains retrievable.

#### BR-007 — Reconciliation gate on finality
- **Description:** Sign-off **shall** be blocked while a reconciliation check fails, unless explicitly overridden with a reason by an authorised role.
- **Rationale:** Finality must not be reachable over an unreconciled book without a conscious, recorded decision. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-101, FR-102
- **Trace:** discovery BR-007; `MBR-08`; `INV-018`
- **Acceptance:** Given a failing invariant, when sign-off is attempted without an override reason, then it is refused.

#### BR-008 — Dual-scorer mutual confirmation
- **Description:** In dual-scorer mode, a reconciliation change **shall** apply only after both scorers confirm the agreed version; neither log **shall** be silently overwritten; sign-off **shall** be blocked while divergences remain (override = reason + dual attestation).
- **Rationale:** No scorer's independent record is discarded without agreement. (`OBJ-03`, `OBJ-07`)
- **Priority:** Must · P2
- **Dependencies:** FR-110, FR-111
- **Trace:** discovery BR-008; `MINV-14`; `MBR-03`
- **Acceptance:** Given a proposed agreed version, when only one scorer has confirmed, then neither log changes.

#### BR-009 — Valid XI composition
- **Description:** A playing XI **shall** contain exactly the configured number of players, exactly one captain and exactly one wicket-keeper before the first ball.
- **Rationale:** An invalid XI corrupts downstream figures and role logic. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-034
- **Trace:** discovery BR-009; DR-02, DR-03
- **Acceptance:** Given two captains marked, when validation runs, then it fails.

#### BR-010 — One side per player
- **Description:** A player **shall** appear in only one side's XI for a given match.
- **Rationale:** A player cannot represent both teams. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-034
- **Trace:** discovery BR-010
- **Acceptance:** Given the same player in both XIs, when validation runs, then it fails identifying the player.

#### BR-011 — Substitute restrictions and guest-match limits
- **Description:** A substitute fielder **shall not** bowl, bat or keep wicket (except a sanctioned concussion/impact substitute per config); a guest (unauthenticated) match **shall not** be shared, synced, or attached to a competition until claimed.
- **Rationale:** Substitute limits are a Law; guest matches are not yet first-class records. (`OBJ-01`, `OBJ-10`)
- **Priority:** Must · P1
- **Dependencies:** FR-035, FR-004
- **Trace:** discovery BR-011, BR-022 *(consolidated)*; DR-03; `MINV-15`
- **Acceptance:** Given a substitute fielder, when a bowling change to them is attempted, then it is refused.

#### BR-012 — Concussion substitute is like-for-like
- **Description:** A concussion substitute **shall** be a competition-approved like-for-like replacement; the replaced player takes no further part.
- **Rationale:** The Laws-sanctioned replacement is constrained. (`OBJ-01`)
- **Priority:** Must · P2
- **Dependencies:** FR-036
- **Trace:** discovery BR-012; DR-19 (RTHO)
- **Acceptance:** Given a concussion replacement applied, when the replaced player is selected for any action, then it is refused.

#### BR-013 — Verified-only aggregates
- **Description:** Career and team aggregate statistics **shall** derive only from matches in Final state marked verified, and **shall** exclude Super Overs.
- **Rationale:** Aggregates must come only from trustworthy data. (`OBJ-05`)
- **Priority:** Must · P2
- **Dependencies:** FR-133
- **Trace:** discovery BR-013; `MINV-12`, `MINV-17`
- **Acceptance:** Given a provisional match, when career runs are computed, then it does not contribute.

#### BR-014 — Approved appearance links
- **Description:** A player's appearance **shall** be added to their career record only after the appearance link is approved by an authorised role.
- **Rationale:** Prevents false claims polluting records. (`OBJ-07`)
- **Priority:** Must · P2
- **Dependencies:** FR-132
- **Trace:** discovery BR-014; `MINV-17`
- **Acceptance:** Given an unapproved claim, when career stats render, then the appearance is excluded.

#### BR-015 — Standings from Final, non-disputed only
- **Description:** Competition standings, NRR and bonus points **shall** recompute only from Final, non-disputed matches.
- **Rationale:** A table must reflect only settled results. (`OBJ-04`)
- **Priority:** Must · P2
- **Dependencies:** FR-125, FR-126
- **Trace:** discovery BR-015; `MINV-16`
- **Acceptance:** Given a disputed match, when standings recompute, then it is excluded until adjudicated.

#### BR-016 — Dispute lock
- **Description:** A match under dispute **shall** be locked to further scoring edits until an organizer records an adjudication.
- **Rationale:** Contested results need a controlled hold. (`OBJ-07`)
- **Priority:** Must · P2
- **Dependencies:** FR-106
- **Trace:** discovery BR-016; `SM-DISPUTE`
- **Acceptance:** Given a locked match, when a scoring edit is attempted, then it is refused pending adjudication.

#### BR-017 — Conditions freeze at first ball
- **Description:** Playing conditions **shall** be fixed at the first delivery; a mid-match change **shall** be recorded as an explicit, reasoned event.
- **Rationale:** The rule set a match was played under must be unambiguous. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-026, DR-35
- **Trace:** discovery BR-017; `MINV-05`; `MBR-05`
- **Acceptance:** Given a first delivery recorded, when a `[CFG]` value is edited, then it requires a reasoned amendment event, not an in-place change.

#### BR-018 — Target definition
- **Description:** The chase target **shall** be the opponent's total + 1, replaced by the DLS-revised target when a DLS revision is in effect (or a manual override).
- **Rationale:** The target is the spine of the second innings. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-078
- **Trace:** discovery BR-018; DR-28; `MINV-11`
- **Acceptance:** Given a first-innings 200 and no DLS, when the chase starts, then the target is 201.

#### BR-019 — Minimum-overs result validity
- **Description:** A limited-overs result **shall** be valid only if the minimum-overs threshold for the format/competition was met by the side batting second; otherwise the result is "no result" (unless decided earlier by all-out or target).
- **Rationale:** Competitions require a minimum game for a result to stand. (`OBJ-04`)
- **Priority:** Must · P1
- **Dependencies:** FR-028, FR-088
- **Trace:** discovery BR-019; DR-27
- **Acceptance:** Given the second innings abandoned below the minimum overs and not all out, when the result derives, then it is "no result".

#### BR-020 — Tie-breaker application
- **Description:** A tie **shall** trigger the competition's configured tie-breaker; if none is configured, the result stands as "tie".
- **Rationale:** How a tie resolves is a competition choice. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-021
- **Trace:** discovery BR-020; DR-30
- **Acceptance:** Given no tie-breaker configured, when scores finish level, then the recorded result is "tie".

#### BR-021 — DLS revision storage and reversibility
- **Description:** Every DLS revision **shall** store its inputs (overs lost, wickets down, score, time) and **shall** be individually reversible.
- **Rationale:** DLS decisions are disputed and must be reconstructable. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-087
- **Trace:** discovery BR-021; DR-36; AUD-009
- **Acceptance:** Given three revisions, when one is reverted, then the target reverts to the prior revision's value and the revert is logged.

#### BR-022 — Share links are read-only and revocable
- **Description:** Public share links **shall** grant read-only access and **shall** be revocable by the match owner at any time.
- **Rationale:** Sharing must not expose write access and must be retractable. (`OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-137
- **Trace:** discovery BR-023; NFR-029; SEC-009
- **Acceptance:** Given a revoked link, when opened, then access is refused.

#### BR-023 — Deactivated-member authorship retained
- **Description:** A deactivated member **shall** retain authorship of past events but **shall** perform no new actions; deleting an account **shall not** delete Final match records — the actor is anonymised in the audit trail per the retention policy.
- **Rationale:** History stays attributable even as people leave. (`OBJ-07`, `OBJ-09`)
- **Priority:** Must · P1
- **Dependencies:** FR-009, FR-011
- **Trace:** discovery BR-024, BR-025 *(consolidated)*; AUD-002
- **Acceptance:** Given a deleted account, when its authored Final matches are opened, then they reconcile and the actor shows as anonymised.

#### BR-024 — Toss determines initial innings order
- **Description:** Only the toss winner's elected decision **shall** determine the initial innings order, recorded before the first ball.
- **Rationale:** Innings order is not a free setup choice. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-023
- **Trace:** discovery BR-026; DR-05
- **Acceptance:** Given team A elects to bat, when the toss is recorded, then team A is set to bat first.

#### BR-025 — Bowler over rules
- **Description:** A bowler **shall not** bowl two overs in succession in the same innings, and **shall not** exceed the configured maximum overs per innings (either is overridable only with a recorded reason).
- **Rationale:** Both are Laws/competition rules that invalidate an over if breached. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-055, FR-056, FR-057
- **Trace:** discovery BR-027, BR-028 *(consolidated)*; DR-20; `INV-013`
- **Acceptance:** Given a bowler who bowled the last over, when selected for the next, then it is blocked unless overridden with a reason.

#### BR-026 — Innings-end conditions
- **Description:** An innings **shall** end at the first of: overs completed, configured wickets down, target passed, declaration, forfeiture, or (multi-day) time.
- **Rationale:** A single, ordered set of end conditions prevents ambiguity. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-071, FR-072, FR-073
- **Trace:** discovery BR-029; DR-06; `SVC-INNINGS-END-EVALUATOR`
- **Acceptance:** Given the target is passed on the same ball the final over would complete, when evaluated, then the innings ends by "target reached".

#### BR-027 — Dismissal attribution rules
- **Description:** Retired–hurt/ill **shall not** be a dismissal (the batter may resume); retired-out **shall** count as a wicket with no bowler credit; run-out, obstructing the field, hit the ball twice, timed out and retired-out **shall not** credit the bowler; a stumping **shall** be invalid off a no-ball; on a free hit the striker **shall** be dismissible only by the modes permitted off a no-ball; wickets in an innings **shall not** exceed the configured maximum.
- **Rationale:** These attribution rules are where scorers most often err. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** FR-049, FR-050, FR-051
- **Trace:** discovery BR-030, BR-031, BR-032, BR-033, BR-038 *(consolidated)*; DR-18, DR-19; `MINV-06`, `MINV-07`
- **Acceptance:** Given a stumping entered off a no-ball, when validated, then it is rejected and only run-out is offered.

#### BR-028 — Extras and total-identity rules
- **Description:** Byes and leg-byes **shall** be credited to team extras (not the striker) and count as legal deliveries; wides and no-balls **shall not** count as legal deliveries and **shall** be re-bowled, with associated runs as extras; penalty runs (5) **shall** be awarded to the opposing side and face no delivery; the match/innings total **shall** always equal Σ all batters' runs + all extras, and a card failing this **shall not** be signed off without an override.
- **Rationale:** These are the identities the reconciliation check enforces. (`OBJ-01`, `OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-044, FR-045, FR-046, FR-047, FR-101
- **Trace:** discovery BR-034, BR-035, BR-036, BR-037 *(consolidated)*; DR-11…16; `INV-001`, `INV-010`
- **Acceptance:** Given a card where total ≠ Σ batter + extras, when reconciliation runs, then total-identity reports FAIL and sign-off is blocked (BR-007).

#### BR-029 — Competition metric computation
- **Description:** Net Run Rate **shall** be computed by the competition's configured rule set (typically runs-per-over for minus against, all-out treated as the full over quota); bonus points **shall** be computed strictly per the competition's configured model.
- **Rationale:** Metrics must be exactly per the competition rules, not a default. (`OBJ-04`)
- **Priority:** Must · P2
- **Dependencies:** FR-029, FR-126
- **Trace:** discovery BR-039, BR-040 *(consolidated)*; DR-27
- **Acceptance:** Given a team all out in 30 of 50 overs, when NRR computes, then the 50-over quota is used for the overs-faced denominator.

#### BR-030 — Super Over rules and stat isolation
- **Description:** A Super Over **shall** be one over per side, maximum two wickets, three nominated batters and one nominated bowler per side; a tied Super Over **shall** trigger a further Super Over (unless the competition configures boundary count-back); Super Over statistics **shall not** count toward main-match or career aggregates.
- **Rationale:** The tie-breaker has its own constrained rules and must not leak into aggregates. (`OBJ-01`, `OBJ-05`)
- **Priority:** Must · P1
- **Dependencies:** FR-092, FR-093, FR-095
- **Trace:** discovery BR-041, BR-042, BR-043 *(consolidated)*; DR-30; `MINV-12`; `MBR-10`
- **Acceptance:** Given a Super Over, when a third wicket is attempted, then it is refused (the innings ended at the second).

#### BR-031 — Player-merge authority
- **Description:** Only an organization admin or platform admin **shall** merge player records; the merge **shall** be logged and the losing ID **shall** redirect to the surviving ID.
- **Rationale:** Merging rewrites historical attribution and must be controlled. (`OBJ-09`)
- **Priority:** Must · P2
- **Dependencies:** FR-039
- **Trace:** discovery BR-044; `MINV-18`
- **Acceptance:** Given a non-admin, when a merge is attempted, then it is refused.

#### BR-032 — Reference-data versioning
- **Description:** Reference-data updates (DLS tables, condition templates) **shall** apply to matches created after the update; in-progress matches **shall** keep the version they started with.
- **Rationale:** A match's rules and tables must not change under it mid-stream. (`OBJ-01`)
- **Priority:** Must · P1
- **Dependencies:** DR-35, FR-160
- **Trace:** discovery BR-045; `MINV-05`; `MBR-12`
- **Acceptance:** Given a DLS table update mid-match, when a revision is computed, then the match uses the table version pinned at its creation.

#### BR-033 — Timeline is the record
- **Description:** The match **shall** be represented as its ordered, append-only event stream; every match fact (score, figures, result) **shall** be a projection over the active (non-superseded, non-void) stream; no side channel **shall** assert match facts, and any projection **shall** be droppable and rebuildable with identical results.
- **Rationale:** Determinism, replayability and offline/online convergence all rest on this. (`OBJ-01`, `OBJ-03`)
- **Priority:** Must · P1
- **Dependencies:** FR-099, FR-100
- **Trace:** model `MBR-01`, `MBR-06`, `MBR-07`; `MINV-02`; discovery NFR-054
- **Acceptance:** Given a match's projections are discarded, when rebuilt from the stream, then every figure is identical to before.

#### BR-034 — Result is a derived function
- **Description:** The stored result **shall** always be re-derivable from the innings totals plus DLS/Super Over data by the result-deriver; a stored result that does not re-derive **shall** be a reconciliation failure, not an accepted state.
- **Rationale:** The result must never drift from the ball data. (`OBJ-04`, `OBJ-07`)
- **Priority:** Must · P1
- **Dependencies:** FR-079, FR-101
- **Trace:** model `MBR-11`; `MINV-13`; discovery BR (result); `INV-014`
- **Acceptance:** Given a manually edited result statement inconsistent with the totals, when reconciliation runs, then result-consistency reports FAIL.

---

## 7. Non-Functional Requirements

Quality attributes. Security is §8, offline behaviour §9, synchronization §10, audit §11 — cross-referenced where relevant. Each `NFR-XXX` consolidates discovery `NFR-*` / `WEB-*` / `AND-*` (cited). Targets marked "(TBD, planning)" are to be fixed during planning per the source.

### 7.1 Performance & efficiency

#### NFR-001 — Interactions per delivery
- **Description:** A normal delivery **shall** be recordable in ≤ 2 discrete interactions.
- **Rationale:** The scorer must keep pace with live play. (`OBJ-08`)
- **Priority:** Must · P1 · **Dependencies:** FR-063, FR-154
- **Trace:** discovery NFR-001; SCR-001/003
- **Acceptance:** Given target hardware, when the median over a scored innings is measured, then it is ≤ 2 interactions for normal deliveries.

#### NFR-002 — Input latency
- **Description:** The UI **shall** acknowledge a scoring input within ≤ 100 ms on target Android hardware.
- **Rationale:** Perceptible lag breaks scoring rhythm. (`OBJ-08`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery NFR-002; AND-002; WEB-020
- **Acceptance:** Given target hardware, when a scoring control is tapped, then visual acknowledgement occurs within 100 ms at p95.

#### NFR-003 — Keeping pace with live play
- **Description:** A single scorer **shall** be able to keep pace with live play for any supported format with no growing backlog.
- **Rationale:** Falling behind is the failure mode volunteers fear most. (`OBJ-08`)
- **Priority:** Must · P1 · **Dependencies:** NFR-001, NFR-002
- **Trace:** discovery NFR-003
- **Acceptance:** Given a live-paced T20 simulation, when scored by one person, then the entry queue never exceeds one delivery for more than a defined short interval.

#### NFR-004 — Output render time
- **Description:** A full scorecard and the standard charts **should** render in ≤ 1 s for a completed T20.
- **Rationale:** Scorers and viewers expect near-instant outputs. (`OBJ-05`)
- **Priority:** Should · P1 · **Dependencies:** FR-112, FR-119
- **Trace:** discovery NFR-004
- **Acceptance:** Given a completed T20, when the scorecard view opens, then first meaningful render is ≤ 1 s on target hardware.

#### NFR-005 — Cold start
- **Description:** The app **should** cold-start to "ready to score" in ≤ 3 s on target hardware.
- **Rationale:** Scorers open the app as play is about to start. (`OBJ-08`)
- **Priority:** Should · P1 · **Dependencies:** —
- **Trace:** discovery NFR-005; AND-020
- **Acceptance:** Given a cold process, when launched on target hardware, then the scoring screen is interactive within 3 s.

#### NFR-006 — Sync duration
- **Description:** A full offline T20 (~250+ events) **shall** sync in ≤ 30 s on a 3G-class connection.
- **Rationale:** Scorers file the match from the car park after play. (`OBJ-03`)
- **Priority:** Must · P1 · **Dependencies:** SYNC-001
- **Trace:** discovery NFR-006
- **Acceptance:** Given a 3G-class link, when a full offline T20 reconnects, then p95 sync completes within 30 s.

#### NFR-007 — Battery endurance
- **Description:** Battery use **should** allow a full day's play (≥ 8 h intermittent scoring) on a mid-range phone with the screen dimmed.
- **Rationale:** No power at the ground. (`OBJ-02`)
- **Priority:** Should · P1 · **Dependencies:** FR-151
- **Trace:** discovery NFR-007; AND-010
- **Acceptance:** Given a mid-range phone at 50% brightness, when used for a day's intermittent scoring, then the app is not the dominant battery consumer and the match completes without a charge.

#### NFR-008 — Local storage budget
- **Description:** Local storage per match **shall** stay within a documented budget, and the app **shall** function with years of local history.
- **Rationale:** Devices are not replaced often at club level. (`OBJ-02`)
- **Priority:** Should · P1 · **Dependencies:** FR-155, OFF-016
- **Trace:** discovery NFR-008
- **Acceptance:** Given N seasons of local matches, when the app runs, then start-up and search remain within the performance budgets and storage use is within the documented per-match figure × N.

### 7.2 Reliability, durability & availability

#### NFR-009 — Zero event loss under chaos
- **Description:** Zero ball-events **shall** be lost across the defined chaos test (force-kill, battery pull, OS eviction, offline toggling) over ≥ 50 simulated innings on target Android hardware.
- **Rationale:** Losing a ball is unrecoverable trust damage. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-003, OFF-004, SPK-03
- **Trace:** discovery NFR-009
- **Acceptance:** Given the chaos harness over ≥ 50 innings, when each run is replayed from its log, then event loss is exactly zero.

#### NFR-010 — Durable-before-confirm
- **Description:** Every scoring event **shall** be persisted durably before the UI confirms it.
- **Rationale:** A confirmed entry must survive an immediate crash. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-003
- **Trace:** discovery NFR-010; AND-005; OFR-003
- **Acceptance:** Given a delivery confirmed, when power is pulled immediately, then on relaunch that delivery is present.

#### NFR-011 — Crash recovery to exact state
- **Description:** On relaunch after a crash, the match **shall** resume at the exact last confirmed state.
- **Rationale:** No re-keying, no guesswork after a crash. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-004
- **Trace:** discovery NFR-011; OFR-004; AND-004
- **Acceptance:** Given a crash mid-over, when relaunched, then the striker, bowler, over.ball and figures match the pre-crash state.

#### NFR-012 — No connectivity required for scoring
- **Description:** No connectivity **shall** be required for any part of scoring a match from setup to sign-off.
- **Rationale:** The core offline-first guarantee. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** §9 (`OFF-*`)
- **Trace:** discovery NFR-012; OFR-001, OFR-002, OFR-018
- **Acceptance:** Given airplane mode for the whole match, when setup through sign-off is performed, then every step succeeds.

#### NFR-013 — Online availability
- **Description:** Online services **should** achieve ≥ 99.5% monthly availability.
- **Rationale:** Sharing, sync and competitions need dependable uptime. (`OBJ-10`)
- **Priority:** Should · P2 · **Dependencies:** FR-160
- **Trace:** discovery NFR-013
- **Acceptance:** Given a calendar month, when uptime is measured, then it is ≥ 99.5%.

#### NFR-014 — Backend degradation never blocks scoring
- **Description:** Backend degradation or outage **shall not** block offline scoring; clients **shall** queue and retry.
- **Rationale:** The backend is a destination, not a dependency. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** SYNC-004, OFF-005
- **Trace:** discovery NFR-014; OFR-018, OFR-019
- **Acceptance:** Given the backend is unreachable, when a match is scored and signed off, then all functions work and outbound actions queue and drain on recovery.

#### NFR-015 — Multi-day local durability
- **Description:** Data **shall** be retained locally without loss for the full duration of a multi-day match (≥ 5 days).
- **Rationale:** Multi-day matches accumulate state across days offline. (`OBJ-02`)
- **Priority:** Should · P3 · **Dependencies:** NFR-009
- **Trace:** discovery NFR-015; OFR-012
- **Acceptance:** Given a 5-day match scored locally, when the chaos test runs across the period, then no data is lost.

### 7.3 Scalability

#### NFR-016 — Concurrent live matches and viewers
- **Description:** The system **should** support a defined target of concurrent live matches and per-match viewers without degradation (target TBD, planning).
- **Rationale:** Saturday afternoons have many simultaneous matches. (`OBJ-10`, `OBJ-05`)
- **Priority:** Should · P2 · **Dependencies:** NFR-017
- **Trace:** discovery NFR-020
- **Acceptance:** Given the planned target load, when sustained, then latency and error rates stay within budget.

#### NFR-017 — Viewer fan-out graceful degradation
- **Description:** Viewer fan-out **should** degrade gracefully to periodic polling under load.
- **Rationale:** A popular match must not take down realtime for others. (`OBJ-05`)
- **Priority:** Should · P2 · **Dependencies:** FR-138
- **Trace:** discovery NFR-021
- **Acceptance:** Given realtime capacity is exceeded, when a viewer connects, then it falls back to polling with the staleness indicator (FR-138).

#### NFR-018 — Tenant data volume
- **Description:** Tenant data volume **should** scale to multi-season history per organization.
- **Rationale:** Clubs stay for years. (`OBJ-10`)
- **Priority:** Should · P2 · **Dependencies:** —
- **Trace:** discovery NFR-022
- **Acceptance:** Given an organization with multiple seasons, when its data is queried, then response times stay within budget.

### 7.4 Usability & accessibility

#### NFR-019 — WCAG 2.2 AA on core flows
- **Description:** Core web scoring and scorecard flows **shall** meet WCAG 2.2 AA (keyboard, screen reader, contrast, focus order).
- **Rationale:** Accessibility is a first-class objective. (`OBJ-11`)
- **Priority:** Must · P1 · **Dependencies:** FR-164
- **Trace:** discovery NFR-037; WEB-012
- **Acceptance:** Given an audit of the core web flows, when performed, then there are zero blocking WCAG 2.2 AA issues.

#### NFR-020 — One-handed reach
- **Description:** Primary scoring actions **shall** be reachable one-handed on phones up to a defined size.
- **Rationale:** The primary persona scores one-handed, standing. (`OBJ-08`)
- **Priority:** Must · P1 · **Dependencies:** FR-165
- **Trace:** discovery NFR-038; AND-002
- **Acceptance:** Given a phone of the defined maximum size, when scoring, then all primary actions are within thumb reach in the portrait layout.

#### NFR-021 — Touch-target size
- **Description:** Touch targets for scoring controls **should** meet a defined minimum size, usable with thin gloves.
- **Rationale:** Cold-weather scoring with gloves is common. (`OBJ-08`)
- **Priority:** Should · P1 · **Dependencies:** FR-165
- **Trace:** discovery NFR-039; AND-003
- **Acceptance:** Given the scoring UI, when measured, then every primary control meets the defined minimum target size.

#### NFR-022 — First-use success
- **Description:** A first-time volunteer scorer **shall** complete a guided practice match with ≥ 95% task completion and no unrecoverable error.
- **Rationale:** New scorers must succeed on their first match. (`OBJ-08`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery NFR-040
- **Acceptance:** Given a panel of first-time scorers, when each completes the guided match, then task completion is ≥ 95% with zero unrecoverable errors.

#### NFR-023 — Satisfaction (SUS)
- **Description:** The system **should** achieve a System Usability Scale score ≥ 80 with a panel of club scorers.
- **Rationale:** Adoption depends on scorers preferring it. (`OBJ-08`)
- **Priority:** Should · P1 · **Dependencies:** —
- **Trace:** discovery NFR-041
- **Acceptance:** Given a SUS survey of the pilot panel, when scored, then the mean is ≥ 80.

#### NFR-024 — Sunlight-readable mode
- **Description:** A high-contrast, sunlight-readable mode **shall** be available for outdoor use.
- **Rationale:** Screens wash out in bright light. (`OBJ-11`)
- **Priority:** Must · P1 · **Dependencies:** FR-153
- **Trace:** discovery NFR-042; WEB-015; AND-012
- **Acceptance:** Given sunlight mode, when enabled outdoors, then contrast meets the defined threshold and all text remains legible.

#### NFR-025 — Destructive actions reversible/confirmable
- **Description:** All destructive actions **shall** be confirmable and/or reversible.
- **Rationale:** A mis-tap must never silently destroy data. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-059
- **Trace:** discovery NFR-043
- **Acceptance:** Given any action that deletes or overwrites, when invoked, then it is either confirmed first or undoable.

### 7.5 Compatibility & portability

#### NFR-026 — Android compatibility
- **Description:** The Android app **shall** support Android 10+ on mid-range hardware and phone sizes small→large, with basic tablet support.
- **Rationale:** Matches the assumed device base. (`OBJ-06`; `A-04`)
- **Priority:** Must · P1 · **Dependencies:** FR-165
- **Trace:** discovery NFR-044; AND-001, AND-011
- **Acceptance:** Given the defined device matrix, when the app runs, then all core flows function on every entry in the matrix.

#### NFR-027 — Web compatibility
- **Description:** The web app **shall** support current evergreen browsers on desktop, laptop, tablet and Chromebook, and **shall** be an installable PWA that works offline.
- **Rationale:** Professional scorers and organizers work on the web. (`OBJ-06`, `OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** FR-163
- **Trace:** discovery NFR-045, NFR-046; WEB-001, WEB-006
- **Acceptance:** Given each supported browser, when the PWA is installed and taken offline, then a full match can be scored.

#### NFR-028 — Cross-platform behavioural parity
- **Description:** Scoring-core behaviour **shall** be identical across Web and Android for identical inputs (contract-tested), with a parity matrix ≥ 95%.
- **Rationale:** A scorecard must not depend on the client. (`OBJ-06`)
- **Priority:** Must · P1 · **Dependencies:** FR-168, SPK-04
- **Trace:** discovery NFR-047, NFR-048; WEB-022, AND-024
- **Acceptance:** Given the shared contract-test suite on both clients, when run, then outputs are identical and the matrix is ≥ 95%.

#### NFR-029 — Consumable exports
- **Description:** Exported data **shall** be consumable without proprietary tooling.
- **Rationale:** Data ownership means open formats. (`OBJ-09`)
- **Priority:** Must · P1 · **Dependencies:** FR-143, FR-144, FR-145
- **Trace:** discovery NFR-049
- **Acceptance:** Given each export format, when opened with common free tools, then the content is fully readable.

### 7.6 Interoperability

#### NFR-030 — Cricsheet schema conformance
- **Description:** Cricsheet-compatible export **shall** conform to the published schema and validate against it; lossy fields **shall** be enumerated.
- **Rationale:** Interchange only works if it validates. (`OBJ-09`; `A-08`)
- **Priority:** Should · P1 · **Dependencies:** FR-145, SPK-05
- **Trace:** discovery NFR-050
- **Acceptance:** Given an exported match, when validated against the schema, then it passes and any lossy fields are listed.

#### NFR-031 — Round-trip fidelity
- **Description:** Export→import round-trip **shall** preserve the match with zero material difference for supported fields.
- **Rationale:** Data must survive a round trip. (`OBJ-09`)
- **Priority:** Should · P2 · **Dependencies:** FR-146
- **Trace:** discovery NFR-051
- **Acceptance:** Given a match exported then re-imported, when compared field-by-field, then supported fields are identical.

#### NFR-032 — Stable external identifiers
- **Description:** Identifiers exposed externally **shall** be stable across releases.
- **Rationale:** External consumers cannot tolerate ID churn. (`OBJ-09`)
- **Priority:** Should · P2 · **Dependencies:** FR-148
- **Trace:** discovery NFR-052
- **Acceptance:** Given an external ID from release N, when resolved in release N+k, then it points to the same entity.

### 7.7 Maintainability, observability & testability

#### NFR-033 — Cricket-rules conformance suite
- **Description:** A versioned cricket-rules conformance suite **shall** exist (covering every `CSR-*` and worked example) and **shall** pass 100% for a release.
- **Rationale:** The engine's correctness is the product. (`OBJ-01`)
- **Priority:** Must · P1 · **Dependencies:** §5 (`DR-*`)
- **Trace:** discovery NFR-053; DR-31
- **Acceptance:** Given the conformance suite, when run on a release candidate, then 100% pass and the version is recorded.

#### NFR-034 — Deterministic, replayable engine
- **Description:** The scoring engine **shall** be deterministic and replayable from its event log.
- **Rationale:** Basis of corrections, sync convergence and audit. (`OBJ-01`)
- **Priority:** Must · P1 · **Dependencies:** BR-033
- **Trace:** discovery NFR-054; `MBR-07`
- **Acceptance:** Given the same event log, when replayed on any build, then every projection is identical.

#### NFR-035 — Operable observability without PII
- **Description:** Errors and sync failures **shall** be observable to operators without exposing personal data.
- **Rationale:** Operations need signal; users need privacy. (`OBJ-10`)
- **Priority:** Should · P1 · **Dependencies:** FR-160
- **Trace:** discovery NFR-055; ADM-106
- **Acceptance:** Given an error in production, when it surfaces in dashboards/logs, then it carries diagnostic context and no PII.

#### NFR-036 — Central reference-data updates
- **Description:** Reference data (DLS tables, condition templates) **shall** be updatable centrally without a client release.
- **Rationale:** Rules and tables change between app releases. (`OBJ-01`)
- **Priority:** Should · P2 · **Dependencies:** FR-160, BR-032
- **Trace:** discovery NFR-056; ONR-012
- **Acceptance:** Given a new condition template published, when a client next syncs, then it is available with no app update.

### 7.8 Privacy & compliance

#### NFR-037 — Data minimisation
- **Description:** Personal-data collection **shall** be minimised; scoring **shall** work with names only.
- **Rationale:** Low-sensitivity data model; less to protect. (`OBJ-11`; `A-10`, `C-9`)
- **Priority:** Must · P1 · **Dependencies:** FR-030
- **Trace:** discovery NFR-031
- **Acceptance:** Given a full match, when scored, then no personal field beyond player names is required.

#### NFR-038 — Data-protection compliance
- **Description:** The system **shall** meet GDPR-class data-protection obligations for target jurisdictions, including data export and erasure.
- **Rationale:** Legal requirement and a data-ownership objective. (`OBJ-09`)
- **Priority:** Must · P1 · **Dependencies:** FR-010, FR-011
- **Trace:** discovery NFR-032
- **Acceptance:** Given an export or erasure request, when processed, then it completes within the policy window and is logged.

#### NFR-039 — Minors' data handling
- **Description:** Minors' data **shall** receive special handling (consent, reduced profile visibility).
- **Rationale:** Child-data protection is a design constraint. (`OBJ-11`; `A-15`)
- **Priority:** Should · P2 · **Dependencies:** FR-013
- **Trace:** discovery NFR-033
- **Acceptance:** Given a minor profile, when displayed to a non-guardian, then only the permitted reduced fields appear.

#### NFR-040 — DLS licence and swappability
- **Description:** The DLS implementation **shall** be used under an appropriate licence/permission, and the method **shall** be swappable if terms change.
- **Rationale:** Legal basis for DLS is unresolved (`SPK-01`). (`OBJ-01`)
- **Priority:** Must · P1 · **Dependencies:** FR-091, SPK-01, A-06
- **Trace:** discovery NFR-034
- **Acceptance:** Given the licence decision, when recorded, then the shipped method matches what is permitted, and the interface allows an alternative without a rewrite.

#### NFR-041 — Laws text cited, not copied
- **Description:** The Laws of Cricket **shall** be implemented as logic and cited, not reproduced verbatim without permission.
- **Rationale:** MCC text IP (`SPK-06`). (`OBJ-01`)
- **Priority:** Must · P1 · **Dependencies:** SPK-06, A-07
- **Trace:** discovery NFR-035
- **Acceptance:** Given in-app rule/help text, when reviewed, then any verbatim Law text has permission on file or is paraphrased.

#### NFR-042 — Privacy-respecting telemetry
- **Description:** Telemetry **shall** be privacy-respecting, disclosed, and opt-outable where required.
- **Rationale:** Feedback data must not compromise trust. (`OBJ-11`)
- **Priority:** Should · P1 · **Dependencies:** —
- **Trace:** discovery NFR-036
- **Acceptance:** Given telemetry enabled, when inspected, then it contains no PII and an opt-out is available and effective.

### 7.9 Internationalisation

#### NFR-043 — Externalised strings
- **Description:** All user-facing strings **shall** be externalised for translation.
- **Rationale:** Localization-ready structure from the start. (`OBJ-11`; `A-13`)
- **Priority:** Should · P1 · **Dependencies:** FR-157
- **Trace:** discovery NFR-057; WEB-013
- **Acceptance:** Given a pseudo-locale, when applied, then no hard-coded English string appears in the core flows.

#### NFR-044 — Locale-aware formatting
- **Description:** Date, time and number formatting **shall** be locale-aware.
- **Rationale:** Regions differ in formats. (`OBJ-11`)
- **Priority:** Should · P1 · **Dependencies:** FR-152
- **Trace:** discovery NFR-058
- **Acceptance:** Given a locale, when dates/numbers render, then they follow that locale's conventions.

#### NFR-045 — Unambiguous match timestamps
- **Description:** Match timestamps **shall** be stored unambiguously and displayed in the match time zone.
- **Rationale:** Audit and scorecards must be time-consistent regardless of device. (`OBJ-11`)
- **Priority:** Must · P1 · **Dependencies:** FR-024, FR-152
- **Trace:** discovery NFR-059; `INV-017`
- **Acceptance:** Given devices in different zones, when the same event is viewed on each, then the displayed time is identical (the match zone).

---

## 8. Security Requirements

`SEC-XXX` consolidate discovery `NFR-023…030`, `ADM-107`, `ONR-021/022`, foundation risk 15, and model `SVC-AUTHORIZER`. Data is low-sensitivity but high-integrity (`A-10`, `C-8`): the emphasis is authorization, tamper-evidence and attribution over confidentiality.

#### SEC-001 — Transport encryption
- **Description:** All network traffic between clients and backend **shall** use transport encryption; plaintext transport **shall not** be accepted.
- **Rationale:** Baseline confidentiality and integrity in transit. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery NFR-023
- **Acceptance:** Given a client request, when inspected on the wire, then it is encrypted; a downgrade attempt is refused.

#### SEC-002 — Credential and session security
- **Description:** Authentication **shall** use salted-hashed credentials, support password reset and full session revocation, and expire sessions per policy (with an offline grace period per OFF-013).
- **Rationale:** Accounts gate tenancy, sharing and attribution. (`OBJ-10`)
- **Priority:** Must · P1 · **Dependencies:** FR-002
- **Trace:** discovery FR-012; ONR-008
- **Acceptance:** Given a revoked session, when it is used, then the request is rejected and re-authentication is required.

#### SEC-003 — Least-privilege client
- **Description:** A client **shall** be able to read or write only data within its actor's permissions; server-side authorization **shall** be the enforcement point, never client-side checks alone.
- **Rationale:** A compromised or modified client must not exceed its rights. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** SEC-005
- **Trace:** discovery NFR-024; `SVC-AUTHORIZER`
- **Acceptance:** Given a crafted request for another organization's match, when received, then the data layer denies it regardless of client UI state.

#### SEC-004 — Data-layer role enforcement (RLS)
- **Description:** Access **shall** be enforced by role at the data layer via row-level security policies, covering read and write, for every tenant-scoped table.
- **Rationale:** Defence in depth: authorization lives with the data. (`OBJ-07`, `OBJ-10`)
- **Priority:** Must · P1 · **Dependencies:** FR-005, A-09
- **Trace:** discovery NFR-024; foundation risk 15
- **Acceptance:** Given RLS policies, when a security review runs the policy test matrix, then no row is readable or writable outside the actor's role scope.

#### SEC-005 — Additive RBAC model
- **Description:** The system **shall** implement the additive role model of `R1 §4`; roles grant capabilities and never remove them; every capability maps to an explicit role check.
- **Rationale:** Predictable, auditable permissions. (`OBJ-10`)
- **Priority:** Must · P1 · **Dependencies:** FR-007
- **Trace:** R1 §4; discovery ADM-002…006
- **Acceptance:** Given a user with two roles, when they act, then their capability set is exactly the union of the two roles.

#### SEC-006 — Scorer-only delivery writes
- **Description:** Only the Head Scorer or Assistant Scorer roles on a match **shall** be able to write or correct deliveries; all other roles are read-only with respect to the ball log.
- **Rationale:** The record's integrity depends on constraining who writes it. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** SEC-004, SEC-005
- **Trace:** discovery NFR-026; BR-003; `SVC-AUTHORIZER`
- **Acceptance:** Given a Captain role, when a delivery write is attempted, then it is refused at the data layer.

#### SEC-007 — Local data protection at rest
- **Description:** Local data at rest on device **shall** rely on OS-level encryption where available, and sensitive fields **shall** be minimised in local storage.
- **Rationale:** Devices are lost; local data is mostly low-sensitivity but should still be protected. (`OBJ-07`)
- **Priority:** Should · P1 · **Dependencies:** —
- **Trace:** discovery NFR-027
- **Acceptance:** Given a device with OS encryption on, when the local store is inspected without unlocking, then match data is not readable.

#### SEC-008 — Minimum Android permissions
- **Description:** The Android client **shall** request only the minimum permissions its enabled features require; no location or contacts access unless a feature in use requires it.
- **Rationale:** Privacy-minimal footprint; store compliance. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-166
- **Trace:** discovery AND-016
- **Acceptance:** Given first run, when permissions are enumerated, then each maps to an enabled feature.

#### SEC-009 — Unguessable, revocable share links
- **Description:** Public share links **shall** be unguessable (high-entropy tokens), read-only, and revocable/rotatable by the match owner at any time.
- **Rationale:** Sharing must not leak write access or be enumerable. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-137
- **Trace:** discovery NFR-029; BR-022; ONR-022
- **Acceptance:** Given a revoked token, when used, then access is denied; given a token, when altered by one character, then it does not resolve.

#### SEC-010 — Rate limiting and abuse protection
- **Description:** Public and API endpoints **shall** enforce rate limiting and abuse protection.
- **Rationale:** Protect availability and data from scraping/abuse. (`OBJ-10`)
- **Priority:** Should · P2 · **Dependencies:** FR-147, FR-129
- **Trace:** discovery NFR-030
- **Acceptance:** Given requests above the configured rate, when received, then they are throttled with a standard response and logged.

#### SEC-011 — Consented, logged impersonation
- **Description:** Platform-admin support impersonation **shall** require explicit user consent on record and **shall** log every impersonated action with both the admin and the impersonated identity.
- **Rationale:** Support access must be attributable and bounded. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-161, AUD-007
- **Trace:** discovery NFR-028; ADM-107; ONR-021
- **Acceptance:** Given no consent record, when impersonation is attempted, then it is refused; given an impersonated action, then the audit entry names both identities.

#### SEC-012 — Tamper-evident record (see AUD)
- **Description:** The event log and audit trail **shall** be append-only and tamper-evident such that any post-hoc alteration is detectable.
- **Rationale:** High-integrity data model; disputes hinge on trust in the record. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** AUD-001
- **Trace:** discovery NFR-025; `MINV-01`
- **Acceptance:** Given a stored event is altered out of band, when integrity verification runs, then the alteration is flagged.

#### SEC-013 — Minor-data access control
- **Description:** Access to minors' profile data **shall** be restricted to guardians and authorised roles; public and cross-tenant exposure **shall** be reduced per policy.
- **Rationale:** Child-data protection. (`OBJ-11`; `A-15`)
- **Priority:** Should · P2 · **Dependencies:** FR-013, NFR-039
- **Trace:** discovery NFR-033
- **Acceptance:** Given a minor profile, when requested by an unauthorised actor, then only the reduced public field set is returned.

#### SEC-014 — Input validation on uploaded logs
- **Description:** The backend **shall** validate uploaded event logs server-side (schema, ordinal monotonicity, provenance, authorization) and reject or quarantine malformed or unauthorised events.
- **Rationale:** Sync ingest is an attack surface; a bad log must not corrupt a match. (`OBJ-03`, `OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** SYNC-005, SEC-006
- **Trace:** discovery ONR-016; `INV-017`
- **Acceptance:** Given an event log with a forged actor, when uploaded, then it is rejected and the attempt is logged.

#### SEC-015 — Export/erasure integrity
- **Description:** Personal-data export and erasure **shall** be authenticated, authorised to the data subject (or an authorised admin), and logged; erasure **shall** preserve Final match records with actor anonymisation (BR-023).
- **Rationale:** Compliance flows are themselves security-sensitive. (`OBJ-09`)
- **Priority:** Must · P1 · **Dependencies:** FR-010, FR-011
- **Trace:** discovery NFR-032; ONR-014; BR-025
- **Acceptance:** Given an erasure request, when completed, then personal data is removed, Final matches remain and reconcile, and the operation is in the audit trail.

#### SEC-016 — Guest-to-account boundary
- **Description:** A guest match **shall** have no server-side footprint until claimed; claiming **shall** bind it to the claiming account and thereafter apply that account's authorization.
- **Rationale:** Guest data must not be silently associated with any account. (`OBJ-09`, `OBJ-10`)
- **Priority:** Must · P1 · **Dependencies:** FR-004
- **Trace:** discovery BR-022; `MINV-15`; `MBR-02`
- **Acceptance:** Given an unclaimed guest match, when the backend is queried by any account, then it is not found.

#### SEC-017 — API key scoping and rotation
- **Description:** Organization API keys **shall** be scoped to that organization's readable data, revocable, and rotatable, with per-key rate limits.
- **Rationale:** Programmatic access must be bounded and revocable. (`OBJ-09`)
- **Priority:** Could · P2 · **Dependencies:** FR-014, FR-147, SEC-010
- **Trace:** discovery FR-015; ONR-022
- **Acceptance:** Given a rotated key, when the old key is used, then it is rejected after the grace window.

#### SEC-018 — Staged rollout and rollback safety
- **Description:** Platform release controls (feature flags, staged rollout, rollback) **shall** be restricted to platform-admin roles and **shall** be audit-logged; a client downgrade **shall not** lose unsynced local data.
- **Rationale:** Release controls are powerful and must be attributable and safe. (`OBJ-10`)
- **Priority:** Should · P1 · **Dependencies:** FR-160, OFF-012
- **Trace:** discovery ADM-104, ADM-114; OFR-024; AND-019
- **Acceptance:** Given a rollback, when applied, then it is logged with the admin identity and no device loses queued events.

---

## 9. Offline Requirements

`OFF-XXX` consolidate discovery `OFR-001…024`, `NFR-009…015`, `WEB-001/007/019`, `AND-001…005/015/019/022`. All trace to `OBJ-02` unless noted. All are **Must · P1** unless noted.

#### OFF-001 — Full offline match setup
- **Description:** The system **shall** create and fully configure a match (format, conditions, squads, XIs, roles, toss) with no connectivity.
- **Rationale:** Setup happens at the ground, often offline. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** FR-016, FR-026
- **Trace:** discovery OFR-001
- **Acceptance:** Given airplane mode, when a match is set up end to end, then it passes validation and scoring can start.

#### OFF-002 — Full offline scoring to sign-off
- **Description:** The system **shall** score a complete match — both innings, any Super Over, corrections, reconciliation and sign-off — with no connectivity.
- **Rationale:** The core guarantee. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** FR-082, FR-103
- **Trace:** discovery OFR-002, OFR-018; NFR-012
- **Acceptance:** Given airplane mode for the whole match, when signed off, then the match is Final locally and queued to publish/notify on reconnection.

#### OFF-003 — Write-ahead persistence per event
- **Description:** The system **shall** persist every scoring event durably on-device before the UI confirms it.
- **Rationale:** A confirmed entry must survive an immediate failure. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery OFR-003; NFR-010; AND-005
- **Acceptance:** Given a delivery confirmed, when the process is killed instantly, then the delivery is present on relaunch.

#### OFF-004 — Crash / kill / reboot recovery
- **Description:** The system **shall** recover to the exact last confirmed state after a crash, OS kill, or reboot.
- **Rationale:** No re-keying after an interruption. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-003
- **Trace:** discovery OFR-004; NFR-011; AND-004, AND-007
- **Acceptance:** Given a reboot mid-innings, when the app reopens, then it resumes at the last confirmed delivery with all figures intact.

#### OFF-005 — Visible local queue
- **Description:** The system **shall** maintain a local queue of unsynced events with a visible count and status.
- **Rationale:** Scorers need to know what has not yet reached the cloud. (`OBJ-02`, `OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery OFR-005; AND-006, AND-023
- **Acceptance:** Given offline scoring, when the sync indicator is viewed, then it shows the count of pending events and "last synced" time.

#### OFF-006 — Per-device sequence and logical clock
- **Description:** The system **shall** assign each local event a monotonic per-device sequence number and a logical timestamp, sufficient for later deterministic merge.
- **Rationale:** The foundation for P2 sync and dual-scorer without a rewrite. (`OBJ-03`; `SPK-02`, `A-16`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery OFR-006; `MINV-03`, `MINV-17`; SYNC-006
- **Acceptance:** Given two devices scoring offline, when their logs are later merged, then per-device ordering is preserved and the merge is deterministic.

#### OFF-007 — Offline access to cached reference data
- **Description:** The system **shall** provide offline access to previously loaded squads, players, templates and competition config.
- **Rationale:** Setup and scoring reference this data with no signal. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-014
- **Trace:** discovery OFR-007
- **Acceptance:** Given a squad loaded while online, when offline later, then it is fully available for selection.

#### OFF-008 — Offline DLS / par calculation
- **Description:** The system **shall** perform all DLS and par calculations offline from pinned tables.
- **Rationale:** Rain happens at offline grounds. (`OBJ-04`)
- **Priority:** Must · P1 *(gated by `SPK-01`; else FR-084 manual only)* · **Dependencies:** FR-083
- **Trace:** discovery OFR-008; NFR-012
- **Acceptance:** Given no connectivity, when a DLS revision is requested, then it computes locally with no network call.

#### OFF-009 — Offline outputs and charts
- **Description:** The system **shall** render the full scorecard, linear sheet, bowling analysis, FoW and standard charts offline.
- **Rationale:** Scorers produce outputs at the ground. (`OBJ-05`)
- **Priority:** Must · P1 · **Dependencies:** FR-112, FR-119
- **Trace:** discovery OFR-009
- **Acceptance:** Given offline, when the scorecard and Manhattan chart are opened, then both render fully.

#### OFF-010 — Offline PDF and CSV export
- **Description:** The system **shall** produce PDF and CSV exports offline for locally held matches.
- **Rationale:** The card is emailed the same evening, often from a poor connection. (`OBJ-09`)
- **Priority:** Must · P1 · **Dependencies:** FR-143, FR-144
- **Trace:** discovery OFR-010; WEB-009; AND-013
- **Acceptance:** Given offline, when PDF and CSV export run, then both files are produced on-device.

#### OFF-011 — Offline local backup and restore
- **Description:** The system **shall** create and restore local backup files without connectivity.
- **Rationale:** Device loss must not lose an unsynced season. (`OBJ-02`)
- **Priority:** Should · P1 · **Dependencies:** FR-149
- **Trace:** discovery OFR-011; AND-018
- **Acceptance:** Given offline, when a backup is created and restored on another offline device, then the matches are reconstructed identically.

#### OFF-012 — Unsynced data survives app updates
- **Description:** Unsynced local data **shall** be preserved across app updates and client downgrades.
- **Rationale:** A release must never cost a scorer their unfiled match. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-003
- **Trace:** discovery OFR-024; AND-019
- **Acceptance:** Given queued events, when the app is updated, then the queue is intact and syncs normally afterward.

#### OFF-013 — Offline authenticated-session grace period
- **Description:** The system **shall** continue an authenticated session offline for a configurable grace period, and support offline sign-in via the cached session.
- **Rationale:** Scorers sign in at home and stay signed in all match day. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** FR-003, SEC-002
- **Trace:** discovery OFR-020; AND-022; WEB-019
- **Acceptance:** Given a session established online, when offline within the grace period, then role-permitted actions remain available without re-auth.

#### OFF-014 — Pre-download for planned offline use
- **Description:** The system **shall** let the user pre-download a match's squads, config and reference data while online for planned offline use.
- **Rationale:** Scorers prepare before travelling to an offline ground. (`OBJ-02`)
- **Priority:** Should · P1 · **Dependencies:** OFF-007
- **Trace:** discovery OFR-021; AND-015
- **Acceptance:** Given a pre-download performed online, when the device is offline at the ground, then the match opens with all referenced data present.

#### OFF-015 — Device-clock timestamps with skew flagging
- **Description:** While offline, the system **shall** use the device clock for timestamps and **shall** flag suspected clock skew on sync (not silently trust or reject it).
- **Rationale:** Offline timestamps are best-effort; skew must be visible, not corrupt the record. (`OBJ-03`)
- **Priority:** Must · P1 · **Dependencies:** OFF-006
- **Trace:** discovery OFR-017; `INV-017`; SYNC-007
- **Acceptance:** Given a device clock 20 minutes fast, when its log syncs, then a skew flag is raised for review and no event is dropped.

#### OFF-016 — Storage-limit warnings and purge
- **Description:** The system **shall** warn the user before local storage limits are reached and offer to purge synced matches.
- **Rationale:** The app must not silently fail to persist an event because the disk is full. (`OBJ-02`)
- **Priority:** Should · P1 · **Dependencies:** FR-155
- **Trace:** discovery OFR-016
- **Acceptance:** Given local storage near the limit, when scoring continues, then a warning appears with a one-tap purge of synced matches.

#### OFF-017 — Offline corrections as superseding events
- **Description:** Corrections made offline **shall** be recorded as superseding events and **shall** sync as such, never as destructive edits.
- **Rationale:** Offline corrections must merge deterministically later. (`OBJ-07`, `OBJ-03`)
- **Priority:** Must · P1 · **Dependencies:** FR-099, OFF-006
- **Trace:** discovery OFR-015; `MINV-01`
- **Acceptance:** Given an offline correction, when synced, then the backend receives a superseding event linked to the original.

#### OFF-018 — Deferred publish/notify queue
- **Description:** Share/publish and notification intents created offline **shall** be queued and executed on reconnection; signing off offline **shall** be permitted with publish/notify deferred.
- **Rationale:** Offline sign-off must not block on connectivity. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** OFF-002, SYNC-004
- **Trace:** discovery OFR-018, OFR-019; NFR-014
- **Acceptance:** Given an offline sign-off with a pending share, when the device reconnects, then the match publishes and notifications send once.

#### OFF-019 — Never block a scoring input on the network
- **Description:** The system **shall not** block or delay any scoring input on a network operation.
- **Rationale:** The hot path is local-only by design. (`OBJ-02`, `OBJ-08`)
- **Priority:** Must · P1 · **Dependencies:** OFF-003
- **Trace:** discovery OFR-023
- **Acceptance:** Given the network is slow or down, when a delivery is recorded, then confirmation latency is unchanged from the fully-offline case.

#### OFF-020 — Dual-scorer offline independence
- **Description:** Two scorers **shall** each be able to score the same match fully offline and reconcile later.
- **Rationale:** Both scorers are typically offline in the box. (`OBJ-03`)
- **Priority:** Must · P2 · **Dependencies:** FR-108, OFF-006
- **Trace:** discovery OFR-014
- **Acceptance:** Given both scorers offline for a full innings, when they later exchange logs, then divergences are computed and neither log is lost.

#### OFF-021 — Always-visible connectivity and last-synced state
- **Description:** The system **shall** indicate clearly, at all times, whether it is online or offline and when it last synced.
- **Rationale:** Trust depends on knowing the data's freshness. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** OFF-005
- **Trace:** discovery OFR-022; AND-023; WEB-018
- **Acceptance:** Given any app screen during scoring, when viewed, then the online/offline state and last-synced time are visible.

#### OFF-022 — Guest-mode offline scoring
- **Description:** The system **shall** allow scoring entirely in guest mode with no account and no network.
- **Rationale:** Zero-friction start for volunteers. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** FR-001
- **Trace:** discovery OFR-013
- **Acceptance:** Given no account and airplane mode, when a match is scored and signed off, then it is complete locally and claimable later.

---

## 10. Synchronization Requirements

`SYNC-XXX` consolidate discovery `NFR-016…019`, `ONR-001/004/007/011/016`, `OFR-006/014/017`, `FR-113…120` (the sync-mechanics parts), and model `SVC-DIVERGENCE-DETECTOR` / `MINV-14` / `MBR-03`. All trace to `OBJ-03` unless noted. The single-scorer upload path (SYNC-001…005, 008) is **P1**; the deterministic-merge and dual-scorer path (SYNC-006/007/009…016) is **P2** but its **foundation** (SYNC-006, per-device sequencing) is **P1** (`SPK-02`, `A-16`).

#### SYNC-001 — Upload completed and in-progress events
- **Description:** The system **shall** sync completed and in-progress match events to the backend whenever connectivity is available, without interrupting scoring.
- **Rationale:** Cloud backup, sharing and cross-device handoff depend on it. (`OBJ-03`)
- **Priority:** Must · P1 · **Dependencies:** OFF-003, OFF-005
- **Trace:** discovery ONR-001, ONR-007
- **Acceptance:** Given queued events and a returning connection, when sync runs, then all events reach the backend and the local queue empties, with scoring unaffected throughout.

#### SYNC-002 — Near-real-time propagation to viewers
- **Description:** While the source is online, the system **shall** stream near-real-time updates to viewers of a live match.
- **Rationale:** Viewers expect a live card. (`OBJ-05`)
- **Priority:** Must · P1 · **Dependencies:** SYNC-001, FR-138
- **Trace:** discovery ONR-003; NFR (viewer freshness)
- **Acceptance:** Given a viewer connected and the source online, when a delivery is recorded, then the viewer card reflects it within the freshness budget (p95 < 10 s).

#### SYNC-003 — Cross-device resume
- **Description:** The system **shall** allow a match in progress to be resumed on another signed-in device from the cloud copy, surfacing a conflict if both devices wrote.
- **Rationale:** A dead phone must not end the scoring. (`OBJ-02`, `OBJ-03`)
- **Priority:** Should · P2 · **Dependencies:** SYNC-001, SYNC-009
- **Trace:** discovery ONR-011; FR-167
- **Acceptance:** Given a match synced from device A, when opened on device B, then scoring continues from the last synced event; if A also wrote unsynced events, then a conflict is surfaced (SYNC-010).

#### SYNC-004 — Queue-and-retry with backoff
- **Description:** Outbound sync **shall** queue and retry with backoff; backend unavailability **shall never** block offline scoring, sign-off, or local export.
- **Rationale:** The backend is a destination, not a dependency. (`OBJ-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-005, OFF-019
- **Trace:** discovery NFR-014; OFR-018, OFR-019
- **Acceptance:** Given repeated sync failures, when scoring continues, then no scoring function is impaired and the queue drains automatically on recovery.

#### SYNC-005 — Server-side validation of uploaded logs
- **Description:** The backend **shall** validate every uploaded event log — schema, per-device ordinal monotonicity, provenance, and authorization — and **shall** reject or quarantine invalid or unauthorised events, flagging conflicts for reconciliation.
- **Rationale:** Ingest is an integrity and security boundary. (`OBJ-03`, `OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** SEC-014, OFF-006
- **Trace:** discovery ONR-016; `INV-017`
- **Acceptance:** Given a log with a non-monotonic ordinal or a forged actor, when uploaded, then it is rejected/quarantined and the event is logged, with the rest of the log unaffected where separable.

#### SYNC-006 — Per-device monotonic sequence and logical clock
- **Description:** Every event **shall** carry a per-device monotonic sequence number and a logical clock value; ordering **shall** be preserved per device through sync.
- **Rationale:** Deterministic merge is impossible without stable per-device ordering. (`OBJ-03`; `SPK-02`)
- **Priority:** Must · P1 · **Dependencies:** OFF-006
- **Trace:** discovery NFR-018; OFR-006; `MINV-03`
- **Acceptance:** Given a device's events, when they arrive at the backend in any transport order, then their per-device sequence order is reconstructed exactly.

#### SYNC-007 — Clock-skew detection, not blind trust
- **Description:** Clock skew between devices **shall** be detected and flagged on sync, and **shall not** be blindly trusted or used to silently reorder events.
- **Rationale:** Wall-clock times from offline devices are unreliable. (`OBJ-03`)
- **Priority:** Should · P2 · **Dependencies:** OFF-015, SYNC-006
- **Trace:** discovery NFR-019; OFR-017; `INV-017`
- **Acceptance:** Given two devices whose clocks differ materially, when their logs sync, then a skew flag is raised and merge uses logical ordering, not wall-clock.

#### SYNC-008 — Idempotent, resumable sync
- **Description:** Sync **shall** be idempotent and resumable: re-sending an already-received event **shall not** duplicate it, and an interrupted sync **shall** resume without loss or duplication.
- **Rationale:** Flaky connections retry constantly. (`OBJ-03`)
- **Priority:** Must · P1 · **Dependencies:** SYNC-006
- **Trace:** discovery ONR-001; `MINV-03`
- **Acceptance:** Given a sync interrupted at 60%, when it resumes, then the final backend state contains each event exactly once.

#### SYNC-009 — Deterministic merge
- **Description:** Merging event sets **shall** be deterministic: the same set of events **shall** yield the same merged result regardless of arrival order or which device initiated the merge.
- **Rationale:** Convergence is the whole point of offline-first multi-device. (`OBJ-03`)
- **Priority:** Must · P2 · **Dependencies:** SYNC-006, BR-033
- **Trace:** discovery NFR-016; `MBR-03`, `MBR-07`
- **Acceptance:** Given a fixed multi-device event set, when merged in 100 randomised arrival orders, then all 100 merges produce an identical match state.

#### SYNC-010 — Conflicts always surfaced, never last-write-wins
- **Description:** True conflicts **shall** always be surfaced for human resolution; the system **shall never** silently resolve a conflict by last-write-wins or by discarding an event.
- **Rationale:** A silently dropped correction is a corrupted record. (`OBJ-03`, `OBJ-07`)
- **Priority:** Must · P2 · **Dependencies:** SYNC-009
- **Trace:** discovery NFR-017; `MBR-03`; foundation risk 4
- **Acceptance:** Given two devices that recorded incompatible outcomes for the same delivery, when merged, then both versions are retained and a conflict/divergence is raised; neither is dropped.

#### SYNC-011 — Exchange independent scorer logs
- **Description:** In dual-scorer mode, the system **shall** exchange each scorer's independent event log between devices whenever connectivity (direct or via backend) allows.
- **Rationale:** Reconciliation needs both logs in one place. (`OBJ-03`)
- **Priority:** Must · P2 · **Dependencies:** FR-108, SYNC-001
- **Trace:** discovery FR-115; OFR-014
- **Acceptance:** Given two scorer devices reconnecting, when exchange runs, then each device holds both logs aligned by over/ball.

#### SYNC-012 — Divergence detection by over/ball
- **Description:** The system **shall** align two scorer logs by over/ball and emit a divergence for every delivery where runs, extras, wicket or striker differ.
- **Rationale:** Scorers must see exactly where they disagree. (`OBJ-03`)
- **Priority:** Must · P2 · **Dependencies:** SYNC-011
- **Trace:** discovery FR-116; `SVC-DIVERGENCE-DETECTOR`; `MINV-14`
- **Acceptance:** Given logs differing at two deliveries, when detection runs, then exactly two divergences are emitted with both field-level versions.

#### SYNC-013 — Mutual-confirmation resolution
- **Description:** A divergence **shall** reach a resolved state only when one scorer proposes an agreed version and the other confirms; the resolution **shall** be recorded as an event and **shall not** overwrite either original entry.
- **Rationale:** No independent record is discarded without agreement. (`OBJ-03`)
- **Priority:** Must · P2 · **Dependencies:** SYNC-012, FR-110
- **Trace:** discovery FR-118, FR-119; BR-008; `MINV-14`
- **Acceptance:** Given a proposed resolution, when unconfirmed, then no log changes; when both confirm, then both converge to the agreed version as a new event.

#### SYNC-014 — Sign-off blocked on unresolved divergence
- **Description:** Match sign-off **shall** be blocked while any divergence is unresolved, overridable only with a reason and dual attestation from both scorers.
- **Rationale:** A signed dual-scored match must be a reconciled one. (`OBJ-07`)
- **Priority:** Must · P2 · **Dependencies:** SYNC-013, FR-102
- **Trace:** discovery FR-120; BR-008; `MINV-14`
- **Acceptance:** Given one open divergence, when sign-off is attempted, then it is refused unless both scorers attest an override reason.

#### SYNC-015 — Combined live view and presence
- **Description:** When online, the system **should** merge the head and assistant scorers' state into a combined live view and **should** show presence indicators (who is scoring / viewing).
- **Rationale:** A shared live picture helps the pair and any umpire. (`OBJ-03`, `OBJ-05`)
- **Priority:** Should · P2 · **Dependencies:** SYNC-011
- **Trace:** discovery ONR-004, ONR-005
- **Acceptance:** Given both scorers online, when the combined view is opened, then it shows the reconciled state and both scorers' presence.

#### SYNC-016 — Server-side recompute on sign-off
- **Description:** On sign-off sync, the backend **shall** recompute competition standings, NRR and bonus points server-side for any competition the match belongs to.
- **Rationale:** Authoritative standings computed once, centrally. (`OBJ-04`, `OBJ-10`)
- **Priority:** Should · P2 · **Dependencies:** FR-125, FR-126
- **Trace:** discovery ONR-009; `MINV-16`
- **Acceptance:** Given a match syncs as Final, when it belongs to a competition, then standings recompute server-side and reflect it.

---

## 11. Audit Requirements

`AUD-XXX` consolidate discovery `FR-100…111` (audit-trail parts), `NFR-025`, `BR-004/006/024/025`, `ADM-107/108`, cricket-rules `CORR-*`, and model `QRY-AUDIT-TRAIL` / `VO-PROVENANCE` / `VO-AMENDMENT-ENTRY` / `SVC-RECONCILER`. All trace to `OBJ-07`. All are **Must · P1** unless noted.

#### AUD-001 — Append-only event log
- **Description:** The match event log **shall** be append-only: no event is ever mutated or deleted; every change is a new event linked to what it supersedes or voids.
- **Rationale:** The record's trustworthiness rests on immutability. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** discovery FR-109; `MINV-01`; `CORR-001`
- **Acceptance:** Given any correction, when the log is inspected, then the superseded event is still present and marked, with a link to its successor.

#### AUD-002 — Actor, time, device and app-version provenance
- **Description:** Every event **shall** record its provenance: acting user (or anonymised placeholder), timestamp, device identifier, and app version.
- **Rationale:** "Who / what / when / where" is the minimum for a defensible trail. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-012
- **Trace:** discovery FR-111, FR-013; `VO-PROVENANCE`
- **Acceptance:** Given an event, when its provenance is viewed, then all four fields are populated (actor may be anonymised per BR-023).

#### AUD-003 — Tamper-evidence
- **Description:** The audit trail **shall** be tamper-evident: any out-of-band alteration, reordering or deletion **shall** be detectable by an integrity check.
- **Rationale:** Append-only is only credible if violations are detectable. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** AUD-001
- **Trace:** discovery NFR-025; `MINV-01`; SEC-012
- **Acceptance:** Given a stored event altered directly in the datastore, when integrity verification runs, then it reports the tampering with the affected event.

#### AUD-004 — Human-readable audit view
- **Description:** The system **shall** present a human-readable audit view showing, per change, who, what, when, and the before/after values.
- **Rationale:** Scorers, organizers and adjudicators must be able to read the history without tooling. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** AUD-001, AUD-002
- **Trace:** discovery FR-110; `QRY-AUDIT-TRAIL`; `VO-AMENDMENT-ENTRY`
- **Acceptance:** Given a corrected delivery, when the audit view is opened for it, then the original value, new value, actor, reason and time are shown.

#### AUD-005 — Every override and guardrail bypass is logged with a reason
- **Description:** Every guardrail override, reconciliation-failure override, and manual target entry **shall** be recorded with a mandatory non-empty reason and full provenance.
- **Rationale:** The record must show exactly where a rule was consciously set aside. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-057, FR-084, FR-102
- **Trace:** discovery FR-059, FR-105; `CORR-*`
- **Acceptance:** Given an override, when saved, then a reason is required and the override appears in both the audit view and the reconciliation report.

#### AUD-006 — Reconciliation report as an audit artefact
- **Description:** The system **shall** produce a reconciliation report enumerating each invariant with PASS / FAIL(detail), at each interval checkpoint and at sign-off, and **shall** retain each report.
- **Rationale:** The reconciliation state at finality is itself part of the record. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-101, DR-31
- **Trace:** discovery FR-104; `INV-018`; `SVC-RECONCILER`; `CORR-008`
- **Acceptance:** Given sign-off, when it completes, then the reconciliation report at that moment is stored and retrievable with the match.

#### AUD-007 — Impersonation actions dual-attributed
- **Description:** Actions taken under support impersonation **shall** be logged with both the platform-admin identity and the impersonated user identity, and marked as impersonated.
- **Rationale:** Support access must be fully attributable. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-161, SEC-011
- **Trace:** discovery ADM-107, NFR-028; ONR-021
- **Acceptance:** Given an impersonated action, when the audit view is opened, then it shows "X acting as Y" with the consent reference.

#### AUD-008 — Sign-off record and versions
- **Description:** Each sign-off (and counter-signature, and post-Final re-sign-off) **shall** be recorded with signer identity, timestamp, the reconciliation state, and a monotonically increasing sign-off version; prior Final versions **shall** be retained and retrievable.
- **Rationale:** The chain of finality decisions must be reconstructable. (`OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-103, FR-105
- **Trace:** discovery FR-106, FR-108; BR-006; `VO-SIGN-OFF`; `MBR-04`
- **Acceptance:** Given a Final match amended and re-signed, when its sign-off history is viewed, then both versions appear with their signers, times and reconciliation states.

#### AUD-009 — DLS revision audit
- **Description:** Each DLS revision **shall** be individually recorded with its inputs (overs lost, wickets, score, time), method/table version, timestamp, actor, and its supersede/revert relationships.
- **Rationale:** DLS decisions are the most disputed; each must stand alone in the trail. (`OBJ-07`)
- **Priority:** Must · P1 *(applies to manual targets too when DLS is gated by `SPK-01`)* · **Dependencies:** FR-087, BR-021
- **Trace:** discovery FR-089; `ENT-DLS-REVISION`; `SM-DLS-REVISION`
- **Acceptance:** Given three revisions with one reverted, when the DLS audit is viewed, then each shows its inputs, version, actor and status, and the revert is itself an entry.

#### AUD-010 — Correction cascade summary retained
- **Description:** When a correction triggers a cascade recomputation, the system **shall** record a cascade summary (which projections changed, any strike-continuity breaks detected) alongside the correcting event.
- **Rationale:** A reviewer must see not just the edit but its consequences. (`OBJ-04`, `OBJ-07`)
- **Priority:** Must · P1 · **Dependencies:** FR-100
- **Trace:** `SVC-CASCADE-RECOMPUTER`; `CORR-004`, `CORR-005`, `CORR-013`
- **Acceptance:** Given a mid-innings correction, when the correcting event is inspected, then its cascade summary lists the affected figures and any flagged discontinuities.

#### AUD-011 — Lineup and roster change log
- **Description:** Post-deadline lineup changes, role assignments/revocations, member deactivations, and player merges **shall** each be recorded with actor, timestamp and (where applicable) reason.
- **Rationale:** Team-sheet and permission disputes need a trail. (`OBJ-07`)
- **Priority:** Should · P2 · **Dependencies:** FR-007, FR-039, FR-041
- **Trace:** discovery FR-042, BR-044; ADM-*
- **Acceptance:** Given a player merge, when the org audit log is viewed, then the merge, its actor, time and the surviving/losing IDs are shown.

#### AUD-012 — Dispute adjudication record
- **Description:** A dispute lock and its adjudication **shall** be recorded: who locked it, when, why; who adjudicated, when, the ruling, and any resulting amendments.
- **Rationale:** Contested results must have a complete, readable ruling trail. (`OBJ-07`)
- **Priority:** Should · P2 · **Dependencies:** FR-106
- **Trace:** discovery FR-112; BR-016; `SM-DISPUTE`
- **Acceptance:** Given an adjudicated dispute, when its record is opened, then the lock, the ruling and any score amendments are all present and linked.

#### AUD-013 — Audit query and export
- **Description:** The system **shall** let an authorised role query and export a match's full audit trail (events, provenance, corrections, overrides, reconciliation reports, sign-offs) in a human- and machine-readable form.
- **Rationale:** Associations and adjudicators need the trail out of the system. (`OBJ-07`, `OBJ-09`)
- **Priority:** Should · P1 · **Dependencies:** AUD-004, FR-144
- **Trace:** discovery FR-110; `QRY-AUDIT-TRAIL`
- **Acceptance:** Given a match, when an authorised user exports its audit trail, then the export contains every event with provenance and every override with its reason.

#### AUD-014 — Retention and anonymisation
- **Description:** The audit trail **shall** be retained per the configured retention policy; on account deletion the actor **shall** be anonymised in place (not removed), preserving the trail's completeness.
- **Rationale:** Compliance without destroying the official record. (`OBJ-07`, `OBJ-09`)
- **Priority:** Must · P1 · **Dependencies:** FR-011, BR-023
- **Trace:** discovery BR-025; NFR-032; SEC-015
- **Acceptance:** Given a deleted account, when its authored events are viewed, then the actor shows as an anonymised placeholder and every other field is intact.

#### AUD-015 — Operator observability without PII
- **Description:** Operational logs and dashboards derived from audit/telemetry data **shall not** expose personal data.
- **Rationale:** Operations need signal; the audit trail's PII must not leak into ops tooling. (`OBJ-10`, `OBJ-11`)
- **Priority:** Should · P1 · **Dependencies:** NFR-035, NFR-042
- **Trace:** discovery NFR-055; ADM-106
- **Acceptance:** Given an operational dashboard, when reviewed, then it presents aggregates and diagnostics with no personal identifiers.

---

## 12. Traceability

### 12.1 SRS requirements → foundation objectives (`OBJ-01…11`)

| OBJ | Objective | Primary SRS coverage |
|---|---|---|
| **OBJ-01** | Law-accurate engine | DR-01…DR-36; FR-042…FR-070, FR-071…FR-082, FR-092…FR-096; BR-009…012, BR-017, BR-024…028, BR-030; NFR-033, NFR-034 |
| **OBJ-02** | Offline-first | OFF-001…OFF-022; NFR-009…015; FR-001, FR-003, FR-089, FR-149, FR-151, FR-163, FR-165; SYNC-004 |
| **OBJ-03** | Deterministic sync / dual-scorer | SYNC-001…SYNC-016; FR-107…FR-111, FR-167; OFF-006, OFF-015, OFF-020; NFR-006; BR-008; `MINV-14` |
| **OBJ-04** | Match mathematics | DR-27…DR-30, DR-36; FR-078, FR-079, FR-083…FR-088, FR-126; BR-018…021, BR-029, BR-034; NFR-045 |
| **OBJ-05** | Complete outputs | FR-112…FR-122, FR-129, FR-130, FR-137, FR-138, FR-150; DR-32, DR-34; NFR-004 |
| **OBJ-06** | Cross-platform parity | FR-163…FR-168; NFR-026…028; SPK-04 |
| **OBJ-07** | Verifiability / trust | AUD-001…AUD-015; SEC-001…SEC-018; FR-097…FR-106, FR-161; BR-001…008, BR-022, BR-023, BR-033, BR-034; NFR-025, NFR-043; DR-31, DR-33 |
| **OBJ-08** | Speed of entry | FR-052, FR-059, FR-060, FR-063, FR-151, FR-154, FR-164; NFR-001…005; NFR-020, NFR-021 |
| **OBJ-09** | Data ownership / portability | FR-010, FR-011, FR-143…FR-150; NFR-029…032, NFR-038; SEC-015; AUD-013 |
| **OBJ-10** | Multi-tenant | FR-005…FR-009, FR-123…FR-129, FR-159…FR-162; SEC-003…005, SEC-010; NFR-013, NFR-016…018; BR-001 |
| **OBJ-11** | Accessibility / i18n | FR-013, FR-152, FR-153, FR-157; NFR-019…024, NFR-037, NFR-039, NFR-043…045; SEC-013 |

**Coverage note:** `OBJ-03` has no functional P1 coverage by design (dual-scorer is P2). The P1 obligations that keep P2 achievable without a rewrite are **OFF-006, SYNC-006, SYNC-008, DR-33 (event-log model)**, all gated on `SPK-02` / `A-16`.

### 12.2 Discovery requirement IDs → SRS requirements (reverse map)

Every discovery ID lands in at least one SRS requirement. Ranges below; the exact origin IDs are in each SRS requirement's **Trace** field.

| Discovery set | SRS destination |
|---|---|
| `FR-001…015` (Accounts/Tenancy) | FR-001…FR-014 |
| `FR-016…030` (Match Setup) | FR-015…FR-029 |
| `FR-031…042` (Squads/Lineups) | FR-030…FR-041 |
| `FR-043…072` (Live Scoring) | FR-042…FR-070 |
| `FR-073…085` (Innings/State) | FR-071…FR-082 |
| `FR-086…094` (Rain/DLS) | FR-083…FR-091; DR-36; OFF-008; AUD-009 |
| `FR-095…099` (Tie-breakers) | FR-092…FR-096; DR-30; BR-030 |
| `FR-100…112` (Corrections/Audit/Sign-off) | FR-097…FR-106; AUD-001…AUD-008, AUD-012 |
| `FR-113…120` (Dual-Scorer) | FR-107…FR-111; SYNC-011…SYNC-014; BR-008 |
| `FR-121…138` (Scorecards/Analytics/Commentary) | FR-112…FR-122; DR-32, DR-34; OFF-009 |
| `FR-139…150` (Competitions/Standings) | FR-123…FR-129; BR-015, BR-016, BR-029; SYNC-016 |
| `FR-151…160` (Profiles/Stats/History) | FR-130…FR-136; BR-013, BR-014 |
| `FR-161…170` (Sharing/Notifications/Viewer) | FR-137…FR-142; SEC-009; BR-022 |
| `FR-171…182` (Import/Export/API/Backup) | FR-143…FR-150; NFR-029…032; OFF-010, OFF-011 |
| `FR-183…190` (Settings/Localization) | FR-151…FR-158; NFR-043, NFR-044 |
| `NFR-001…008` (Performance) | NFR-001…NFR-008 |
| `NFR-009…015` (Reliability/Durability) | NFR-009…NFR-015; OFF-003, OFF-004, OFF-012 |
| `NFR-016…019` (Sync & Consistency) | SYNC-006, SYNC-007, SYNC-009, SYNC-010 |
| `NFR-020…022` (Scalability) | NFR-016…NFR-018 |
| `NFR-023…030` (Security & Integrity) | SEC-001…SEC-012, SEC-018; AUD-003, AUD-007 |
| `NFR-031…036` (Privacy & Compliance) | NFR-037…NFR-042; SEC-013; AUD-014 |
| `NFR-037…043` (Usability & Accessibility) | NFR-019…NFR-025 |
| `NFR-044…049` (Compatibility & Portability) | NFR-026…NFR-029; FR-163…FR-166 |
| `NFR-050…052` (Interoperability) | NFR-030…NFR-032; FR-145, FR-146, FR-148 |
| `NFR-053…056` (Maintainability/Observability) | NFR-033…NFR-036; AUD-015 |
| `NFR-057…059` (Internationalisation) | NFR-043…NFR-045; FR-152, FR-157 |
| `BR-001…045` (Business Rules) | BR-001…BR-032 (see each BR's Trace); FR-026, FR-099, FR-102 |
| `CSR-001…060` (Cricket Scoring Reqs) | DR-01…DR-36 (via the cited `<AREA>-NNN`) |
| `ONR-001…022` (Online Reqs) | SYNC-001…SYNC-005, SYNC-015, SYNC-016; FR-137, FR-139, FR-147, FR-160, FR-161, FR-167; NFR-036 |
| `OFR-001…024` (Offline Reqs) | OFF-001…OFF-022 |
| `WEB-001…022` (Web Reqs) | FR-163, FR-164; NFR-019, NFR-024, NFR-027; FR-129, FR-137, FR-155, FR-157 |
| `AND-001…024` (Android Reqs) | FR-165, FR-166; NFR-002, NFR-005, NFR-007, NFR-011, NFR-020, NFR-021, NFR-024, NFR-026, NFR-028; FR-151; SEC-008; OFF-003…OFF-005, OFF-013, OFF-014 |
| `ADM-001…020` (Org Admin) | FR-159; FR-007, FR-039, FR-150; AUD-011 |
| `ADM-101…114` (Platform Admin) | FR-160, FR-161, FR-162; SEC-011, SEC-018; NFR-035, NFR-036; AUD-007, AUD-015 |
| `SCR-001…035` (Scorer Reqs) | FR-042…FR-070, FR-097…FR-106; NFR-001…003 |
| `CTR-001…020` (Captain/Team Reqs) | FR-040, FR-041, FR-131, FR-132, FR-139 |
| `VWR-001…022` (Viewer Reqs) | FR-122, FR-137, FR-138; NFR-017; SYNC-002 |

### 12.3 Model objects → SRS

| Model area (R4) | SRS coverage |
|---|---|
| `SM-MATCH`, `SM-INNINGS`, `SM-DELIVERY` | FR-082, FR-071…073, DR-05…08 |
| `MINV-01…18` | AUD-001…006, DR-31, DR-33, BR-004, BR-017, BR-033, BR-034, SYNC-006, SYNC-009, SYNC-013, FR-078, FR-095, FR-100 |
| `MBR-01…12` | BR-033 (`MBR-01/06/07`), FR-004 (`MBR-02`), SYNC-009/010 (`MBR-03`), BR-006/AUD-008 (`MBR-04`), BR-017 (`MBR-05`), FR-102 (`MBR-08`), FR-052 (`MBR-09`), BR-030 (`MBR-10`), BR-034 (`MBR-11`), BR-032 (`MBR-12`) |
| `SVC-*` (13 services) | STRIKE-RESOLVER→FR-052; EXTRAS-DECOMPOSER→FR-044…046; INNINGS-END-EVALUATOR→FR-071…073; RESULT-DERIVER→FR-079; DLS-CALCULATOR→FR-083…089; POWERPLAY-PLANNER→FR-019, FR-077; CASCADE-RECOMPUTER→FR-100, AUD-010; RECONCILER→FR-101, AUD-006; DIVERGENCE-DETECTOR→SYNC-012; MILESTONE-DETECTOR→FR-118; EXPORT-TRANSLATOR→FR-145, FR-146; AUTHORIZER→SEC-003, SEC-006, BR-003 |
| `EVT-*` / `CMD-*` | FR-043, FR-047, FR-062, FR-098, FR-099, FR-105 (cited inline) |

---

## 13. Open Issues & Deferred Items

### 13.1 Blocking spikes (from `R2 §3.5`)

| Spike | Blocks | SRS items held / conditioned | Fallback in this SRS |
|---|---|---|---|
| **SPK-01** — DLS licensing/IP | FR-083, FR-085, FR-086, FR-089, OFF-008, DR-36, NFR-040 | Marked "gated by `SPK-01`". | FR-084 (manual target) is Must·P1 and always available; DLS UI behind a flag (`C-2`). |
| **SPK-02** — Event-log & provenance model | The P2-readiness of SYNC-006/008/009 and the correctness of FR-099/FR-100 | `A-16`; DR-33, OFF-006, SYNC-006 must be proven before MVP build. | None — this spike must resolve; it is the top architecture risk. |
| **SPK-03** — Offline durability on Android | NFR-009, NFR-010, NFR-011, OFF-003, OFF-004 | `A-17`; these are MVP exit gates. | None — no Alpha exit without it. |
| **SPK-04** — Cross-platform rules core | NFR-028, FR-168 | `A-18`; parity matrix ≥ 95% is a Version 1 gate. | Single-platform pilot possible; parity slips to V2. |
| **SPK-05** — Interchange format | FR-145, FR-146, NFR-030, NFR-031 | `A-08`; marked "gated by `SPK-05`". | PDF/CSV (FR-143/144) satisfy the portability minimum. |
| **SPK-06** — MCC Laws text permission | NFR-041 | `A-07`. | Ship paraphrased-only in-app rule/help text. |

### 13.2 Open clarification questions (from `R1 §11`, `R2 §3.5`)

| Ref | Question | SRS items affected | Assumption held |
|---|---|---|---|
| A1 / A2 / A4 | Primary segment · first geography · business model | FR-005…009 scope; tenancy limits | `A-12`, `A-13` |
| B5 | Formats in v1 (limited-overs only?) | FR-018, FR-074, FR-075, FR-081; DR-25, DR-26 (all P3) | `A-27` |
| B6 | Automated DLS in v1 or manual? | FR-083…089 vs FR-084 | `A-06`, `A-19` |
| B7 | Dual-scorer in v1 or P2? | Entire §4.I, §10 P2 items | `A-03` |
| B8 | Tournaments in v1 or P2? | §4.K, FR-029, SYNC-016 | assumed P2 |
| C12 / C13 | Guest scoring required? Umpire/commentator roles in v1? | FR-001, FR-025; DR-04, DR-24 | `A-12`, `A-26` |
| D16 / D17 / D19 | Confirm Supabase; PWA acceptable; shared-core approach | SEC-004, NFR-027, NFR-028; `A-09`, `A-18` | held |
| E21 / E22 | DLS/MCC licensing ownership + budget; match-data ownership model | NFR-040, NFR-041; BR-001, BR-023 | `A-06`, `A-10` |
| Q-D1 | Super Over in P1 or fast-follow? | FR-092 priority | `A-20` |
| Q-D2 | P1 single matches: org-first or per-match teams? | FR-030, FR-033 | `A-24` |
| Q-D3 | Counter-signature needed for "official" pilot match? | FR-104 priority | `A-21` |
| Q-D4 | Wagon wheels expected day one? | FR-120 priority | `A-22` |
| Q-D5 | Pilot-mandated export format beyond Cricsheet? | FR-145; NFR-030 | `A-25` |
| Q-D6 | Notifications table-stakes for pilot? | FR-139 priority | `A-23` |

### 13.3 Config-registry clarifications (from `R3 §35`)

Six open clarification notes in the cricket-rules configuration registry (`CFG-REG`) remain to be resolved by an accredited-scorer ratification pass; they affect the allowed values / per-profile defaults referenced by **DR-35** but not the shape of any SRS requirement. Tracked in R3, not duplicated here.

### 13.4 Deferred scope (not a gap — an explicit boundary)

| Deferred | To | SRS reference |
|---|---|---|
| Multi-day / first-class (declaration, follow-on, forfeiture, sessions, ≥5-day durability) | P3 / Future | FR-018, FR-074, FR-075, FR-081; DR-25, DR-26; NFR-015 |
| Advanced analytics (pitch maps/beehive, record lists, deep head-to-head) | P3 / Future | FR-120, FR-134, FR-136 |
| Knockout brackets; embeddable widget; moment deep-links | P3 / Future | FR-127, FR-142 |
| Read/realtime API; Cricsheet import; org API keys | P2 | FR-146, FR-147, FR-014; SEC-017 |
| Alternative rain methods (Professional Edition, VJD) | Future (licensing permitting) | FR-091; NFR-040 |
| Impact/replacement player; runner; last-man-stands | P3 | FR-037, FR-070 |
| Everything in `foundation §7` "Out of Scope" | Not planned | §1.2 |

---

## 14. Change Log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-02 | Initial SRS. Consolidates the approved foundation, discovery, domain-model, cricket-rules-reference and glossary documents into: §1 Introduction (purpose, scope, definitions, references, conventions, the "no requirement invented silently" and "assumptions isolated" statements); §2 Overall Description (product perspective, 13 user classes, operating environment, 11 constraints, phasing); §3 Assumptions `A-01…A-27` (isolated); §4 Functional Requirements `FR-001…FR-168` (16 clusters A–Q); §5 Domain Rules `DR-01…DR-36` (one per cricket-rules area, pointing to authoritative `<AREA>-NNN` IDs); §6 Business Rules `BR-001…BR-034`; §7 Non-Functional Requirements `NFR-001…NFR-045`; §8 Security `SEC-001…SEC-018`; §9 Offline `OFF-001…OFF-022`; §10 Synchronization `SYNC-001…SYNC-016`; §11 Audit `AUD-001…AUD-015`; §12 Traceability (to `OBJ-01…11`, reverse map from every discovery set, model-object map); §13 Open Issues (spikes `SPK-01…06`, clarification questions, deferred scope). Every requirement carries Description, Rationale, Priority (`MoSCoW · Phase`), Dependencies, Trace, and Acceptance criteria. Requirements consolidated from multiple sources are marked `(consolidated)`; inferred-to-be-enforceable requirements are marked `(derived)` with their basis. No design or implementation content. |


