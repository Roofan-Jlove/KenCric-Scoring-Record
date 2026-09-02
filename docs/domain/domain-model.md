# Cricket Scoring — Formal Domain Model

| | |
|---|---|
| **Document** | Formal Domain Model (Domain layer / 4Ds *Decompose*) |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-02 |
| **Upstream** | `docs/specs/cricket-rules-reference.md` v0.1.0 (the approved domain specification) |
| **Companion** | `docs/domain/glossary.md` v0.1.0 |
| **Downstream** | `docs/architecture/*` (schema, sync, API), feature specs under `docs/specs/*` |

Derived one-to-one from the approved cricket-domain specification. This is a **model**, not a design: no storage, no framework, no code. Where a rule already carries a spec ID (`CSR-*`, `NB-*`, `WKT-*`, `INV-*`, …) this document **references** it rather than restating it.

---

## 0. Modelling conventions

### 0.1 Identifier scheme

| Kind | Prefix | Example | Notes |
|---|---|---|---|
| Bounded context | `CTX-` | `CTX-SCORING` | — |
| Aggregate | `AGG-` | `AGG-MATCH` | Names its consistency boundary. |
| Entity | `ENT-` | `ENT-INNINGS` | Has identity + lifecycle; lives inside exactly one aggregate. |
| Value object | `VO-` | `VO-RUNLINE` | No identity; immutable; compared by value. |
| Domain event | `EVT-` | `EVT-DELIVERY-RECORDED` | Past tense. |
| Command | `CMD-` | `CMD-RECORD-DELIVERY` | Imperative. |
| Query / read model | `QRY-` | `QRY-LIVE-SCORECARD` | Side-effect free. |
| State machine | `SM-` | `SM-MATCH` | — |
| Model-level invariant | `MINV-` | `MINV-01` | Complements the spec's `INV-*`. |
| Model-level business rule | `MBR-` | `MBR-01` | Complements the spec's `BR-*` / `CSR-*`. |
| Domain service | `SVC-` | `SVC-STRIKE-RESOLVER` | Stateless behaviour that doesn't belong to one entity. |

IDs are **stable and never reused**. Withdrawn objects are marked `DEPRECATED (v0.x.y)`, not deleted.

### 0.2 Every object entry carries the same seven fields

1. **Identifier** — the `ENT-`/`VO-` id and the identity key (for entities) or "compared by value" (for VOs).
2. **Purpose** — one or two sentences: why it exists in the domain.
3. **Attributes** — name : type — constraint. Types are domain types (`Runs`, `OverBall`, `PlayerId`, …), not language types.
4. **Relationships** — associations to other objects, with cardinality and direction; which aggregate owns it.
5. **Validation rules** — always-true constraints on the object itself (structural + referential), citing spec IDs.
6. **Lifecycle** — how it is created, how it changes, how it ends; which events/commands drive it.
7. *(entities & aggregates also carry)* **States** and **State transitions** where a lifecycle is non-trivial (§6).

### 0.3 Aggregate design rationale

- **`AGG-MATCH` is the core consistency boundary and is event-sourced.** Every scoring fact is an immutable event on the match's timeline; all read structures (scorecard, cards, partnerships, FoW, run rate, DLS ladder) are **projections** and hold no independent truth. This directly serves `CORR-001…004`, `INV-*`, `STATE-004`, and the offline/append-only requirements.
- Internal entities of `AGG-MATCH` (`ENT-INNINGS`, `ENT-OVER`, `ENT-DELIVERY`, `ENT-WICKET`, `ENT-SUPER-OVER`, `ENT-INTERRUPTION`, `ENT-DLS-REVISION`, `ENT-REVIEW`, `ENT-BATTER-CARD-LINE`, `ENT-BOWLER-CARD-LINE`, `ENT-PLAYER-REPLACEMENT`) are reached **only through the `Match` root**; they are never referenced by identity from outside the aggregate.
- Other aggregates (`AGG-ORGANIZATION`, `AGG-PLAYER`, `AGG-TEAM`, `AGG-COMPETITION`, `AGG-CONDITIONS-PROFILE`, `AGG-MATCH-TEMPLATE`) are referenced from `AGG-MATCH` **by identity only** (`OrganizationId`, `PlayerId`, …), never by object reference — they are separate transactional boundaries and may live in other services.
- A guest (anonymous, device-local) match is a fully valid `AGG-MATCH` whose `organizationId` is null and whose team/player references may be local-only value objects until claimed (`MBR-02`).

### 0.4 Relationship to the cricket-domain specification

The spec (`cricket-rules-reference.md`) answers *"what is true in cricket and what must the record contain"*. This model answers *"as what objects, with what identity, state, and behaviour"*. Every `[LAW]`/`[PRD]`/`[CFG]`/`[EDGE]` requirement lands in exactly one of: an attribute, a validation rule, an invariant, a state transition, an event, or a command precondition. §12 is the traceability matrix.

---

## 1. Bounded Contexts

| ID | Context | Responsibility | Core? | Key aggregates |
|---|---|---|---|---|
| **CTX-SCORING** | Scoring | Record every ball of a match, maintain match state, produce the reconciled scorecard, handle corrections, DLS, tie-breakers, sign-off. | **Core domain** | `AGG-MATCH` |
| **CTX-IDENTITY** | Identity & Tenancy | Organizations, users, roles, membership, guest→account claim. | Supporting | `AGG-ORGANIZATION` |
| **CTX-PARTICIPANTS** | Teams & Players | Canonical player registry, team profiles, squads, dedupe/merge. | Supporting | `AGG-PLAYER`, `AGG-TEAM` |
| **CTX-COMPETITION** | Competitions | Seasons, fixtures, playing-condition templates, standings, NRR, bonus points, disputes. | Supporting | `AGG-COMPETITION`, `AGG-CONDITIONS-PROFILE`, `AGG-MATCH-TEMPLATE` |
| **CTX-PROFILES** | Profiles & Stats | Career/team aggregates, appearance claims, records, head-to-head. Consumes `EVT-MATCH-FINALISED`. | Generic | (read models) |
| **CTX-PUBLISHING** | Sharing & Viewer | Shareable read-only links, live viewer projection, notifications. Consumes scoring events. | Generic | (read models) |

**Context map (relationship patterns).**

```
CTX-COMPETITION ──(supplier: templates, fixtures)──▶ CTX-SCORING
CTX-PARTICIPANTS ─(supplier: PlayerId, TeamId)────▶ CTX-SCORING
CTX-IDENTITY ─────(supplier: OrganizationId, roles)▶ CTX-SCORING
CTX-SCORING ──────(published language: domain events)▶ CTX-PROFILES
CTX-SCORING ──────(published language: domain events)▶ CTX-PUBLISHING
CTX-SCORING ──────(EVT-MATCH-FINALISED)─────────────▶ CTX-COMPETITION (standings)
```

- **Published Language** = the domain event set in §9. Downstream contexts subscribe; they never reach into `AGG-MATCH`.
- **Anti-corruption**: `CTX-SCORING` accepts external Cricsheet-style imports only through a translation service that maps to commands; it never adopts a foreign model.

The rest of this document details **CTX-SCORING** in full and the other contexts to the depth needed to bound `AGG-MATCH`.

---

## 2. Aggregates

Each aggregate: **Identifier · Purpose · Root · Internal members · Externally-referenced-by-id · Consistency invariants · Transaction rule · Lifecycle**.

### AGG-MATCH — the Match aggregate *(core)*

- **Identifier:** `AGG-MATCH`. Identity key: `MatchId` (opaque, globally unique, assigned at creation; a guest match keeps its locally-generated `MatchId` after claim — `MBR-02`).
- **Purpose:** the single consistency boundary for scoring one match. Owns the immutable event timeline and every structure derived from it. Guarantees the reconciliation invariants (`INV-001…018`, §7) hold after every accepted command.
- **Root entity:** `ENT-MATCH`.
- **Internal members (reached only via the root):** `ENT-INNINGS` (1–4), `ENT-SUPER-OVER` (0–n), `ENT-OVER` (per innings), `ENT-DELIVERY` (per over), `ENT-WICKET` (per innings), `ENT-INTERRUPTION` (0–n), `ENT-DLS-REVISION` (0–n), `ENT-REVIEW` (0–n), `ENT-BATTER-CARD-LINE` (per innings per batter), `ENT-BOWLER-CARD-LINE` (per innings per bowler), `ENT-PLAYER-REPLACEMENT` (0–n), plus value objects (§5) and non-delivery timeline markers.
- **Referenced by id only:** `OrganizationId?`, `CompetitionId?`, `FixtureId?`, `ConditionsProfileId` (snapshotted into `VO-PLAYING-CONDITIONS-PROFILE` at freeze), `TeamId ×2` (or local team VOs for guest), `PlayerId` throughout `VO-NOMINATED-SIDE`, `UserId` for scorers/officials.
- **Consistency invariants (must hold at the end of every command):** `MINV-01…MINV-14` (§7) and the spec's `INV-001…018`. Notably: total identity, ball identity, wickets ≤ max, strike continuity, one dismissal per delivery, no bowler two consecutive overs, playing-conditions freeze.
- **Transaction rule:** one command → zero or more events appended atomically to this match's timeline → all projections recomputed within the same logical transaction. No command spans two matches. Cross-aggregate effects (standings, stats, notifications) are **eventual**, via published events.
- **Lifecycle:** created by `CMD-CREATE-MATCH` → configured → toss → ready → in progress (deliveries) → complete pending sign-off → **finalised** by `CMD-SIGN-OFF-MATCH`; or → abandoned / no-result / awarded. Post-final change only via `CMD-AMEND-*` with elevated authority (`CORR-009`). Full state machine `SM-MATCH` (§6.1).

### AGG-ORGANIZATION — tenancy & access *(supporting, CTX-IDENTITY)*

- **Identifier:** `AGG-ORGANIZATION`. Identity key: `OrganizationId`.
- **Purpose:** owns members, role assignments, branding, and the set of teams/competitions in a tenant; the authority for "who may do what" referenced by `AGG-MATCH` at command time.
- **Root:** `ENT-ORGANIZATION`. Internal: `ENT-MEMBERSHIP` (user↔org↔roles), `VO-BRANDING`, `VO-ROLE-ASSIGNMENT`.
- **Referenced by id only:** `UserId`.
- **Consistency invariants:** a membership references a real user and a defined role set; exactly one owner-equivalent must exist; deactivated members hold no active roles (`BR-024`).
- **Transaction rule:** membership/role changes are atomic within the org; they do not retroactively alter authored match events.
- **Lifecycle:** `Created → Active → Suspended → Deleted`. Deletion anonymises the actor in downstream audit trails but does not delete finalised matches (`BR-025`).

### AGG-PLAYER — canonical person *(supporting, CTX-PARTICIPANTS)*

- **Identifier:** `AGG-PLAYER`. Identity key: `PlayerId` (stable, external-safe — `NFR-052`, `FR-179`).
- **Purpose:** one record per real person, so appearances and career stats aggregate correctly across matches and teams.
- **Root:** `ENT-PLAYER`. Internal: `VO-PLAYER-NAME`, `VO-PLAYER-ATTRIBUTES` (batting hand, bowling type, role hint), `VO-APPEARANCE-CLAIM`.
- **Consistency invariants:** display name non-empty; a merged player redirects to its survivor and accepts no new writes (`BR-044`).
- **Lifecycle:** `Draft(ad-hoc) → Registered → (Merged→redirect) | Deactivated`. Ad-hoc players created at the ground (`SCR-029`) start `Draft` and may later be linked/merged.

### AGG-TEAM — team profile & squad *(supporting, CTX-PARTICIPANTS)*

- **Identifier:** `AGG-TEAM`. Identity key: `TeamId`.
- **Purpose:** a named side with colours/logo/home ground and a squad pool from which a nominated XI is drawn.
- **Root:** `ENT-TEAM`. Internal: `ENT-SQUAD-MEMBER` (player ref + availability), `VO-TEAM-IDENTITY` (name, short name, colours, logo).
- **Referenced by id only:** `PlayerId`, `OrganizationId?`.
- **Consistency invariants:** a squad member references a real player; a player appears at most once in a squad.
- **Lifecycle:** `Created → Active → Archived`. Ad-hoc match teams may be free-text `VO-LOCAL-TEAM` and never become an `AGG-TEAM` unless claimed.

### AGG-COMPETITION — season & standings *(supporting, CTX-COMPETITION)*

- **Identifier:** `AGG-COMPETITION`. Identity key: `CompetitionId`.
- **Purpose:** groups matches into a season with one condition template, a points model, NRR/bonus rules, fixtures, and standings.
- **Root:** `ENT-COMPETITION`. Internal: `ENT-FIXTURE`, `ENT-DIVISION`, `VO-POINTS-MODEL`, `VO-NRR-RULE`, `VO-STANDINGS-ROW` (projection), `ENT-DISPUTE`.
- **Referenced by id only:** `TeamId`, `ConditionsProfileId`, `MatchId` (per fixture), `UserId` (scorer assignment, organizer).
- **Consistency invariants:** standings recompute only from `FINAL`, non-disputed matches (`BR-015`); a locked/disputed fixture is excluded until adjudicated (`BR-016`).
- **Lifecycle:** `Draft → Scheduled → InProgress → Completed → Archived`.

### AGG-CONDITIONS-PROFILE — playing-conditions template *(supporting, CTX-COMPETITION)*

- **Identifier:** `AGG-CONDITIONS-PROFILE`. Identity key: `ConditionsProfileId` (+ `version`).
- **Purpose:** a named, versioned set of `[CFG]` values (`CFG-REG`, spec §35) that a match or competition adopts; the source that is **snapshotted** into a match at first delivery.
- **Root:** `ENT-CONDITIONS-PROFILE`. Internal: `VO-PLAYING-CONDITIONS-PROFILE` (the full key set), `VO-DLS-REFERENCE` (table id + `G50` + edition).
- **Consistency invariants:** every `[CFG]` key present and within its allowed values; `rain_method` consistent with format (`DLS-002`); reference-data versions pinned.
- **Lifecycle:** `Draft → Published(vN) → Superseded(vN+1) → Retired`. Published versions are immutable; a change is a new version. Applied to matches created **after** publication only (`BR-045`).

### AGG-MATCH-TEMPLATE — reusable match setup *(supporting, CTX-COMPETITION / scorer-local)*

- **Identifier:** `AGG-MATCH-TEMPLATE`. Identity key: `MatchTemplateId`.
- **Purpose:** a saved match setup (format, conditions profile ref, default officials, venue, ball) so a scorer can create a ready match in under two minutes (`SCR-001`, `FR-028`).
- **Root:** `ENT-MATCH-TEMPLATE`. Internal: `VO-FORMAT`, `ConditionsProfileId` ref, `VO-VENUE`, `VO-BALL-SPEC`.
- **Lifecycle:** `Created → Active → Archived`. May be org-shared or device-local (guest).

---

## 3. Aggregate containment & external-reference map

```
AGG-MATCH (root: ENT-MATCH)
│
├── VO-FORMAT                      (frozen at create)
├── VO-PLAYING-CONDITIONS-PROFILE  (SNAPSHOT of AGG-CONDITIONS-PROFILE @ first delivery)
├── VO-TOSS
├── VO-MATCH-OFFICIALS ── {VO-UMPIRE-SLOT, VO-SCORER-ASSIGNMENT*}
├── VO-NOMINATED-SIDE ×2 ── {PlayerId*, captain: PlayerId, keeper: PlayerId}
├── VO-VENUE, VO-BALL-SPEC, VO-SCHEDULE
│
├── ENT-INNINGS  (1..4)  [SM-INNINGS]
│   ├── ENT-OVER (0..n)
│   │   └── ENT-DELIVERY (0..n)  [SM-DELIVERY]
│   │       ├── VO-RUNLINE
│   │       ├── VO-EXTRAS-ON-DELIVERY
│   │       ├── VO-DELIVERY-CONTEXT  (striker, non-striker, bowler, keeper, phase, isFreeHit)
│   │       ├── VO-FIELDING-INVOLVEMENT
│   │       └── →0..1 ENT-WICKET
│   ├── ENT-WICKET (0..10+)  ── VO-DISMISSAL, VO-FALL-OF-WICKET
│   ├── ENT-BATTER-CARD-LINE (per batter)   [SM-BATTER-CARD-LINE]   (projection-backed)
│   ├── ENT-BOWLER-CARD-LINE (per bowler)                            (projection-backed)
│   ├── VO-PARTNERSHIP-SEGMENT (0..n)  (projection)
│   ├── VO-EXTRAS-BREAKDOWN            (projection)
│   ├── VO-POWERPLAY-PLAN ── {VO-POWERPLAY-PHASE*}
│   └── VO-TARGET?  (innings batting last)
│
├── ENT-SUPER-OVER (0..n)  ── mini ENT-INNINGS ×2 (constrained)
├── ENT-INTERRUPTION (0..n)   [SM-INTERRUPTION]
├── ENT-DLS-REVISION (0..n)   [SM-DLS-REVISION]  ── VO-DLS-INPUTS, VO-DLS-OUTPUTS, VO-PAR-LADDER
├── ENT-REVIEW (0..n)         [SM-REVIEW]        ── VO-REVIEW-OUTCOME
├── ENT-PLAYER-REPLACEMENT (0..n)               ── VO-REPLACEMENT-REASON
│
├── VO-RESULT?                (set at completion)
├── VO-SIGN-OFF?              (set at FINAL)  ── {VO-SIGNATURE*}
├── VO-RECONCILIATION-REPORT  (recomputed each checkpoint)
└── Timeline: ordered EVT-* stream  (the source of truth)

External references held only as ids:
  OrganizationId?, CompetitionId?, FixtureId?, ConditionsProfileId(+version),
  TeamId×2 | VO-LOCAL-TEAM×2, PlayerId (throughout), UserId (scorers/officials/amenders)
```

**Read models (no independent truth; rebuilt from the timeline):** `QRY-LIVE-SCORECARD`, `QRY-FULL-SCORECARD`, `QRY-LINEAR-SHEET`, `QRY-BOWLING-ANALYSIS`, `QRY-FALL-OF-WICKETS`, `QRY-PARTNERSHIPS`, `QRY-OVER-BY-OVER`, `QRY-MANHATTAN`, `QRY-WORM`, `QRY-RUN-RATE-SERIES`, `QRY-DLS-PANEL`, `QRY-COMMENTARY-FEED`, `QRY-AUDIT-TRAIL`, `QRY-SCORECARD-AT`, `QRY-RECONCILIATION-REPORT`, `QRY-DIVERGENCE-LIST` (§10).

---

## 4. Entities

### 4.1 CTX-SCORING — the Match aggregate

---

#### ENT-MATCH — aggregate root

