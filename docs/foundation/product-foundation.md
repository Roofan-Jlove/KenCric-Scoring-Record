# Cricket Scoring Book — Project Foundation

*(working name: KenCric Scoring Record)*

| | |
|---|---|
| **Document** | Project Foundation (Product Layer / Describe phase) |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-02 |
| **Status** | Draft. Foundation for later Spec-Driven Development. |
| **Downstream** | Feeds `docs/discovery/product-discovery.md` and `docs/specs/*`. |

This is the **Describe** phase / **Product layer** output. It is the shared context artifact that every later prompt, agent, and spec reads from. Nothing below is implementation — it is the ground the Specification is built on.

---

## How this foundation maps to the frameworks

| Framework | Where this document sits |
|---|---|
| **4Ds** | Describe (complete). Decompose comes next: domain model + feature backlog. |
| **4 Layers** | Product layer. Domain / System / Implementation layers are downstream and must trace back to this. |
| **SDD** | Pre-Specification. This defines *what problem and for whom*; the spec defines *what the system does*; the plan defines *how*. |
| **Prompt + Context + Harness + Loop** | This file is the durable **Context**. Every agent prompt (product-spec, architecture, backend, web, android, qa, security) should be grounded in it. The **Harness** is the agent set + `docs/` structure + conformance tests. |
| **Build → Verify → Feedback → Improve** | The Verify gate is defined in §8 (Success Criteria): rules-conformance suite, chaos tests, accredited-scorer review, pilot feedback. |

---

## 1. Product Vision

**Vision statement:** To be the world's most trusted digital cricket scoring book — an official-standard record of every ball, usable anywhere from a Test arena to a village green, fully functional offline, and verifiable by two independent scorers.

**Narrative.** Cricket's record of record is still, in most of the world, a paper book kept by one person. Cricket Scoring Book replaces that book with a single source of truth that lives across a Web app and an Android app, works with no connectivity, and encodes the Laws of Cricket and ICC playing conditions so that correctness is *enforced*, not hoped for. It serves a lone volunteer in a club scorebox and a professional broadcast scoring team equally. It produces both the traditional scorebook (linear sheet, bowling analysis, fall of wickets, full card) and modern analytics, and it never traps the data — every match can be exported in an open, standards-aligned format.

**3–5 year north star:** the default way club, league, and association cricket is scored in at least one major cricketing nation, with an open data trail behind every match.

---

## 2. Problem Statement

**Current state.** Scoring today splits into three unsatisfactory options:

1. **Paper scorebooks** — error-prone, slow to reconcile, a single fragile physical copy, illegible under pressure, no live sharing, no analytics, frequently lost or damaged.
2. **Fan / club apps** — easy to use but not Law-rigorous, incomplete on formats, weak on extras/free-hit/dismissal edge cases, and typically online-only.
3. **Professional desktop tools** — rigorous but expensive, Windows-bound, steep learning curve, poor mobility, closed data.

**Specific pain points.**
- Grounds routinely have weak or no connectivity, so online-only tools fail exactly when needed.
- **Dual-scorer reconciliation** — cricket's built-in integrity check — is manual and almost never supported.
- Rain/interruption math (**DLS**), **Super Overs**, **NRR**, over-rate, and powerplay tracking are done by hand or in spreadsheets, producing mistakes in results that decide leagues.
- Data is locked in proprietary silos with no clean export and weak interoperability with league systems.
- Volunteer scorers are under-trained and under-supported; tools don't prevent illegal states (bowler bowling consecutive overs, wrong batter on strike, 12 players batting).
- Teams, analysts, and remote fans cannot reliably follow or reuse a match record.

**Consequence.** Disputed results, lost history, wasted volunteer effort, and low trust in amateur records.

**Why now.** Capable Android devices are near-ubiquitous; offline-first web storage is mature; managed cloud backends with realtime and row-level security are commodity; open interchange formats have momentum; and AI-assisted spec-driven development makes a rigorous domain build feasible for a small team.

---

## 3. Target Users