1. **Identifier:** `ENT-MATCH`. Identity: `MatchId`. Also carries `originDeviceId` and `claimStatus` for guest→account (`MBR-02`).
2. **Purpose:** the entry point and guardian of the whole scoring record. Holds match-level facts, owns the event timeline, enforces every aggregate invariant, and orchestrates state via `SM-MATCH`.
3. **Attributes**
   - `matchId : MatchId` — immutable.
   - `state : MatchState` — one of `SM-MATCH` (§6.1).
   - `format : VO-FORMAT` — frozen at creation (`FMT-002`, `FMT-014`).
   - `conditionsProfile : VO-PLAYING-CONDITIONS-PROFILE?` — null until first delivery, then an immutable snapshot; `conditionsFrozenAt : EventOrdinal?` (`BR-017`, `MBR-05`).
   - `conditionsProfileRef : {ConditionsProfileId, version}?` — the source of the snapshot.
   - `organizationId : OrganizationId?` — null ⇒ guest match (`MBR-01/02`).
   - `competitionId : CompetitionId?`, `fixtureId : FixtureId?`.
   - `sides : VO-NOMINATED-SIDE[2]` — home/away designation in `VO-TEAM-REF`.
   - `toss : VO-TOSS?` — set by `CMD-RECORD-TOSS`.
   - `officials : VO-MATCH-OFFICIALS` — umpires, third/fourth, referee, scorers.
   - `schedule : VO-SCHEDULE` — dates, scheduled start, time zone, days.
   - `venue : VO-VENUE`, `ball : VO-BALL-SPEC`.
   - `inningsOrder : InningsId[]` — derived from toss + follow-on; length 1–4 (`FMT-003`, `FLW-005`).
   - `currentInningsId : InningsId?`.
   - `result : VO-RESULT?` — set on completion (`RES-*`).
   - `signOff : VO-SIGN-OFF?` — set at `FINAL` (`SCRD-020`, `CORR-009`).
   - `playerOfTheMatch : PlayerId?` (`OFCL-008`).
   - `timelineHead : EventOrdinal` — the last appended event's ordinal (monotonic — `INV-017`).
   - `reconciliation : VO-RECONCILIATION-REPORT` — recomputed at each checkpoint (`CORR-008`, `INV-018`).
   - `amendmentLog : VO-AMENDMENT-ENTRY[]` — human-readable post-first-ball corrections (`CORR-012`).
4. **Relationships**
   - owns 1–4 `ENT-INNINGS`, 0–n `ENT-SUPER-OVER`, 0–n `ENT-INTERRUPTION`, 0–n `ENT-DLS-REVISION`, 0–n `ENT-REVIEW`, 0–n `ENT-PLAYER-REPLACEMENT` (composition).
   - references `OrganizationId?`, `CompetitionId?`, `FixtureId?`, `ConditionsProfileId?`, two `TeamId` or `VO-LOCAL-TEAM`, many `PlayerId`, several `UserId`.
   - publishes the §9 events; consumed by `CTX-COMPETITION`, `CTX-PROFILES`, `CTX-PUBLISHING`.
5. **Validation rules**
   - `sides[0].teamRef ≠ sides[1].teamRef`; no `PlayerId` appears in both nominated sides (`BR-010`, `TEAM-010`).
   - `format` consistent with `conditionsProfile` (e.g. `innings_per_side`, `balls_per_over`, `rain_method` per `DLS-002`).
   - `inningsOrder` length = `format.inningsPerSide × 2`, ordering matches toss + any follow-on (`INN-002`, `FLW-005`).
   - No delivery may be recorded unless `state = IN_PROGRESS` and `currentInningsId` set (`STATE-002`).
   - `conditionsProfile` MUST be non-null once `timelineHead` reflects ≥ 1 delivery (`MBR-05`).
   - `result` non-null ⇔ `state ∈ {COMPLETE_PENDING_SIGNOFF, FINAL, ABANDONED, NO_RESULT, AWARDED}`.
   - `signOff` non-null ⇔ `state = FINAL`; sign-off requires `reconciliation.allPass` OR a recorded override reason (`BR-007`, `FR-105`).
   - guest match (`organizationId = null`): `competitionId` MUST be null; no share/publish events permitted (`BR-022`).
6. **Lifecycle:** `CMD-CREATE-MATCH` → root exists in `SCHEDULED`. Configuration commands enrich it. `CMD-RECORD-TOSS` → `TOSS_DONE`. `CMD-CONFIRM-READY` (validation gate) → `READY`. `CMD-START-INNINGS`/`CMD-RECORD-DELIVERY` → `IN_PROGRESS`. Completion path per `SM-MATCH`. `CMD-SIGN-OFF-MATCH` → `FINAL`. Post-`FINAL` only `CMD-AMEND-*` (elevated) or `CMD-REOPEN-MATCH` (`STATE-006`). No destructive delete; a mistaken match is `CMD-VOID-MATCH` → `VOIDED` with reason (still retained).
7. **States / transitions:** `SM-MATCH` §6.1.

---

#### ENT-INNINGS

1. **Identifier:** `ENT-INNINGS`. Identity: `InningsId` (unique within the match). Also `sequenceNo : 1..4` and `superOverRef : SuperOverId?` (null for main innings).
2. **Purpose:** one team's batting period; the sub-boundary within which overs, deliveries, wickets, cards and partnerships accrue and against which end-reason and target are evaluated.
3. **Attributes**
   - `inningsId : InningsId`, `sequenceNo : InningsSequence`.
   - `battingSide : VO-TEAM-REF`, `bowlingSide : VO-TEAM-REF`.
   - `state : InningsState` — `SM-INNINGS` (§6.2).
   - `allottedOvers : Overs?` — null for unlimited (`FMT-004`); mutable **only** via `EVT-OVERS-REVISED` (`INN-012`).
   - `oversPerBowlerCap : Balls?` (`FMT-006`).
   - `battingOrder : PlayerId[]` — append-only in the order batters actually came in (`INN-006`).
   - `batStrikerId : PlayerId?`, `batNonStrikerId : PlayerId?` — current pair; null before first delivery / after all out.
   - `currentBowlerId : PlayerId?`, `previousOverBowlerId : PlayerId?` (`OVER-003`).
   - `currentKeeperId : PlayerId` (`PLYR-002`).
   - `freeHitPending : bool` (`FH-003/004`).
   - `legalBallsBowled : int` — derived (`OVER-010`).
   - `score : Runs`, `wicketsLost : int` — derived projections (`INN-008`, `WKT-001`).
   - `extras : VO-EXTRAS-BREAKDOWN` — projection (`EXT-007`).
   - `powerplayPlan : VO-POWERPLAY-PLAN` (`PP-006`).
   - `target : VO-TARGET?` — set for the side batting last (`TGT-*`).
   - `endReason : InningsEndReason?` (`INN-003`).
   - `newBallTakenAt : OverBall[]` (`FMT-007`, `FR-068`).
   - `battersUnavailable : {PlayerId, reason}[]` — absent / retired-not-out-cannot-resume (`PLYR-010`, `RTHO-003`) — reduces the effective all-out threshold.
4. **Relationships**
   - part-of exactly one `ENT-MATCH`.
   - owns 0–n `ENT-OVER`, 0–n `ENT-WICKET`, per-batter `ENT-BATTER-CARD-LINE`, per-bowler `ENT-BOWLER-CARD-LINE`, 0–n `VO-PARTNERSHIP-SEGMENT`.
   - references `PlayerId` (order, pair, bowler, keeper), `VO-TEAM-REF ×2`.
   - `target` may reference the latest `ENT-DLS-REVISION`.
5. **Validation rules**
   - `battingSide ≠ bowlingSide`; both drawn from the match's two sides.
   - `batStrikerId ≠ batNonStrikerId`; both currently "in" (in `battingOrder`, not dismissed, not retired-away) (`STRK-*`).
   - `currentBowlerId ≠ previousOverBowlerId` at the first delivery of an over (`OVER-003`, `INV-013`); bowler's bowled balls ≤ cap unless override (`FMT-006`, `BOWL-008`).
   - `wicketsLost ≤ effectiveAllOutThreshold` where `effectiveAllOutThreshold = wickets_for_all_out − |battersUnavailable|` (`INN-004/005`, `INV-005`).
   - `legalBallsBowled ≤ allottedOvers × balls_per_over` when `allottedOvers` non-null (`INV-002/012`).
   - `score = Σ batterRuns + extras.total` at all times (`INN-008`, `INV-001`).
   - `state = ENDED` ⇒ `endReason` non-null and consistent with the triggering condition (`INN-003`).
   - `freeHitPending` may be true only if `conditionsProfile.free_hit_enabled` (`FH-001`).
   - `target` present ⇔ this innings' side bats last in `inningsOrder`.
6. **Lifecycle:** created `NOT_STARTED` by `CMD-CREATE-MATCH` (all innings shells) or lazily by `CMD-START-INNINGS`. → `IN_PROGRESS` on `CMD-OPEN-INNINGS` (sets opening pair + bowler). ↔ `SUSPENDED` on interruption/interval. → `ENDED(reason)` by all-out / overs-complete / target / declaration / forfeiture / time / no-further-play. May re-open (`SM-INNINGS`) on a cascading amendment (`CORR-006`). Ends permanently at match `FINAL`.
7. **States / transitions:** `SM-INNINGS` §6.2.

---

#### ENT-OVER

1. **Identifier:** `ENT-OVER`. Identity: `(InningsId, overNumber)` where `overNumber : 1..n`. `blockLength : 6 | 5 | 10` (`FMT-005`).
2. **Purpose:** groups the deliveries bowled from one end by (normally) one bowler; the unit for the "6 legal balls", "no consecutive overs", maiden, and end-change rules.
3. **Attributes**
   - `overNumber : int`, `bowlingEnd : EndRef`.
   - `bowlers : {PlayerId, ballsBowledInThisOver}[]` — usually one; two if `OVER-005/011/012` applies.
   - `deliveryIds : DeliveryId[]` — ordered; may exceed `blockLength` (illegal deliveries) (`OVER-014`).
   - `legalBallCount : 0..blockLength` — derived.
   - `runsInOver : Runs`, `wicketsInOver : int` — derived.
   - `isMaiden : bool`, `isWicketMaiden : bool` — derived (`OVER-008`).
   - `status : PENDING | IN_PROGRESS | COMPLETE | INCOMPLETE_AT_END` (`INN-013`, `OVER-006`).
4. **Relationships:** part-of one `ENT-INNINGS`; owns ordered `ENT-DELIVERY`; references `PlayerId` (bowler(s)).
5. **Validation rules**
   - `legalBallCount ≤ blockLength`; a `COMPLETE` over has `legalBallCount = blockLength` unless it is the innings' last over (`INV-012`, `OVER-001`).
   - the first legal delivery's bowler ≠ the previous over's bowler (`OVER-003`); a mid-over replacement bowler must not have bowled the previous over and is barred from the next (`OVER-011`).
   - `runsInOver` = Σ of its deliveries' total-run contribution.
   - `isMaiden` ⇒ no off-the-bat runs and no wides/no-balls among its deliveries (byes/leg-byes allowed).
6. **Lifecycle:** created `PENDING` when a new over is due; `IN_PROGRESS` on its first delivery; `COMPLETE` when `legalBallCount = blockLength`; `INCOMPLETE_AT_END` if the innings ends mid-over. May be re-derived wholesale by a cascading amendment (`CORR-013`).

---

#### ENT-DELIVERY

1. **Identifier:** `ENT-DELIVERY`. Identity: `DeliveryId`. Also `ordinal : EventOrdinal` (total order within the match — `BALL-007`) and `legalIndex : (overNumber, ballInOver)?` (null for wide/no-ball/NSRO-dead — `CMTRY-003/008`).
2. **Purpose:** the atomic scoring fact — one ball bowled with its complete, immutable outcome. The unit every projection folds over.
3. **Attributes**
   - `deliveryId : DeliveryId`, `ordinal : EventOrdinal`.
   - `context : VO-DELIVERY-CONTEXT` — `{strikerId, nonStrikerId, bowlerId, keeperId, powerplayPhase, isFreeHit, newBallInUse}`.
   - `legality : LEGAL | NO_BALL | WIDE` (`BALL-002`).
   - `countsAsLegalBall : bool` — true for LEGAL (incl. bye/leg-bye); false for NO_BALL/WIDE (`BALL-003`).
   - `noBallReason : NoBallReason?` (`NB-002/003/004/005`, `NB-010`).
   - `wideVariant : OFF_SIDE | LEG_SIDE?` (`WD-001/005`).
   - `runLine : VO-RUNLINE` — `{batRuns, ranByes, ranLegByes, shortRuns, boundary: NONE|FOUR|SIX, overthrow: VO-OVERTHROW?, penaltyOnDelivery: Runs}`.
   - `extrasOnDelivery : VO-EXTRAS-ON-DELIVERY` — how `runLine` maps to `b/lb/w/nb/pen` given `legality` and `nb_wd_secondary_extras_itemised` (`EXT-005`).
   - `battersCrossedAtKeyInstant : bool?` — for catch/overthrow strike resolution (`STRK-007`, `RUN-007`).
   - `fielding : VO-FIELDING-INVOLVEMENT` — ordered fielder refs (fielder / thrower / wicket-breaker / catcher; `(sub)` marker).
   - `wicketId : WicketId?` — 0..1 dismissal on this delivery (`WKT-005`).
   - `deadBall : {isDeadBall: bool, reason: DeadBallReason?}` (`BALL-006`).
   - `commentary : VO-COMMENTARY` — `{generatedSummary, freeText?, tokens}` (`CMTRY-002/004/005`).
   - `reviewId : ReviewId?` — a review attached to this delivery (`DRS-005`).
   - `provenance : VO-PROVENANCE` — scorer, device, appVersion, capturedAt (`FR-111`, `BALL-001`).
   - `supersedes : DeliveryId?`, `supersededBy : DeliveryId?` — amendment chain (`CORR-001`).
   - `status : ACTIVE | SUPERSEDED | VOID` (`CORR-014`).
4. **Relationships:** part-of one `ENT-OVER`; 0..1 `ENT-WICKET`; 0..1 `ENT-REVIEW`; references three+ `PlayerId` via `context`/`fielding`.
5. **Validation rules**
   - `context.strikerId ≠ context.nonStrikerId`; `context.bowlerId ≠ context.nonStrikerId` (NSRO handled separately).
   - `legality = LEGAL` ⇒ `countsAsLegalBall = true`; else false (`BALL-003`).
   - `isFreeHit = true` ⇒ `conditionsProfile.free_hit_enabled` and the immediately-preceding non-void delivery was a free-hit-triggering NO_BALL, or the free hit was retained (`FH-003/004/011`).
   - dismissal-mode legality matrix respected: `wicketId` mode ∈ allowed set for `legality` and `isFreeHit` (`WKT-009`); `NO_BALL`/`WIDE`/free-hit dismissal deliveries are **not** re-bowled and do **not** increment the legal count but still owe an extra ball (`WKT-011`).
   - `runLine.boundary = SIX` ⇒ `batRuns` originate off the bat (`RUN-004`); byes/leg-byes cannot produce a SIX.
   - `runLine.ranLegByes > 0` ⇒ a shot or evasion was attempted (`LB-001/002/007`).
   - on `WIDE`: `runLine.ranByes = 0` (extra running is wides) (`WD-009`); `batRuns = 0`.
   - `boundary` and `overthrow` interplay per `RUN-005/007`; five+ physically-run runs permitted (`RUN-016`).
   - a `VOID`/`SUPERSEDED` delivery contributes nothing to any projection.
   - `ordinal` strictly greater than every prior delivery's `ordinal` in the match (`INV-017`).
6. **Lifecycle:** created `ACTIVE` by `CMD-RECORD-DELIVERY` (emits `EVT-DELIVERY-RECORDED`). Never mutated in place: `CMD-AMEND-DELIVERY` creates a new `ENT-DELIVERY` that `supersedes` it and flips the original to `SUPERSEDED` (`CORR-001/002`); `CMD-VOID-DELIVERY` → `VOID`. Insertion of a missed ball (`CMD-INSERT-DELIVERY`) allocates a fresh `ordinal` between neighbours and triggers a cascade (`CORR-013`). Frozen (only amendable via elevated flow) once the match is `FINAL`.

---

#### ENT-WICKET

1. **Identifier:** `ENT-WICKET`. Identity: `WicketId`. `wicketNumber : 1..n` within its innings.
2. **Purpose:** records one dismissal — the mode, who is out, who (if anyone) is credited, and the fall-of-wicket snapshot.
3. **Attributes**
   - `wicketId : WicketId`, `wicketNumber : int`.
   - `deliveryId : DeliveryId?` — null for `timed out` / `retired out` (between-deliveries) (`TIMO-004`, `RTOU-004`).
   - `dismissal : VO-DISMISSAL` — `{mode, outBatterId, bowlerId?, fielders: VO-FIELDING-INVOLVEMENT, offTheBat: bool, nonStrikerBeforeDelivery: bool}`.
   - `creditsBowler : bool` — derived from `mode` (`WKT-003`).
   - `runsCompletedBeforeDismissal : VO-RUNLINE?` — for run out / obstructing (`RUN-012`, `WKT-010`).
   - `fallOfWicket : VO-FALL-OF-WICKET` — `{teamScore, wicketNumber, outBatterId, overBall, partnershipRuns, partnershipBalls, notOutBatterScore}` (`WKT-007`, `CSR-031`).
   - `incomingBatterId : PlayerId?`, `incomingBatterEnd : EndRef?` — resolved by `SVC-STRIKE-RESOLVER` and scorer-confirmed (`WKT-012`, `STRK-007/008/012`).
   - `status : ACTIVE | REVERSED` — reversed by successful review / amendment (`WKT-015`, `DRS-006`).
4. **Relationships:** part-of one `ENT-INNINGS`; 0..1 attached to one `ENT-DELIVERY`; references `PlayerId` (out batter, bowler, fielders, incoming batter).
5. **Validation rules**
   - exactly one `outBatterId`, currently "in" (`WKT-005`).
   - `mode` valid for the delivery's `legality`/`isFreeHit` (`WKT-009`); `bowled` never off no-ball/wide/free-hit (`BWLD-003`); stumped valid off a wide, not a no-ball (`STMP-001`, `WD-007`).
   - `creditsBowler = true` ⇔ `mode ∈ {BOWLED, CAUGHT, CAUGHT_AND_BOWLED, LBW, STUMPED, HIT_WICKET}` (`WKT-003`); `bowlerId` present iff `creditsBowler` or (run out where a bowler happened to break the wicket, recorded as fielder not credit).
   - `caught` / `stumped` / `bowled` / `lbw` / `hit wicket` ⇒ `runsCompletedBeforeDismissal` is empty (no runs) (`WKT-010`).
   - `mode = RETIRED_OUT` ⇒ `deliveryId = null`, `bowlerId = null`, team score unchanged, `wicketNumber` increments (`RTOU-002/004`).
   - `mode = TIMED_OUT` ⇒ `deliveryId = null`, `outBatterId` = the incoming batter (`TIMO-003`).
   - `nonStrikerBeforeDelivery = true` ⇒ `mode = RUN_OUT`, `bowlerId` recorded as fielder only, delivery re-bowled and not counted (`NSRO-004/005`).
   - `fallOfWicket.teamScore` monotonic non-decreasing across `wicketNumber` (`INV-006`).