### Primary
| User | Context | Core need |
|---|---|---|
| **Club & league / association scorers** (volunteer or accredited, in the scorebox) | Weekend and evening matches, often solo, often no signal | Fast, forgiving, offline, Law-correct entry that produces the official sheet |
| **Professional / broadcast scorers** (domestic & international scoring teams) | Multi-day and limited-overs, high scrutiny, paired scorers | Full formats incl. multi-day, dual-scorer reconciliation, precision, export to feeds |

### Secondary
- **Tournament & competition organizers** — fixtures, standings, NRR, bonus points, discipline records.
- **Team analysts & coaches** — spells, match-ups, wagon wheels, run-rate and partnership trends.
- **Players** — verified personal career record and milestones.
- **Broadcasters / commentators / media** — live scorecard, commentary feed, stats.

### Tertiary
- **Spectators / parents / remote fans** following a shared live link.
- **Umpires** — cross-checking totals, overs, and DLS par score.
- **Governing bodies / associations** — aggregated data, compliance, potential endorsement.
- **Developers / researchers** — open match data via export/API.

---

## 4. User Roles (system RBAC)

Roles are **additive** (one person may be Team Manager *and* Head Scorer). Every write action is attributed and audit-logged.

| Role | Scope | Key capabilities | Cannot |
|---|---|---|---|
| **Platform Admin** | Global | Manage tenants, users, global config, releases | Silently alter match records without audit trail |
| **Organization Admin** (club / league / board) | Tenant | Manage members, teams, competitions, role assignments | Access other tenants' data |
| **Competition / Tournament Organizer** | Competition | Create fixtures, configure playing conditions, assign scorers, publish standings | Edit ball-by-ball data of a match they don't score |
| **Team Manager / Captain** | Team | Maintain squad, submit playing XI, confirm lineup | Score the match or change results |
| **Head Scorer (Match Owner)** | Match | Full ball-by-ball scoring, innings state, corrections, close & **sign off** the match | Delete the immutable event history |
| **Assistant / Co-Scorer** | Match | Independent parallel scoring, reconciliation, propose corrections | Unilaterally sign off the match |
| **Umpire** | Match | View live state; confirm/flag toss, result, DLS target, sanctions | Enter or edit deliveries |
| **Commentator** | Match | Add ball commentary and notes | Change any scoring data |
| **Statistician / Analyst** | Org / Competition | Read-only deep access, reports, export | Any write to match data |
| **Player** | Self | Manage own profile, claim/verify appearances, view personal stats | Edit match data or others' profiles |
| **Viewer / Spectator** | Public / shared link | Read-only live scorecard and summary | Anything else |
| **Guest (anonymous)** | Device-local | Score a match fully offline with no account; optional later claim/upload | Sync, share, or collaborate until an account is created |

---

## 5. Core Objectives

1. **Law-accurate scoring engine** — MCC Laws of Cricket + ICC Standard Playing Conditions, with per-competition configurable variations; illegal states prevented or explicitly flagged. `(OBJ-01)`
2. **True offline-first** — every feature needed to score a full match works with zero connectivity; no data loss under crash, power loss, or airplane mode. `(OBJ-02)`
3. **Deterministic sync & dual-scorer reconciliation** — append-only ball-event log, deterministic merge, explicit conflict surfacing, never a silent overwrite. `(OBJ-03)`
4. **Automated match mathematics** — DLS (Standard Edition), revised targets and par scores, Super Over handling, NRR, current/required run rate, over-rate, powerplay and fielding-restriction tracking. `(OBJ-04)`
5. **Complete outputs** — traditional full scorecard, linear scoresheet, bowling analysis, fall of wickets, over-by-over — plus analytics (Manhattan, worm, run-rate, partnerships; wagon wheel / pitch map via manual input). `(OBJ-05)`
6. **Cross-platform parity** — Web and Android share one authoritative domain/rules core; a defined parity matrix for the scoring core. `(OBJ-06)`
7. **Verifiability & trust** — immutable event history, correction-as-new-event workflow, two-scorer sign-off, full attribution and audit. `(OBJ-07)`
8. **Speed of entry** — a normal delivery recorded in ≤ 2 interactions; one scorer keeps pace with live play in any supported format. `(OBJ-08)`
9. **Data ownership & portability** — standards-aligned import/export (Cricsheet-compatible JSON/YAML, CSV, PDF scorecard) plus a public read API and shareable live links. `(OBJ-09)`
10. **Multi-tenant scale** — clubs → leagues → boards, with isolation, roles, and competition management. `(OBJ-10)`
11. **Accessibility & i18n-ready** — WCAG 2.2 AA on core web flows; English first, localizable structure. `(OBJ-11)`