6. **Lifecycle:** created `ACTIVE` with its delivery (or as a standalone `CMD-RECORD-RETIREMENT`/`CMD-APPEAL-TIMED-OUT`). → `REVERSED` by `CMD-APPLY-REVIEW-OUTCOME` (overturned) or `CMD-AMEND-WICKET`; reversal decrements `wicketsLost`, re-seats the batter, and triggers a strike cascade (`CORR-019`, `RTOU-005`).

---

#### ENT-SUPER-OVER

1. **Identifier:** `ENT-SUPER-OVER`. Identity: `SuperOverId`. `sequenceNo : 1..n` (repeat Super Overs — `SO-013`).
2. **Purpose:** a tie-breaker mini-contest: two constrained one-over innings whose winner sets the match's tie-breaker outcome.
3. **Attributes**
   - `superOverId`, `sequenceNo`.
   - `battingOrder : [VO-TEAM-REF, VO-TEAM-REF]` — resolved by `super_over_batting_order` (`SO-004`).
   - `nominations : {side: VO-TEAM-REF, batters: PlayerId[3], bowlerId: PlayerId}[2]` (`SO-003`).
   - `innings : [SuperOverInnings, SuperOverInnings]` — each a constrained `ENT-INNINGS` with `allottedOvers = 1 over`, `effectiveAllOutThreshold = 2` (`SO-002`).
   - `outcome : VO-SUPER-OVER-OUTCOME` — `{winner: VO-TEAM-REF? , tied: bool}`.
4. **Relationships:** part-of one `ENT-MATCH`; each side's `SuperOverInnings` reuses `ENT-OVER`/`ENT-DELIVERY`/`ENT-WICKET` with the Super-Over constraints.
5. **Validation rules**
   - nominated batters ⊆ that side's `VO-NOMINATED-SIDE`; a batter dismissed in Super Over `k` is absent from side's nominations for `k+1` (`SO-003/013`).
   - a bowler may not bowl consecutive Super Overs for the same side (`SO-003`).
   - each mini-innings ends at 2 wickets or `balls_per_over` legal balls (`SO-002/011`).
   - Super-Over runs/wickets excluded from all main-match and career aggregates (`SO-009`, `MBR-06`).
   - only permitted when `result.type = TIE` and `conditionsProfile.tie_breaker = SUPER_OVER` (`RES-005`).
6. **Lifecycle:** created by `CMD-START-SUPER-OVER` after `EVT-MATCH-TIED`. Plays out via normal delivery commands. `CMD-RESOLVE-SUPER-OVER` sets `outcome`; if `tied` and `super_over_tie_resolution = REPEAT`, a new `ENT-SUPER-OVER` (`sequenceNo+1`) is created (`SO-008/013`); otherwise the match result is updated to `TIE (winner …)` (`SO-012`).

---

#### ENT-INTERRUPTION

1. **Identifier:** `ENT-INTERRUPTION`. Identity: `InterruptionId`.
2. **Purpose:** records a stoppage in play, its cause and duration, and the overs lost — the raw input to DLS and over-rate handling.
3. **Attributes**
   - `interruptionId`.
   - `cause : RAIN | BAD_LIGHT | GROUND | CROWD | INJURY_STOPPAGE | OTHER` .
   - `startedAt : Instant`, `startOverBall : OverBall?`, `resumedAt : Instant?`.
   - `inningsId : InningsId` — which innings is/was affected.
   - `wicketsDownAtStart : int`, `scoreAtStart : Runs`.
   - `oversLost : Overs?` — entered on resumption per the umpires (`FR-078/079`).
   - `revisedInningsOvers : Overs?` — resulting new allotment (`INN-012`).
   - `status : ACTIVE | RESOLVED | ABANDONED_FROM_HERE` .
4. **Relationships:** part-of one `ENT-MATCH`; affects one `ENT-INNINGS`; 0..1 originating `ENT-DLS-REVISION` (`DLS-007`).
5. **Validation rules**
   - `resumedAt ≥ startedAt` when present; `oversLost ≤ oversRemainingAtStart`.
   - a resolved interruption that reduced overs MUST have a linked `EVT-OVERS-REVISED` and, for DLS formats, a linked `ENT-DLS-REVISION` (`CSR-047`, `DLS-014`).
   - `status = ABANDONED_FROM_HERE` ⇒ the innings/match ends and result is derived from par at the last valid ball or `NO_RESULT` (`TGT-010`, `RES-006`).
6. **Lifecycle:** `CMD-RECORD-INTERRUPTION` → `ACTIVE` (innings → `SUSPENDED`). `CMD-RESUME-PLAY` → `RESOLVED` (+ overs revision + DLS revision as needed). `CMD-ABANDON-MATCH` from here → `ABANDONED_FROM_HERE`.

---

#### ENT-DLS-REVISION

1. **Identifier:** `ENT-DLS-REVISION`. Identity: `DlsRevisionId`. `revisionNo : 1..n` (`DLS-009`).
2. **Purpose:** one versioned application of the DLS method producing a revised target and a par ladder; individually reversible; auditable.
3. **Attributes**
   - `dlsRevisionId`, `revisionNo`.
   - `method : DLS_STANDARD | DLS_PROFESSIONAL | VJD` , `edition`, `resourceTableVersion`, `g50 : number` (`DLS-006`, `CFG-REG`).
   - `inputs : VO-DLS-INPUTS` — `{team1Score, team1ResourcesUsedPct, team2ResourcesAvailablePct, interruptionsSummary, wicketsAtEachInterruption}` (`DLS-007`).
   - `outputs : VO-DLS-OUTPUTS` — `{revisedTarget: Runs, revisedOvers: Overs, resourcesTeam1Pct, resourcesTeam2Pct, calculationBreakdown}` (`DLS-004/008`).
   - `parLadder : VO-PAR-LADDER` — par score keyed by `(oversCompleted, wicketsLost)` for the chasing innings (`DLS-005`).
   - `manualOverride : {revisedTarget: Runs, reason: NonEmptyText, byUserId: UserId}?` (`DLS-010`, `FR-090`).
   - `triggeredByInterruptionId : InterruptionId?`.
   - `status : ACTIVE | REVERSED` .
4. **Relationships:** part-of one `ENT-MATCH`; supplies the current `VO-TARGET` of the chasing `ENT-INNINGS`; 0..1 `ENT-INTERRUPTION`.
5. **Validation rules**
   - only present when `conditionsProfile.rain_method ≠ NONE` and format ∈ `dls_applicable_formats` (`DLS-001/002`).
   - `outputs.revisedTarget ≥ 1`; rounding per `DLS-004`; `resources ≤ 100%` per side (`INV-015`).
   - the **latest** `ACTIVE` revision (by `revisionNo`) defines the chasing side's `target` and par; earlier ones are historical (`CSR-051`).
   - `manualOverride` present ⇒ `reason` non-empty; computed `outputs` retained alongside (`DLS-010`).
   - computable offline from pinned reference data (`DLS-012`).
6. **Lifecycle:** `CMD-APPLY-DLS-REVISION` → `ACTIVE` (emits `EVT-DLS-REVISION-APPLIED`). `CMD-REVERSE-DLS-REVISION` / `CMD-AMEND-DLS-REVISION` → `REVERSED` + a fresh revision; if a match had been decided on a now-reversed par, the result re-derives and `FINAL` is revoked pending re-sign-off (`CORR-015`).

---

#### ENT-REVIEW

1. **Identifier:** `ENT-REVIEW`. Identity: `ReviewId`.
2. **Purpose:** records a challenge to an on-field decision (player or umpire initiated) and the change it caused to the record.
3. **Attributes**
   - `reviewId`, `type : PLAYER | UMPIRE` , `requestedBy : PlayerId | UMPIRE` , `requestedWithinSeconds : int?` (`DRS-002`).
   - `deliveryId : DeliveryId`, `subjectMode : DismissalMode | BOUNDARY | NO_BALL_CHECK | CLEAN_CATCH | RUN_OUT | STUMPING` .
   - `originalOnFieldDecision : OUT | NOT_OUT | SIGNALLED_X` .
   - `outcome : VO-REVIEW-OUTCOME` — `{result: UPHELD | OVERTURNED | UMPIRES_CALL, componentEvidence?: text, reviewRetained: bool}` (`DRS-003/005`).
   - `sideReviewCountAfter : int` — remaining player reviews for the side this innings (`DRS-008`).
   - `resultingChange : text` — the applied delta to the record (`DRS-006`).
4. **Relationships:** part-of one `ENT-MATCH`; attached to one `ENT-DELIVERY`; may cause an `ENT-WICKET` to be created or `REVERSED`, or a `NO_BALL` to be recorded (`DRS-007`).
5. **Validation rules**
   - `type = PLAYER` ⇒ `conditionsProfile.drs_enabled` and the side had ≥ 1 review remaining (`DRS-011`); request within `review_request_seconds` (`DRS-002`).
   - `outcome.result = UMPIRES_CALL` ⇒ on-field decision stands and `reviewRetained = true` (`DRS-003/009/010`).
   - a no-ball found on a dismissal review ⇒ wicket `REVERSED`, `NO_BALL` recorded, free hit set if enabled, runs actually run applied, no re-bowl (`DRS-007`).
   - the scoring record reflects only the final decision (`DRS-006`).
6. **Lifecycle:** `CMD-REQUEST-REVIEW` → pending; `CMD-APPLY-REVIEW-OUTCOME` → outcome set + record change applied + review counters updated. Immutable thereafter (a mistaken review entry is amended, not edited).

---

#### ENT-BATTER-CARD-LINE  *(projection-backed entity)*

1. **Identifier:** `ENT-BATTER-CARD-LINE`. Identity: `(InningsId, PlayerId)`.
2. **Purpose:** the batting-card row for one player in one innings — position, runs, balls, boundaries, minutes, and how out. Derived from the delivery/wicket stream; carries identity because its "status" is referenced by other rules (all-out threshold, not-out markers).
3. **Attributes**
   - `playerId`, `battingPosition : int` — order of arrival at the crease (`INN-006`, `BAT-007`).
   - `runs : Runs`, `ballsFaced : int`, `minutes : int?` (`track_batting_minutes`), `fours : int`, `sixes : int`, `strikeRate : number` (`BAT-001/003`).
   - `status : YET_TO_BAT | AT_CREASE | OUT | NOT_OUT | RETIRED_NOT_OUT | RETIRED_OUT | ABSENT | DID_NOT_BAT` (`SM-BATTER-CARD-LINE` §6.5).
   - `dismissal : VO-DISMISSAL?` — set when `status = OUT` / `RETIRED_OUT`.
   - `battingSpans : {fromOverBall, toOverBall?}[]` — >1 if retired then resumed (`RTHO-008`, `BAT-009`).
   - `dismissalString : text` — canonical (`BAT-005`).
4. **Relationships:** part-of one `ENT-INNINGS`; references one `PlayerId`; linked to 0..1 `ENT-WICKET`.
5. **Validation rules**
   - `ballsFaced` counts legal deliveries + no-balls faced, not wides (`BAT-002`, `INV-008`).
   - `fours×4 + sixes×6 ≤ runs` (`INV-009`).
   - `status = RETIRED_NOT_OUT`/`ABSENT` ⇒ not counted in `wicketsLost` but counted in `battersUnavailable` if unable to resume (`RTHO-003`, `PLYR-010`).
   - at most two `AT_CREASE` lines per innings at any time; they are `Innings.batStrikerId` / `batNonStrikerId`.
6. **Lifecycle:** created `YET_TO_BAT` for each XI member at innings open (or lazily). `→ AT_CREASE` on arrival, `→ OUT`/`RETIRED_*`/`NOT_OUT` per events; `→ DID_NOT_BAT` at innings end if never `AT_CREASE`. Fully recomputable from the timeline; identity/status persisted for rule references.

---

#### ENT-BOWLER-CARD-LINE  *(projection-backed entity)*

1. **Identifier:** `ENT-BOWLER-CARD-LINE`. Identity: `(InningsId, PlayerId)`.
2. **Purpose:** the bowling-analysis row — overs, maidens, runs charged, wickets, wides, no-balls, economy, plus spells and milestone flags.
3. **Attributes**
   - `playerId`, `oversBowled : OverBall` (or `ballsBowled` for The Hundred — `bowling_figures_unit`), `maidens : int`, `runsCharged : Runs`, `wickets : int`, `widesConceded : int`, `noBallsConceded : int`, `dotBalls : int`, `economy : number`, `strikeRate : number`, `average : number`, `foursConceded`, `sixesConceded` (`BOWL-001/004`).
   - `spells : VO-BOWLING-SPELL[]` (`BOWL-006`).
   - `ballsRemainingUnderCap : Balls?` (`BOWL-008`).
   - `milestones : {fiveWicketHaul: bool, tenWicketMatch: bool, hatTrickBallOrdinals: EventOrdinal[]}` (`BOWL-007/010`).
4. **Relationships:** part-of one `ENT-INNINGS`; references one `PlayerId`; spells reference `ENT-OVER` ranges.
5. **Validation rules**
   - `runsCharged` = off-bat runs off this bowler + wides + no-ball penalties; **excludes** byes, leg-byes, penalty runs, over-rate penalties (`BOWL-002`, `INV-004`).
   - `wickets` counts only bowler-credited modes (`BOWL-003/011`).
   - Σ over all bowlers of `ballsBowled` = innings `legalBallsBowled` (`INV-003`).
   - a split over (`OVER-011`) yields no maiden credit for either bowler (`BOWL-005`).
6. **Lifecycle:** as `ENT-BATTER-CARD-LINE` — projection-backed, recomputable, identity persisted for cap enforcement and spell tracking.

---

#### ENT-PLAYER-REPLACEMENT

1. **Identifier:** `ENT-PLAYER-REPLACEMENT`. Identity: `ReplacementId`.
2. **Purpose:** records a concussion replacement, impact/replacement player, or (legacy) runner entering the match, and the constraints that follow.
3. **Attributes**
   - `replacementId`, `kind : CONCUSSION | IMPACT_PLAYER | RUNNER | SUBSTITUTE_FIELDER` .
   - `side : VO-TEAM-REF`, `replacedPlayerId : PlayerId?`, `replacementPlayerId : PlayerId`.
   - `effectiveFrom : OverBall | BETWEEN_INNINGS` , `reason : VO-REPLACEMENT-REASON`, `approvedBy : text` (match officials).
   - `constraints : {mayBat: bool, mayBowl: bool, mayKeep: bool, mayCaptain: bool}` — derived from `kind` and profile.
4. **Relationships:** part-of one `ENT-MATCH`; references two `PlayerId` and one side.
5. **Validation rules**
   - `kind = CONCUSSION` ⇒ `concussion_replacement_enabled`; like-for-like; `replacedPlayerId` takes no further part; a replaced player never re-enters (`PLYR-004/011`).
   - `kind = IMPACT_PLAYER` ⇒ `impact_player_enabled` (`PLYR-005`).
   - `kind = SUBSTITUTE_FIELDER` ⇒ `mayBat = mayBowl = mayKeep = mayCaptain = false`, except keeper-sub with umpires' consent (`PLYR-003/006`).
   - `kind = RUNNER` ⇒ `runners_enabled` (default off) (`PLYR-009`).
6. **Lifecycle:** `CMD-RECORD-REPLACEMENT` → active; effects apply from `effectiveFrom`. Reversible only by amendment (rare).

---

### 4.2 Supporting-context entities *(bounded to what `AGG-MATCH` needs)*

#### ENT-ORGANIZATION  *(CTX-IDENTITY)*
- **Identifier:** `ENT-ORGANIZATION` / `OrganizationId`.
- **Purpose:** the tenant that owns teams, competitions and matches and governs access.
- **Attributes:** `organizationId`, `name`, `branding : VO-BRANDING`, `status : ACTIVE | SUSPENDED | DELETED`, `plan?`.
- **Relationships:** owns `ENT-MEMBERSHIP[]`; referenced by `AGG-TEAM`, `AGG-COMPETITION`, `AGG-MATCH`.
- **Validation:** unique `name` within the platform; ≥ 1 active owner-role membership.
- **Lifecycle:** `Created → Active ↔ Suspended → Deleted` (deletion anonymises downstream actor refs, retains finalised matches — `BR-025`).

#### ENT-MEMBERSHIP  *(CTX-IDENTITY)*
- **Identifier:** `ENT-MEMBERSHIP` / `(OrganizationId, UserId)`.
- **Purpose:** binds a user to an org with a set of roles; the source of authorisation checks at command time.
- **Attributes:** `userId`, `roles : Role[]` (`Platform Admin` is global, not here), `status : ACTIVE | DEACTIVATED`, `invitedAt?`, `acceptedAt?`.
- **Relationships:** part-of one `ENT-ORGANIZATION`; references one `UserId`.
- **Validation:** roles ⊆ the defined role set (foundation §4); a `DEACTIVATED` membership carries no effective roles (`BR-024`).
- **Lifecycle:** `Invited → Active ↔ Deactivated`.

#### ENT-PLAYER  *(CTX-PARTICIPANTS)*
- **Identifier:** `ENT-PLAYER` / `PlayerId` (external-stable).
- **Purpose:** one canonical person for cross-match stat aggregation and appearance claims.
- **Attributes:** `playerId`, `name : VO-PLAYER-NAME`, `attributes : VO-PLAYER-ATTRIBUTES`, `registryStatus : DRAFT | REGISTERED | MERGED | DEACTIVATED`, `mergedIntoPlayerId?`, `claims : VO-APPEARANCE-CLAIM[]`.
- **Relationships:** referenced (id only) by `AGG-TEAM` squads, `AGG-MATCH` nominated sides, all card lines, all dismissals.
- **Validation:** `name.display` non-empty; `MERGED` ⇒ `mergedIntoPlayerId` set and no new writes accepted; only org/platform admin may merge (`BR-044`).
- **Lifecycle:** `Draft(ad-hoc at ground) → Registered → (Merged→redirect) | Deactivated`.

#### ENT-TEAM  *(CTX-PARTICIPANTS)*
- **Identifier:** `ENT-TEAM` / `TeamId`.
- **Purpose:** a named side with identity and a squad pool.
- **Attributes:** `teamId`, `identity : VO-TEAM-IDENTITY` (name, short name, colours, logo, home ground), `organizationId?`, `status : ACTIVE | ARCHIVED`.
- **Relationships:** owns `ENT-SQUAD-MEMBER[]`; referenced by `AGG-COMPETITION` fixtures and `AGG-MATCH` sides.
- **Validation:** `identity.name` non-empty; unique within its org.
- **Lifecycle:** `Created → Active → Archived`.

#### ENT-SQUAD-MEMBER  *(CTX-PARTICIPANTS)*
- **Identifier:** `ENT-SQUAD-MEMBER` / `(TeamId, PlayerId)`.
- **Purpose:** a player available to a team, with an availability flag used by selection views.
- **Attributes:** `playerId`, `shirtNumber?`, `roleHint?`, `availability : AVAILABLE | UNAVAILABLE | INJURED` (`CTR-016`).
- **Relationships:** part-of one `ENT-TEAM`; references one `PlayerId`.
- **Validation:** a `PlayerId` appears at most once per squad.
- **Lifecycle:** `Added → Active ↔ (availability changes) → Removed`.

#### ENT-COMPETITION  *(CTX-COMPETITION)*
- **Identifier:** `ENT-COMPETITION` / `CompetitionId`.
- **Purpose:** a season grouping matches under one condition template with a points/NRR model and standings.
- **Attributes:** `competitionId`, `name`, `season`, `format : VO-FORMAT`, `conditionsProfileRef`, `pointsModel : VO-POINTS-MODEL`, `nrrRule : VO-NRR-RULE`, `bonusPointRule?`, `status : DRAFT | SCHEDULED | IN_PROGRESS | COMPLETED | ARCHIVED`.
- **Relationships:** owns `ENT-FIXTURE[]`, `ENT-DIVISION[]`, `ENT-DISPUTE[]`; references `TeamId`, `ConditionsProfileId`, `MatchId`, `UserId`.
- **Validation:** every fixture's teams belong to the competition; standings computed only from `FINAL` non-disputed matches (`BR-015`).
- **Lifecycle:** `Draft → Scheduled → InProgress → Completed → Archived`.

#### ENT-FIXTURE  *(CTX-COMPETITION)*
- **Identifier:** `ENT-FIXTURE` / `FixtureId`.
- **Purpose:** a scheduled match slot linking two teams, a date, assigned scorers, and (once played) a `MatchId`.
- **Attributes:** `fixtureId`, `homeTeamId`, `awayTeamId`, `scheduledAt`, `venue?`, `assignedScorerUserIds : UserId[]`, `matchId? : MatchId`, `xiDeadlineAt?`, `status : SCHEDULED | XI_LOCKED | IN_PROGRESS | RESULT_IN | DISPUTED | SETTLED`.
- **Relationships:** part-of one `ENT-COMPETITION`; 0..1 `AGG-MATCH`; references `TeamId ×2`, `UserId[]`.
- **Validation:** `homeTeamId ≠ awayTeamId`; `matchId` set once play starts; `status = DISPUTED` blocks standings ingestion (`BR-016`).
- **Lifecycle:** `Scheduled → XI_Locked → InProgress → ResultIn → (Disputed → Settled) | Settled`.

#### ENT-CONDITIONS-PROFILE  *(CTX-COMPETITION)*
- **Identifier:** `ENT-CONDITIONS-PROFILE` / `(ConditionsProfileId, version)`.
- **Purpose:** the versioned `[CFG]` value set (spec §35) adopted by matches/competitions and snapshotted into a match at first delivery.
- **Attributes:** `conditionsProfileId`, `version`, `name`, `values : VO-PLAYING-CONDITIONS-PROFILE`, `dlsReference : VO-DLS-REFERENCE`, `status : DRAFT | PUBLISHED | SUPERSEDED | RETIRED`.
- **Relationships:** referenced by `AGG-COMPETITION`, `AGG-MATCH-TEMPLATE`, `AGG-MATCH` (as a snapshot source).
- **Validation:** all `CFG-REG` keys present & in range; `rain_method`/format consistency (`DLS-002`); published versions immutable.
- **Lifecycle:** `Draft → Published(vN) → Superseded → Retired`; applies only to matches created after publication (`BR-045`).

#### ENT-MATCH-TEMPLATE  *(CTX-COMPETITION / device-local)*
- **Identifier:** `ENT-MATCH-TEMPLATE` / `MatchTemplateId`.
- **Purpose:** a reusable match setup for fast creation (`FR-028`, `SCR-001/023`).
- **Attributes:** `matchTemplateId`, `name`, `format`, `conditionsProfileRef`, `defaultOfficials?`, `venue?`, `ball?`, `scope : ORG | DEVICE_LOCAL`.
- **Relationships:** references `ConditionsProfileId`; used by `CMD-CREATE-MATCH`.
- **Validation:** `format` consistent with the referenced profile.
- **Lifecycle:** `Created → Active → Archived`.

#### ENT-DISPUTE  *(CTX-COMPETITION)*
- **Identifier:** `ENT-DISPUTE` / `DisputeId`.
- **Purpose:** a raised objection to a fixture's result, with an adjudication trail.
- **Attributes:** `disputeId`, `fixtureId`, `raisedByUserId`, `reason`, `status : OPEN | UNDER_REVIEW | ADJUDICATED`, `adjudication : {outcome, rationale, byUserId, at}?`.
- **Relationships:** part-of one `ENT-COMPETITION`; targets one `ENT-FIXTURE`.
- **Validation:** an `OPEN`/`UNDER_REVIEW` dispute locks the fixture from standings (`BR-016`); adjudication requires organizer/admin role.
- **Lifecycle:** `Open → UnderReview → Adjudicated`.

---

## 5. Value Objects

All value objects: **immutable**, **compared by value**, **have no identity**, and are **created as part of an entity and replaced wholesale, never mutated in place**. That shared lifecycle is stated once here; each entry lists Identifier · Purpose · Attributes · Relationships · Validation.

### 5.1 Match-setup value objects

| VO | Purpose | Attributes | Validation |
|---|---|---|---|
| **VO-FORMAT** (`VO-FORMAT`) | Names the shape of the match. | `formatType`, `inningsPerSide:1\|2`, `oversPerInnings:Overs\|UNLIMITED`, `ballsPerOver:6\|5\|10`, `days:int`, `playersPerSide:int` | consistent with `formatType` defaults (`FMT-002/004/005`); `playersPerSide ∈ 2..15`. |
| **VO-PLAYING-CONDITIONS-PROFILE** (`VO-PLAYING-CONDITIONS-PROFILE`) | The frozen `[CFG]` value set governing every rule decision in the match. | one field per `CFG-REG` key (spec §35): `no_ball_penalty_runs`, `wide_interpretation`, `free_hit_enabled`, `free_hit_trigger`, `bouncers_per_over`, `powerplay_model`, `drs_enabled`, `player_reviews_per_innings`, `timed_out_limit_seconds`, `declarations_permitted`, `follow_on_margin`, `minimum_overs_for_result`, `tie_breaker`, `super_over_batting_order`, `super_over_tie_resolution`, `rain_method`, `dls_g50`, `dls_resource_table`, `wickets_for_all_out`, `nb_wd_secondary_extras_itemised`, `no_ball_counts_as_ball_faced`, `mankad_enabled`, `runners_enabled`, `concussion_replacement_enabled`, `impact_player_enabled`, `over_rate_penalty_model`, `track_batting_minutes`, `bowling_figures_unit`, `last_man_stands`, `hat_trick_spans_innings`, `projection_rates`, … | every key present and within its allowed values (`CFG-REG`); `rain_method` consistent with `VO-FORMAT` (`DLS-002`); once attached to a match it is immutable (`BR-017`, `MBR-05`). |
| **VO-DLS-REFERENCE** (`VO-DLS-REFERENCE`) | Pins the DLS data used. | `method`, `edition`, `resourceTableVersion`, `g50` | present iff `rain_method ≠ NONE`. |
| **VO-TOSS** (`VO-TOSS`) | The coin toss result. | `wonBy:VO-TEAM-REF\|NOT_RECORDED`, `decision:BAT\|BOWL\|FIELD\|N/A` | if `NOT_RECORDED`, innings order set manually and flagged (`TEAM-009`). |
| **VO-MATCH-OFFICIALS** (`VO-MATCH-OFFICIALS`) | The officiating panel. | `onFieldUmpires:VO-UMPIRE-SLOT[2]`, `thirdUmpire?`, `fourthUmpire?`, `matchReferee?`, `scorers:VO-SCORER-ASSIGNMENT[1..n]` | ≥ 1 on-field umpire (2 for ICC profiles — `OFCL-001/011`); ≥ 1 scorer, with exactly one `HEAD` (`OFCL-003`). |
| **VO-UMPIRE-SLOT** (`VO-UMPIRE-SLOT`) | One umpire and (optionally) an end. | `personRef`, `endRef?`, `effectiveFrom?` | end assignment optional; a mid-match change is a new VO (`OFCL-010`). |
| **VO-SCORER-ASSIGNMENT** (`VO-SCORER-ASSIGNMENT`) | A scorer's role on the match. | `userId`, `role:HEAD\|ASSISTANT`, `deviceId?` | exactly one `HEAD`; dual-scorer needs ≥ 1 `ASSISTANT` (`FR-113`). |
| **VO-NOMINATED-SIDE** (`VO-NOMINATED-SIDE`) | A team's playing XI and roles for the match. | `teamRef:VO-TEAM-REF`, `players:PlayerId[]`, `captainId:PlayerId`, `keeperId:PlayerId`, `battingOrderHint?:PlayerId[]`, `submittedAt?`, `lockedAt?` | `|players| = players_per_side`; `captainId,keeperId ∈ players`; exactly one captain & keeper (`BR-009`, `TEAM-003`, `PLYR-002`); no overlap with the other side (`BR-010`). |
| **VO-TEAM-REF** (`VO-TEAM-REF`) | Points at a team, canonical or local. | `teamId?:TeamId`, `localTeam?:VO-LOCAL-TEAM`, `designation:HOME\|AWAY\|A\|B` | exactly one of `teamId` / `localTeam`. |
| **VO-LOCAL-TEAM** (`VO-LOCAL-TEAM`) | A free-text team for guest/ad-hoc matches. | `name`, `shortName?`, `colours?` | `name` non-empty; upgraded to `TeamId` only on claim (`MBR-02`, `TEAM-011`). |
| **VO-SCHEDULE** (`VO-SCHEDULE`) | When the match is played. | `matchDates:Date[]`, `scheduledStart:Instant`, `timeZone`, `days:int`, `minOversPerDay?` | `timeZone` valid; `|matchDates| ≤ days`; one time zone per match (`NFR-059`, `FMT-011`). |
| **VO-VENUE** (`VO-VENUE`) | Where the match is played. | `groundName`, `city?`, `country?` | `groundName` non-empty. |
| **VO-BALL-SPEC** (`VO-BALL-SPEC`) | The match ball. | `colour:RED\|PINK\|WHITE`, `brand?`, `newBallPolicy` | consistent with format (`FMT-007/008`). |
| **VO-BRANDING** (`VO-BRANDING`) | Org branding for scorecards/exports. | `name`, `logoRef?`, `primaryColour?`, `secondaryColour?` | used only for presentation (`FR-182`, `ADM-014`). |

### 5.2 Delivery-level value objects

| VO | Purpose | Attributes | Validation |
|---|---|---|---|
| **VO-DELIVERY-CONTEXT** (`VO-DELIVERY-CONTEXT`) | The situational facts true at the instant a ball was bowled. | `strikerId`, `nonStrikerId`, `bowlerId`, `keeperId`, `powerplayPhase:VO-POWERPLAY-PHASE`, `isFreeHit:bool`, `newBallInUse:bool`, `battingEnd:EndRef` | `strikerId ≠ nonStrikerId`; `bowlerId` in bowling side; all `PlayerId` valid & "in"/available. |
| **VO-RUNLINE** (`VO-RUNLINE`) | How runs on one delivery were made. | `batRuns:int≥0`, `ranByes:int≥0`, `ranLegByes:int≥0`, `shortRuns:int≥0`, `boundary:NONE\|FOUR\|SIX`, `overthrow:VO-OVERTHROW?`, `deliberateShort:bool` | `boundary = SIX` ⇒ `batRuns ≥ 6` off the bat and `ranByes = ranLegByes = 0` (`RUN-004`); `ranLegByes > 0` ⇒ shot/evasion attempted (`LB-001`); `deliberateShort` ⇒ 5-run penalty to fielding side applied via `PenaltyRuns` (`RUN-010`). |
| **VO-OVERTHROW** (`VO-OVERTHROW`) | Extra runs from a wild throw / wilful fielder act. | `runsCompletedBeforeThrow:int`, `crossedAtInstantOfThrow:bool`, `reachedBoundary:bool` | counted runs = completed + (in-progress iff crossed) + (4 iff boundary) (`RUN-007`). |
| **VO-EXTRAS-ON-DELIVERY** (`VO-EXTRAS-ON-DELIVERY`) | The `b/lb/w/nb/pen` decomposition for one delivery. | `byes:int`, `legByes:int`, `wides:int`, `noBalls:int`, `penalty:int` | derived from `legality` + `VO-RUNLINE` + `nb_wd_secondary_extras_itemised` (`EXT-005/009`); on `WIDE`, `byes = 0` (`WD-009`). |
| **VO-FIELDING-INVOLVEMENT** (`VO-FIELDING-INVOLVEMENT`) | Which fielders did what on a delivery/dismissal. | `entries:{playerRef, role:FIELDER\|THROWER\|WICKET_BREAKER\|CATCHER\|KEEPER, isSubstitute:bool}[]` | ordered; `CATCHER` present ⇔ dismissal mode is caught / c&b; substitute cannot be `CATCHER` off own bowling. |
| **VO-DISMISSAL** (`VO-DISMISSAL`) | The facts of one dismissal. | `mode:DismissalMode`, `outBatterId`, `bowlerId?`, `fielders:VO-FIELDING-INVOLVEMENT`, `offTheBat:bool`, `nonStrikerBeforeDelivery:bool`, `dismissalString:text` | mode/legality/free-hit matrix (`WKT-009`); credit rules (`WKT-003`); one `outBatterId` (`WKT-005`). |
| **VO-FALL-OF-WICKET** (`VO-FALL-OF-WICKET`) | The FoW snapshot at a dismissal. | `teamScore:Runs`, `wicketNumber:int`, `outBatterId`, `overBall:OverBall`, `partnershipRuns:Runs`, `partnershipBalls:int`, `notOutBatterScore:Runs` | `teamScore` non-decreasing across wicket numbers (`INV-006`). |
| **VO-COMMENTARY** (`VO-COMMENTARY`) | Text + tokens for one delivery. | `generatedSummary:text`, `freeText:text?`, `tokens:string`, `milestoneFlags:string[]` | `tokens` follow `commentary_token_style` (`CMTRY-004`); editable via amendment only (`CMTRY-009`). |
| **VO-POWERPLAY-PHASE** (`VO-POWERPLAY-PHASE`) | The fielding-restriction phase a delivery falls in. | `label:PP1\|PP2\|PP3\|POWERPLAY\|NON_PP`, `maxOutsideCircle:int` | derived from `powerplay_model` + over/ball, incl. mid-over phase change under reductions (`PP-006/010/011`). |
| **VO-DEAD-BALL** (`VO-DEAD-BALL`) | Marks a delivery the umpire called dead. | `isDeadBall:bool`, `reason:DeadBallReason?` | dead-ball delivery scores nothing and (unless itself wide/no-ball) does not count (`BALL-006`). |
| **VO-PROVENANCE** (`VO-PROVENANCE`) | Origin of a recorded fact. | `scorerUserId`, `deviceId`, `appVersion`, `capturedAt:Instant`, `logicalClock` | attached to every delivery/amendment (`FR-111`, `OFR-006`); `logicalClock` monotonic per device (`NFR-018`). |

### 5.3 Innings-level & result value objects

| VO | Purpose | Attributes | Validation |
|---|---|---|---|
| **VO-EXTRAS-BREAKDOWN** (`VO-EXTRAS-BREAKDOWN`) | The innings extras tally. | `byes`, `legByes`, `wides`, `noBalls`, `penalty`, `total` | `total = byes+legByes+wides+noBalls+penalty` (`EXT-007`, `INV-010`). |
| **VO-PARTNERSHIP-SEGMENT** (`VO-PARTNERSHIP-SEGMENT`) | One unbroken stand between a specific pair (a pair can have >1 segment). | `forWicket:int`, `batterAId`, `batterBId`, `runs:Runs`, `balls:int`, `batterAContribution:Runs`, `batterBContribution:Runs`, `fromOverBall`, `toOverBall?`, `unbroken:bool` | runs include all extras during the stand (`PART-002`); Σ segments' runs = innings total (`INV-007`); retirement splits a segment (`PART-004`). |
| **VO-POWERPLAY-PLAN** (`VO-POWERPLAY-PLAN`) | The set of phases for an innings and their boundaries. | `phases:{label, fromBall:int, toBall:int, maxOutsideCircle:int}[]`, `reductionTableRef?` | phases partition the innings' legal balls; recomputed on `EVT-OVERS-REVISED` (`PP-007`). |
| **VO-TARGET** (`VO-TARGET`) | What the side batting last must reach. | `runsToWin:Runs`, `source:STANDARD\|DLS\|MANUAL`, `dlsRevisionId?`, `revisedOvers?:Overs`, `parAtLastBall?:Runs` | `STANDARD` ⇒ `opponentTotal + 1` (`TGT-001`); `DLS` ⇒ latest active `ENT-DLS-REVISION.outputs.revisedTarget` (`TGT-003`); `MANUAL` ⇒ has an override reason (`DLS-010`). |
| **VO-RESULT** (`VO-RESULT`) | The match outcome. | `type:WIN\|TIE\|DRAW\|NO_RESULT\|ABANDONED\|AWARDED`, `winner:VO-TEAM-REF?`, `method:BY_RUNS\|BY_WICKETS\|BY_INNINGS\|DLS\|SUPER_OVER\|CONCEDED\|null`, `marginRuns?`, `marginWickets?`, `ballsRemaining?`, `tieBreakerWinner?:VO-TEAM-REF`, `statement:text`, `abandonedWithoutBall:bool` | `statement` re-derivable from the innings totals + DLS/Super-Over data (`RES-010`, `INV-014`); `type = TIE` may carry `tieBreakerWinner` (`SO-012`). |
| **VO-SIGN-OFF** (`VO-SIGN-OFF`) | The attestation making a match FINAL. | `signatures:VO-SIGNATURE[]`, `reconciliationOverrideReason?:text`, `finalisedAt:Instant`, `version:int` | ≥ 1 `HEAD` signature; counter-signatures per profile (`SCRD-020`); override reason required iff reconciliation not all-pass (`BR-007`). |
| **VO-SIGNATURE** (`VO-SIGNATURE`) | One person's attestation. | `byUserId`, `role:HEAD_SCORER\|ASSISTANT_SCORER\|UMPIRE`, `at:Instant` | role authorised for sign-off on this match. |
| **VO-RECONCILIATION-REPORT** (`VO-RECONCILIATION-REPORT`) | The pass/fail of every invariant at a checkpoint. | `checkedAt`, `atEventOrdinal`, `results:{invariantId, status:PASS\|FAIL, detail?}[]`, `allPass:bool` | enumerates `INV-001…018` + `MINV-*` (`INV-018`, `CORR-008`). |
| **VO-AMENDMENT-ENTRY** (`VO-AMENDMENT-ENTRY`) | One human-readable correction record. | `amendmentId`, `atEventOrdinal`, `type`, `reason:NonEmptyText`, `before`, `after`, `byUserId`, `role`, `postFinal:bool`, `recomputationScope` | `reason` mandatory (`CORR-003`); `postFinal = true` ⇒ elevated role + re-sign-off (`CORR-009`). |
| **VO-DIVERGENCE** (`VO-DIVERGENCE`) | A per-delivery disagreement between two scorer logs. | `overBall`, `fieldPath`, `valueHead`, `valueAssistant`, `status:OPEN\|PROPOSED\|CONFIRMED`, `proposedValue?`, `proposedBy?`, `confirmedBy?` | resolution requires both scorers' confirmation; never silent overwrite (`FR-118/119`, `CORR-010`). |