---

## 6. Scope

`[MVP]` = targeted for first release · `[P2]` / `[Later]` = subsequent phases. Final MVP line is subject to the §11 clarifications.

### Match setup
- Formats: limited-overs — T20, ODI/List A, T10, The Hundred, custom overs `[MVP: T20 + custom limited-overs]`; multi-day / Test / first-class — two innings per side, sessions, declarations, follow-on `[Later]`.
- Teams, squads, playing XI, captain, wicket-keeper; toss and decision; venue, date, conditions; match officials.
- Per-competition playing conditions: overs, powerplays, bowler over-limits, ball-change rules, interval rules, tie-breaker rule.

### Live scoring (core) `[MVP]`
- Ball-by-ball: runs 0–6+, boundaries, running; all extras (wide, no-ball, bye, leg-bye, penalty runs); no-ball **free-hit** handling.
- All dismissal modes: bowled, caught, LBW, run out, stumped, hit wicket, obstructing the field, hit the ball twice, timed out, retired out; retired–not out (hurt/ill).
- Strike rotation, over completion, new-bowler validation (no consecutive overs, over-limit enforcement), batters-crossed-on-catch, incoming/outgoing batter.
- Innings lifecycle: start, drinks, all out, reduced overs, interruptions, innings close, target set; declaration `[Later]`.
- Substitutes: substitute fielder, concussion substitute `[MVP]`; impact/replacement player where competition config enables it, runner (legacy) `[Later]`.

### Match mathematics
- Current/required run rate, projected score, partnerships, milestones (50/100, five-fors, hat-tricks), last-wicket tracking `[MVP]`.
- **DLS Standard Edition**: overs lost, revised target, par/DLS score at any point `[MVP-target — pending licensing check]`; manual target override always available `[MVP]`.
- Tie resolution: **Super Over** incl. repeat Super Overs `[MVP]`; legacy boundary count-back as configurable fallback `[MVP]`.
- NRR, points, bonus points, standings `[P2]`.

### Outputs & analytics
- Live scorecard, full scorecard, linear scoresheet, bowling analysis, fall of wickets, over-by-over `[MVP]`.
- Manual commentary feed, match/session/day notes `[MVP]`.
- Charts: Manhattan, worm, run-rate, partnership bars `[MVP]`; wagon wheel, pitch map, beehive via manual coordinate entry `[Later]`.
- Export: PDF scorecard, CSV `[MVP]`; Cricsheet-compatible JSON/YAML `[MVP-target]`; shareable live link `[MVP]`; public read API `[Later]`.

### Scoring integrity
- Single-scorer mode `[MVP]`; dual/co-scorer real-time reconciliation with discrepancy flags and two-scorer sign-off `[P2]`.
- Immutable ball-event log, correction workflow, full audit trail, per-action attribution `[MVP]`.

### Platform & accounts
- Web app (installable PWA, offline local store) + Android app (offline-first, background sync) `[MVP]`.
- Accounts & auth, organizations/tenants, RBAC, invitations `[MVP]`.
- Guest / anonymous local-only scoring with optional later upload `[MVP]`.
- Player & team profiles, match history, aggregate stats `[MVP basic / P2 deep]`.
- Online notifications (wicket, innings break, result) `[MVP]`.
- Localization framework (English v1), time zones, multi-day match clock `[framework MVP]`.

### Cross-cutting
- Shared domain/rules core used by both clients; deterministic sync engine; conflict resolution; local backup/restore; account data export & deletion `[MVP]`.

---

## 7. Out of Scope

Not in this product for the foreseeable roadmap:

- **Ball-tracking / Hawk-Eye / computer vision / automated ball detection** — a hardware + CV programme, not a scoring book.
- **Live video streaming and broadcast graphics/overlay production** — separate broadcast domain.
- **Official DRS / umpire-review technology and adjudication** — governed by ICC-licensed systems.
- **Betting, odds, fantasy leagues, monetized predictions** — regulatory and ethical scope we will not take on.
- **AI-generated natural-language commentary** — deferred; not part of the foundation.
- **Automated umpire signal recognition or decision-making** — out of domain.
- **Club administration suite** — membership, subscriptions, ground booking, payments, kit shop, selection/availability workflows beyond lineup submission.
- **Native iOS app for v1** — Android + Web first; iOS a later platform.
- **Smartwatch / wearable scoring.**
- **Social-network features** — feeds, following, DMs, comment threads beyond a shareable live link.
- **Multi-sport support** (baseball, softball, rounders) — cricket only.
- **Historical stats archive / encyclopedia** (ESPNcricinfo / CricketArchive-style bulk historical database).
- **Proprietary rain methods beyond DLS Standard Edition** (DLS Professional Edition, VJD) — pluggable interface only, pending licensing/interest.
- **Server-less peer-to-peer LAN sync with no backend** — possible future, not committed.
- **Dedicated hardware scoring consoles.**

---

## 8. Success Criteria

### Correctness & quality gates
- **100% pass** on a versioned *cricket rules conformance suite* covering every dismissal mode, every extra, free hit, and over/strike edge cases — benchmarked against worked examples reviewed by an accredited scorer.
- **DLS** revised targets/par scores match DLS Standard Edition reference outputs within published rounding tolerance across a fixed benchmark set of rain scenarios.
- On-screen and exported scorecards **always reconcile**: total = Σ batter runs + extras; legal deliveries reconcile with overs; wickets ≤ 10 per innings; zero discrepancy.

### Reliability
- **Zero ball-events lost** across a defined chaos test (force-kill, battery pull, OS eviction, offline toggling) over ≥ 50 simulated innings on target Android hardware.
- On reconnect, a full T20's offline data syncs in **< 30 s** on a 3G-class connection; dual-scorer states converge deterministically with **all** conflicts surfaced.
- Online services availability **≥ 99.5%** monthly; live viewer link end-to-end lag **< 10 s**.

### Usability & speed
- Median normal delivery recorded in **≤ 2 interactions**; one scorer keeps pace with live play for a full innings in every supported format with no backlog.
- First-time volunteer scorer completes a guided practice match with **≥ 95% task completion** and no unrecoverable error.
- **SUS ≥ 80** with a panel of club scorers.
- **WCAG 2.2 AA** verified on core web scoring and scorecard flows.

### Adoption & satisfaction
- Pilot: **≥ 5 clubs/leagues** score **≥ 100 complete matches** end-to-end over one season.
- Scorer-reported error rate at or below the paper baseline; **≥ 80%** of pilot scorers would choose it over their current method.

### Data & interoperability
- Cricsheet-compatible export validates against the target schema; export → import round-trip preserves the match with zero material difference.
- Every match has a complete, attributable audit trail from first ball to signed-off result.

### Operational & parity
- Scoring-core feature-parity matrix **≥ 95%** between Web and Android.
- Shared rules core: identical inputs produce identical scoring outcomes on both platforms (contract tests green on both).

---

## 9. Major Assumptions