### 5.4 Scalar / small value objects

| VO | Purpose | Attributes / form | Validation |
|---|---|---|---|
| **VO-RUNS** (`Runs`) | A non-negative run count. | `value:int ≥ 0` | — |
| **VO-OVERS** (`Overs`) | A whole/decimal over count. | `completed:int ≥ 0`, `balls:int 0..blockLength-1` | `balls < blockLength` (`OVER-010`). |
| **VO-OVERBALL** (`OverBall`) | A position in an innings. | `inningsId`, `overNumber:int ≥ 1`, `ballInOver:int ≥ 1`, `legalityTag:LEGAL\|WIDE\|NO_BALL\|NSRO_DEAD` | illegal deliveries share the current legal index (`CMTRY-003`). |
| **VO-EVENT-ORDINAL** (`EventOrdinal`) | Total order of an event in a match. | `value:int` strictly increasing per match | monotonic (`INV-017`, `BALL-007`). |
| **VO-END-REF** (`EndRef`) | One end of the pitch. | `name:text` (e.g. "Pavilion End") or `A\|B` | stable within a match. |
| **VO-PLAYER-NAME** (`VO-PLAYER-NAME`) | A person's name for display and cards. | `full:text`, `display:text`, `initialsForm:text` | `display` non-empty; disambiguated on collision (`PLYR-013`). |
| **VO-PLAYER-ATTRIBUTES** (`VO-PLAYER-ATTRIBUTES`) | Cricketing attributes. | `battingHand:L\|R?`, `bowlingType?`, `roleHint:BATTER\|BOWLER\|ALLROUNDER\|WICKETKEEPER?` | all optional; informational. |
| **VO-APPEARANCE-CLAIM** (`VO-APPEARANCE-CLAIM`) | A player's claim to have played a match. | `matchId`, `status:REQUESTED\|APPROVED\|REJECTED`, `approvedByUserId?` | career stats count only `APPROVED` on `FINAL` matches (`BR-013/014`). |
| **VO-BOWLING-SPELL** (`VO-BOWLING-SPELL`) | A contiguous run of overs from one end. | `fromOver:int`, `toOver:int`, `overs:Overs`, `runs:Runs`, `wickets:int` | contiguous; from one end (`BOWL-006`). |
| **VO-DLS-INPUTS / VO-DLS-OUTPUTS / VO-PAR-LADDER** | See `ENT-DLS-REVISION` attributes. | as listed there | `resources ≤ 100%`; `revisedTarget ≥ 1`; par ladder monotonic within a phase (`INV-015`). |
| **VO-POINTS-MODEL / VO-NRR-RULE** (CTX-COMPETITION) | Competition scoring rules. | `winPoints`, `tiePoints`, `noResultPoints`, `bonusRule?` / `formula`, `allOutCountsFullQuota:bool` | NRR per `CSR-057`; points per `CSR-058/059`. |
| **VO-REPLACEMENT-REASON** (`VO-REPLACEMENT-REASON`) | Why a replacement occurred. | `text`, `category:CONCUSSION\|TACTICAL\|INJURY\|OTHER` | non-empty for concussion/impact. |
| **VO-REVIEW-OUTCOME** (`VO-REVIEW-OUTCOME`) | The result of a DRS review. | `result:UPHELD\|OVERTURNED\|UMPIRES_CALL`, `reviewRetained:bool`, `componentEvidence?` | `UMPIRES_CALL ⇒ reviewRetained` (`DRS-003`). |

### 5.5 Relationships (summary)

| From | To | Cardinality | Kind | Notes |
|---|---|---|---|---|
| `ENT-MATCH` | `ENT-INNINGS` | 1 → 1..4 | composition | ordered by `inningsOrder` |
| `ENT-MATCH` | `ENT-SUPER-OVER` | 1 → 0..n | composition | only when tied |
| `ENT-MATCH` | `ENT-INTERRUPTION` / `ENT-DLS-REVISION` / `ENT-REVIEW` / `ENT-PLAYER-REPLACEMENT` | 1 → 0..n | composition | |
| `ENT-INNINGS` | `ENT-OVER` | 1 → 0..n | composition | ordered |
| `ENT-OVER` | `ENT-DELIVERY` | 1 → 0..n | composition | ordered by `ordinal` |
| `ENT-DELIVERY` | `ENT-WICKET` | 1 → 0..1 | association (owned by innings) | one dismissal per delivery |
| `ENT-INNINGS` | `ENT-BATTER-CARD-LINE` / `ENT-BOWLER-CARD-LINE` | 1 → 0..n | composition (projection-backed) | one per player who batted/bowled |
| `ENT-DLS-REVISION` | `ENT-INNINGS.target` | 1 → 0..1 | reference | latest active revision governs |
| `ENT-MATCH` | `AGG-ORGANIZATION` / `AGG-COMPETITION` / `AGG-CONDITIONS-PROFILE` | n → 0..1 | reference by id | separate transaction boundary |
| `ENT-MATCH` | `AGG-TEAM` (`TeamId`) | n → 2 | reference by id (or `VO-LOCAL-TEAM`) | |
| `VO-NOMINATED-SIDE` | `AGG-PLAYER` (`PlayerId`) | 1 → `players_per_side` | reference by id | |
| `ENT-FIXTURE` | `AGG-MATCH` (`MatchId`) | 1 → 0..1 | reference by id | set when play starts |
| `AGG-COMPETITION` | `AGG-CONDITIONS-PROFILE` | 1 → 1 | reference by id (+version) | snapshotted into each match |

---

## 6. States & State Transitions

Notation: `STATE --[command / guard]--> STATE  (emits EVT-…)`. Guards reference spec IDs. Terminal states in **bold**.

### 6.1 SM-MATCH — `ENT-MATCH.state`

States: `SCHEDULED, CONFIGURED, TOSS_DONE, READY, IN_PROGRESS, INNINGS_BREAK, INTERRUPTION, STUMPS, SUPER_OVER, COMPLETE_PENDING_SIGNOFF, FINAL*, ABANDONED*, NO_RESULT*, AWARDED*, VOIDED*`.

| From | Trigger / guard | To | Emits |
|---|---|---|---|
| `SCHEDULED` | `CMD-CREATE-MATCH` completes | `SCHEDULED` | `EVT-MATCH-CREATED` |
| `SCHEDULED` | `CMD-CONFIGURE-MATCH` (sides, format, conditions ref, officials, venue) | `CONFIGURED` | `EVT-MATCH-CONFIGURED` |
| `CONFIGURED` | `CMD-RECORD-TOSS` | `TOSS_DONE` | `EVT-TOSS-RECORDED` |
| `TOSS_DONE` | `CMD-CONFIRM-READY` / setup validation passes (`FR-027`) | `READY` | `EVT-MATCH-READY` |
| `READY` | `CMD-OPEN-INNINGS` (first innings) | `IN_PROGRESS` | `EVT-INNINGS-STARTED` |
| `IN_PROGRESS` | `CMD-RECORD-DELIVERY` (first) / conditions freeze (`MBR-05`) | `IN_PROGRESS` | `EVT-DELIVERY-RECORDED`, `EVT-PLAYING-CONDITIONS-FROZEN` |
| `IN_PROGRESS` | `CMD-END-INNINGS` (all-out / overs / target / declaration / forfeiture / time / no-further-play — `INN-003`) & more innings remain | `INNINGS_BREAK` | `EVT-INNINGS-ENDED` |
| `INNINGS_BREAK` | `CMD-OPEN-INNINGS` (next) | `IN_PROGRESS` | `EVT-INNINGS-STARTED` |
| `IN_PROGRESS` / `INNINGS_BREAK` | `CMD-RECORD-INTERRUPTION` | `INTERRUPTION` | `EVT-INTERRUPTION-RECORDED` |
| `INTERRUPTION` | `CMD-RESUME-PLAY` (+ optional overs/DLS revision) | previous phase | `EVT-PLAY-RESUMED`, `EVT-OVERS-REVISED?`, `EVT-DLS-REVISION-APPLIED?` |
| `IN_PROGRESS` | `CMD-CALL-STUMPS` (multi-day) | `STUMPS` | `EVT-STUMPS-CALLED` |
| `STUMPS` | `CMD-RESUME-PLAY` (next day) | `IN_PROGRESS` | `EVT-PLAY-RESUMED` |
| `IN_PROGRESS` | `CMD-END-INNINGS` & this was the last innings & scores level & `tie_breaker = SUPER_OVER` (`RES-004/005`) | `SUPER_OVER` | `EVT-INNINGS-ENDED`, `EVT-MATCH-TIED` |
| `SUPER_OVER` | `CMD-RESOLVE-SUPER-OVER` & still tied & `REPEAT` (`SO-013`) | `SUPER_OVER` | `EVT-SUPER-OVER-RESOLVED` |
| `SUPER_OVER` | `CMD-RESOLVE-SUPER-OVER` & decided | `COMPLETE_PENDING_SIGNOFF` | `EVT-SUPER-OVER-RESOLVED`, `EVT-RESULT-DETERMINED` |
| `IN_PROGRESS` | `CMD-END-INNINGS` & last innings & result derivable (`RES-001/002/003/008`) | `COMPLETE_PENDING_SIGNOFF` | `EVT-INNINGS-ENDED`, `EVT-RESULT-DETERMINED` |
| `IN_PROGRESS` / `INTERRUPTION` | `CMD-ABANDON-MATCH` & minimum overs met (`RES-008`, `TGT-010`) | `COMPLETE_PENDING_SIGNOFF` | `EVT-RESULT-DETERMINED` (DLS/par) |
| `IN_PROGRESS` / `INTERRUPTION` | `CMD-ABANDON-MATCH` & minimum overs NOT met (`RES-006`) | **`NO_RESULT`** | `EVT-MATCH-NO-RESULT` |
| `READY` / `IN_PROGRESS` | `CMD-ABANDON-MATCH` & no play possible | **`ABANDONED`** | `EVT-MATCH-ABANDONED` |
| any pre-final | `CMD-AWARD-MATCH` (umpires/referee) (`RES-009`) | **`AWARDED`** | `EVT-MATCH-AWARDED` |
| `COMPLETE_PENDING_SIGNOFF` | `CMD-SIGN-OFF-MATCH` & `reconciliation.allPass` or override reason (`BR-007`) | **`FINAL`** | `EVT-MATCH-FINALISED` |
| `COMPLETE_PENDING_SIGNOFF` | `CMD-REOPEN-MATCH` (a correction shows completion premature — `STATE-006`, `CORR-006`) | `IN_PROGRESS` | `EVT-MATCH-REOPENED` |
| **`FINAL`** | `CMD-AMEND-*` (elevated) that changes the result (`CORR-009/015/016`) | `COMPLETE_PENDING_SIGNOFF` | `EVT-FINAL-REVOKED`, then re-sign-off |
| `SCHEDULED..READY` | `CMD-VOID-MATCH` (created in error) | **`VOIDED`** | `EVT-MATCH-VOIDED` |

### 6.2 SM-INNINGS — `ENT-INNINGS.state`

States: `NOT_STARTED, IN_PROGRESS, SUSPENDED, ENDED*` (`ENDED` carries `endReason`).

| From | Trigger / guard | To | Emits |
|---|---|---|---|
| — | created with match shell | `NOT_STARTED` | — |
| `NOT_STARTED` | `CMD-OPEN-INNINGS` (opening pair + bowler set) | `IN_PROGRESS` | `EVT-INNINGS-STARTED` |
| `IN_PROGRESS` | `CMD-RECORD-INTERRUPTION` / interval | `SUSPENDED` | `EVT-INTERRUPTION-RECORDED` |
| `SUSPENDED` | `CMD-RESUME-PLAY` | `IN_PROGRESS` | `EVT-PLAY-RESUMED` |
| `IN_PROGRESS` | `wicketsLost = effectiveAllOutThreshold` (`INN-004`) | `ENDED(ALL_OUT)` | `EVT-INNINGS-ENDED` |
| `IN_PROGRESS` | `legalBallsBowled = allottedOvers×blockLength` (`INN-003`) | `ENDED(OVERS_COMPLETE)` | `EVT-INNINGS-ENDED` |
| `IN_PROGRESS` | side batting last, `score ≥ target.runsToWin` (`TGT-006`) | `ENDED(TARGET_REACHED)` | `EVT-INNINGS-ENDED`, `EVT-RESULT-DETERMINED` |
| `IN_PROGRESS` | `CMD-DECLARE-INNINGS` & `declarations_permitted` (`DECL-002`) | `ENDED(DECLARED)` | `EVT-INNINGS-DECLARED` |
| `NOT_STARTED` / `IN_PROGRESS` | `CMD-FORFEIT-INNINGS` (`DECL-003`) | `ENDED(FORFEITED)` | `EVT-INNINGS-FORFEITED` |
| `IN_PROGRESS` / `SUSPENDED` | `CMD-END-INNINGS(TIME)` (multi-day) | `ENDED(TIME_EXPIRED)` | `EVT-INNINGS-ENDED` |
| `SUSPENDED` | `CMD-ABANDON-MATCH` | `ENDED(NO_FURTHER_PLAY)` | `EVT-INNINGS-ENDED` |
| `IN_PROGRESS` / `SUSPENDED` | `CMD-CONCEDE-INNINGS` (`RES-016`) | `ENDED(INNINGS_CONCEDED)` | `EVT-INNINGS-ENDED` |
| `ENDED(*)` | `CMD-REOPEN-INNINGS` (cascading amendment — `CORR-006`, `RUN-018`) | `IN_PROGRESS` | `EVT-INNINGS-REOPENED` |

### 6.3 SM-DELIVERY — `ENT-DELIVERY.status`

States: `ACTIVE, SUPERSEDED*, VOID*`.

| From | Trigger / guard | To | Emits |
|---|---|---|---|
| — | `CMD-RECORD-DELIVERY` | `ACTIVE` | `EVT-DELIVERY-RECORDED` (+ `EVT-WICKET-RECORDED?`, `EVT-BOUNDARY-SCORED?`, `EVT-EXTRA-SCORED?`) |
| `ACTIVE` | `CMD-AMEND-DELIVERY` | `SUPERSEDED` (new `ACTIVE` created) | `EVT-DELIVERY-CORRECTED` |
| `ACTIVE` | `CMD-VOID-DELIVERY` (entered in error) | `VOID` | `EVT-DELIVERY-VOIDED` |
| `ACTIVE` | `CMD-APPLY-REVIEW-OUTCOME` (no-ball found / decision changed) | `SUPERSEDED` (corrected copy) | `EVT-DELIVERY-CORRECTED`, `EVT-REVIEW-OUTCOME-APPLIED` |

A `SUPERSEDED`/`VOID` delivery contributes to no projection but is retained forever (`CORR-001`).

### 6.4 SM-DLS-REVISION — `ENT-DLS-REVISION.status`

`ACTIVE → REVERSED*`. `CMD-APPLY-DLS-REVISION` creates `ACTIVE`; `CMD-REVERSE-DLS-REVISION` / `CMD-AMEND-DLS-REVISION` → `REVERSED` and a fresh `ACTIVE` revision; if the match result depended on the reversed revision, `SM-MATCH` transitions `FINAL → COMPLETE_PENDING_SIGNOFF` (`CORR-015`).

### 6.5 SM-BATTER-CARD-LINE — `ENT-BATTER-CARD-LINE.status`

States: `YET_TO_BAT, AT_CREASE, OUT*, NOT_OUT*, RETIRED_NOT_OUT, RETIRED_OUT*, ABSENT*, DID_NOT_BAT*`.

| From | Trigger / guard | To |
|---|---|---|
| `YET_TO_BAT` | comes to the crease | `AT_CREASE` |
| `AT_CREASE` | `EVT-WICKET-RECORDED` for this batter (out modes) | `OUT` |
| `AT_CREASE` | `CMD-RECORD-RETIREMENT` (unavoidable cause) | `RETIRED_NOT_OUT` |
| `RETIRED_NOT_OUT` | `CMD-RESUME-BATTER` at a fall of wicket (`RTHO-001`) | `AT_CREASE` |
| `RETIRED_NOT_OUT` | innings ends, never resumed | `NOT_OUT` (shown "retired not out") |
| `AT_CREASE` | `CMD-RECORD-RETIREMENT` (other cause, no consent) (`RTOU-001`) | `RETIRED_OUT` (counts as wicket) |
| `RETIRED_OUT` | opposing captain later consents (`RTOU-005`) | `AT_CREASE` (wicket reversed) |
| `AT_CREASE` | innings ends with batter in | `NOT_OUT` |
| `YET_TO_BAT` | innings ends, never batted, declared absent | `ABSENT` |
| `YET_TO_BAT` | innings ends, never batted, not absent | `DID_NOT_BAT` |

### 6.6 SM-INTERRUPTION — `ACTIVE → RESOLVED* | ABANDONED_FROM_HERE*` (see `ENT-INTERRUPTION` lifecycle).

### 6.7 SM-REVIEW — `REQUESTED → {UPHELD* | OVERTURNED* | UMPIRES_CALL*}` via `CMD-APPLY-REVIEW-OUTCOME` (see `ENT-REVIEW`).

### 6.8 SM-FIXTURE / SM-DISPUTE / SM-COMPETITION / SM-ORGANIZATION / SM-PLAYER / SM-CONDITIONS-PROFILE — as listed in each entity's Lifecycle field (§4.2).

---

## 7. Invariants

`INV-001…018` (spec §34) are **inherited verbatim** and enforced by `AGG-MATCH` after every command. The model adds:

| ID | Invariant | Scope | Enforces |
|---|---|---|---|
| **MINV-01** | The match timeline is append-only; no event is mutated or deleted; every correction is a new event linked by `supersedes`. | `AGG-MATCH` | `CORR-001` |
| **MINV-02** | Every read structure (scorecard, cards, partnerships, FoW, run rate, DLS ladder, commentary) is a pure function of the `ACTIVE` (non-superseded, non-void) event stream. No projection holds truth the stream lacks. | `AGG-MATCH` | `CORR-004`, `SCRD-019` |
| **MINV-03** | `EventOrdinal` is strictly increasing and dense-orderable; an inserted delivery takes an ordinal strictly between its neighbours. | `AGG-MATCH` | `BALL-007`, `CORR-013` |
| **MINV-04** | For every `ENT-DELIVERY(n>first)`, `context.strikerId` equals the value produced by `SVC-STRIKE-RESOLVER` from delivery `n-1`'s active outcome + end-of-over rule + any logged `EVT-STRIKER-OVERRIDDEN`. Unexplained discontinuity ⇒ reconciliation FAIL. | `AGG-MATCH` | `STRK-010/011`, `INV-011` |
| **MINV-05** | `conditionsProfile` is null before the first delivery and immutable after; any later `[CFG]` change is an explicit `EVT-PLAYING-CONDITIONS-AMENDED` with reason, never an in-place edit. | `AGG-MATCH` | `BR-017`, `BR-045`, `FMT-014` |
| **MINV-06** | At most one `ENT-WICKET` per `ENT-DELIVERY`; a delivery-less wicket exists only for `TIMED_OUT` / `RETIRED_OUT`. | `AGG-MATCH` | `WKT-005`, `TIMO-004`, `RTOU-004` |
| **MINV-07** | `creditsBowler` is a pure function of `dismissal.mode`; no run-out/obstructing/hit-twice/timed-out/retired-out wicket appears in any `ENT-BOWLER-CARD-LINE.wickets`. | `ENT-INNINGS` | `WKT-003`, `BOWL-011`, `INV-004` |
| **MINV-08** | A `NO_BALL`/`WIDE` delivery, and any dismissal delivery, never increments an over's `legalBallCount`; an over completes only at `legalBallCount = blockLength` (or innings end). | `ENT-OVER` | `OVER-001/014`, `WKT-011`, `INV-012` |
| **MINV-09** | `freeHitPending` transitions: set true by a free-hit-triggering `NO_BALL` (profile permitting); consumed (set false) by the next `LEGAL` delivery; retained across an intervening `NO_BALL`/`WIDE`. | `ENT-INNINGS` | `FH-003/004/011` |
| **MINV-10** | `effectiveAllOutThreshold = wickets_for_all_out − |battersUnavailable|`; `wicketsLost` never exceeds it; an innings may end `ALL_OUT` at fewer than `wickets_for_all_out` dismissals. | `ENT-INNINGS` | `INN-004`, `RTHO-003`, `PLYR-010`, `INV-005` |
| **MINV-11** | The chasing innings' `target` always equals: the latest `ACTIVE` `ENT-DLS-REVISION` output if any; else a `MANUAL` override; else `opponentTotal + 1`. Exactly one source is authoritative at a time. | `AGG-MATCH` | `TGT-001/003`, `DLS-010`, `CSR-051` |
| **MINV-12** | Super-Over deliveries/wickets never contribute to any `ENT-BATTER-CARD-LINE`/`ENT-BOWLER-CARD-LINE` of a main innings, nor to any career aggregate. | `AGG-MATCH`, `CTX-PROFILES` | `SO-009`, `BR-043` |
| **MINV-13** | `VO-RESULT.statement` is re-derivable from the two (or four) innings totals plus DLS/Super-Over data; a stored statement that does not re-derive ⇒ reconciliation FAIL. | `AGG-MATCH` | `RES-010`, `INV-014` |
| **MINV-14** | In dual-scorer mode, a `VO-DIVERGENCE` reaches `CONFIRMED` only with both `proposedBy` and `confirmedBy` set to the two distinct scorers; sign-off is blocked while any `OPEN`/`PROPOSED` divergence remains (unless overridden with reason + dual attestation). | `AGG-MATCH` | `FR-118/119/120`, `CORR-010`, `BR-008` |
| **MINV-15** | A guest match (`organizationId = null`) emits no `EVT-MATCH-SHARED` / `EVT-MATCH-PUBLISHED` and is not referenced by any `ENT-FIXTURE` until `EVT-GUEST-MATCH-CLAIMED`. | `AGG-MATCH` | `BR-022`, `MBR-02` |

**Cross-aggregate invariants** (eventually consistent, checked by the owning context, not inside `AGG-MATCH`):

| ID | Invariant | Owner |
|---|---|---|
| **MINV-16** | `AGG-COMPETITION` standings/NRR reflect exactly the set of `FINAL`, non-`DISPUTED` fixtures. | CTX-COMPETITION (`BR-015/016`) |
| **MINV-17** | A career aggregate in `CTX-PROFILES` counts a player's match only if there is an `APPROVED` `VO-APPEARANCE-CLAIM` (or an authoritative lineup link) for a `FINAL` match, and excludes Super Overs. | CTX-PROFILES (`BR-013/014`, `SO-009`) |
| **MINV-18** | A `MERGED` `ENT-PLAYER` has zero direct references remaining after merge; all historical appearances point at the survivor. | CTX-PARTICIPANTS (`BR-044`) |

---

## 8. Business Rules

Spec rules `BR-001…045` and `CSR-001…060` are **inherited** and are enforced at the points named below. The model adds `MBR-*` for rules that are about the *model's* structure rather than cricket itself.

### 8.1 Where inherited rules are enforced

| Rule area | Enforced by |
|---|---|
| Over / strike / bowler rules (`CSR-001…008`, `BR-027/028`, `OVER-003`) | `SVC-STRIKE-RESOLVER`, `CMD-RECORD-DELIVERY` preconditions, `MINV-04/08`, `SM-INNINGS` |
| Extras & boundaries (`CSR-009…018`, `EXT-*`, `NB-*`, `WD-*`, `BYE-*`, `LB-*`, `PEN-*`) | `VO-RUNLINE` + `VO-EXTRAS-ON-DELIVERY` validation, `CMD-RECORD-DELIVERY` |
| Dismissals & credit (`CSR-019…030`, `WKT-*`, all `BWLD/CAUT/LBW/…` areas) | `VO-DISMISSAL` validation, `MINV-06/07`, `CMD-RECORD-DELIVERY` / `CMD-RECORD-RETIREMENT` / `CMD-APPEAL-TIMED-OUT` |
| FoW / partnerships / milestones (`CSR-031…036`, `PART-*`, `BAT-008`, `BOWL-007/010`) | projections + `VO-FALL-OF-WICKET` / `VO-PARTNERSHIP-SEGMENT` validation |
| Match maths & results (`CSR-037…046`, `RES-*`, `TGT-*`) | `SVC-RESULT-DERIVER`, `VO-RESULT`, `MINV-11/13` |
| Rain / DLS (`CSR-047…051`, `DLS-*`) | `ENT-DLS-REVISION`, `SVC-DLS-CALCULATOR`, `MINV-11` |
| Super Over / tie-break (`CSR-052…056`, `SO-*`) | `ENT-SUPER-OVER`, `SM-MATCH` SUPER_OVER branch, `MINV-12` |
| Corrections & audit (`CORR-*`, `BR-004/006`) | append-only timeline, `CMD-AMEND-*`, `SVC-CASCADE-RECOMPUTER`, `VO-AMENDMENT-ENTRY`, `MINV-01/02` |
| Access / tenancy (`BR-001/003/022/024/025/044`) | `AGG-ORGANIZATION` authz check at command handler; `MINV-15` |
| Conditions freeze / reference data (`BR-017/045`) | `MINV-05`, `ENT-CONDITIONS-PROFILE` versioning |

### 8.2 Model-level business rules

- **MBR-01 — Timeline is the record.** The match *is* its ordered event stream. Any statement about the match ("the score is 142/3") is shorthand for "the projection over the active event stream yields 142/3". No side channel may assert match facts.
- **MBR-02 — Guest identity continuity.** A guest match created offline keeps its `MatchId`, timeline and provenance after `CMD-CLAIM-GUEST-MATCH`; claiming only *adds* an `organizationId`/owner and may resolve `VO-LOCAL-TEAM` → `TeamId` and `Draft` players → `Registered`. It never rewrites history (`FR-004`, `BR-022`).
- **MBR-03 — One writer of truth per aggregate per logical time.** Commands against one `AGG-MATCH` are serialised; concurrent commands from two devices are ordered by the sync layer and any true conflict surfaces as a `VO-DIVERGENCE` (dual-scorer) or a command rejection — never a silent merge (`NFR-016/017`, `CORR-018`).
- **MBR-04 — Amendments carry intent.** Every `CMD-AMEND-*` requires a non-empty `reason` and records `before`/`after`; a post-`FINAL` amendment additionally requires an elevated role and produces a new `VO-SIGN-OFF.version` (`CORR-003/009`).
- **MBR-05 — Conditions freeze at first ball.** `EVT-PLAYING-CONDITIONS-FROZEN` is emitted with (and only with) the first `EVT-DELIVERY-RECORDED`; from then, `VO-PLAYING-CONDITIONS-PROFILE` is immutable and changes only via `EVT-PLAYING-CONDITIONS-AMENDED` (reasoned).
- **MBR-06 — Aggregates isolate.** No entity inside `AGG-MATCH` references an entity inside another aggregate by object; only by id. Downstream contexts learn of match facts only through published events (§9).
- **MBR-07 — Projections are disposable.** Any read model may be dropped and rebuilt from the timeline at any time with identical results (determinism — `NFR-054`); this is the basis of `QRY-SCORECARD-AT` and of offline/online convergence.
- **MBR-08 — Reconciliation gates finality.** `CMD-SIGN-OFF-MATCH` is rejected unless the latest `VO-RECONCILIATION-REPORT` is `allPass` or the caller supplies a `reconciliationOverrideReason` (`BR-007`).
- **MBR-09 — Strike is derived, not stored as truth.** `Innings.batStrikerId` is a cache of `SVC-STRIKE-RESOLVER`'s output; the authoritative striker for delivery *n* is always recomputable, and scorer overrides are themselves events (`EVT-STRIKER-OVERRIDDEN`).
- **MBR-10 — Super Over is a sub-contest, not a third innings.** It has its own `ENT-SUPER-OVER` container, its own constrained innings, and is invisible to every main-match and career projection (`MINV-12`).
- **MBR-11 — Result is a function, recorded for convenience.** `VO-RESULT` is written when completion is reached but must always re-derive from `SVC-RESULT-DERIVER`; a mismatch is a reconciliation failure, not an accepted state (`MINV-13`).
- **MBR-12 — Reference data is versioned and pinned.** A match uses the `AGG-CONDITIONS-PROFILE` version and DLS table version in force at creation; later publishes of those aggregates do not affect it (`BR-045`, `MINV-05`).

---

## 9. Domain Events