1. Connectivity at grounds is unreliable or absent; **offline-first is a hard requirement**, not a nice-to-have.
2. Scorers have basic cricket literacy; the app assists and enforces the Laws but is **not** a from-zero teaching tool.
3. Dual scoring = two people, two devices/accounts, one logical match — not two cursors on one device.
4. Android target: Android 10+ on mid-range hardware and phone screen sizes from small to large; basic tablet support. Web target: current evergreen browsers on desktop, laptop, tablet and Chromebook with a keyboard.
5. Authoritative rule base = **MCC Laws of Cricket** (current code) + **ICC Standard Playing Conditions**; competition-specific variations are configuration, not forks.
6. **DLS Standard Edition** (publicly documented) is acceptable for v1; Professional Edition and alternative methods are out unless licensed. *Requires legal confirmation.*
7. Reproducing Laws/DLS text verbatim may require MCC permission; encoding rules as logic and citing rather than copying is acceptable.
8. A **Cricsheet-compatible** JSON/YAML target is an acceptable interchange standard; no single universally mandated official match format exists.
9. Backend is a **managed cloud Postgres platform with auth, row-level security, and realtime (Supabase)**, per the project's configured agents; web offline store is IndexedDB; Android has a local database with background sync.
10. Match records are low-sensitivity but **high-integrity**: tamper-resistance and attribution matter more than confidentiality.
11. One time zone per match; matches may span multiple days.
12. Users will create accounts for cloud/sharing features; anonymous local-only scoring is permitted.
13. English-first is acceptable for v1 with a localization-ready structure.
14. A small team using AI-assisted SDD can deliver a rigorous domain build **if scope is phased**.
15. Minors participate in cricket; player-profile features must be designed with child-data protection (GDPR-K / COPPA-style) in mind.

---

## 10. Major Risks

| # | Risk | Type | Impact | Likelihood | Mitigation |
|---|---|---|---|---|---|
| 1 | Rules/edge-case complexity underestimated → engine bugs erode trust | Product/Domain | High | High | Formal domain model + versioned conformance suite + accredited-scorer review; phase formats (limited-overs before multi-day) |
| 2 | DLS licensing / IP constraints | Legal | High | Med | Early legal review; use documented Standard Edition; keep rain method pluggable; pursue licensing/partnership; always allow manual target entry |
| 3 | MCC Laws text IP | Legal | Med | Med | Implement as logic, cite don't copy, seek written permission for in-app help text |
| 4 | Offline sync conflicts corrupt the record (naive last-write-wins) | Technical | High | Med | Event-sourced append-only ball log; deterministic merge; per-event provenance; explicit reconciliation UI; no silent overwrites |
| 5 | Data loss on mobile (crash/OS kill mid-over) | Technical | High | Med | Write-ahead persistence per event; crash-recovery on launch; chaos testing as a release gate |
| 6 | Scope creep (endless edge cases + tournaments + analytics) | Delivery | High | High | Strict MVP, enforced out-of-scope list, phase gates, every ask triaged against §5 objectives |
| 7 | Cross-platform divergence (Web vs Android behavior drifts) | Technical | High | Med | Single authoritative rules-core spec; conformance/contract tests run on both; parity matrix tracked per release |
| 8 | Adoption vs incumbents (CricHeroes, Play-Cricket, NV Play, TCS, MyCricket) | Market | Med | Med | Superior offline UX + integrity features; import tooling; free tier; pilot partners; pursue association endorsement |
| 9 | Real-time scale (many concurrent live matches + viewers) | Technical | Med | Med | Capacity planning, load tests, graceful degradation to polling, backpressure on viewer fan-out |
| 10 | Performance on low-end Android (laggy entry loses live pace) | Technical | High | Med | Per-tap performance budget; minimal hot-path work; device-lab testing on target-tier hardware |
| 11 | Governing-body politics (associations mandate their own tools) | Market/Political | Med | Med | Interoperability + open export + API; position as complementary; seek endorsement not confrontation |
| 12 | Small-team bandwidth vs a large domain | Delivery | High | Med | AI-assisted SDD, aggressive phasing, managed backend, narrow v1, specialized agent workflow |
| 13 | Multi-day/Test state complexity (sessions, bad light, follow-on, declarations) | Domain | Med | Med | Explicit match-state machine; isolate as a dedicated later phase with its own spec |
| 14 | One-handed / speed UX hard to nail | UX | Med | Med | Early, repeated usability testing with real scorers during live matches; iterate on Build→Verify→Feedback→Improve |
| 15 | Integrity/security: unauthorized or tampered score edits | Security | High | Low–Med | Row-level security, role checks, immutable audit log, corrections as new events, two-scorer sign-off, security-agent review |
| 16 | Legal/privacy for player data incl. minors | Legal | Med | Med | Data-protection design review, consent model, minimized profile data, guardian-consent path |
| 17 | Interchange standard shifts or is rejected by the target ecosystem | Technical/Market | Low–Med | Med | Adapter-based export layer; support multiple targets over time |

---

## 11. Questions Requiring Clarification

These gate the move from Describe → Decompose and from Foundation → Specification.

### A. Market & positioning
1. **Primary v1 segment** — club/league volunteer scorers, professional/accredited scorers, or broadcasters? (Sets the rigor-vs-simplicity balance.)
2. **Primary geography first** — England/Play-Cricket ecosystem, Australia/MyCricket, India, or global from day one? (Affects rule variations and interchange targets.)
3. Is **association/governing-body endorsement** ("official record" status) a v1 goal, or is being an excellent independent tool sufficient?
4. **Business model** — free, freemium, per-club licence, competition SaaS? (Drives tenancy, limits, roles.)

### B. Scope & formats
5. Which **formats must v1 support**? Is multi-day/Test in v1 or a later phase?
6. Is **automated DLS** required for v1, or is manual/known-target entry acceptable initially?
7. Is **dual-scorer real-time reconciliation** a v1 requirement or Phase 2?
8. Are **tournaments / points tables / NRR** in v1 or later?
9. Which **competition-specific variations** matter early — impact player, concussion sub, powerplay variants, The Hundred rules?
10. **Analytics depth for v1** — scorecard + Manhattan/worm only, or wagon wheel / pitch maps (manual coordinate entry) too?
11. Is **manual commentary entry** in v1?

### C. Users & roles
12. Is **anonymous/guest local-only scoring** required, or is login always mandatory?
13. Are **Umpire** and **Commentator** real roles in v1, or deferred?
14. Are **player self-service profiles** and appearance/stat claiming in v1 or later?

### D. Platform & technical direction *(foundation-level only)*
15. Confirm **Android + Web only for v1**, iOS deferred?
16. Confirm the **managed cloud backend (Supabase: Postgres + Auth + Realtime + RLS)** assumed by the project's agents?
17. Is an **installable PWA** acceptable for the web offline experience, or is a specific stack required?
18. Any requirement for **self-hosting / on-prem** for associations?
19. Preference on how the **shared rules core** is delivered across Web + Android — one shared library, or spec + parallel implementations verified by contract tests?

### E. Data, standards & legal
20. **Interchange target** — is Cricsheet-compatible acceptable, or must we match a specific league/board feed format?
21. Who **owns and pursues DLS licensing and MCC permission** for rule/help text — and is there budget for it?
22. **Data ownership model** — who owns a scored match: the scorer, the club, or the platform? Retention, deletion, and portability rules?
23. **Minors' data** in player profiles — consent model and jurisdictions in scope?

### F. Delivery & process
24. **Team size, roles, and skills** available?
25. Is there a **season/tournament deadline** that fixes the pilot date?
26. **Definition of "done" for the v1 pilot** — how many clubs, how many matches, over what period?
27. **Budget envelope** for third-party licensing, cloud, and app-store distribution?

---

## Recommended next steps in the SDD flow

1. **Resolve the gating questions** — at minimum A1–A4, B5–B7, D15–D16, E20–E22. These determine the MVP line.
2. **Write `docs/specs/cricket-rules-reference.md`** — the single source of truth for overs, extras, dismissals, strike rotation, free hit, DLS, Super Over, retired hurt. Every other spec defers to it. *(Draft v0.1.0 now exists.)*
3. **Domain glossary + domain model** (Decompose / Domain layer) — entities (Match, Innings, Over, Delivery, Dismissal, Partnership, Player, Team, Competition), the ball-event vocabulary, and the match state machine.
4. **Feature spec backlog** — one file per feature under `docs/specs/`, each with user stories, Given/When/Then acceptance criteria, edge cases, and open questions.
5. **Architecture foundation** (System layer) — offline-first strategy, sync & conflict-resolution model, high-level Supabase schema outline, API/realtime contracts, shared-state approach.
6. Then **Plan → Build → Verify** per feature, with the §8 criteria as the Verify gate.