Past tense; immutable; each is a fact appended to the `AGG-MATCH` timeline (or the relevant aggregate's stream) and is the Published Language for downstream contexts. Every event carries: `eventId`, `matchId` (or aggregate id), `ordinal : EventOrdinal`, `occurredAt : Instant`, `provenance : VO-PROVENANCE`, plus the payload below. Correction events additionally carry `supersedes` and `reason`.

### 9.1 CTX-SCORING — match lifecycle events

| Event | Meaning | Key payload | Emitted by | Trace |
|---|---|---|---|---|
| **EVT-MATCH-CREATED** | A match record now exists. | `format`, `originDeviceId`, `organizationId?`, `templateId?` | `CMD-CREATE-MATCH` | `STATE-001` |
| **EVT-MATCH-CONFIGURED** | Sides / officials / venue / conditions ref set or changed pre-toss. | `sides`, `officials`, `venue`, `ball`, `conditionsProfileRef` | `CMD-CONFIGURE-MATCH` | `FMT-*`, `TEAM-*`, `OFCL-*` |
| **EVT-TOSS-RECORDED** | The toss outcome is recorded; innings order derived. | `wonBy`, `decision`, `derivedInningsOrder` | `CMD-RECORD-TOSS` | `TEAM-006/007`, `BR-026` |
| **EVT-MATCH-READY** | Setup validation passed; scoring may begin. | `validationSummary` | `CMD-CONFIRM-READY` | `FR-027`, `STATE-001` |
| **EVT-PLAYING-CONDITIONS-FROZEN** | The `[CFG]` snapshot is now immutable (emitted with first delivery). | `profileSnapshot`, `atOrdinal` | `CMD-RECORD-DELIVERY` (first) | `MBR-05`, `BR-017` |
| **EVT-PLAYING-CONDITIONS-AMENDED** | A frozen condition value was deliberately changed. | `key`, `before`, `after`, `reason` | `CMD-AMEND-PLAYING-CONDITIONS` | `FMT-014`, `MINV-05` |
| **EVT-INNINGS-STARTED** | An innings opened with a pair and a bowler. | `inningsId`, `battingSide`, `openingStrikerId`, `openingNonStrikerId`, `openingBowlerId`, `allottedOvers` | `CMD-OPEN-INNINGS` | `INN-*`, `SM-INNINGS` |
| **EVT-INNINGS-ENDED** | An innings ended for a stated reason. | `inningsId`, `endReason`, `finalScore`, `wickets`, `oversBowled` | `CMD-END-INNINGS` (auto or explicit) | `INN-003`, `SM-INNINGS` |
| **EVT-INNINGS-DECLARED** / **EVT-INNINGS-FORFEITED** | Captain closed / gave up an innings. | `inningsId`, `scoreAt`, `wicketsAt`, `oversAt`, `byCaptainId` | `CMD-DECLARE-INNINGS` / `CMD-FORFEIT-INNINGS` | `DECL-002/003` |
| **EVT-INNINGS-REOPENED** | A cascading amendment re-opened a closed innings. | `inningsId`, `reason`, `triggeringAmendmentId` | `CMD-REOPEN-INNINGS` | `CORR-006`, `RUN-018` |
| **EVT-STUMPS-CALLED** / **EVT-PLAY-RESUMED** | Multi-day day close / resumption; or resumption after interruption. | `atOverBall`, `notOutBatters`, `newBallDue?` / `resumedAt`, `revisedOvers?` | `CMD-CALL-STUMPS` / `CMD-RESUME-PLAY` | `CSR-060`, `STATE-004` |
| **EVT-FOLLOW-ON-DECISION-RECORDED** | The follow-on was enforced or declined. | `available:bool`, `decision:ENFORCED\|DECLINED`, `leadAtDecision`, `marginApplied` | `CMD-RECORD-FOLLOW-ON-DECISION` | `FLW-001…005` |
| **EVT-RESULT-DETERMINED** | The match outcome is now known (pre-sign-off). | `result : VO-RESULT` | `CMD-END-INNINGS` / `CMD-ABANDON-MATCH` / `CMD-RESOLVE-SUPER-OVER` | `RES-*`, `TGT-*` |
| **EVT-MATCH-TIED** | Scores level at completion; tie-breaker path entered. | `finalScores`, `tieBreaker` | `CMD-END-INNINGS` | `RES-004`, `SO-001` |
| **EVT-MATCH-NO-RESULT** / **EVT-MATCH-ABANDONED** / **EVT-MATCH-AWARDED** | Terminal non-win outcomes. | `reason`, `abandonedWithoutBall?`, `awardedTo?` | `CMD-ABANDON-MATCH` / `CMD-AWARD-MATCH` | `RES-006/007/009` |
| **EVT-MATCH-FINALISED** | Head Scorer signed off; the record is FINAL. | `signOff : VO-SIGN-OFF`, `scorecardVersion` | `CMD-SIGN-OFF-MATCH` | `SCRD-020`, `CORR-009` |
| **EVT-FINAL-REVOKED** / **EVT-MATCH-REOPENED** | A finalised/complete match was re-opened for correction. | `reason`, `triggeringAmendmentId` | `CMD-AMEND-*` / `CMD-REOPEN-MATCH` | `STATE-006`, `CORR-015/016` |
| **EVT-MATCH-VOIDED** | A match created in error was voided (retained). | `reason` | `CMD-VOID-MATCH` | `STATE-001` |
| **EVT-GUEST-MATCH-CLAIMED** | A local guest match was attached to an account/org. | `organizationId?`, `ownerUserId`, `teamResolutions`, `playerResolutions` | `CMD-CLAIM-GUEST-MATCH` | `FR-004`, `MBR-02` |
| **EVT-MATCH-SHARED** / **EVT-MATCH-PUBLISHED** | A read-only link / live projection was made available. | `linkToken`, `scope` | `CMD-SHARE-MATCH` / `CMD-PUBLISH-MATCH` | `FR-161/162`, `BR-023` |

### 9.2 CTX-SCORING — ball & wicket events

| Event | Meaning | Key payload | Trace |
|---|---|---|---|
| **EVT-DELIVERY-RECORDED** | One ball was bowled and its outcome captured. | `deliveryId`, `context`, `legality`, `runLine`, `extrasOnDelivery`, `fielding`, `isFreeHit`, `wicketId?` | `BALL-001`, `CSR-001…018` |
| **EVT-BOUNDARY-SCORED** | A 4 or 6 was scored (sub-fact for feeds/analytics). | `deliveryId`, `boundary:FOUR\|SIX`, `offTheBat:bool` | `RUN-004`, `CMTRY-007` |
| **EVT-EXTRA-SCORED** | A wide / no-ball / bye / leg-bye / penalty was recorded (sub-fact). | `deliveryId?`, `kind`, `amount` | `EXT-*` |
| **EVT-PENALTY-RUNS-AWARDED** | 5 penalty runs awarded to a side. | `receivingSide`, `amount`, `reasonCode`, `atOverBall?`, `byUmpire` | `PEN-001…011` |
| **EVT-FREE-HIT-SET** / **EVT-FREE-HIT-CONSUMED** | Free-hit state changed. | `triggeringDeliveryId` / `consumedByDeliveryId` | `FH-003/004` |
| **EVT-OVER-COMPLETED** | An over reached its legal-ball count. | `inningsId`, `overNumber`, `runsInOver`, `wicketsInOver`, `isMaiden` | `OVER-001/008` |
| **EVT-NEW-BALL-TAKEN** | The fielding side took a new ball. | `inningsId`, `atOverBall` | `FMT-007`, `FR-068` |
| **EVT-WICKET-RECORDED** | A dismissal occurred. | `wicketId`, `deliveryId?`, `dismissal`, `fallOfWicket`, `incomingBatterId?`, `incomingBatterEnd?` | `WKT-*`, all dismissal areas |
| **EVT-WICKET-REVERSED** | A recorded wicket was overturned (review/amendment/consent-to-return). | `wicketId`, `cause:REVIEW\|AMENDMENT\|CAPTAIN_CONSENT`, `reason` | `WKT-015`, `DRS-006`, `RTOU-005` |
| **EVT-RETIREMENT-RECORDED** | A batter retired (hurt/ill or otherwise). | `batterId`, `type:NOT_OUT\|OUT`, `atOverBall`, `reason` | `RTHO-001`, `RTOU-001` |
| **EVT-BATTER-RESUMED** | A retired-not-out (or consented retired-out) batter returned. | `batterId`, `atFallOfWicketNumber` | `RTHO-001`, `RTOU-005` |
| **EVT-STRIKER-OVERRIDDEN** | The scorer manually set the striker for the next delivery. | `newStrikerId`, `reason` | `STRK-011`, `MBR-09` |
| **EVT-PLAYER-REPLACED** | A concussion / impact / substitute / runner replacement took effect. | `kind`, `side`, `replacedPlayerId?`, `replacementPlayerId`, `effectiveFrom`, `constraints` | `PLYR-003…009` |
| **EVT-KEEPER-CHANGED** | The wicket-keeper changed. | `inningsId`, `newKeeperId`, `atOverBall` | `PLYR-002`, `FR-067` |
| **EVT-POWERPLAY-PHASE-CHANGED** | A fielding-restriction phase boundary was crossed. | `inningsId`, `fromLabel`, `toLabel`, `atOverBall` | `PP-006/010` |

### 9.3 CTX-SCORING — interruption, DLS, review, correction, dual-scorer events

| Event | Meaning | Key payload | Trace |
|---|---|---|---|
| **EVT-INTERRUPTION-RECORDED** | Play stopped. | `interruptionId`, `cause`, `startedAt`, `startOverBall`, `scoreAtStart`, `wicketsAtStart` | `FR-078`, `CSR-047` |
| **EVT-OVERS-REVISED** | An innings' allotted overs changed. | `inningsId`, `before:Overs`, `after:Overs`, `reason` | `INN-012`, `PP-007` |
| **EVT-DLS-REVISION-APPLIED** | A DLS recalculation produced a revised target/par. | `dlsRevisionId`, `revisionNo`, `inputs`, `outputs`, `parLadder`, `triggeredByInterruptionId?` | `DLS-004…009` |
| **EVT-DLS-REVISION-REVERSED** | A DLS revision was reversed (then re-applied). | `dlsRevisionId`, `reason` | `CORR-015`, `DLS-009` |
| **EVT-DLS-TARGET-OVERRIDDEN** | A manual target/par override was set. | `dlsRevisionId`, `manualTarget`, `reason`, `byUserId` | `DLS-010`, `FR-090` |
| **EVT-REVIEW-REQUESTED** | A DRS review was requested. | `reviewId`, `type`, `requestedBy`, `deliveryId`, `subjectMode`, `originalDecision` | `DRS-002/004` |
| **EVT-REVIEW-OUTCOME-APPLIED** | A review concluded and the record was updated. | `reviewId`, `outcome`, `resultingChange`, `sideReviewCountAfter` | `DRS-005/006/007` |
| **EVT-DELIVERY-CORRECTED** | A prior delivery was superseded by an amended version. | `originalDeliveryId`, `newDeliveryId`, `diff`, `reason`, `cascadeSummary` | `CORR-001/002/005` |
| **EVT-DELIVERY-VOIDED** | A delivery entered in error was voided. | `deliveryId`, `reason` | `CORR-014` |
| **EVT-DELIVERY-INSERTED** | A missed delivery was inserted at a position. | `newDeliveryId`, `betweenOrdinals`, `reason`, `cascadeSummary` | `CORR-013` |
| **EVT-WICKET-CORRECTED** / **EVT-LINEUP-CORRECTED** / **EVT-RESULT-CORRECTED** | Targeted post-hoc corrections. | `before`, `after`, `reason`, `postFinal:bool` | `CORR-002/016/017` |
| **EVT-RECONCILIATION-CHECKPOINT-RECORDED** | An invariant report was produced (interval / sign-off). | `report : VO-RECONCILIATION-REPORT` | `CORR-008`, `INV-018` |
| **EVT-DIVERGENCE-DETECTED** | Two scorer logs disagree on a delivery. | `divergence : VO-DIVERGENCE` | `FR-116/117` |
| **EVT-DIVERGENCE-RESOLVED** | A divergence was mutually confirmed. | `divergenceId`, `agreedValue`, `proposedBy`, `confirmedBy` | `FR-118/119`, `CORR-010` |
| **EVT-SUPER-OVER-STARTED** / **EVT-SUPER-OVER-RESOLVED** | A Super Over began / concluded. | `superOverId`, `sequenceNo`, `nominations`, `battingOrder` / `outcome`, `nextSequenceNo?` | `SO-002…013` |
| **EVT-MATCH-FINALISED** *(also §9.1)* — consumed by CTX-COMPETITION (standings) and CTX-PROFILES (stats). | | | `BR-013/015` |

### 9.4 Other contexts (summary)

| Context | Events |
|---|---|
| CTX-IDENTITY | `EVT-ORGANIZATION-CREATED`, `EVT-MEMBER-INVITED`, `EVT-MEMBER-JOINED`, `EVT-ROLE-ASSIGNED`, `EVT-ROLE-REVOKED`, `EVT-MEMBER-DEACTIVATED`, `EVT-ORGANIZATION-SUSPENDED`, `EVT-ORGANIZATION-DELETED` |
| CTX-PARTICIPANTS | `EVT-PLAYER-REGISTERED`, `EVT-PLAYER-MERGED`, `EVT-PLAYER-DEACTIVATED`, `EVT-TEAM-CREATED`, `EVT-SQUAD-MEMBER-ADDED`, `EVT-SQUAD-MEMBER-AVAILABILITY-CHANGED`, `EVT-APPEARANCE-CLAIM-REQUESTED`, `EVT-APPEARANCE-CLAIM-APPROVED`, `EVT-APPEARANCE-CLAIM-REJECTED` |
| CTX-COMPETITION | `EVT-COMPETITION-CREATED`, `EVT-CONDITIONS-PROFILE-PUBLISHED`, `EVT-FIXTURE-SCHEDULED`, `EVT-XI-SUBMITTED`, `EVT-XI-LOCKED`, `EVT-FIXTURE-RESULT-INGESTED`, `EVT-STANDINGS-RECOMPUTED`, `EVT-DISPUTE-RAISED`, `EVT-DISPUTE-ADJUDICATED` |
| CTX-PUBLISHING | `EVT-LIVE-LINK-CREATED`, `EVT-LIVE-LINK-REVOKED`, `EVT-FOLLOWER-SUBSCRIBED`, `EVT-NOTIFICATION-SENT` |

---

## 10. Commands

Imperative; each may be **accepted** (emitting events) or **rejected** (with a reason). Every command carries `issuedByUserId` (or `guestDeviceId`), `matchId` (or target aggregate id), `clientLogicalClock`. Table columns: intent · key inputs · preconditions (guards) · events on success · trace.

### 10.1 CTX-SCORING — setup & lifecycle commands

| Command | Intent | Key inputs | Preconditions | Emits | Trace |
|---|---|---|---|---|---|
| **CMD-CREATE-MATCH** | Start a new match record. | `format`, `templateId?`, `organizationId?`, `competitionId?`, `fixtureId?` | caller may create in scope (or guest); template consistent with format | `EVT-MATCH-CREATED` | `FR-016/017`, `SCR-001` |
| **CMD-CONFIGURE-MATCH** | Set/adjust sides, officials, venue, ball, conditions ref (pre-toss). | `sides`, `officials`, `venue`, `ball`, `conditionsProfileRef` | `state ∈ {SCHEDULED, CONFIGURED}`; sides distinct; no shared player (`BR-010`) | `EVT-MATCH-CONFIGURED` | `TEAM-*`, `OFCL-*`, `FMT-*` |
| **CMD-SUBMIT-NOMINATED-SIDE** | Provide a team's XI + roles. | `teamRef`, `players`, `captainId`, `keeperId` | `|players| = players_per_side`; captain & keeper ∈ players (`BR-009`) | `EVT-MATCH-CONFIGURED` (side) | `FR-032/033/035` |
| **CMD-RECORD-TOSS** | Record toss result. | `wonBy`, `decision` | `state = CONFIGURED`; both sides nominated | `EVT-TOSS-RECORDED` | `TEAM-006`, `BR-026` |
| **CMD-CONFIRM-READY** | Assert setup is valid; enable scoring. | — | `state = TOSS_DONE`; validation gate passes (`FR-027`) | `EVT-MATCH-READY` | `STATE-001` |
| **CMD-OPEN-INNINGS** | Open the next innings with a pair + bowler. | `inningsId`, `strikerId`, `nonStrikerId`, `bowlerId`, `keeperId` | `state ∈ {READY, INNINGS_BREAK}`; players available; `striker ≠ nonStriker` | `EVT-INNINGS-STARTED` (+ `EVT-PLAYING-CONDITIONS-FROZEN` on first ever) | `INN-*`, `SM-INNINGS` |
| **CMD-DECLARE-INNINGS** | Captain closes the innings. | `inningsId`, `byCaptainId` | `declarations_permitted`; ball dead; `state = IN_PROGRESS` | `EVT-INNINGS-DECLARED`, `EVT-INNINGS-ENDED` | `DECL-002` |
| **CMD-FORFEIT-INNINGS** | Captain gives up the innings. | `inningsId`, `byCaptainId` | `declarations_permitted` context; irreversible | `EVT-INNINGS-FORFEITED`, `EVT-INNINGS-ENDED` | `DECL-003` |
| **CMD-END-INNINGS** | Explicitly end (time / concede / no further play) or confirm an auto-end. | `inningsId`, `endReason` | reason consistent with state (`INN-003`) | `EVT-INNINGS-ENDED` (+ `EVT-RESULT-DETERMINED`/`EVT-MATCH-TIED` if last) | `INN-003`, `RES-*` |
| **CMD-RECORD-FOLLOW-ON-DECISION** | Enforce/decline follow-on. | `decision` | two-innings format; lead ≥ margin for `ENFORCED` (`FLW-001/002`) | `EVT-FOLLOW-ON-DECISION-RECORDED` | `FLW-*` |
| **CMD-CALL-STUMPS** / **CMD-RESUME-PLAY** | Multi-day day close / resume, or resume after interruption. | `atOverBall`, `resumeContext` | multi-day (stumps); `state ∈ {STUMPS, INTERRUPTION}` (resume) | `EVT-STUMPS-CALLED` / `EVT-PLAY-RESUMED` | `CSR-060`, `STATE-004` |
| **CMD-RECORD-INTERRUPTION** | Log a stoppage. | `cause`, `startedAt`, `startOverBall` | `state ∈ {IN_PROGRESS, INNINGS_BREAK}` | `EVT-INTERRUPTION-RECORDED` | `FR-078` |
| **CMD-REVISE-OVERS** | Change an innings' allotted overs. | `inningsId`, `newOvers`, `reason` | tied to a resolved interruption or umpire ruling | `EVT-OVERS-REVISED` (+ `EVT-POWERPLAY-PHASE-CHANGED?`) | `INN-012`, `PP-007` |
| **CMD-APPLY-DLS-REVISION** | Recompute target/par via DLS. | `inputs`, `triggeredByInterruptionId?` | `rain_method ≠ NONE`; DLS-applicable format (`DLS-002`) | `EVT-DLS-REVISION-APPLIED` | `DLS-004…009` |
| **CMD-REVERSE-DLS-REVISION** / **CMD-AMEND-DLS-REVISION** | Undo/correct a DLS revision. | `dlsRevisionId`, `reason`, `newInputs?` | revision exists | `EVT-DLS-REVISION-REVERSED` (+ new `EVT-DLS-REVISION-APPLIED`) | `CORR-015` |
| **CMD-OVERRIDE-DLS-TARGET** | Set a manual target. | `manualTarget`, `reason` | authorised; reason non-empty | `EVT-DLS-TARGET-OVERRIDDEN` | `DLS-010`, `FR-090` |
| **CMD-START-SUPER-OVER** | Begin a (repeat) Super Over. | `sequenceNo`, `nominations`, `battingOrder` | `state = SUPER_OVER`; nominations valid (`SO-003`) | `EVT-SUPER-OVER-STARTED` | `SO-002/013` |
| **CMD-RESOLVE-SUPER-OVER** | Conclude a Super Over. | `superOverId` | both mini-innings ended | `EVT-SUPER-OVER-RESOLVED` (+ `EVT-RESULT-DETERMINED` or new `EVT-SUPER-OVER-STARTED`) | `SO-008/012` |
| **CMD-ABANDON-MATCH** | Call the match off. | `reason`, `withoutBall?` | — | `EVT-RESULT-DETERMINED` \| `EVT-MATCH-NO-RESULT` \| `EVT-MATCH-ABANDONED` | `RES-006/007`, `TGT-010` |
| **CMD-AWARD-MATCH** | Umpires/referee award the match. | `awardedTo`, `reason` | authorised official context | `EVT-MATCH-AWARDED` | `RES-009` |
| **CMD-SIGN-OFF-MATCH** | Make the match FINAL. | `signatures`, `reconciliationOverrideReason?` | `state = COMPLETE_PENDING_SIGNOFF`; reconciliation all-pass or override reason (`MBR-08`) | `EVT-RECONCILIATION-CHECKPOINT-RECORDED`, `EVT-MATCH-FINALISED` | `SCRD-020`, `BR-007` |
| **CMD-REOPEN-MATCH** | Re-open a complete/final match for correction. | `reason` | a correction shows completion premature/incorrect | `EVT-MATCH-REOPENED` \| `EVT-FINAL-REVOKED` | `STATE-006`, `CORR-015/016` |
| **CMD-VOID-MATCH** | Void a match created in error. | `reason` | `state ∈ {SCHEDULED..READY}` | `EVT-MATCH-VOIDED` | `STATE-001` |
| **CMD-CLAIM-GUEST-MATCH** | Attach a guest match to an account/org. | `organizationId?`, `ownerUserId`, `teamResolutions`, `playerResolutions` | match currently guest; caller authenticated | `EVT-GUEST-MATCH-CLAIMED` | `FR-004`, `MBR-02` |
| **CMD-SHARE-MATCH** / **CMD-PUBLISH-MATCH** | Create a read-only link / live projection. | `scope` | not a guest match (`BR-022`) | `EVT-MATCH-SHARED` / `EVT-MATCH-PUBLISHED` | `FR-161/162` |

### 10.2 CTX-SCORING — ball, wicket & correction commands

| Command | Intent | Key inputs | Preconditions | Emits | Trace |
|---|---|---|---|---|---|
| **CMD-RECORD-DELIVERY** | Record one ball and its complete outcome. | `context (auto-filled striker/bowler/phase/freeHit)`, `legality`, `noBallReason?`, `wideVariant?`, `runLine`, `fielding`, `wicket?`, `commentary?` | `state = IN_PROGRESS`; caller has Head/Assistant scorer role (`BR-003`); bowler ≠ previous-over bowler on ball 1 (`OVER-003`); bowler under cap or override; dismissal mode legal for legality/free-hit (`WKT-009`); `runLine` valid (`VO-RUNLINE`) | `EVT-DELIVERY-RECORDED` (+ `EVT-BOUNDARY-SCORED?`, `EVT-EXTRA-SCORED?`, `EVT-WICKET-RECORDED?`, `EVT-FREE-HIT-SET/CONSUMED?`, `EVT-OVER-COMPLETED?`, `EVT-POWERPLAY-PHASE-CHANGED?`, `EVT-INNINGS-ENDED?`) | `BALL-*`, `CSR-001…036`, all extra/dismissal areas |
| **CMD-RECORD-NON-STRIKER-RUNOUT** | Bowler attempts to run out the backing-up non-striker before delivery. | `attempt:SUCCESS\|FAIL` | within the permitted window (`NSRO-001`); `mankad_enabled` | `EVT-WICKET-RECORDED` (mode RUN_OUT, no credit) or dead-ball no-event; delivery re-bowled, not counted | `NSRO-001…009` |
| **CMD-AWARD-PENALTY-RUNS** | Award 5 penalty runs. | `receivingSide`, `amount`, `reasonCode`, `atOverBall?` | umpire-directed | `EVT-PENALTY-RUNS-AWARDED`, `EVT-EXTRA-SCORED` | `PEN-001…011` |
| **CMD-RECORD-RETIREMENT** | A batter retires (hurt/ill or otherwise). | `batterId`, `type:NOT_OUT\|OUT`, `atOverBall`, `reason` | ball dead; batter at crease | `EVT-RETIREMENT-RECORDED` (+ `EVT-WICKET-RECORDED` if `OUT`) | `RTHO-001`, `RTOU-001` |
| **CMD-RESUME-BATTER** | A retired batter returns. | `batterId` | at a fall of wicket; wickets remain; consent recorded if was `RETIRED_OUT` | `EVT-BATTER-RESUMED` (+ `EVT-WICKET-REVERSED` if consented retired-out) | `RTHO-001`, `RTOU-005` |
| **CMD-APPEAL-TIMED-OUT** | Fielding side appeals timed out. | `incomingBatterId` | elapsed > `timed_out_limit_seconds` since last wicket; appeal in time | `EVT-WICKET-RECORDED` (mode TIMED_OUT) | `TIMO-001…007` |
| **CMD-OVERRIDE-STRIKER** | Scorer sets the next striker manually. | `newStrikerId`, `reason` | reason non-empty | `EVT-STRIKER-OVERRIDDEN` | `STRK-011`, `MBR-09` |
| **CMD-RECORD-REPLACEMENT** | Enter a concussion/impact/substitute/runner replacement. | `kind`, `side`, `replacedPlayerId?`, `replacementPlayerId`, `effectiveFrom`, `reason` | `kind` enabled by profile; like-for-like for concussion (`PLYR-004`) | `EVT-PLAYER-REPLACED` | `PLYR-003…009` |
| **CMD-CHANGE-KEEPER** | Change the wicket-keeper. | `newKeeperId`, `atOverBall` | new keeper on the fielding side | `EVT-KEEPER-CHANGED` | `PLYR-002`, `FR-067` |
| **CMD-REQUEST-REVIEW** | Request a player/umpire DRS review. | `deliveryId`, `type`, `requestedBy`, `subjectMode` | `drs_enabled`; reviews remaining for a player review (`DRS-011`); within `review_request_seconds` | `EVT-REVIEW-REQUESTED` | `DRS-002/004` |
| **CMD-APPLY-REVIEW-OUTCOME** | Record a review's conclusion and apply the record change. | `reviewId`, `outcome`, `resultingChange` | review pending | `EVT-REVIEW-OUTCOME-APPLIED` (+ `EVT-WICKET-RECORDED`/`EVT-WICKET-REVERSED`/`EVT-DELIVERY-CORRECTED`/`EVT-FREE-HIT-SET`) | `DRS-005/006/007` |
| **CMD-AMEND-DELIVERY** | Correct a prior delivery. | `deliveryId`, `changes`, `reason` | caller authorised; reason non-empty; if post-`FINAL`, elevated role (`CORR-009`) | `EVT-DELIVERY-CORRECTED` (+ cascade events, + `EVT-RECONCILIATION-CHECKPOINT-RECORDED`, + `EVT-FINAL-REVOKED?`) | `CORR-001…006` |
| **CMD-VOID-DELIVERY** | Remove a delivery entered in error. | `deliveryId`, `reason` | as above | `EVT-DELIVERY-VOIDED` (+ cascade) | `CORR-014` |
| **CMD-INSERT-DELIVERY** | Insert a missed delivery at a position. | `betweenOrdinals`, `deliveryPayload`, `reason` | as above | `EVT-DELIVERY-INSERTED` (+ cascade) | `CORR-013` |
| **CMD-AMEND-WICKET** / **CMD-AMEND-LINEUP** / **CMD-CORRECT-RESULT** | Targeted corrections. | `target`, `changes`, `reason` | as above | `EVT-WICKET-CORRECTED` / `EVT-LINEUP-CORRECTED` / `EVT-RESULT-CORRECTED` (+ cascade) | `CORR-002/016/017` |
| **CMD-AMEND-PLAYING-CONDITIONS** | Change a frozen `[CFG]` value. | `key`, `newValue`, `reason` | authorised; reason non-empty | `EVT-PLAYING-CONDITIONS-AMENDED` | `FMT-014`, `MINV-05` |
| **CMD-RUN-RECONCILIATION** | Produce an invariant report at a checkpoint. | `atOrdinal?` | — | `EVT-RECONCILIATION-CHECKPOINT-RECORDED` | `CORR-008`, `INV-018` |
| **CMD-PROPOSE-DIVERGENCE-RESOLUTION** / **CMD-CONFIRM-DIVERGENCE-RESOLUTION** | Dual-scorer reconciliation. | `divergenceId`, `proposedValue` / `divergenceId` | proposer & confirmer are the two distinct scorers (`MINV-14`) | `EVT-DIVERGENCE-DETECTED` (by sync) / `EVT-DIVERGENCE-RESOLVED` | `FR-116…119`, `CORR-010` |

### 10.3 Other contexts (summary)

| Context | Commands |
|---|---|
| CTX-IDENTITY | `CMD-CREATE-ORGANIZATION`, `CMD-INVITE-MEMBER`, `CMD-ACCEPT-INVITE`, `CMD-ASSIGN-ROLE`, `CMD-REVOKE-ROLE`, `CMD-DEACTIVATE-MEMBER`, `CMD-SUSPEND-ORGANIZATION`, `CMD-DELETE-ORGANIZATION`, `CMD-EXPORT-MY-DATA`, `CMD-DELETE-MY-ACCOUNT` |
| CTX-PARTICIPANTS | `CMD-REGISTER-PLAYER`, `CMD-MERGE-PLAYERS`, `CMD-DEACTIVATE-PLAYER`, `CMD-CREATE-TEAM`, `CMD-ADD-SQUAD-MEMBER`, `CMD-SET-SQUAD-AVAILABILITY`, `CMD-REQUEST-APPEARANCE-CLAIM`, `CMD-APPROVE-APPEARANCE-CLAIM`, `CMD-REJECT-APPEARANCE-CLAIM` |
| CTX-COMPETITION | `CMD-CREATE-COMPETITION`, `CMD-PUBLISH-CONDITIONS-PROFILE`, `CMD-GENERATE-FIXTURES`, `CMD-IMPORT-FIXTURES`, `CMD-ASSIGN-SCORERS`, `CMD-SUBMIT-XI`, `CMD-LOCK-XI`, `CMD-INGEST-RESULT`, `CMD-RECOMPUTE-STANDINGS`, `CMD-RAISE-DISPUTE`, `CMD-ADJUDICATE-DISPUTE`, `CMD-LOCK-FIXTURE` |
| CTX-PUBLISHING | `CMD-CREATE-LIVE-LINK`, `CMD-REVOKE-LIVE-LINK`, `CMD-SUBSCRIBE-FOLLOWER`, `CMD-SEND-NOTIFICATION` |

---

## 11. Queries (Read Models)

Side-effect free; each is a **projection over the active event stream** (`MBR-02/07`) or an aggregate read. Every query: **Identifier · Purpose · Inputs · Shape · Source · Trace**.

| Query | Purpose | Inputs | Shape (summary) | Source | Trace |
|---|---|---|---|---|---|
| **QRY-LIVE-SCORECARD** | The at-a-glance live state for scorer & viewer. | `matchId` | score/wickets, overs, striker/non-striker (with R/B), bowler (figures), RR, RRR, runs required, balls remaining, target, DLS par, last 6 balls, free-hit flag, powerplay phase | `AGG-MATCH` timeline | `FR-065/138`, `VWR-002` |
| **QRY-FULL-SCORECARD** | The complete card (all §31 sections). | `matchId` | header, per-innings batting/bowling/extras/total, DNB, FoW, partnerships, powerplay scores, match notes, DLS panel, Super Over panel, result, sign-off, amendment log | timeline | `SCRD-001…022` |
| **QRY-LINEAR-SHEET** | Ball-by-ball linear scoresheet. | `matchId`, `inningsId?` | ordered deliveries with over.ball notation + tokens | timeline | `SCRD-006`, `CMTRY-003` |
| **QRY-BOWLING-ANALYSIS** | Bowling figures + spells. | `matchId`, `inningsId` | per bowler O/M/R/W/wd/nb/econ, spells, milestones | `ENT-BOWLER-CARD-LINE` projection | `BOWL-001…010` |
| **QRY-FALL-OF-WICKETS** | FoW list. | `matchId`, `inningsId` | `[{wicketNo, score, batter, overBall}]` | `ENT-WICKET` | `WKT-007`, `CSR-031` |
| **QRY-PARTNERSHIPS** | Partnership table (segments + combined). | `matchId`, `inningsId` | `[VO-PARTNERSHIP-SEGMENT]` + per-wicket combined | projection | `PART-001…008` |
| **QRY-OVER-BY-OVER** | Runs/wickets per over. | `matchId`, `inningsId` | `[{overNo, runs, wickets, isMaiden, bowler}]` | `ENT-OVER` | `SCRD` |
| **QRY-MANHATTAN** / **QRY-WORM** / **QRY-RUN-RATE-SERIES** | Analytics chart series. | `matchId`, `inningsId?` | per-over bars / cumulative runs / RR vs RRR series | projection | `FR-130/131/132` |
| **QRY-DLS-PANEL** | DLS method, resources, revisions, par ladder. | `matchId` | method/edition/G50/table version, per-side resources, revised target, par ladder, revision history | `ENT-DLS-REVISION` | `SCRD-016`, `DLS-*` |
| **QRY-COMMENTARY-FEED** | Chronological commentary + non-delivery markers. | `matchId`, `from?`, `to?` | ordered `[VO-COMMENTARY | marker]` | timeline | `CMTRY-001…013` |
| **QRY-AUDIT-TRAIL** | Who/what/when for every event & amendment. | `matchId`, `filter?` | ordered `[{ordinal, event, actor, device, before?, after?, reason?}]` | timeline | `FR-109/110`, `SCRD-021` |
| **QRY-SCORECARD-AT** | The scorecard as at a past ordinal/time. | `matchId`, `atOrdinal | atInstant` | same shape as `QRY-FULL-SCORECARD`, computed from the truncated stream | timeline (`MBR-07`) | `SCRD-022`, `CORR-011` |
| **QRY-RECONCILIATION-REPORT** | Latest / historical invariant pass-fail. | `matchId`, `atCheckpoint?` | `VO-RECONCILIATION-REPORT` | timeline | `INV-018`, `CORR-008` |
| **QRY-DIVERGENCE-LIST** | Open/proposed/confirmed divergences (dual-scorer). | `matchId` | `[VO-DIVERGENCE]` grouped by over | dual-scorer projection | `FR-117` |
| **QRY-MATCH-STATE** | Current `SM-MATCH` / `SM-INNINGS` state + what commands are valid now. | `matchId` | `{matchState, inningsState, allowedCommands[]}` | `AGG-MATCH` | `STATE-001…003` |
| **QRY-CARDS-EXPORT** | Cricsheet-compatible / CSV / PDF payload. | `matchId`, `format` | serialised match per target schema | timeline via `SVC-EXPORT-TRANSLATOR` | `FR-171…174`, `NFR-050` |
| **QRY-STANDINGS** *(CTX-COMPETITION)* | League table with points & NRR. | `competitionId`, `divisionId?` | `[VO-STANDINGS-ROW]` | competition read model | `CSR-057…059`, `BR-015` |
| **QRY-PLAYER-CAREER** / **QRY-TEAM-RECORD** *(CTX-PROFILES)* | Career/team aggregates from FINAL, verified matches. | `playerId` / `teamId` | batting/bowling aggregates, milestones, head-to-head | stats read model | `BR-013/014`, `MINV-17` |

---

## 12. Domain Services

Stateless behaviour that doesn't belong to a single entity.

| Service | Responsibility | Consumes | Produces | Trace |
|---|---|---|---|---|
| **SVC-STRIKE-RESOLVER** | Given delivery *n-1*'s active outcome + end-of-over rule + logged overrides, compute the striker/non-striker and ends for delivery *n*, and the incoming batter's end after a wicket. | prior delivery, wicket, over boundary, `EVT-STRIKER-OVERRIDDEN` | `{strikerId, nonStrikerId, battingEnd}` + confirmation prompt on wickets | `STRK-001…017`, `MINV-04`, `MBR-09` |
| **SVC-EXTRAS-DECOMPOSER** | Map a `VO-RUNLINE` + `legality` + `nb_wd_secondary_extras_itemised` to `VO-EXTRAS-ON-DELIVERY` and to the bowler's charged runs. | delivery inputs, profile | `VO-EXTRAS-ON-DELIVERY`, `runsChargedToBowler` | `EXT-*`, `NB-*`, `WD-*`, `BOWL-002` |
| **SVC-INNINGS-END-EVALUATOR** | After each delivery/retirement, decide whether the innings has ended and why. | innings state, wickets, overs, target | `InningsEndReason?` | `INN-003`, `SM-INNINGS`, `MINV-10` |
| **SVC-RESULT-DERIVER** | Compute `VO-RESULT` (type, method, margin, statement) from innings totals + DLS/Super-Over data. | all innings, DLS, Super Over | `VO-RESULT` | `RES-001…016`, `TGT-*`, `MINV-13` |
| **SVC-DLS-CALCULATOR** | Apply DLS Standard Edition: resources, revised target, par ladder — offline from pinned tables. | `VO-DLS-INPUTS`, `VO-DLS-REFERENCE` | `VO-DLS-OUTPUTS`, `VO-PAR-LADDER` | `DLS-003…018` |
| **SVC-POWERPLAY-PLANNER** | Compute/repartition `VO-POWERPLAY-PLAN` phases, including mid-over boundaries after reductions. | `powerplay_model`, allotted overs, reductions | `VO-POWERPLAY-PLAN` | `PP-001…012` |
| **SVC-CASCADE-RECOMPUTER** | After an amendment/insert/void, recompute all projections, detect strike-continuity breaks, and surface the cascade for scorer review. | timeline delta | updated projections + `cascadeSummary` + review prompts | `CORR-004/005/013`, `MINV-02` |
| **SVC-RECONCILER** | Evaluate `INV-001…018` + `MINV-*` and produce `VO-RECONCILIATION-REPORT`. | full timeline | `VO-RECONCILIATION-REPORT` | `INV-018`, `MBR-08` |
| **SVC-DIVERGENCE-DETECTOR** | Align two scorer logs by over/ball and emit `VO-DIVERGENCE` for each field mismatch. | two event streams | `[VO-DIVERGENCE]` | `FR-116`, `MINV-14` |
| **SVC-MILESTONE-DETECTOR** | Flag fifties/hundreds/five-fors/hat-tricks/team milestones/record partnerships. | timeline | `milestoneFlags` on commentary & cards | `CSR-034…036`, `CMTRY-007` |
| **SVC-EXPORT-TRANSLATOR** | Serialise a match to Cricsheet-compatible / CSV / PDF and parse an import into commands (anti-corruption). | timeline / foreign doc | export payload / command list | `FR-171…176`, `NFR-050…052` |
| **SVC-AUTHORIZER** | Resolve whether an actor may issue a command against a match (role from `AGG-ORGANIZATION`, guest rules). | `issuedByUserId`, `matchId` | allow / deny + reason | `BR-003/022/024`, `NFR-024/026` |

---

## 13. Traceability — spec area → model object

| Spec area (`cricket-rules-reference.md`) | Primary model carriers |
|---|---|
| §1 Formats `FMT-*` | `VO-FORMAT`, `ENT-MATCH.format`, `CMD-CREATE-MATCH` |
| §2 Teams `TEAM-*` | `AGG-TEAM`, `VO-NOMINATED-SIDE`, `VO-TEAM-REF`, `VO-LOCAL-TEAM`, `VO-TOSS` |
| §3 Players `PLYR-*` | `AGG-PLAYER`, `ENT-SQUAD-MEMBER`, `ENT-PLAYER-REPLACEMENT`, `VO-PLAYER-*` |
| §4 Officials `OFCL-*` | `VO-MATCH-OFFICIALS`, `VO-UMPIRE-SLOT`, `VO-SCORER-ASSIGNMENT` |
| §5 State `STATE-*` | `SM-MATCH`, `ENT-MATCH.state`, `QRY-MATCH-STATE` |
| §6 Innings `INN-*` | `ENT-INNINGS`, `SM-INNINGS`, `SVC-INNINGS-END-EVALUATOR`, `MINV-10` |
| §7 Overs `OVER-*` | `ENT-OVER`, `MINV-08`, `EVT-OVER-COMPLETED` |
| §8 Balls `BALL-*` | `ENT-DELIVERY`, `VO-DELIVERY-CONTEXT`, `VO-DEAD-BALL`, `MINV-03` |
| §9 Runs `RUN-*` | `VO-RUNLINE`, `VO-OVERTHROW`, `SVC-EXTRAS-DECOMPOSER` |
| §10 Strike `STRK-*` | `SVC-STRIKE-RESOLVER`, `EVT-STRIKER-OVERRIDDEN`, `MINV-04`, `MBR-09` |
| §11–16 Extras `EXT/NB/WD/BYE/LB/PEN` | `VO-EXTRAS-ON-DELIVERY`, `VO-EXTRAS-BREAKDOWN`, `EVT-PENALTY-RUNS-AWARDED`, `SVC-EXTRAS-DECOMPOSER` |
| §17 Free hit `FH-*` | `ENT-DELIVERY.isFreeHit`, `Innings.freeHitPending`, `EVT-FREE-HIT-SET/CONSUMED`, `MINV-09` |
| §18–19 Wickets & dismissals `WKT/BWLD/CAUT/LBW/STMP/RNO/NSRO/HITW/OBSF/HBT/TIMO/RTHO/RTOU` | `ENT-WICKET`, `VO-DISMISSAL`, `VO-FALL-OF-WICKET`, `CMD-RECORD-DELIVERY`, `CMD-RECORD-NON-STRIKER-RUNOUT`, `CMD-RECORD-RETIREMENT`, `CMD-APPEAL-TIMED-OUT`, `SM-BATTER-CARD-LINE`, `MINV-06/07` |
| §20 Bowling `BOWL-*` | `ENT-BOWLER-CARD-LINE`, `VO-BOWLING-SPELL`, `SVC-MILESTONE-DETECTOR` |
| §21 Batting `BAT-*` | `ENT-BATTER-CARD-LINE`, `SM-BATTER-CARD-LINE` |
| §22 Partnerships `PART-*` | `VO-PARTNERSHIP-SEGMENT`, `QRY-PARTNERSHIPS` |
| §23 Powerplays `PP-*` | `VO-POWERPLAY-PLAN`, `VO-POWERPLAY-PHASE`, `SVC-POWERPLAY-PLANNER`, `EVT-POWERPLAY-PHASE-CHANGED` |
| §24 Reviews `DRS-*` | `ENT-REVIEW`, `VO-REVIEW-OUTCOME`, `CMD-REQUEST-REVIEW`, `CMD-APPLY-REVIEW-OUTCOME` |
| §25 Declarations `DECL-*` | `CMD-DECLARE-INNINGS`, `CMD-FORFEIT-INNINGS`, `EVT-INNINGS-DECLARED/FORFEITED` |
| §26 Follow-on `FLW-*` | `CMD-RECORD-FOLLOW-ON-DECISION`, `ENT-MATCH.inningsOrder`, `EVT-FOLLOW-ON-DECISION-RECORDED` |
| §27 Results `RES-*` | `VO-RESULT`, `SVC-RESULT-DERIVER`, `MINV-13` |
| §28 Target `TGT-*` | `VO-TARGET`, `MINV-11` |
| §29 DLS `DLS-*` | `ENT-DLS-REVISION`, `VO-DLS-*`, `SVC-DLS-CALCULATOR`, `SM-DLS-REVISION` |
| §30 Super Over `SO-*` | `ENT-SUPER-OVER`, `SM-MATCH` SUPER_OVER branch, `MINV-12`, `MBR-10` |
| §31 Scorecard `SCRD-*` | `QRY-FULL-SCORECARD`, `QRY-SCORECARD-AT`, `VO-SIGN-OFF` |
| §32 Commentary `CMTRY-*` | `VO-COMMENTARY`, `QRY-COMMENTARY-FEED`, `SVC-MILESTONE-DETECTOR` |
| §33 Corrections `CORR-*` | append-only timeline, `CMD-AMEND-*`, `SVC-CASCADE-RECOMPUTER`, `VO-AMENDMENT-ENTRY`, `MINV-01/02` |
| §34 Invariants `INV-*` | inherited; enforced by `SVC-RECONCILER`; extended by `MINV-*` |
| §35 Config Registry `CFG-REG` | `VO-PLAYING-CONDITIONS-PROFILE`, `AGG-CONDITIONS-PROFILE`, `MBR-05/12` |

---

## 14. Open items for review

1. **Aggregate size.** `AGG-MATCH` is deliberately large (whole match). Confirm this is acceptable given the offline/append-only requirements, or split the boundary at `ENT-INNINGS` (trade-off: cross-innings result/DLS logic then becomes a domain service coordinating two aggregates).
2. **Projection-backed entities.** `ENT-BATTER-CARD-LINE` / `ENT-BOWLER-CARD-LINE` are modelled as entities because rules reference their `status`/`ballsRemainingUnderCap`. Confirm, or demote them to pure value objects inside projections and move the referenced state onto `ENT-INNINGS`.
3. **`ENT-OVER` identity.** Composite `(InningsId, overNumber)` shifts under `CMD-INSERT-DELIVERY` cascades. Alternative: opaque `OverId` with a derived `overNumber`. Decide before the schema doc.
4. **DLS blockage.** `ENT-DLS-REVISION` / `SVC-DLS-CALCULATOR` remain provisional pending **SPK-01** (licensing). If unlicensed, `rain_method = NONE` and only `CMD-OVERRIDE-DLS-TARGET` survives.
5. **Dual-scorer as one aggregate vs two.** `MINV-14` assumes both scorer logs converge into one `AGG-MATCH` timeline via sync. Confirm against the architecture's sync model (P2).
6. **Command granularity.** `CMD-RECORD-DELIVERY` is a single fat command emitting many sub-events. Confirm this over a family of narrow commands (`CMD-RECORD-RUNS`, `CMD-RECORD-WIDE`, …).

---

## 15. Change Log

| Version | Date | Summary |
|---|---|---|
| **0.1.0** | 2026-09-02 | Initial formal domain model derived from `cricket-rules-reference.md` v0.1.0. 6 bounded contexts; 7 aggregates; ~30 entities; ~45 value objects; 8 state machines; `MINV-01…18` on top of inherited `INV-001…018`; `MBR-01…12`; ~70 domain events; ~55 commands; ~20 queries; 13 domain services; full traceability matrix. Not yet reviewed. DLS objects provisional pending SPK-01. |





