# Cricket Scoring System — Domain Specification

*(single source of truth — every feature spec defers to the requirement IDs below rather than restating rules)*

| | |
|---|---|
| **Document** | Cricket Scoring System — Domain Specification (International Standard) |
| **Version** | **0.1.0** (Draft — for review) |
| **Date** | 2026-09-02 |
| **Status** | Draft. Not yet ratified by an accredited scorer. |
| **Supersedes** | — (initial version) |
| **Upstream** | `docs/foundation/product-foundation.md`, `docs/discovery/product-discovery.md` (maps to `CSR-*` and objective **OBJ-01**) |

### Authoritative sources

1. **MCC Laws of Cricket**, 2017 Code (3rd Edition, 2017) incorporating the 2019, 2021 and 2022 updates.
2. **ICC Standard Playing Conditions** — Test Matches, One Day Internationals, Twenty20 Internationals (current editions).
3. **ICC Duckworth–Lewis–Stern (DLS) method** — Standard Edition (public tables) and Professional Edition (reference only).
4. Competition-specific playing conditions (domestic boards, franchise leagues, The Hundred) — treated as configuration overlays.

> Where this specification and a cited source diverge, **the cited source governs** and this specification is a defect to be corrected. Rule values that have changed recently or vary by edition are marked `[CFG]` and listed in §35 with open clarification notes.

---

## 0. How to read this specification

### 0.1 Classification tags — every requirement carries exactly one

| Tag | Meaning | System obligation |
|---|---|---|
| **[LAW]** | Behaviour mandated by the Laws of Cricket or ICC Playing Conditions. | MUST reproduce faithfully. A deviation is a correctness defect. |
| **[PRD]** | Product rule — a decision *this system* makes about how scoring is recorded, represented, computed or presented, not dictated by the Laws. | MUST implement as specified; may be revised by product decision, not by a scorer. |
| **[CFG]** | Configurable rule — varies by format / competition / playing conditions. | MUST store as a setting with a defined default and allowed values (§35). |
| **[EDGE]** | Edge-case handling — a specific, usually rare, situation the system MUST resolve deterministically. | MUST handle exactly as described; MUST NOT leave undefined. |

Some rules have a law core plus a configurable parameter (e.g. "an over is 6 balls" is `[LAW]`; "balls per over" is `[CFG]` for The Hundred). These appear as two linked requirements.

### 0.2 Requirement ID format

`<AREA>-<NNN>` (e.g. `NB-014`). IDs are **stable across versions and never reused**. A withdrawn requirement is marked `DEPRECATED (v0.x.y)` and kept in place. Sub-areas of Dismissals use their own prefixes (§19).

### 0.3 Normative keywords

**MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** are used per RFC 2119.

### 0.4 Playing-conditions profile

A **profile** is a complete set of `[CFG]` values for a match. Named baseline profiles: `LAWS` (Laws only), `TEST`, `ODI`, `T20I`, `CLUB_LO` (club limited-overs), `HUNDRED`. A match is scored against exactly one profile, captured at the first delivery (see `CORR` and `INV`).

### 0.5 Explicitly out of scope of this document

Application architecture, data model, storage, synchronisation, offline strategy, UI, API shape. Those live in `docs/architecture/*`. This document defines **what is true in the cricket domain and what the scoring record must contain**, not how it is built.

---

## 1. Match Formats — `FMT`

Cricket is scored identically at the delivery level across formats; formats differ in innings count, over limits, ball rules, permitted endings and applicable playing conditions.

- **FMT-001** `[LAW]` The system MUST support **multi-innings formats** (each side has two innings) and **single-innings formats** (each side has one innings).
- **FMT-002** `[CFG]` Format type is configured per match: `TEST`, `FIRST_CLASS`, `ODI`, `LIST_A`, `T20`, `T20I`, `T10`, `THE_HUNDRED`, `MULTIDAY_CLUB`, `LIMITED_OVERS_CUSTOM`, `OTHER`. (`FMT-002.days`, `FMT-002.innings_per_side`, `FMT-002.overs_per_innings`, `FMT-002.balls_per_over` are sub-keys.)
- **FMT-003** `[LAW]` In multi-innings formats the sides bat in alternating order except where the **follow-on** (§26) is enforced.
- **FMT-004** `[CFG]` Overs per innings: `TEST/FIRST_CLASS` = unlimited; `ODI/LIST_A` = 50 (allowed 20–50); `T20` = 20; `T10` = 10; `THE_HUNDRED` = 100 balls; `LIMITED_OVERS_CUSTOM` = 1–max.
- **FMT-005** `[CFG]` Balls per over: default **6** `[LAW]`; `THE_HUNDRED` = 5 or 10 consecutive balls bowled by one bowler (`FMT-005.hundred_over_length`).
- **FMT-006** `[CFG]` Per-bowler bowling limit: `ODI` = 10 overs; `T20` = 4 overs (20% of innings); `T10` = 2 overs; `THE_HUNDRED` = 20 balls; `TEST` = none. Expressed as `max_balls_per_bowler` or `max_overs_per_bowler`.
- **FMT-007** `[CFG]` New-ball policy: `TEST` = new ball available after N overs (default 80); `ODI` = two new balls, one from each end (`new_ball_policy = TWO_NEW`); `T20` = one ball. Note: ODI single-ball-from-35th-over variants exist — see §35 open note.
- **FMT-008** `[CFG]` Ball colour / session context: `RED` (daytime multi-day), `PINK` (day-night multi-day), `WHITE` (limited-overs). Informational for the record; does not change scoring logic.
- **FMT-009** `[CFG]` Permitted innings endings per format (declaration, forfeiture, time, over-limit, all-out, target, no-result minimum) — see §6, §25.
- **FMT-010** `[CFG]` Applicable playing conditions bundle: powerplays (§23), DRS (§24), free hit (§17), Super Over (§30), DLS (§29), timed-out limit (§19), over-rate penalties (§16-adjacent).
- **FMT-011** `[LAW]` **Test / first-class**: two innings per side; minimum scheduled overs per day `[CFG]` (default 90); result requires a side to be dismissed twice or to win on aggregate, else **draw**.
- **FMT-012** `[LAW]` A **draw** (multi-innings, time expired without a positive result) is distinct from a **tie** (scores level) — see §27.
- **FMT-013** `[PRD]` The system MUST allow a `LIMITED_OVERS_CUSTOM` profile so unlisted club/indoor/six-a-side formats can be scored by setting the `[CFG]` keys directly.
- **FMT-014** `[EDGE]` If a match's format is changed after scoring has begun (e.g. reduced from 50 to 40 overs before first ball), the change MUST be recorded as an explicit amendment event with reason (§33); changing format after the first delivery is not permitted, only over-count reductions (§6, §29).

**Edge cases**
- **FMT-015** `[EDGE]` Timed multi-day club matches that also impose a first-innings over limit (e.g. "declaration match, first innings max 60 overs"): the system MUST support a per-innings over cap **and** declarations simultaneously.
- **FMT-016** `[EDGE]` The Hundred: a bowler may bowl a 10-ball block (two "overs" back-to-back) counted as one change of ends; the "no two consecutive overs" rule (§7) is replaced by the 20-ball bowler cap and the block rule (`FMT-005.hundred_over_length`).

---

## 2. Teams — `TEAM`

- **TEAM-001** `[LAW]` A match is contested by exactly **two teams**.
- **TEAM-002** `[LAW]` Each team fields a nominated side of **11 players** `[CFG]` `players_per_side` (allowed 2–15 for non-standard formats).
- **TEAM-003** `[LAW]` Each team nominates a **captain**; if the captain is unavailable a deputy acts. Exactly one acting captain per team at any time.
- **TEAM-004** `[LAW]` The nominated side MUST be given to the opposing captain / umpires before the toss; players may not be changed after nomination except as permitted (substitutes, concussion replacement — §3).
- **TEAM-005** `[PRD]` A team record MUST hold: team name, short name/abbreviation, optional club/association, optional colours and logo (for scorecard branding), squad, nominated XI, captain, wicket-keeper.
- **TEAM-006** `[LAW]` The team that **wins the toss** elects to bat or bowl first; this determines initial innings order (§6).
- **TEAM-007** `[PRD]` The system MUST record toss winner, toss decision (`BAT` / `BOWL` / `FIELD`), and derive the batting order for innings 1..N.
- **TEAM-008** `[CFG]` Home/away or team A/team B designation, used only for scorecard presentation and venue logic.
- **TEAM-009** `[EDGE]` A neutral or unknown toss (toss not held / not recorded) MUST be enterable as "toss not recorded" with innings order set manually; flagged on the scorecard.
- **TEAM-010** `[EDGE]` If both nominated sides contain the same physical person (guest player error), the system MUST flag it before the first ball.
- **TEAM-011** `[PRD]` For competition play, a team links to a canonical competition team entity so results and standings aggregate correctly; for ad-hoc matches a team may be free-text.

---

## 3. Players — `PLYR`

- **PLYR-001** `[PRD]` A player record MUST hold: full name, display name, optional preferred batting hand, bowling hand/type, role hint (batter / bowler / all-rounder / wicket-keeper), and a stable identifier where linked to a registry.
- **PLYR-002** `[LAW]` Exactly one player per side is designated **wicket-keeper** at any moment; the keeper may be changed during an innings (§19 Stumped, §39 Law).
- **PLYR-003** `[LAW]` A player not in the nominated XI MAY act only as a **substitute fielder** and MUST NOT bat, bowl, keep wicket or act as captain — except a sanctioned **concussion replacement** or a competition-permitted **impact/replacement player**.
- **PLYR-004** `[CFG]` `concussion_replacement_enabled` (default true for ICC profiles): a like-for-like replacement approved by match officials; the replaced player takes no further part; the replacement assumes a normal role.
- **PLYR-005** `[CFG]` `impact_player_enabled` (default false): a competition-specific rule permitting one nominated replacement to enter and take a full part; governed by that competition's conditions.
- **PLYR-006** `[LAW]` **Substitute fielder**: permitted for an absent fielder; a wicket-keeping substitute is allowed only with the umpires' consent `[CFG]` `keeper_substitute_requires_consent` (default true).
- **PLYR-007** `[LAW]` A fielder absent for a period may be restricted from bowling on return until they have been on the field for time equal to their absence (`[CFG]` `penalty_time_for_absence_enabled`, default true for ICC). The system MUST track fielder absence start/end and compute the earliest permitted bowling time.
- **PLYR-008** `[PRD]` The system MUST record, per player per match: batting position, whether they batted, how they were dismissed (or not out / did not bat / absent), and every bowling spell.
- **PLYR-009** `[LAW]` **Runners are not part of the Laws.** `[CFG]` `runners_enabled` (default false) MAY be enabled for social/legacy cricket only; when enabled, a runner's run-out and infringements attach to the striker.
- **PLYR-010** `[EDGE]` "Absent hurt" / "absent" — a batter unavailable to bat at all: recorded in the batting list as `absent hurt` / `absent`, not a dismissal, does not count toward wickets; the innings can be **all out** with such a batter never having batted (fewer than 10 dismissals).
- **PLYR-011** `[EDGE]` A player who bats, is dismissed, and later returns as a concussion replacement's original — not permitted; the system MUST prevent a replaced player from re-entering.
- **PLYR-012** `[EDGE]` A concussion replacement who was already in the XI in another role: permitted per officials' decision; system MUST allow but flag for the match officials' note.
- **PLYR-013** `[PRD]` Player name collisions within one match (two "A. Kumar") MUST be disambiguated on the scorecard (initials expansion, jersey number, or suffix).

---

## 4. Officials — `OFCL`

- **OFCL-001** `[LAW]` Two **on-field umpires** officiate. The system MUST record both, plus their end assignments where relevant.
- **OFCL-002** `[CFG]` `third_umpire_enabled` (TV/third umpire), `fourth_umpire_enabled` (reserve), `match_referee_enabled` — default true for `TEST/ODI/T20I`, false for `CLUB_LO`.
- **OFCL-003** `[LAW]` **Two scorers** officiate; each records independently and they reconcile frequently and at every interval. This motivates dual-scorer mode (discovery `FR-113…120`). The system MUST record the identity of each scorer.
- **OFCL-004** `[LAW]` Scorers MUST accept and immediately acknowledge the umpires' signals; the recorded outcome MUST correspond to the umpire's signal, not the scorer's own judgement of the event.
- **OFCL-005** `[LAW]` In any case of doubt, scorers consult the umpires; the umpires' determination of what happened is final for the record.
- **OFCL-006** `[PRD]` The system MUST provide a structured outcome vocabulary that mirrors umpire signals: boundary four, six, bye, leg bye, wide, no ball, out, short run, dead ball, penalty runs (5), new ball, revoke last signal, TV referral, free hit, last hour.
- **OFCL-007** `[PRD]` The system MUST support recording an **umpire-directed correction** (§33) with the instructing umpire noted.
- **OFCL-008** `[CFG]` `player_of_the_match_enabled` (default true for representative matches) — recorded in the match record, not part of scoring logic.
- **OFCL-009** `[PRD]` Officials records MUST appear on the scorecard header (§31): on-field umpires, third umpire, fourth umpire, match referee, scorers.
- **OFCL-010** `[EDGE]` Umpire substitution mid-match: the system MUST record the change with the over/time it took effect.
- **OFCL-011** `[EDGE]` A single umpire standing (club match): permitted; `OFCL-001` relaxed under `CLUB_LO` with a data-quality flag.

---

## 5. Match Lifecycle & State — `STATE`

- **STATE-001** `[PRD]` A match progresses through defined states: `SCHEDULED → CONFIGURED → TOSS_DONE → READY → IN_PROGRESS → {INNINGS_BREAK | INTERRUPTION | STUMPS(day break)} → IN_PROGRESS … → COMPLETE_PENDING_SIGNOFF → FINAL`; plus terminal states `ABANDONED`, `CONCEDED/AWARDED`, `NO_RESULT`.
- **STATE-002** `[PRD]` Delivery entry is permitted only in `IN_PROGRESS`.
- **STATE-003** `[PRD]` Each innings has its own sub-state: `NOT_STARTED → IN_PROGRESS → {SUSPENDED} → ENDED(reason)`. `reason ∈ {ALL_OUT, OVERS_COMPLETE, TARGET_REACHED, DECLARED, FORFEITED, TIME_EXPIRED, NO_FURTHER_PLAY, INNINGS_CONCEDED}`.
- **STATE-004** `[PRD]` The system MUST record a timeline of non-delivery events: toss, innings start/end, interval, drinks, interruption start/end, resumption, over-rate penalty, DLS revision, new ball, powerplay boundaries, stumps/day change, review, sign-off.
- **STATE-005** `[LAW]` The **ball is in play** from the moment the bowler begins the run-up until it becomes **dead** (§8). Runs and dismissals are only valid while the ball is in play (exception: non-striker run-out before delivery, §19).
- **STATE-006** `[EDGE]` A match may re-enter `IN_PROGRESS` from `COMPLETE_PENDING_SIGNOFF` if a correction (§33) shows the result was premature (e.g. the "winning run" was a short run). This MUST be an explicit, logged action.
- **STATE-007** `[PRD]` `FINAL` is reached only by scorer sign-off (discovery `FR-106`); the result and full scorecard are frozen; further change requires a post-final amendment (§33).

---

## 6. Innings — `INN`

- **INN-001** `[CFG]` Number of innings per side is set by format (`FMT-002.innings_per_side`): 1 or 2.
- **INN-002** `[LAW]` Innings order follows the toss decision; in a two-innings match sides alternate unless the follow-on is enforced (§26).
- **INN-003** `[LAW]` An innings **ends** at the first of: the side is **all out**; the agreed number of **overs is completed**; the side **batting last reaches its target**; the batting captain **declares** (where permitted); the batting captain **forfeits** (where permitted); **time expires** (timed matches); **no further play is possible**.
- **INN-004** `[LAW]` **All out** = the batting side cannot continue because it has lost all the wickets available to it. Normally 10 dismissals; fewer if one or more batters are `absent` / `retired – not out and unable to resume` (§3, §19).
- **INN-005** `[CFG]` `wickets_for_all_out` default 10 (allowed 1–10 for non-standard formats, e.g. "last man stands" club rules, `INN-005.last_man_bats` — see §19 `RNO`).
- **INN-006** `[LAW]` The batting side **may change its batting order at any time**; batting position is recorded as the order in which batters actually came to the crease.
- **INN-007** `[PRD]` Each innings record MUST hold: batting side, bowling side, innings number (1..N), sequence within the match, allotted overs, overs bowled, total runs, wickets, extras breakdown, run rate, powerplay tallies, DLS data (if any), start/end timestamps, end reason.
- **INN-008** `[LAW]` **Innings total** = Σ (runs credited to each batter) + Σ (all extras: byes + leg-byes + wides + no-balls + penalty runs credited to this batting side). This identity MUST always hold (§34).
- **INN-009** `[CFG]` `innings_over_limit_per_innings` — some multi-day club formats cap the first innings; the system MUST support a per-innings cap independent of a whole-match over limit.
- **INN-010** `[LAW]` In a two-innings match the system MUST compute and display the **lead / deficit** after each completed innings and the **aggregate** scores.
- **INN-011** `[EDGE]` A team may **concede/forfeit an entire innings** before it starts (rare, e.g. to force a result in a timed match). Recorded as `ENDED(FORFEITED)` with 0 runs, 0 wickets, 0 overs.
- **INN-012** `[EDGE]` If overs are reduced (§29) after an innings has started, the allotted-overs value MUST be updated with a linked timeline event; deliveries already bowled are unaffected.
- **INN-013** `[EDGE]` "Innings ends mid-over" (all out, target reached, or time): the over is recorded as incomplete with the actual legal-ball count; the bowler's figures show a part-over (e.g. `3.4` overs).
- **INN-014** `[EDGE]` Target reached on a wide or no-ball (the penalty run is the winning run): innings ends immediately; the delivery is recorded but not re-bowled; result margin computed accordingly (§27, §28).
- **INN-015** `[EDGE]` Both a wicket and the innings' final legal ball coincide (10th wicket on the last scheduled ball): end reason is `ALL_OUT` (wickets precedence over overs-complete for record purposes).

---

## 7. Overs — `OVER`

- **OVER-001** `[LAW]` An over comprises **6 legal deliveries** `[CFG]` (`FMT-005`); wides and no-balls are not legal deliveries and MUST be re-bowled, so an over may contain more than 6 total deliveries.
- **OVER-002** `[LAW]` The **bowler changes ends** at the start of each over; consecutive overs are bowled from alternate ends.
- **OVER-003** `[LAW]` **No bowler may bowl two consecutive overs** in the same innings.
- **OVER-004** `[CFG]` Per-bowler over/ball cap enforced per `FMT-006`; the system MUST warn and block (with reasoned override) a delivery that would exceed it.
- **OVER-005** `[LAW]` An over is **completed by the bowler who started it** unless that bowler is incapacitated or suspended during the over, in which case another bowler (who did not bowl the preceding over and will not bowl the next over) completes it.
- **OVER-006** `[LAW]` If an over is left incomplete at an interval or end of innings, it is **completed after the interval** (or abandoned if the innings ends), by the same bowler where possible.
- **OVER-007** `[PRD]` An over record MUST hold: innings, over number, bowling end, bowler(s), ordered list of deliveries, runs in the over, wickets in the over, and whether it is a maiden.
- **OVER-008** `[LAW]` A **maiden over** is an over from which **no runs are scored off the bat and no wides or no-balls are conceded**. Byes and leg-byes do **not** prevent a maiden. A **wicket maiden** is a maiden in which at least one wicket falls.
- **OVER-009** `[PRD]` The system MUST track **balls remaining in the innings** and **balls remaining in the current over** at all times.
- **OVER-010** `[LAW]` The number of legal balls bowled in the innings determines "overs bowled" as `completed_overs + (legal_balls_in_current_over / balls_per_over)` displayed as `O.B` (e.g. `12.3`).
- **OVER-011** `[EDGE]` Bowler injured mid-over after bowling e.g. 3 legal balls: the replacement bowls the remaining balls; for the "no two consecutive overs" rule the **replacement is treated as having bowled that over** and MUST NOT bowl the next over; the original bowler is also barred from the next over.
- **OVER-012** `[EDGE]` A bowler is **suspended** mid-over (e.g. two dangerous beamers): the over is completed by another bowler; the suspended bowler takes no further part in the innings (`[CFG]` per offence type, §12); the record shows both bowlers against the over.
- **OVER-013** `[EDGE]` Over-count for a bowler removed mid-over: the part-over counts toward the bowler's cap as bowled balls (e.g. 3 balls = 0.3 of an over against a 4-over cap).
- **OVER-014** `[EDGE]` "Extra ball" situations (wide/no-ball) that push an over's delivery list long: the legal-ball counter, not the delivery count, ends the over. There is no upper bound on deliveries in an over.
- **OVER-015** `[EDGE]` The Hundred 10-ball block: one bowler bowls 10 consecutive legal balls; ends do not change mid-block; the block counts as two "overs" for scorecard aggregation but one change of ends.

---

## 8. Balls / Deliveries — `BALL`

- **BALL-001** `[PRD]` A **delivery** is the atomic scoring event. Every delivery record MUST hold: match, innings, over, delivery sequence within the over, striker, non-striker, bowler, fielding side, wicket-keeper, legality (`LEGAL` / `NO_BALL` / `WIDE`), whether it counts as a legal ball, whether it is a **free hit**, outcome (runs and their attribution), wicket (if any), fielders involved, umpire signals, review flag, timestamp, and scorer/device provenance.
- **BALL-002** `[LAW]` A delivery is **legal** unless it is called **no-ball** (§12) or **wide** (§13).
- **BALL-003** `[LAW]` A legal delivery, a bye and a leg-bye **count as one of the over's balls**; a no-ball and a wide **do not** and are re-bowled.
- **BALL-004** `[LAW]` The ball becomes **dead** when: it finally settles in the hands of the bowler or wicket-keeper; it reaches or crosses the boundary; a batter is dismissed; it lodges in a batter's or umpire's clothing/equipment; it lodges in the wicket-keeper's or a fielder's helmet; a penalty is incurred that ends the ball; the umpire calls "over" or "time"; or the umpire calls dead ball for an intervening cause (serious injury, unfair action, striker not ready, external interference, etc.).
- **BALL-005** `[LAW]` No runs (other than penalties already incurred) and no dismissals may occur after the ball is dead.
- **BALL-006** `[LAW]` **Dead ball on umpire's call**: the delivery does not count (unless it was itself a no-ball or wide, in which case that penalty stands and it is re-bowled). The system MUST record a `DEAD_BALL` delivery with reason and zero runs/wicket.
- **BALL-007** `[PRD]` The system MUST assign every delivery an immutable ordinal so the innings is strictly and totally ordered, with illegal deliveries interleaved without incrementing the legal-ball index.
- **BALL-008** `[PRD]` Optional per-delivery enrichment (all `[CFG]` on/off, all manual entry): shot type, shot direction/wagon-wheel coordinate, pitch map line & length, delivery speed, delivery type (e.g. yorker, bouncer, googly), foot movement. Absence MUST NOT affect any computed figure.
- **BALL-009** `[EDGE]` "Ball lodged in equipment" — the ball is dead; batters may not run; any runs attempted are disallowed; recorded as a dot (or the pre-lodge completed runs if any were legitimately completed before it lodged — umpire's call).
- **BALL-010** `[EDGE]` Bowler throws before delivery stride to run out the non-striker — handled under §19 `NSRO`, not as a normal delivery; if unsuccessful the ball is dead and re-bowled and MUST NOT appear in the legal-ball count.
- **BALL-011** `[EDGE]` Bowler breaks the **striker's** wicket during the delivery action (2022 Law update): called **no-ball** (§12), not dead ball.
- **BALL-012** `[EDGE]` Ball strikes a fielding-side helmet lying on the ground: 5 penalty runs to the batting side, ball becomes dead (§16).
- **BALL-013** `[EDGE]` A delivery on which nothing happens but the ball is not gathered and the batters decline to run — recorded as a dot; the ball becomes dead when it settles or the umpire calls over/time.

---

## 9. Runs & Boundaries — `RUN`

- **RUN-001** `[LAW]` Runs are scored when the two batters **cross and each makes good their ground** at the opposite end while the ball is in play.
- **RUN-002** `[LAW]` Runs off the bat (ball touched the bat or the glove holding the bat) are **credited to the striker** and to the team total.
- **RUN-003** `[LAW]` Runs not off the bat are **extras** (byes, leg-byes) or the penalty component of wides/no-balls (§11–§16) — credited to the team, not to any batter.
- **RUN-004** `[LAW]` A **boundary 4** is scored when the ball touches or crosses the boundary having been in contact with the ground within the field of play or after bouncing/rolling. A **boundary 6** is scored when the ball crosses the boundary on the full **from the bat**.
- **RUN-005** `[LAW]` A boundary supersedes runs physically run: the batting side receives the **greater of** the boundary allowance and the runs completed (plus the run in progress if crossed — see overthrows).
- **RUN-006** `[LAW]` **Boundary attribution**: 4 or 6 off the bat → to the striker as runs and as `4s`/`6s` count; 4 from byes → 4 byes; 4 from leg-byes → 4 leg-byes; boundary from a wide → 4 (+1) wides; boundary from a no-ball → no-ball penalty + 4 to the striker if off the bat, else 4 as no-ball extras `[PRD]/[CFG]` (`nb_wd_secondary_extras_itemised`).
- **RUN-007** `[LAW]` **Overthrows / wilful fielder act**: the batting side scores any boundary reached plus the runs completed **plus the run in progress only if the batters had already crossed at the instant the fielder threw or acted**. The system MUST let the scorer record "runs completed before the throw" and "crossed at instant of throw = yes/no".
- **RUN-008** `[LAW]` **Overthrow runs off the bat** are credited to the striker; overthrows on a bye/leg-bye extend the byes/leg-byes; overthrows on a wide extend the wides.
- **RUN-009** `[LAW]` **Short run**: if a batter fails to ground bat or person behind the popping crease when turning, that run is **short** and not scored. The umpire signals "short run". Multiple/both-batter short runs are each deducted.
- **RUN-010** `[LAW]` **Deliberate short run**: the umpire disallows all runs from that delivery except any boundary and any that were validly completed at the time of the deliberate act, warns the offenders, awards **5 penalty runs to the fielding side**, and (from the offending side) informs the batters which of them will face the next ball.
- **RUN-011** `[PRD]` The system MUST let the scorer enter runs run (0–n), byes (0–n), leg-byes (0–n), and short-run deductions independently, and MUST compute strike change (§10) from the **net counted** running total, not the attempted total.
- **RUN-012** `[LAW]` Runs credited on a delivery ending in a wicket: any runs **completed before** the dismissal count (as bat/bye/leg-bye as appropriate) **except** where the mode of dismissal disallows them (caught, bowled, LBW, stumped, hit wicket → no runs; run out / obstructing → completed runs before the incident count).
- **RUN-013** `[PRD]` **Run rate** = runs ÷ overs (overs as decimal of legal balls). **Required run rate** = runs still required ÷ overs remaining. **Projected score** = current run rate × total overs, plus a set of projections at configurable rates `[CFG]` `projection_rates`.
- **RUN-014** `[EDGE]` Batter run out going for a run **after** the ball had reached the boundary — impossible; the ball was dead at the boundary; the system MUST reject a run-out entry timestamped after a boundary on the same delivery.
- **RUN-015** `[EDGE]` "All-run four" (four runs physically completed, no boundary): recorded as 4 runs run (not a boundary; not counted as a `4`), strike change per odd/even (4 = even, no change).
- **RUN-016** `[EDGE]` Five runs run (rare, usually with an overthrow component): permitted; the system MUST NOT cap physically-run runs at 4.
- **RUN-017** `[EDGE]` Runs scored when the ball is simultaneously a no-ball and goes for a bye that is then overthrown to the boundary: no-ball penalty (1) + 4 (as byes off a no-ball, itemisation per `[CFG]`); ball re-bowled.
- **RUN-018** `[EDGE]` "One short" that changes the winning moment: if disallowing a short run means the target is not actually reached, the innings/match MUST re-open from `COMPLETE_PENDING_SIGNOFF` (§5, §33).

---

## 10. Strike Rotation & End Changes — `STRK`

- **STRK-001** `[LAW]` The batters **change ends** whenever an **odd number of runs is run** (runs off the bat, byes, or leg-byes that are counted; boundaries do not cause a physical change beyond what was run).
- **STRK-002** `[LAW]` At the **end of an over** the batters do not move, but because bowling switches ends, **the batter who was non-striker becomes the striker** for the next over — net effect: strike changes at the end of every over **unless** an odd number of runs was run off the last delivery of the over (which flips it back).
- **STRK-003** `[LAW]` A **boundary 4 or 6** does not change the striker (0 net crossings) unless combined with an odd number of completed runs before an overthrow boundary.
- **STRK-004** `[LAW]` **2 runs / 4 runs run / 6 runs run** (even) → no strike change (within the over). **1 / 3 / 5 runs** (odd) → strike change.
- **STRK-005** `[LAW]` On a **wide**: any runs run are wides; if the number run (byes-equivalent on the wide) is odd, the batters have changed ends → strike changes; the delivery is re-bowled with the new striker facing.
- **STRK-006** `[LAW]` On a **no-ball**: strike change follows the **odd/even count of runs actually run** (bat runs + byes/leg-byes off the no-ball); the delivery is re-bowled with whoever is now the striker.
- **STRK-007** `[LAW]` **After a caught dismissal**: if the batters **had crossed** at the instant the catch was completed, the **not-out batter is at the striker's end**; if they had **not crossed**, the not-out batter is at the non-striker's end. The **new batter takes the vacant end**. Then apply end-of-over (`STRK-002`) if the catch was the last ball of the over.
- **STRK-008** `[LAW]` **After a run out**: the **not-out batter is credited with the end they had reached and made good**; the incoming batter takes the other end. The run in progress does not count. Then apply end-of-over if applicable.
- **STRK-009** `[LAW]` **After bowled / LBW / stumped / hit wicket** (no runs): the incoming batter is the striker, unless it was the last ball of the over, in which case the incoming batter is the non-striker and the existing not-out batter is on strike.
- **STRK-010** `[PRD]` The system MUST compute the striker for every delivery automatically from the prior delivery's outcome, and MUST surface the current striker/non-striker prominently at all times (discovery `FR-065`).
- **STRK-011** `[PRD]` The scorer MUST be able to **override** the computed striker for the next delivery (with the change logged), to handle situations the umpires resolved on the field that the model did not capture.
- **STRK-012** `[EDGE]` **Wicket on the last ball of the over, batters crossed**: e.g. caught with a crossed run — new batter ends up **on strike** for the next over (crossed → not-out batter at striker's end → end-of-over swap → new batter on strike). The system MUST resolve this two-step logic and show the result for confirmation.
- **STRK-013** `[EDGE]` **Run out on the last ball of the over**: not-out batter at the end reached; end-of-over swap then applies to determine who faces next over.
- **STRK-014** `[EDGE]` **Retired hurt mid-over**: the incoming batter takes the retiring batter's end and role (striker or non-striker) as it was at that moment.
- **STRK-015** `[EDGE]` **Odd runs + overthrow boundary**: batters ran 1 (crossed once), then overthrow to boundary → +4; total 5 to the striker; net physical crossings = 1 (odd) → strike changes. The system MUST derive strike from crossings, not from the run total's parity alone in this combined case.
- **STRK-016** `[EDGE]` **New batter at wrong end** (batters/umpires put the incoming batter at the end not indicated by the model): scorer override (`STRK-011`) with a note; subsequent deliveries follow the corrected state.
- **STRK-017** `[EDGE]` **Free hit** delivery that is a no-ball or wide: strike handling per `STRK-005/006`; free-hit status is retained for the next legal delivery regardless of strike change (§17).

---

## 11. Extras — General — `EXT`

- **EXT-001** `[LAW]` **Extras** are runs not credited to a batter: **byes (b)**, **leg-byes (lb)**, **wides (w)**, **no-balls (nb)**, **penalty runs (pen)**.
- **EXT-002** `[LAW]` Wides and no-balls are debited to the **bowler**'s analysis; byes and leg-byes are **not** debited to the bowler; penalty runs are debited to neither bowler nor batter.
- **EXT-003** `[PRD]` The scorecard MUST show extras itemised (`b`, `lb`, `w`, `nb`, `pen`) and as a single **Extras** total.
- **EXT-004** `[LAW]` Byes and leg-byes count as a legal ball faced; wides and no-balls do not count as legal balls (the delivery is re-bowled) but a **no-ball counts as a ball faced by the striker** for the striker's balls-faced tally `[CFG]` `no_ball_counts_as_ball_faced` (default true per common convention); a **wide is not a ball faced**.
- **EXT-005** `[CFG]` `nb_wd_secondary_extras_itemised` — when runs are run on a no-ball/wide that are not off the bat: default `false` = record them as no-ball/wide extras (a single lump); `true` = itemise the running component as byes/leg-byes while keeping the no-ball/wide penalty separate. Default `false` matches ICC/CA scoring convention. **(Open clarification — see §35.)**
- **EXT-006** `[LAW]` **Penalty runs (5)** are awarded to a side for specified infringements by the other side (§16); they are added to that side's innings total and to that side's Extras; if the receiving side is not currently batting, the runs are added to their most recent or next innings as applicable.
- **EXT-007** `[PRD]` The system MUST maintain a running Extras breakdown per innings and MUST guarantee `Extras_total = b + lb + w + nb + pen` at all times.
- **EXT-008** `[EDGE]` Byes/leg-byes scored as a boundary: recorded as 4 byes / 4 leg-byes; not a batter `4`.
- **EXT-009** `[EDGE]` A delivery that is both a no-ball and would have been a wide: it is a **no-ball** (no-ball takes precedence); never both.

---

## 12. No-ball — `NB`

- **NB-001** `[LAW]` A no-ball incurs a **1-run penalty** `[CFG]` `no_ball_penalty_runs` (default 1; some competitions use 2, e.g. The Hundred) added to the team total and the bowler's analysis; the delivery does not count as one of the over's balls and is **re-bowled**.
- **NB-002** `[LAW]` **Bowling-action no-balls**: (a) **front-foot** — no part of the front foot, whether grounded or raised, is behind the popping crease at the moment of delivery; (b) **back-foot** — the back foot is not within and behind the return crease; (c) **throw** — the ball is not bowled (elbow straightening beyond the permitted 15°); (d) the ball **bounces more than once**, rolls along the ground, or comes to rest before reaching the popping crease; (e) the ball **lands wholly off the pitch**; (f) **underarm** bowling (unless agreed beforehand); (g) mode of delivery (over/round the wicket, right/left arm) not notified.
- **NB-003** `[LAW]` **Dangerous / unfair no-balls**: (a) a **non-pitching delivery** (full toss) passing or that would have passed **above waist height** of the striker standing upright at the crease (a "beamer"); (b) a **bouncer above shoulder height** in excess of the permitted number per over; (c) **exceeding the permitted number of bouncers** per over `[CFG]` `bouncers_per_over` (default: Test 2, ODI 2, T20I per current PC); (d) deliberate high full toss (also leads to warnings/suspension).
- **NB-004** `[LAW]` **Fielding no-balls**: (a) **more than two fielders behind square on the leg side**; (b) a fielder (other than the wicket-keeper) **encroaching on the pitch** before the ball reaches the striker; (c) the **wicket-keeper not wholly behind the stumps** at the moment of delivery (until the ball touches bat/person or passes the stumps); (d) **illegal fielding** (§16) on the delivery; (e) a fielder **significantly moving** laterally after the ball comes into play (unfair) — umpire may call dead ball or no-ball per Law.
- **NB-005** `[LAW]` **2022 update**: if the **bowler breaks the striker's wicket** during the act of delivery, it is a no-ball.
- **NB-006** `[LAW]` On a no-ball the **striker may be dismissed only by**: run out, obstructing the field, hit the ball twice. The striker MUST NOT be recorded as bowled, caught, LBW, stumped, or hit wicket off a no-ball.
- **NB-007** `[LAW]` Runs off the bat on a no-ball are credited to the **striker** (and to `4s`/`6s` if a boundary); the no-ball penalty is separate.
- **NB-008** `[LAW]` Byes/leg-byes may be run on a no-ball; recorded per `EXT-005`.
- **NB-009** `[CFG]` `free_hit_enabled` and `free_hit_trigger` — whether a no-ball triggers a **free hit** (§17) and for which no-ball types (`ALL` for white-ball internationals; `FOOT_FAULT_ONLY` for legacy; `NONE` for red-ball).
- **NB-010** `[PRD]` A no-ball record MUST capture the **no-ball reason** (from `NB-002/003/004/005`) for the scorecard notes and analytics.
- **NB-011** `[LAW]` A no-ball called for a fielding-restriction breach (powerplay, §23) is still a no-ball with all normal no-ball consequences.
- **NB-012** `[EDGE]` No-ball + run out of the striker: 1 (penalty) + any completed runs; wicket = run out; bowler not credited; a delivery on which a wicket falls is not re-bowled even if a no-ball; the over's legal-ball count is still not incremented; the next delivery is the "extra" ball for the no-ball.
- **NB-013** `[EDGE]` No-ball + striker bowled/caught: **not out** (`NB-006`); if bowled, the ball is not dead by the stumps being hit for dismissal purposes — runs may still be scored (it behaves as a live ball for running); record any runs, no wicket.
- **NB-014** `[EDGE]` No-ball where the ball is called for height (beamer) and the striker hits it for 6: the 6 stands (to the striker) plus the no-ball penalty; the bowler also receives an official warning (recorded as a timeline note, `NB-003`).
- **NB-015** `[EDGE]` Consecutive no-balls (e.g. 3 in a row): each re-bowled, each 1-run penalty, free-hit status (if enabled) persists until a legal delivery is bowled.
- **NB-016** `[EDGE]` `no_ball_penalty_runs = 2` profile: all "1" references above become "2"; strike/running logic unchanged.

---

## 13. Wide — `WD`

- **WD-001** `[LAW]` A wide is called when the ball passes **wide of the striker** and out of reach of the striker standing in a normal guard position, and is not touched by the bat or person; a ball passing **down the leg side** where the striker cannot hit it is a wide.
- **WD-002** `[LAW]` A wide incurs a **1-run penalty** `[CFG]` `wide_penalty_runs` (default 1) plus any runs run or boundary, **all recorded as wides** and debited to the bowler; the delivery does not count as one of the over's balls and is **re-bowled**.
- **WD-003** `[LAW]` A delivery is **not** a wide if the striker moves and brings the ball within reach, or makes contact with it, or (for a high delivery) it passes within reach.
- **WD-004** `[CFG]` `wide_interpretation` — `LAWS_STANDARD` (umpire judgement per Law 22) or `STRICT_WHITE_BALL` (limited-overs guideline: any off-side delivery passing outside the marked wide guideline that the striker does not hit, and stricter leg-side calling). Default `STRICT_WHITE_BALL` for `ODI/T20I`, `LAWS_STANDARD` for `TEST/CLUB_LO`.
- **WD-005** `[CFG]` `wide_from_leg_side_off_pads` — under strict white-ball conditions, a ball passing down the leg side without contact is called wide even if close to the body; recorded per profile.
- **WD-006** `[LAW]` Off a wide the striker may be dismissed only by: **run out, stumped, hit wicket, obstructing the field**. The striker MUST NOT be recorded as bowled, caught, LBW, hit the ball twice, or timed out off a wide.
- **WD-007** `[LAW]` A **stumping off a wide is valid** (unlike off a no-ball).
- **WD-008** `[LAW]` A wide is **not a ball faced** by the striker (balls-faced tally unaffected).
- **WD-009** `[LAW]` Byes cannot be scored on a wide; any runs run become additional wides; a boundary becomes 4 (+ the 1 penalty) wides.
- **WD-010** `[EDGE]` Wide + stumping: 1 wide + wicket (stumped); the wide penalty still counts against the bowler; the delivery is not re-bowled (wicket fell); the over's legal-ball count is not incremented; an extra ball is bowled.
- **WD-011** `[EDGE]` Wide + run out: 1 wide + any completed runs as wides + wicket (run out); not re-bowled; extra ball follows.
- **WD-012** `[EDGE]` Wide called, then the keeper misfields and the batters run 3: 1 + 3 = 4 wides; if 3 physically run (odd) the strike changes; delivery re-bowled to the new striker.
- **WD-013** `[EDGE]` Wide that goes to the boundary: 5 wides total (`wide_penalty_runs` + 4).
- **WD-014** `[EDGE]` "Wide" on a free hit: the free hit is retained; the wide is scored normally; re-bowled.

---

## 14. Bye — `BYE`

- **BYE-001** `[LAW]` A bye is scored when a **legal delivery** passes the striker **without touching the bat or the striker's person** and the batters run (or it reaches the boundary).
- **BYE-002** `[LAW]` Byes are credited to the **team** as extras, **not** to the striker and **not** debited to the bowler.
- **BYE-003** `[LAW]` A bye delivery **counts as a legal ball** and as a **ball faced** by the striker.
- **BYE-004** `[LAW]` Odd byes run → strike change (§10).
- **BYE-005** `[LAW]` A boundary from byes = **4 byes**.
- **BYE-006** `[EDGE]` Byes off a no-ball: recorded per `EXT-005` (default: as no-ball extras; `[CFG]` to itemise).
- **BYE-007** `[EDGE]` The wicket-keeper takes the bails off attempting a stumping and misses; the ball runs away and the batters take 2 → 2 byes; if the striker was out of the crease the keeper could instead have effected a stumping — the scorer records what actually happened (2 byes, no wicket).
- **BYE-008** `[EDGE]` "Byes" where the ball actually flicked the pad first — that is **leg-byes**, not byes; the scorer MUST be able to reclassify before confirming (and via amendment after).

---

## 15. Leg-bye — `LB`

- **LB-001** `[LAW]` A leg-bye is scored when a legal delivery strikes the **striker's person (not the bat, not a hand not holding the bat)** and the striker **either attempted to play the ball with the bat or attempted to avoid being hit**, and runs are then run or the ball reaches the boundary.
- **LB-002** `[LAW]` If the striker made **no attempt to play the ball and no attempt to avoid it**, leg-byes are **not allowed**: the umpire calls and signals **dead ball** as soon as one run is completed or the ball reaches the boundary or it is clear no run will be attempted; **no runs are scored** (the ball counts as a legal ball).
- **LB-003** `[LAW]` Leg-byes are credited to the **team** as extras, not to the striker, not to the bowler.
- **LB-004** `[LAW]` A leg-bye delivery **counts as a legal ball** and as a **ball faced** by the striker.
- **LB-005** `[LAW]` Odd leg-byes run → strike change (§10).
- **LB-006** `[LAW]` A boundary from leg-byes = **4 leg-byes**.
- **LB-007** `[PRD]` The system MUST require the scorer to affirm "shot offered or evasion attempted = yes" when entering leg-byes; if "no", the outcome is a dead-ball dot (`LB-002`).
- **LB-008** `[EDGE]` Ball hits the glove that is **not** holding the bat, then runs are taken: treated as hitting the person → leg-byes if a shot/evasion was attempted (a hand holding the bat counts as the bat, so that would be runs off the bat).
- **LB-009** `[EDGE]` Leg-byes off a no-ball: per `EXT-005`.
- **LB-010** `[EDGE]` LBW appeal declined and the batters run leg-byes on the same delivery: leg-byes stand (shot/evasion attempted); if the LBW is later given on review, the leg-byes are removed and the wicket recorded (§24).

---

## 16. Penalty Runs — `PEN`

- **PEN-001** `[LAW]` **5 penalty runs to the batting side** for, inter alia: the ball striking a fielder's **helmet lying on the ground** or **protective equipment left on the field** by the fielding side; **illegal fielding** (a fielder intentionally fielding the ball other than with the person — e.g. with a cap, helmet held in hand, or a thrown item); **fake fielding** (a fielder wilfully attempting to deceive the striker/runners by a sham fielding action); **deliberate distraction/obstruction** of the striker; **damaging the pitch** by the fielding side; **time-wasting by the fielding side (second and subsequent offences)**; **ball tampering**.
- **PEN-002** `[LAW]` **5 penalty runs to the fielding side** for, inter alia: a batter **deliberately running a short run**; a batter **damaging the pitch** (after a warning); **time-wasting by the batting side**; the striker taking guard/position in a manner causing delay (after warning); a batter's **deliberate distraction/obstruction** of the fielding side (may instead be "obstructing the field", §19).
- **PEN-003** `[LAW]` Penalty runs to the batting side are added to the **team total and Extras** and are **not** credited to any batter; the ball is dead when illegal fielding occurs, and the batting side also receives any runs completed plus the umpires' assessment of runs that would have been completed.
- **PEN-004** `[LAW]` Penalty runs to the **fielding side** are added to that side's score. If the fielding side has already completed its innings(s) (e.g. 4th innings of a Test), these runs are added to their total and **may determine the result**.
- **PEN-005** `[PRD]` A penalty-runs event MUST record: amount (default 5) `[CFG]` `penalty_run_amount`, receiving side, reason code, over/ball context (or "between deliveries"), instructing umpire.
- **PEN-006** `[CFG]` **Over-rate penalties**: `over_rate_penalty_model` — `NONE`, `T20I_INFIELD` (a fielder must come inside the circle for the remaining overs if the side is behind the required over rate at a checkpoint), `WTC_POINTS` (World Test Championship points deduction, recorded but applied at competition level), `RUNS_PENALTY` (5-run penalties per over short — legacy). The system MUST record the penalty and, where it awards runs, add them per `PEN-003/004`.
- **PEN-007** `[LAW]` The ball striking a **helmet being worn by a fielder** carries **no penalty** (it is a legal position); if the ball then lodges in the worn helmet's grille, the ball is dead and no catch is valid from that lodging.
- **PEN-008** `[EDGE]` Illegal fielding that also saves a boundary: the batting side gets 5 penalty runs **plus** the runs the umpires judge would have been scored (often the 4 that was being saved), i.e. potentially 9.
- **PEN-009** `[EDGE]` Penalty runs awarded on the **last ball** that take the batting side past its target: match won by the penalty; result margin computed from the post-penalty total.
- **PEN-010** `[EDGE]` Multiple simultaneous penalties (e.g. illegal fielding + fielder's helmet on ground): umpires award per Law; the system MUST allow more than one penalty event on a delivery.
- **PEN-011** `[EDGE]` Penalty to the fielding side in the **first innings** — added to their (future) first batting innings total, shown on the scorecard as a pre-existing Extras entry when that innings begins.

---

## 17. Free Hit — `FH`

- **FH-001** `[CFG]` `free_hit_enabled` (default true for `ODI/T20I/HUNDRED`, false for `TEST/FIRST_CLASS`).
- **FH-002** `[CFG]` `free_hit_trigger` — `ALL_NO_BALLS` (default white-ball) or `FOOT_FAULT_ONLY` (legacy).
- **FH-003** `[LAW/PC]` The delivery **immediately following** a free-hit-triggering no-ball is a **free hit**: the striker **cannot be dismissed** except by **run out, obstructing the field, or hit the ball twice** (i.e. the same set as off a no-ball), even if the free-hit delivery is itself legal.
- **FH-004** `[PC]` If the free-hit delivery is itself a **no-ball or wide**, the free hit is **retained** for the next delivery.
- **FH-005** `[PC]` `free_hit_retained_on_strike_change` `[CFG]` (default true under current ICC PC): the free hit stands even if the strike changed off the triggering no-ball.
- **FH-006** `[PC]` The **field may not be changed** for a free hit unless the **striker has changed**, or the number of overs/rules otherwise require it.
- **FH-007** `[PRD]` Every delivery record carries `is_free_hit: bool`; the scorecard/commentary MUST mark free-hit deliveries; the system MUST auto-set and auto-clear the flag.
- **FH-008** `[EDGE]` Striker "bowled" on a free hit: **not out**; the ball is live; runs may be run; if it deflects to the boundary, 4 to the striker (off the bat); record no wicket.
- **FH-009** `[EDGE]` Striker "caught" on a free hit: **not out**; the batters may run; whatever runs they complete before the ball is returned/settled count to the striker (it behaves like a no-ball delivery for running).
- **FH-010** `[EDGE]` Striker **stumped** on a free hit: not out (stumped not in the permitted set); but a **run out** at the striker's end (keeper breaks the wicket while the striker is out of the ground **attempting a run**) **is** valid — the scorer MUST distinguish "left crease attempting a run" (run out, valid) from "overbalanced, no run attempted" (not out).
- **FH-011** `[EDGE]` Free-hit no-ball again → `no_ball_penalty_runs` again, free hit retained; can chain indefinitely.
- **FH-012** `[EDGE]` `free_hit_enabled = false` but the profile still calls no-balls: no free-hit flag is ever set; §12 dismissal restrictions on the no-ball delivery itself still apply, but the **next** delivery is fully normal.

---

## 18. Wickets — General — `WKT`

- **WKT-001** `[LAW]` A "wicket" (dismissal) removes a batter from the innings; the count of wickets is `dismissals` (not including `retired – not out`).
- **WKT-002** `[LAW]` **Modes of dismissal**: bowled, caught, LBW, run out, stumped, hit wicket, hit the ball twice, obstructing the field, timed out, **retired out**. (`Retired – not out` / `retired hurt` and `absent` are **not** dismissals.)
- **WKT-003** `[LAW]` **Bowler credited** with the wicket for: **bowled, caught, LBW, stumped, hit wicket**. **Not credited** for: run out, obstructing the field, hit the ball twice, timed out, retired out.
- **WKT-004** `[LAW]` A dismissal requires an **appeal** by the fielding side ("How's That?") before the bowler begins the run-up for the next delivery, or before "Time" if it is the last delivery of an over/session — **except** the batter may leave without an appeal ("walk"). Timed out also requires an appeal.
- **WKT-005** `[LAW]` **Only one batter may be dismissed per delivery.**
- **WKT-006** `[LAW]` **Precedence** where more than one mode could apply on a delivery: **Bowled** takes precedence over all other modes; otherwise the mode that occurred first in time is the dismissal; **run out** takes precedence over **stumped** if the striker was attempting a run.
- **WKT-007** `[PRD]` A wicket record MUST hold: dismissed batter, mode, bowler (nullable), fielder(s) (ordered; catcher / thrower / wicket-breaker as applicable), whether off the bat, whether it counts as a ball faced, team score at fall, wicket number, over.ball, partnership runs & balls, not-out batter's score at fall, and any runs completed on the delivery before the dismissal.
- **WKT-008** `[LAW]` A dismissal is valid only while the **ball is in play** (exception: non-striker run out before delivery, §19 `NSRO`).
- **WKT-009** `[LAW]` **Dismissal validity by delivery legality**:

  | Mode | Off **no-ball** | Off **wide** | Off **free hit** |
  |---|---|---|---|
  | Bowled | No | No | No |
  | Caught | No | No | No |
  | LBW | No | No | No |
  | Stumped | No | Yes | No |
  | Hit wicket | No | Yes | No |
  | Run out | Yes | Yes | Yes |
  | Obstructing the field | Yes | Yes | Yes |
  | Hit the ball twice | Yes | No (no bat contact on a wide) | Yes |
  | Timed out | n/a (between deliveries) | n/a | n/a |

- **WKT-010** `[LAW]` **Runs and the dismissal delivery**: bowled/caught/LBW/stumped/hit wicket → no runs scored from that delivery (any physically run are void); run out/obstructing → runs completed before the incident count; wide/no-ball penalties on a dismissal delivery still stand.
- **WKT-011** `[LAW]` A dismissal delivery, even if a no-ball or wide, is **not re-bowled**; the over's legal-ball count is not incremented for a no-ball/wide dismissal delivery, so an extra ball is still owed.
- **WKT-012** `[PRD]` The system MUST compute the incoming batter's end and strike (§10) and MUST present it for scorer confirmation on every wicket.
- **WKT-013** `[EDGE]` Appeal made **after** the bowler started the next run-up / after "Time": too late; the umpires may decline to consider it; the system MUST allow "appeal disallowed — untimely" as a non-event.
- **WKT-014** `[EDGE]` Two batters run out on the same delivery (both short) — **not permitted**: only the first is out (`WKT-005`); the umpires decide which; the other is not out with the ball dead.
- **WKT-015** `[EDGE]` A batter given out then reinstated (umpire error corrected, or successful review): the wicket event is voided via amendment (§33), all downstream deliveries re-evaluated for striker correctness, and the scorer alerted to any cascade.

---

## 19. Dismissal Modes — detailed

### 19.1 Bowled — `BWLD`
- **BWLD-001** `[LAW]` The striker is out **bowled** if their wicket is put down by a ball delivered by the bowler, even if it first touched the bat or the striker's person — **but not** if it was touched by another player first.
- **BWLD-002** `[LAW]` **Bowled has absolute precedence** over all other modes.
- **BWLD-003** `[LAW]` Not valid off a no-ball, wide, or free hit (`WKT-009`).
- **BWLD-004** `[LAW]` Bowler credited; no runs; counts as a ball faced.
- **BWLD-005** `[PRD]` Dismissal string: `b <bowler>`.
- **BWLD-006** `[EDGE]` "Played on" / "chopped on" — off the bat onto the stumps: still **bowled** (`b <bowler>`), not caught.
- **BWLD-007** `[EDGE]` The bails are dislodged but the umpire judges the wicket was not fully put down (e.g. a bail lifted and returned): not out; scorer records per umpire.
- **BWLD-008** `[EDGE]` Wind / the striker's own action returns a bail before the ball arrives, so the "wicket is broken" already — per Law 29, the fielding side must remove a stump or the umpire adjudges; typically not bowled. Scorer records per the umpire's decision.

### 19.2 Caught (incl. caught & bowled) — `CAUT`
- **CAUT-001** `[LAW]` The striker is out **caught** if a ball touching the bat (or glove holding the bat) is **held by a fielder before it touches the ground**, within the field of play, with the fielder having **complete control over the ball and their own movement**.
- **CAUT-002** `[LAW]` **Boundary catch**: the fielder's first contact with the ball must be with some part of their person **grounded inside the boundary**, or their last contact before that airborne, having taken off from inside; a fielder who is airborne after last contact from **inside** may complete the catch outside. If any contact is with the ground/object **outside** the boundary, it is a **six**.
- **CAUT-003** `[LAW]` Not valid off a no-ball, wide, or free hit (`WKT-009`).
- **CAUT-004** `[LAW]` Bowler credited; **no runs** are scored (any runs run are void); counts as a ball faced.
- **CAUT-005** `[LAW]` **Incoming batter's end**: determined by whether the batters had **crossed at the instant the catch was completed** (`STRK-007`).
- **CAUT-006** `[PRD]` Dismissal strings: `c <fielder> b <bowler>`; wicket-keeper catch: `c †<keeper> b <bowler>`; caught and bowled: `c & b <bowler>` (or `c and b <bowler>`); substitute fielder: `c (sub) [<name>] b <bowler>`.
- **CAUT-007** `[LAW]` **Caught takes precedence over stumped, run out, LBW, hit wicket** if the catch was completed first; it does **not** take precedence over **bowled**.
- **CAUT-008** `[EDGE]` Catch off the **helmet worn by a fielder** then held before touching the ground: **valid catch** (deflection off a worn helmet is allowed), provided control is established.
- **CAUT-009** `[EDGE]` Ball lodges in the wicket-keeper's or a fielder's **helmet grille / pads / clothing**: **not a catch**; ball is dead; no runs; 5 penalty runs only if it was a fielder's helmet on the ground (`PEN-001`), not if worn.
- **CAUT-010** `[EDGE]` "Bump ball" (hit into the ground first): not out; scorer records per umpire.
- **CAUT-011** `[EDGE]` Relay/juggled catch across the boundary rope between two fielders: valid only if every contact chain satisfies `CAUT-002`; otherwise six.
- **CAUT-012** `[EDGE]` Catch taken off a **free-hit** delivery: not out (`FH-009`); batters may run.
- **CAUT-013** `[EDGE]` Batters had run 2 and were mid-third-run when a skier is caught: **no runs**, batter out caught, incoming batter's end per crossed-at-instant-of-catch.

### 19.3 LBW (Leg Before Wicket) — `LBW`
- **LBW-001** `[LAW]` The striker is out **LBW** if **all** hold: (a) the delivery is **not a no-ball**; (b) the ball **pitches in line** between wicket and wicket **or on the off side** (NOT outside leg stump); (c) the ball **strikes the striker** (not the bat first; a hand not holding the bat counts as the person) **in line between wicket and wicket** — or outside the line of the off stump **if the striker made no genuine attempt to play the ball with the bat**; (d) the ball **would have hit the wicket**.
- **LBW-002** `[LAW]` If the ball first touches the bat (or glove holding the bat) before the person, the striker **cannot** be out LBW.
- **LBW-003** `[LAW]` Bowler credited; no runs; counts as a ball faced. Dismissal string: `lbw b <bowler>`.
- **LBW-004** `[PC]` Where DRS applies, "**umpire's call**" on ball-tracking marginal outputs means the **on-field decision stands**; for the scoring record **only the final decision matters** (§24).
- **LBW-005** `[EDGE]` LBW given, batters had run leg-byes: leg-byes removed, wicket recorded (`LB-010`).
- **LBW-006** `[EDGE]` "No genuine shot" LBW where impact is outside off: valid; the scorer records `impact_outside_off = true, shot_offered = false` for the notes.
- **LBW-007** `[EDGE]` LBW overturned to "not out" on review with the ball having deflected to the boundary before being called dead — runs stand as leg-byes/byes per what actually happened (usually the umpire had signalled out and called dead ball, so 0).

### 19.4 Stumped — `STMP`
- **STMP-001** `[LAW]` The striker is out **stumped** if, **not attempting a run**, they are **out of their ground** and the **wicket-keeper** puts down the wicket **with the ball** (or the ball rebounding from the keeper's person, or the keeper's glove with ball in it) **without the intervention of another fielder**, off a **legal delivery or a wide** (not a no-ball, not a free hit).
- **STMP-002** `[LAW]` If the striker was **attempting a run**, or another fielder intervened, it is **run out**, not stumped.
- **STMP-003** `[LAW]` Bowler credited; no runs; counts as a ball faced (or, off a wide, the wide penalty applies and it is not a ball faced). Dismissal string: `st †<keeper> b <bowler>`.
- **STMP-004** `[EDGE]` Keeper knocks off the bails with gloves, ball held separately in the other glove, then touches stumps with the ball-holding glove: valid if the wicket was fairly put down with the ball/ball-in-glove per Law 29; scorer records per umpire.
- **STMP-005** `[EDGE]` Stumping off a wide (`WD-007`): 1 wide + wicket; not re-bowled; extra ball owed.
- **STMP-006** `[EDGE]` Striker momentarily grounds the bat behind the crease, lifts it while dragging, keeper breaks wicket: **out** if no part of bat/person was grounded behind the line at the moment the wicket was broken (third-umpire frame check where DRS applies).
- **STMP-007** `[EDGE]` "Stumped" recorded but replay shows the striker had set off for a run → amend to **run out** (bowler loses the wicket credit); cascade check on strike (§33).

### 19.5 Run Out — `RNO`
- **RNO-001** `[LAW]` A batter is out **run out** if, **while the ball is in play**, they are **out of their ground** and their wicket is fairly put down by the action of a fielder (including the bowler and wicket-keeper).
- **RNO-002** `[LAW]` **Which batter is out**: the batter is out **at whichever end the wicket is put down** if they are the batter associated with that end at that moment — specifically, **if the batters have crossed**, the batter **running toward** the broken wicket is out; **if they have not crossed**, the batter **running from** the broken wicket is out.
- **RNO-003** `[LAW]` **Runs on the delivery**: any runs **completed before** the moment of the run out are scored (to the striker if off the bat, else as byes/leg-byes/extras); the **run in progress is not scored**; the batters do not benefit from the run they were attempting.
- **RNO-004** `[LAW]` Valid off **any** delivery: legal, no-ball, wide, free hit. **No bowler credit.**
- **RNO-005** `[PRD]` Dismissal string: `run out (<fielder>)` or `run out (<thrower>/<wicket-breaker>)`; if the keeper broke the wicket from a throw: `run out (<thrower>/†<keeper>)`.
- **RNO-006** `[LAW]` If **no fielder touched the ball** and it is put onto the stumps directly from the bat/person and a batter is out of the ground — per Law 38: still a run out (the ball must have been in play; e.g. deflection off the non-striker or bowler).
- **RNO-007** `[LAW]` A batter is **not** run out if the ball has not been touched by a fielder since the bowler delivered it **and** the batter is within the ground when the wicket is broken; nor if the ball is dead.
- **RNO-008** `[CFG]` `last_man_stands` (default false) — club rule allowing the last batter to bat on alone; when true, a run out of "the last man" ends the innings and the not-out partner is credited not out; strike/running rules per the local variant.
- **RNO-009** `[EDGE]` **Striker run out off the last ball of the over**: not-out (non-dismissed) batter is at the end they made good; then end-of-over strike swap (§10) determines who faces next over.
- **RNO-010** `[EDGE]` **Run out on a bye/leg-bye**: completed byes/leg-byes before the run out count; wicket = run out; not off the bat.
- **RNO-011** `[EDGE]` **Run out going for the winning run**, run not completed: the run does not count → target **not** reached → innings continues (`RUN-018`, `STATE-006`).
- **RNO-012** `[EDGE]` **Both batters at the same end**, wicket broken: the batter **not** entitled to that end (the one who has not made good the ground) is out; the umpires determine entitlement; scorer records per umpires.
- **RNO-013** `[EDGE]` Wicket broken at the bowler's end by the bowler in the follow-through with the ball in hand while the non-striker is out — valid run out (see also `NSRO`, which is specifically *before* delivery).
- **RNO-014** `[EDGE]` Deflection off the bowler onto the stumps with the non-striker backing up out of the crease: run out, no bowler credit; the ball was in play.

### 19.6 Non-striker Run Out ("Mankad") — `NSRO`
- **NSRO-001** `[LAW]` (2022 update — Law 38.3) The **non-striker is liable to be run out** from the moment the ball comes into play until **the instant the bowler would normally be expected to release the ball**. This is a **fair run out**, not unfair play.
- **NSRO-002** `[LAW]` If the bowler, in the delivery stride or before completing the action, **does not** attempt the run out, the ball remains in play normally.
- **NSRO-003** `[LAW]` If the attempt is **unsuccessful** (non-striker regains the ground, or the bowler misses), the umpire calls **dead ball**; **no runs**; the delivery **does not count** and is **re-bowled**.
- **NSRO-004** `[LAW]` If **successful**: **run out**, no bowler credit; the ball does not count and the over's legal-ball count is not incremented; the incoming batter comes in at the non-striker's end.
- **NSRO-005** `[PRD]` Dismissal string: `run out (<bowler>)` with a `non_striker_before_delivery = true` flag for commentary/notes.
- **NSRO-006** `[CFG]` `mankad_enabled` (default true — it is in the Laws). MAY be disabled only for a competition that has explicitly outlawed it via its own conditions.
- **NSRO-007** `[EDGE]` The non-striker leaves early, the bowler completes the delivery instead (no attempt) and the striker hits a boundary — all normal; no NSRO event; runs stand.
- **NSRO-008** `[EDGE]` Attempt made after the bowler's arm has passed the release point: umpire calls the delivery a **dead ball** and **not out** (the window had closed); re-bowled.
- **NSRO-009** `[EDGE]` NSRO effected on what would also have been a no-ball for another reason: the run out stands (`RNO-004`); no-ball penalty is not added because the ball is dead and does not count; re-bowled.

### 19.7 Hit Wicket — `HITW`
- **HITW-001** `[LAW]` The striker is out **hit wicket** if, **while the ball is in play**, they put down their own wicket with the **bat, person, clothing, or equipment**: (a) in the act of **receiving the ball**, (b) in the act of **playing or attempting to play the ball**, or (c) in **setting off for the first run** immediately after playing the ball.
- **HITW-002** `[LAW]` Not valid off a **no-ball** or **free hit**; **is** valid off a **wide**.
- **HITW-003** `[LAW]` Bowler credited; no runs; counts as a ball faced. Dismissal string: `hit wicket b <bowler>`.
- **HITW-004** `[LAW]` **Not** out hit wicket if the wicket is broken: while the striker is **running** (after the first step off) or **avoiding a run out / a throw**, or by a **dislodged bail settling then being blown off**, or in **avoiding a fast, high delivery** — umpire's judgement; scorer records per umpire.
- **HITW-005** `[EDGE]` Cap/helmet falls off the striker onto the stumps while playing a shot: **out hit wicket** (equipment/clothing).
- **HITW-006** `[EDGE]` Bat slips from the hands onto the stumps while playing: **out hit wicket**.
- **HITW-007** `[EDGE]` Hit wicket **and** caught on the same delivery: per `WKT-006` the mode that occurred first governs (Bowled aside) — if hit wicket occurred while playing the shot and the catch after, it is **hit wicket**; both credit the bowler, so figures are unaffected; the record differs. Scorer records per umpires.

### 19.8 Obstructing the Field — `OBSF`
- **OBSF-001** `[LAW]` **Either batter** is out **obstructing the field** if they **wilfully** obstruct or distract the fielding side **by word or action**; this includes **wilfully striking the ball with a hand not holding the bat** (formerly "handled the ball").
- **OBSF-002** `[LAW]` Valid off **any** delivery (legal, no-ball, wide, free hit). **No bowler credit.**
- **OBSF-003** `[LAW]` The batter who obstructed is the one dismissed. Dismissal string: `obstructing the field` (optionally `... (handled the ball)` for the hand-strike variant, `[PRD]`).
- **OBSF-004** `[LAW]` **Runs**: if the obstruction prevented a **catch**, the **striker** is out and **no runs** are scored; otherwise runs completed before the obstruction stand, and the run in progress does not.
- **OBSF-005** `[LAW]` A batter **may** legitimately guard the wicket with the bat from a delivery, and **may** run a normal line; wilfully changing course to block a throw or fielder is the offence.
- **OBSF-006** `[EDGE]` Striker hits the ball a second time **with the bat** solely to **guard the wicket** — that is lawful (see `HBT`), **not** obstruction, unless it then prevents a catch or a run out.
- **OBSF-007** `[EDGE]` Non-striker collides with a fielder going for the ball: out only if the umpires judge it **wilful**; an accidental collision is not out (ball may be called dead).
- **OBSF-008** `[EDGE]` Batter kicks the ball away from the stumps to prevent a run out: **obstructing the field** (wilful), the batter who did so is out, no runs.

### 19.9 Hit the Ball Twice — `HBT`
- **HBT-001** `[LAW]` The striker is out **hit the ball twice** if, after the ball is struck or stopped by the bat/person, they **wilfully strike it again** with the bat or person — **except** solely to **guard the wicket** (which is lawful, provided it does not obstruct a catch or run out).
- **HBT-002** `[LAW]` Valid off a **no-ball** and a **free hit**; **not** off a wide (no bat contact). **No bowler credit.** Dismissal string: `hit the ball twice`.
- **HBT-003** `[LAW]` **No runs** may be scored from a delivery on which the striker hits the ball twice (other than penalties and overthrows arising from a lawful second strike to guard the wicket, per Law).
- **HBT-004** `[LAW]` The striker may **not** take a run for a lawful second strike (to guard the wicket) unless there is an overthrow.
- **HBT-005** `[EDGE]` Second strike to guard the wicket that deflects to a fielder who then attempts a run out: lawful; if the batter then obstructs, that becomes **obstructing the field**.
- **HBT-006** `[EDGE]` Extremely rare in the modern game; the system MUST still offer it as a selectable mode.

### 19.10 Timed Out — `TIMO`
- **TIMO-001** `[LAW]` An incoming batter is out **timed out** if, on the fall of a wicket or a batter retiring, the incoming batter (or, at the striker's end, the other batter) is **not ready to receive the ball, or for the other batter to receive it, within the allowed time**.
- **TIMO-002** `[CFG]` `timed_out_limit_seconds` — default **180** (Laws); ICC current white-ball and Test conditions use **120**. Set per profile.
- **TIMO-003** `[LAW]` Requires an **appeal**. **No bowler credit.** The **incoming batter** is the one dismissed. Dismissal string: `timed out`.
- **TIMO-004** `[PRD]` No delivery is associated; recorded as a timeline/wicket event between deliveries with the elapsed time noted; wicket number increments; team score unchanged.
- **TIMO-005** `[EDGE]` If **no batter comes out at all** and the side thereby cannot continue: still **timed out** on appeal; the innings then ends as `ALL_OUT` (last available batter dismissed).
- **TIMO-006** `[EDGE]` Delay caused by an equipment failure or a legitimate cause accepted by the umpires: not out; recorded as an interruption, not a wicket.
- **TIMO-007** `[EDGE]` Clock starts at the **fall of the previous wicket** (ball dead), not at the appeal; the system SHOULD offer a timer from the wicket event.

### 19.11 Retired — Hurt / Not Out — `RTHO`
- **RTHO-001** `[LAW]` A batter may **retire at any time when the ball is dead**. If the reason is **injury, illness, or another unavoidable cause**, the batter is **"retired – not out"** and **may resume** their innings at the fall of a wicket or the retirement of another batter.
- **RTHO-002** `[LAW]` `Retired – not out` is **not a dismissal** and does **not** count toward wickets.
- **RTHO-003** `[LAW]` If a `retired – not out` batter **cannot resume**, their innings is shown as **`retired not out`** (or `retired hurt`); the side is effectively a batter short and can be **all out with this batter unbeaten** (e.g. 9 wickets down, innings over).
- **RTHO-004** `[PRD]` Batting-card strings: `retired hurt` / `retired not out` / `retired ill`. Balls faced and runs to the point of retirement are retained; if resumed, they continue to accrue.
- **RTHO-005** `[PRD]` The system MUST record the **over.ball at retirement** and at **resumption**, and MUST reconstruct the batting order to place the resumed batter correctly.
- **RTHO-006** `[EDGE]` Batter retires hurt mid-over: incoming batter takes the exact end/role; strike unchanged except by that substitution (`STRK-014`).
- **RTHO-007** `[EDGE]` Two batters retired hurt and both later unavailable: innings can end at 8 wickets down.
- **RTHO-008** `[EDGE]` Retired-hurt batter resumes, is then dismissed: normal wicket; the earlier retirement is just a gap in their occupation of the crease; partnership records split across the two spells (§22).
- **RTHO-009** `[EDGE]` Retired-hurt batter is the **last recognised batter** and the innings reaches the last pair — the batter may resume even if it means batting at number 11's partner slot; system MUST allow resumption at any fall of wicket while wickets remain.

### 19.12 Retired Out — `RTOU`
- **RTOU-001** `[LAW]` If a batter retires for **any reason other than injury/illness/unavoidable cause**, they are **"retired out"** unless the **opposing captain consents** to a resumption.
- **RTOU-002** `[LAW]` `Retired out` **counts as a wicket** (toward all out); **no bowler credit**; the retiring batter is the one "dismissed". Dismissal string: `retired out`.
- **RTOU-003** `[LAW]` It is a **legitimate tactic** (e.g. a set batter retiring to bring in a hitter in a run chase); the system MUST support it without warnings implying illegality.
- **RTOU-004** `[PRD]` Recorded as a wicket event at the current over.ball context (between deliveries), team score unchanged, wicket number incremented, partnership closed.
- **RTOU-005** `[EDGE]` A `retired out` batter for whom the opposing captain **later consents** to return: permitted; the wicket is **reversed via amendment** (§33) and the batter re-enters; wicket count decremented.
- **RTOU-006** `[EDGE]` Retired out with a subsequent all-out at 9 further dismissals: total wickets = 10 including the retired-out; innings `ALL_OUT`.

---

## 20. Bowling — `BOWL`

- **BOWL-001** `[PRD]` Per bowler per innings the system MUST compute: **Overs (O)** as `completed_overs.balls`, **Maidens (M)**, **Runs (R)**, **Wickets (W)**, plus **Wides (wd)**, **No-balls (nb)**, **Dot balls**, **Economy rate**, **Strike rate**, **Average**, **Boundaries conceded (4s/6s)**.
- **BOWL-002** `[LAW]` **Runs charged to the bowler** = runs off the bat off that bowler + wides + no-ball penalties. **Not charged**: byes, leg-byes, penalty runs (5-run penalties, over-rate penalties), runs from a fielder's overthrow that are byes/leg-byes.
- **BOWL-003** `[LAW]` **Wickets credited to the bowler**: bowled, caught, LBW, stumped, hit wicket (`WKT-003`).
- **BOWL-004** `[PRD]` **Economy** = runs charged ÷ overs bowled (decimal). **Bowling strike rate** = legal balls bowled ÷ wickets credited. **Average** = runs charged ÷ wickets credited.
- **BOWL-005** `[PRD]` **Maiden** attribution follows `OVER-008`; a bowler who bowls only part of an over (injury) cannot be credited a maiden for that over.
- **BOWL-006** `[PRD]` The system MUST track **spells**: contiguous sequences of overs by a bowler from one end, with start/end over, overs, runs, wickets per spell.
- **BOWL-007** `[PRD]` **Milestones**: 5 wickets in an innings ("five-for"), 10 wickets in a match (multi-day), and **hat-trick** — three wickets from three consecutive deliveries by the same bowler (§ `BOWL-010`).
- **BOWL-008** `[CFG]` Per-bowler cap (`FMT-006`): the system MUST display each bowler's remaining overs/balls and prevent (with reasoned override) an over that exceeds the cap.
- **BOWL-009** `[LAW]` The system MUST enforce **no two consecutive overs** (`OVER-003`) and the completion rules (`OVER-005/006/011/012`).
- **BOWL-010** `[LAW]` **Hat-trick**: the three consecutive scoring-relevant deliveries may span **two overs**, **two spells**, or **two innings of the same match** (for the same bowler); intervening **wides and no-balls do not break** the sequence (they are not deliveries for this purpose) — a legal delivery that is not a wicket **does** break it. `[CFG]` `hat_trick_spans_innings` (default true).
- **BOWL-011** `[PRD]` Wickets **not** credited to the bowler (run out etc.) MUST still be reflected in the fall-of-wickets and the "team wickets" count but MUST NOT appear in any bowler's `W`.
- **BOWL-012** `[EDGE]` A bowler dismissed as a batter for 0 who then takes a hat-trick — unrelated tallies; the system keeps batting and bowling records fully independent.
- **BOWL-013** `[EDGE]` No-ball hit for 6 off a given bowler: 6 charged to the bowler + `no_ball_penalty_runs` charged to the bowler (total 7 or 8).
- **BOWL-014** `[EDGE]` Overthrow boundary where the original was a bye: 4 byes — **not** charged to the bowler; the bowler's over shows those 4 as byes.
- **BOWL-015** `[EDGE]` A bowler concedes runs via a 5-run penalty against the fielding side on their over: **not** charged to the bowler; shown as penalty extras in the innings, not in the bowler's `R`.
- **BOWL-016** `[EDGE]` The Hundred: bowler figures aggregate 5-ball or 10-ball units; "overs" column may be shown as balls (e.g. `15` balls) per `[CFG]` `bowling_figures_unit`.

---

## 21. Batting — `BAT`

- **BAT-001** `[PRD]` Per batter per innings the system MUST record: batting position, **Runs (R)**, **Balls faced (B)**, **Minutes at the crease (M)** `[CFG]` `track_batting_minutes` (default true for `TEST`), **4s**, **6s**, **Strike rate (SR)**, dismissal string (or `not out` / `did not bat` / `absent` / `retired ...`).
- **BAT-002** `[LAW]` **Balls faced** = legal deliveries faced + no-balls faced `[CFG]` `no_ball_counts_as_ball_faced` (default true); **wides are not** faced. A dismissal delivery counts as faced if it was legal or a no-ball.
- **BAT-003** `[PRD]` **Strike rate** = (runs ÷ balls faced) × 100.
- **BAT-004** `[LAW]` Runs are credited to the striker only when off the bat (`RUN-002`); byes/leg-byes/wides/no-ball penalties are never credited to a batter.
- **BAT-005** `[PRD]` **Dismissal string formats** (canonical): `b <bowler>` · `c <fielder> b <bowler>` · `c †<keeper> b <bowler>` · `c & b <bowler>` · `lbw b <bowler>` · `st †<keeper> b <bowler>` · `hit wicket b <bowler>` · `run out (<fielder(s)>)` · `obstructing the field` · `hit the ball twice` · `timed out` · `retired out` · `retired hurt` / `retired not out` · `not out` · `did not bat` · `absent hurt`. Substitute fielder shown as `(sub)` with the name where known.
- **BAT-006** `[PRD]` **Not out** batters at innings end MUST be marked `*` on the scorecard; the two not-out batters and the last partnership are highlighted.
- **BAT-007** `[PRD]` **"Did not bat"** lists all XI members below the last batter who neither batted nor were dismissed nor are `absent`.
- **BAT-008** `[PRD]` **Milestones**: 50, 100, 150, 200 … (every 50), plus "pair" (two ducks in a match), "golden duck" (out first ball), "diamond duck" (out without facing a legal ball) `[CFG]` `track_duck_variants` (default false).
- **BAT-009** `[EDGE]` A batter's innings split by retirement (`RTHO-008`): a single batting-card line with combined R/B; the retirement is footnoted; partnerships are split (§22).
- **BAT-010** `[EDGE]` Batter credited runs on a no-ball then the striker changes (odd runs): balls-faced attribution — the no-ball is faced by whoever was on strike **for that delivery**, not the new striker.
- **BAT-011** `[EDGE]` Batter "out" then reinstated on review: the batting-card line reverts to in-progress; any `4s`/`6s` and balls from the voided-then-restored delivery are re-evaluated per what actually counted.
- **BAT-012** `[EDGE]` Concussion replacement: a new batting-card line; the replaced batter's line is frozen with `retired hurt` or their actual dismissal, footnoted "replaced (concussion)".

---

## 22. Partnerships — `PART`

- **PART-001** `[PRD]` A **partnership** is the period during which a specific pair of batters is together at the crease. The system MUST record, per partnership: wicket number (for-the-Nth-wicket), the two batters, runs added, balls faced by the partnership, each batter's contribution, start and end over.ball, and whether it is unbroken.
- **PART-002** `[LAW]` **Partnership runs include all extras** scored while that pair was together (byes, leg-byes, wides, no-balls, penalties).
- **PART-003** `[PRD]` The **for-the-Nth-wicket** label is the number of wickets already fallen + 1 at the start of the partnership.
- **PART-004** `[EDGE]` **Retirement mid-partnership**: the partnership ends at the retirement; a new partnership begins with the incoming batter; if the retired batter later resumes, that is **another** new partnership (so one pair can have two separate partnership segments). The scorecard partnership table lists each segment; a "combined" figure MAY be shown `[PRD]`.
- **PART-005** `[EDGE]` **Run out with runs completed**: the completed runs belong to the just-ended partnership; the run in progress does not.
- **PART-006** `[EDGE]` **Unbroken partnership at innings end** (declaration, target reached, time, or 1 wicket standing with `last_man_stands`): marked unbroken with `*`.
- **PART-007** `[EDGE]` **Highest partnership** milestones per innings and per for-the-wicket record are computed for analytics.
- **PART-008** `[EDGE]` A partnership that starts and ends on the **same delivery** (e.g. a new batter run out first ball without facing): 0 runs, 0 balls; still recorded.

---

## 23. Powerplays & Fielding Restrictions — `PP`

- **PP-001** `[CFG]` `powerplay_model` — `NONE`, `ODI_3PHASE`, `T20_6OVER`, `HUNDRED_25BALL`, `CUSTOM`.
- **PP-002** `[CFG]` **ODI (`ODI_3PHASE`)**: Overs 1–10 → max **2** fielders outside the 30-yard circle; overs 11–40 → max **4**; overs 41–50 → max **5**. Additionally `[CFG]` `odi_close_catchers_first10` (default true for men's) → minimum 2 fielders in catching positions during overs 1–10.
- **PP-003** `[CFG]` **T20 (`T20_6OVER`)**: Overs 1–6 → max **2** outside; overs 7–20 → max **5** outside.
- **PP-004** `[CFG]` **The Hundred (`HUNDRED_25BALL`)**: first **25 balls** → max **2** outside.
- **PP-005** `[LAW/PC]` A breach of a fielding restriction is a **no-ball** (§12 `NB-004`/`NB-011`) with all normal no-ball consequences (including a free hit where enabled).
- **PP-006** `[PRD]` Every delivery record MUST carry its **powerplay phase** (e.g. `PP1`, `PP2`, `PP3`, `NON_PP`); the innings record MUST hold **runs/wickets per powerplay phase** for the scorecard.
- **PP-007** `[CFG/PC]` **Reduced-overs recalculation**: when overs are curtailed (§29), the powerplay over allocations scale per the competition's reduced-overs table (`powerplay_reduction_table`). The system MUST recompute phase boundaries and label deliveries accordingly.
- **PP-008** `[CFG]` Historical/domestic models (batting powerplay, bowling powerplay, discretionary 5-over block) selectable via `CUSTOM` with explicit phase definitions.
- **PP-009** `[PRD]` The system does **not** itself judge fielder positions; it records the **phase** and any **no-ball** the umpires call for a breach, plus an optional scorer note "fielding restriction breach".
- **PP-010** `[EDGE]` Powerplay boundary at a **mid-over** ball due to over reduction (e.g. PP ends after 4.3): the system MUST support a phase change **within** an over.
- **PP-011** `[EDGE]` Innings shortened to below the powerplay length (e.g. T20 reduced to 5 overs): `powerplay_reduction_table` gives the PP as e.g. 2 overs; if the table has no entry, `[PRD]` default = round(PP_fraction × new_overs).
- **PP-012** `[EDGE]` The Hundred powerplay measured in **balls**, not overs — phase change occurs after the 25th legal ball regardless of block structure.

---

## 24. Reviews / DRS — `DRS`

- **DRS-001** `[CFG]` `drs_enabled` (default true for `TEST/ODI/T20I`, false for `CLUB_LO`), `drs_components` (ball-tracking, edge-detection, thermal, front-foot-auto), `player_reviews_per_innings` (`TEST`=3, `ODI`=2, `T20I`=2), `umpires_call_enabled` (default true), `topup_reviews` (default false — no top-up in current conditions).
- **DRS-002** `[PC]` A **player review** may be requested only by the **fielding captain** or the **dismissed batter**, by the prescribed signal, within `[CFG]` `review_request_seconds` (default 15) of the decision.
- **DRS-003** `[PC]` A review that results in **no change to the on-field decision, including an "umpire's call" outcome on ball-tracking**: an unsuccessful review is lost; an "umpire's call" review is **retained**.
- **DRS-004** `[PC]` **Umpire (third-umpire) reviews** may be initiated by the on-field umpires for: run out, stumping, clean catch, boundary, and front-foot no-ball on a wicket-taking delivery; plus every-ball front-foot no-ball checks where `front_foot_auto` is enabled.
- **DRS-005** `[PRD]` The system MUST record, per review: type (player/umpire), requester, delivery, original on-field decision, outcome (`UPHELD` / `OVERTURNED` / `UMPIRES_CALL`), component evidence noted (optional), and the **resulting change to the scoring record**.
- **DRS-006** `[PRD]` The **scoring record reflects only the final decision.** If a delivery originally recorded as `not out` becomes a wicket, the wicket is entered with any runs adjusted to what actually counted. If a wicket becomes `not out`, the wicket is voided and the runs that were actually run (usually 0, because the umpire had signalled out and called the ball dead) are applied; a striker-cascade check runs (§33).
- **DRS-007** `[PC]` **No-ball found on review of a dismissal**: the wicket is voided; a **no-ball** is recorded (penalty per `no_ball_penalty_runs`); a **free hit** is set if enabled; any runs the batters ran count; the delivery is not re-bowled (an extra ball is owed).
- **DRS-008** `[PRD]` The system MUST track each side's **remaining reviews per innings** and reset them per `[CFG]` at each innings (and never top up unless `topup_reviews` is true).
- **DRS-009** `[EDGE]` Review outcome `UMPIRES_CALL` on an LBW where the on-field decision was **out**: batter remains **out**; review retained.
- **DRS-010** `[EDGE]` Review outcome `UMPIRES_CALL` where on-field was **not out**: batter remains **not out**; review retained; no wicket recorded.
- **DRS-011** `[EDGE]` A side with **0 reviews remaining** cannot request a player review; the system MUST block the request and record "review unavailable".
- **DRS-012** `[EDGE]` Timed-out, obstructing, hit-the-ball-twice, handled-the-ball are **not** normally player-reviewable modes but the third umpire may be consulted; the system MUST allow an umpire review on any mode.
- **DRS-013** `[EDGE]` Simultaneous byes and an overturned LBW: the byes/leg-byes that were run before the (now upheld) dismissal are removed; if the dismissal is overturned to not out, the runs that physically occurred (and were not voided by a dead-ball call) stand — scorer confirms with the umpires.
- **DRS-014** `[EDGE]` `drs_enabled = false` profile: the system still allows recording that "the umpires consulted" as a timeline note, but no review counters exist.

---

## 25. Declarations & Forfeiture — `DECL`

- **DECL-001** `[CFG]` `declarations_permitted` (default true for `TEST/FIRST_CLASS/MULTIDAY_CLUB`, false for limited-overs).
- **DECL-002** `[LAW]` The **batting captain may declare** an innings closed **when the ball is dead**, at any time, in a match not limited by overs (or in the limited first innings of a declaration match).
- **DECL-003** `[LAW]` A captain may **forfeit** an innings (the innings counts as completed with the score at forfeiture — normally 0/0). Declaration and forfeiture, once made, **cannot be reversed**.
- **DECL-004** `[PRD]` A declaration event MUST record: innings, score/wickets/overs at declaration, timestamp, declaring captain; the innings sub-state becomes `ENDED(DECLARED)`.
- **DECL-005** `[LAW]` A declaration/forfeiture MUST be permitted **between deliveries** and **during intervals**; the system MUST allow it from `IN_PROGRESS` and from `INNINGS_BREAK`/`INTERRUPTION` (for the innings not yet started, that is a forfeiture).
- **DECL-006** `[EDGE]` Declaration with a batter **retired hurt**: that batter is shown `not out` (retired hurt); the two "not out" batters are the two who were at the crease at the declaration.
- **DECL-007** `[EDGE]` Forfeiture of the **third** innings to set up a run chase (famous timed-match tactic): the fourth innings begins immediately with the target = aggregate lead + 1; the system MUST compute the target across all innings (§28).
- **DECL-008** `[EDGE]` A declaration in a `MULTIDAY_CLUB` first innings that also had an over cap: `ENDED(DECLARED)` even though overs remained; over cap is irrelevant once declared.

---

## 26. Follow-on — `FLW`

- **FLW-001** `[LAW]` In a two-innings match, the side that **batted first and leads by at least the follow-on margin** after both first innings may require the other side to **follow on** (bat again immediately).
- **FLW-002** `[CFG]` `follow_on_margin` by scheduled match length: **≥ 5 days → 200**; **3–4 days → 150**; **2 days → 100**; **1 day → 75**. Derived from `FMT-002.days` but overridable.
- **FLW-003** `[LAW]` If **no play was possible on the first scheduled day** (or play is lost such that the match is effectively shorter), the follow-on margin drops to the value for the reduced length (Law 13.2). `[PRD]` The system MUST let the scorer set the "effective match length for follow-on" when day 1 is lost, and recompute the margin.
- **FLW-004** `[PRD]` After both first innings complete, the system MUST show whether the follow-on is **available**, and record the fielding captain's decision: `ENFORCED` / `DECLINED`.
- **FLW-005** `[PRD]` If enforced, innings order becomes: Team A (1st), Team B (1st), **Team B (2nd)**, Team A (2nd, only if required). The system MUST reorder innings 3 and 4 accordingly.
- **FLW-006** `[EDGE]` Follow-on enforced, Team B then leads → Team A bats last needing a target (§28); if Team B does **not** clear the deficit, Team A wins by an innings and N runs (`RES`).
- **FLW-007** `[EDGE]` "Win by an innings and X runs" is computed as `A_first_innings − (B_first_innings + B_second_innings)` when Team A did not bat a second time.
- **FLW-008** `[EDGE]` Lead exactly equal to the margin (e.g. exactly 200 in a 5-day match): follow-on **is** available (the Law says "at least").

---

## 27. Results — Win / Tie / No Result / Abandoned — `RES`

- **RES-001** `[LAW]` **Win by runs** (side batting first has more runs when the side batting last is all out or its overs expire): margin = `first_side_total − second_side_total`. Applies to the completed limited-overs match and to the aggregate in a two-innings match.
- **RES-002** `[LAW]` **Win by wickets** (side batting last reaches the target): margin = `wickets_in_hand` = `wickets_for_all_out − wickets_lost`; the system SHOULD also show **balls remaining** (limited overs).
- **RES-003** `[LAW]` **Win by an innings and N runs** (two-innings, where the winner did not bat twice): `FLW-007`.
- **RES-004** `[LAW]` **Tie**: the scores are **exactly level** and the side batting last has **completed its innings** (all out or overs expired) — limited overs; or **aggregate scores level** after all four innings — two-innings. Distinct from a **draw** (`FMT-012`).
- **RES-005** `[CFG]` `tie_breaker` — `NONE` (record as "Match tied"), `SUPER_OVER` (§30), `BOUNDARY_COUNTBACK` (legacy), `BOWL_OUT` (legacy, likely unsupported), `SHARED` (trophy shared).
- **RES-006** `[CFG]` **No result / minimum overs**: a limited-overs match produces **No Result** if the side batting second has **faced fewer than `minimum_overs_for_result` overs** (`T20I`=5, `ODI`=20 per side) and has not been dismissed and has not reached the target, and DLS cannot produce a result. `[CFG]` `minimum_overs_for_result`.
- **RES-007** `[PRD]` **Abandoned**: no play was possible, or the match was called off with no result reachable. `[PRD]` `abandoned_without_a_ball_bowled` is a distinct sub-flag.
- **RES-008** `[LAW]` **Win by DLS**: when a DLS revision is in effect and the side batting second is ahead of / behind the **par score** at the last valid ball; margin stated as "**won by N runs (DLS method)**" (batting first ahead) or "**won by W wickets (DLS method)**" (batting second reached the revised target).
- **RES-009** `[LAW]` **Match awarded / conceded / forfeited**: a match may be **awarded** by the umpires/referee (e.g. refusal to play), or a side may **concede**. Recorded as `AWARDED` with a reason; no runs-based margin.
- **RES-010** `[PRD]` The **result statement** MUST be generated in canonical form, e.g.:
  - `"<Winner> won by 42 runs"`
  - `"<Winner> won by 5 wickets (with 11 balls remaining)"`
  - `"<Winner> won by 18 runs (DLS method)"`
  - `"<Winner> won by an innings and 26 runs"`
  - `"Match tied"` / `"Match tied (<Winner> won the Super Over)"`
  - `"No result"` / `"Match abandoned without a ball bowled"` / `"Match drawn"`
  - `"<Winner> awarded the match"`
- **RES-011** `[PRD]` `player_of_the_match` and `player_of_the_series` are optional record fields, not derived.
- **RES-012** `[EDGE]` Two-innings match: side batting last is **all out exactly level** with the aggregate → **tie** (extremely rare — has occurred twice in Test history).
- **RES-013** `[EDGE]` DLS par **exactly equalled** at the moment of abandonment → **tie** (subject to `tie_breaker`).
- **RES-014** `[EDGE]` Target reached with a **boundary that also had the batter caught beyond the rope** — six, target reached, win by wickets; the "dismissal" is void (boundary six).
- **RES-015** `[EDGE]` Side batting second is **bowled out below `minimum_overs_for_result`** → this **is** a result (win by runs), because being all out completes the innings (the minimum-overs rule protects only against rain-shortened non-completion).
- **RES-016** `[EDGE]` Concede/awarded mid-innings: innings sub-state `ENDED(INNINGS_CONCEDED)`; result `AWARDED`.

---

## 28. Target Calculation — `TGT`

- **TGT-001** `[LAW]` **Standard limited-overs target** = `first_innings_total + 1`, to be reached within the side's allotted overs.
- **TGT-002** `[LAW]` **Two-innings target** for the side batting last = `(opponent_aggregate − own_first_innings) + 1` = `opponent_lead + 1`. If the last side is dismissed short, `RES-001/003`.
- **TGT-003** `[LAW/PC]` **DLS-revised target**: when overs are lost such that the two sides have unequal resources, the target for the side batting second is computed by the DLS method (§29) and is `floor(DLS_value) + 1` (or per the method's rounding), replacing `TGT-001`.
- **TGT-004** `[PC]` If **Team 2's innings is shortened before it begins** (Team 2 has fewer overs than Team 1 used resources for), a **revised target is set at the start** of Team 2's innings, even with no in-innings interruption.
- **TGT-005** `[PRD]` The system MUST display, throughout the chase: **runs required**, **balls remaining**, **required run rate**, and — when DLS is active — the **par score** and the **DLS target**.
- **TGT-006** `[LAW]` The chase **ends the instant the target is reached or passed**, including by an extra (wide/no-ball penalty), a boundary, or penalty runs; the innings does not continue.
- **TGT-007** `[EDGE]` **Scores level, last ball, no wicket**: match **tied** (target `+1` not reached) — the side batting second did not win.
- **TGT-008** `[EDGE]` **Target passed by a boundary** where fewer runs would have won it: margin = `wickets in hand`, balls remaining computed from the delivery on which it was passed.
- **TGT-009** `[EDGE]` **DLS target revised downward mid-chase** below the current score: the match is **won immediately** by the side batting second (DLS method) on resumption / at the revision.
- **TGT-010** `[EDGE]` **DLS "no further play"**: compare the actual score with **par at the last completed valid ball**; if `minimum_overs_for_result` was met → result per `RES-008`; else **No Result**.
- **TGT-011** `[EDGE]` `nb_penalty_runs = 2` and a no-ball penalty takes the score from `target−2` to `target`: match won on the no-ball penalty; the free hit (if any) is not bowled.

---

## 29. DLS (Duckworth–Lewis–Stern) — `DLS`

- **DLS-001** `[CFG]` `rain_method` — `DLS_STANDARD` (default), `DLS_PROFESSIONAL` (reference only unless licensed), `VJD` (out of scope initially), `NONE` (manual targets only). **This entire section is subject to spike SPK-01 (licensing).**
- **DLS-002** `[CFG]` `dls_applicable_formats` — DLS applies **only to single-innings limited-overs formats** (`ODI`, `LIST_A`, `T20`, `T20I`, `T10`, `THE_HUNDRED`, `LIMITED_OVERS_CUSTOM`); **never** to `TEST`/`FIRST_CLASS`.
- **DLS-003** `[LAW/PC]` The method works on **resources** (a percentage that is a function of **overs remaining** and **wickets lost**). Each side's innings has a **resource percentage available**; interruptions reduce it.
- **DLS-004** `[PC]` **Target computation** (Standard Edition):
  - Let `R1` = Team 1's resources used (%), `R2` = Team 2's resources available (%), `S` = Team 1's score.
  - If `R2 ≤ R1`: revised target `= S × (R2 / R1)`, then `floor` and `+1`.
  - If `R2 > R1`: revised target `= S + G50 × (R2 − R1) / 100`, then `floor` and `+1`, where `G50` is the average-50-over-innings constant `[CFG]` `dls_g50` (different for T20).
  - If `R2 = R1`: revised target `= S + 1`.
- **DLS-005** `[PC]` **Par score** at any point in Team 2's innings = `S × (resources_used_by_team2_so_far / R1)` (Standard) or the Professional-Edition ball-by-ball equivalent, rounded per the method; the side batting second is "ahead" if its score **exceeds** par, "behind" if **below**, "tied" if equal.
- **DLS-006** `[CFG]` `dls_resource_table` — the Standard Edition resource table is **reference data** maintained centrally (`ADM-105`); the system MUST use the table/version in force when the match started (`INV`/`§35`).
- **DLS-007** `[PRD]` **Inputs** the system MUST capture: allotted overs each innings; every interruption (start over.ball, end, overs lost); wickets lost at each interruption; score at each interruption; whether Team 1 finished early (unused overs → resources not fully consumed).
- **DLS-008** `[PRD]` **Outputs** the system MUST produce and version on **every interruption**: revised overs, revised target, current par, resources used/available for each side, and a human-readable calculation breakdown.
- **DLS-009** `[PRD]` Every DLS revision is an **immutable, individually reversible event**, timestamped, with the instructing official noted.
- **DLS-010** `[PRD]` A **manual target/par override** is always available, with a recorded reason; the override supersedes the computed value but the computed value is retained.
- **DLS-011** `[PC]` **Minimum overs**: a DLS result requires the side batting second to have faced at least `minimum_overs_for_result` (`T20`=5, `ODI`=20) unless it was dismissed or reached the target.
- **DLS-012** `[PRD]` DLS calculations MUST run **fully offline** from local reference data.
- **DLS-013** `[EDGE]` **Team 1 interrupted / curtailed**: Team 1's resources are less than 100%; if Team 1 had **more** resources than Team 2 will have, the target is scaled **down**; if **fewer**, `G50` uplift applies (`DLS-004`).
- **DLS-014** `[EDGE]` **Multiple interruptions** in Team 2's innings: recompute cumulatively; the par ladder is rebuilt after each.
- **DLS-015** `[EDGE]` **Interruption between innings** (Team 1 done, rain before Team 2 starts): set the revised target at the start of Team 2's innings (`TGT-004`); no par ladder needed until Team 2 bats.
- **DLS-016** `[EDGE]` **Team 2 all out before facing minimum overs but chasing a DLS target**: being all out completes the innings → result stands (compare final score to revised target − 1).
- **DLS-017** `[EDGE]` **The Hundred / T10**: DLS tables/`G50` differ; `dls_g50` and `dls_resource_table` are profile-specific.
- **DLS-018** `[EDGE]` Over-rate-related over reductions (not weather) that curtail an innings: treated as a resource reduction identically to a weather interruption for DLS input purposes.

---

## 30. Super Over / Tie-breakers — `SO`

- **SO-001** `[CFG]` `tie_breaker` (`RES-005`). This section applies when `tie_breaker = SUPER_OVER`.
- **SO-002** `[PC]` A Super Over is **one over per side**, maximum **2 wickets**; the innings ends at **6 legal balls** or the **fall of the 2nd wicket**, whichever first.
- **SO-003** `[PC]` Each side **nominates 3 batters and 1 bowler** before its Super Over; a batter dismissed in one Super Over **cannot bat** in a subsequent Super Over for that side; a bowler **cannot bowl consecutive** Super Overs.
- **SO-004** `[CFG]` `super_over_batting_order` — default: **the side that batted second in the match bats first in the Super Over**; for a subsequent Super Over, **the side that bowled second in the preceding Super Over bats first**.
- **SO-005** `[PC]` Normal delivery rules apply within the Super Over: wides, no-balls, `no_ball_penalty_runs`, and free hits (if `free_hit_enabled`); a no-ball/wide is re-bowled, so a Super Over may exceed 6 total deliveries.
- **SO-006** `[CFG]` `super_over_fielding_restrictions` — default: non-powerplay restrictions (max 5 outside the circle).
- **SO-007** `[PC]` The side batting second in the Super Over **knows its target** = first side's Super Over runs + 1.
- **SO-008** `[CFG]` `super_over_tie_resolution` — default **`REPEAT`** (play another Super Over until a winner); legacy alternative `BOUNDARY_COUNTBACK` (the side with more boundaries in the match **then** in the Super Over(s) wins); `SHARED`.
- **SO-009** `[PRD]` Super Over statistics are recorded as a **separate mini-innings pair** per Super Over and **do not count** toward main-match or career batting/bowling aggregates.
- **SO-010** `[PRD]` A Super Over record MUST hold: sequence number, batting order, nominated batters/bowler per side, ordered deliveries, runs, wickets, boundaries, and the resulting winner (or "tied → next Super Over").
- **SO-011** `[PC]` Fall of the 2nd wicket ends that side's Super Over even with balls remaining; a side **all out** for fewer than its opponent's total has lost the Super Over.
- **SO-012** `[PRD]` The match result statement becomes `"Match tied (<Winner> won the Super Over)"` (`RES-010`); the main-match result field records `TIE` with `tie_breaker_winner = <Winner>`.

**Edge cases**
- **SO-013** `[EDGE]` Super Over also tied, `super_over_tie_resolution = REPEAT`: play Super Over 2 immediately; batters dismissed in SO1 are ineligible; the SO1 bowler cannot bowl SO2; batting order per `SO-004`.
- **SO-014** `[EDGE]` A side loses 2 wickets off the first 2 balls of its Super Over: innings over at `0.2`; opponent needs `runs + 1` and may still bat its full over or win earlier.
- **SO-015** `[EDGE]` No-ball on the last legal ball of a Super Over: `no_ball_penalty_runs` added, free hit (if enabled) bowled as an extra delivery; the 2-wicket / 6-legal-ball limit still governs.
- **SO-016** `[EDGE]` Rain prevents a Super Over: fall back to `super_over_tie_resolution` → typically `BOUNDARY_COUNTBACK` or `SHARED` per competition conditions; recorded with reason "Super Over not possible".
- **SO-017** `[EDGE]` `tie_breaker = BOUNDARY_COUNTBACK` (no Super Over at all): winner = more boundaries (6s + 4s) in the match; if still level, more 6s; if still level → `SHARED` or per conditions. The system MUST compute the boundary tally per side across the whole match.
- **SO-018** `[EDGE]` A knockout match that cannot be decided by any tie-breaker: `SHARED` / progression by a pre-set seeding rule `[CFG]` `knockout_progression_rule` (higher seed / higher group position) — recorded at competition level, not in the match record.

---

## 31. Scorecard — `SCRD`

The scorecard is the canonical human-readable output. It MUST be reconstructable at any point in time from the event log (§33).

### 31.1 Header
- **SCRD-001** `[PRD]` MUST show: match title, competition/season, format, ground, city/country, date(s), day/night, start time, time zone.
- **SCRD-002** `[PRD]` MUST show both teams, the **toss** ("<Team> won the toss and elected to <bat|field>"), and the **result statement** (`RES-010`).
- **SCRD-003** `[PRD]` MUST show **playing XIs** with the captain marked `(c)` and the wicket-keeper marked `†` (or `(wk)`), plus any substitutes / concussion replacements / impact players with a footnote.
- **SCRD-004** `[PRD]` MUST show **officials**: on-field umpires, third umpire, fourth/reserve umpire, match referee, scorers (`OFCL-009`).
- **SCRD-005** `[PRD]` MUST show **player of the match** where recorded.

### 31.2 Innings blocks (one per innings, in match order)
- **SCRD-006** `[PRD]` **Batting table** columns: order, batter (with `†`/`(c)` marks), **how out** (`BAT-005`), **R**, **B**, **M** (if tracked), **4s**, **6s**, **SR**. Not-out batters marked `*`.
- **SCRD-007** `[PRD]` **Extras line**: `Extras  (b N, lb N, w N, nb N, pen N)  = TOTAL`.
- **SCRD-008** `[PRD]` **Total line**: `Total  (W wkts, O.B overs, MMM mins)  RRR run rate` — and `dec`/`f` markers for declared/forfeited, `all out` where applicable.
- **SCRD-009** `[PRD]` **Did not bat**: remaining XI in batting-order sequence (`BAT-007`).
- **SCRD-010** `[PRD]` **Fall of wickets**: `W-R (batter, O.B)` for each wicket, in order (`WKT-007`).
- **SCRD-011** `[PRD]` **Bowling table** columns: bowler, **O**, **M**, **R**, **W**, **NB**, **WD**, **Econ** (`BOWL-001`). Order = order in which they bowled.
- **SCRD-012** `[PRD]` **Partnerships** table (international standard): for-the-Nth-wicket, pair, runs, balls, each batter's contribution, unbroken marker (`PART-001`).
- **SCRD-013** `[PRD]` **Powerplay scores**: runs/wickets per powerplay phase (`PP-006`).
- **SCRD-014** `[PRD]` **Two-innings matches**: show first-innings and second-innings blocks per side, plus **lead/deficit** and **aggregate**; a **follow-on** note where enforced (`INN-010`, `FLW-004`).

### 31.3 Match notes & result detail
- **SCRD-015** `[PRD]` **Match notes** MUST list, chronologically: interruptions (with overs lost), DLS revisions (target/par/overs, with calculation reference), penalty runs (with reason & side), retirements & resumptions, concussion replacements, umpire/scorer corrections confirmed at close, over-rate penalties, new-ball taken, debuts (optional), milestones (optional).
- **SCRD-016** `[PRD]` **DLS panel** (when applicable): method & edition, `G50`, resource table version, each side's resources, revised target, final par, and the DLS result phrasing.
- **SCRD-017** `[PRD]` **Super Over panel** (when applicable): each Super Over's line-up, ball-by-ball, totals, and outcome (`SO-010`).
- **SCRD-018** `[PRD]` **Result** MUST appear in canonical form (`RES-010`) and, for limited overs won by the chasing side, include **balls remaining**.

### 31.4 Integrity & versions
- **SCRD-019** `[PRD]` The scorecard MUST satisfy the reconciliation invariants (§34) or be flagged **UNRECONCILED** with the specific failing invariant(s).
- **SCRD-020** `[PRD]` The official version MUST record **scorer sign-off** (and counter-signature where required) with names and timestamps.
- **SCRD-021** `[PRD]` Every published scorecard version MUST carry a **version number / revision id** and a link to the amendment log (§33); a post-final amendment produces a new version, the prior remaining retrievable.
- **SCRD-022** `[PRD]` The scorecard MUST be renderable **as at any past moment** ("scorecard at the innings break", "scorecard after over 30").

### 31.5 Edge cases
- **SCRD-023** `[EDGE]` `absent hurt`/`absent` batters appear in the batting list with that annotation and are **not** in "did not bat".
- **SCRD-024** `[EDGE]` A batter with two batting spells (retired then resumed) is **one line** with combined figures and a retirement footnote (`BAT-009`).
- **SCRD-025** `[EDGE]` Penalty runs awarded to a side **before it bats**: shown as a pre-existing Extras entry when that innings opens, with a note.
- **SCRD-026** `[EDGE]` "Win by an innings and N runs": the winner's block shows only one innings; the result line and aggregate make the margin explicit (`FLW-007`).
- **SCRD-027** `[EDGE]` Bowler figures with a part-over completed by a second bowler: both bowlers listed against that over in the analysis; maiden not creditable for a split over (`BOWL-005`).
- **SCRD-028** `[EDGE]` The Hundred: bowling figures shown in **balls** (`bowling_figures_unit`), batting `B` unchanged; "overs" replaced by "balls" throughout that scorecard.

---

## 32. Ball-by-Ball Commentary — `CMTRY`

- **CMTRY-001** `[PRD]` Every delivery (legal **and** illegal) produces exactly one commentary entry, in strict chronological order, with a stable id.
- **CMTRY-002** `[PRD]` Each entry MUST hold: innings, **over.ball notation**, bowler, striker, non-striker, outcome runs breakdown, wicket detail (if any), fielders, free-hit flag, review flag, powerplay phase, and a generated **summary string**.
- **CMTRY-003** `[PRD]` **Over.ball notation** convention: legal balls number `1..balls_per_over`; illegal deliveries share the *current* legal-ball index with a legality tag (e.g. over 12: `12.1`, `12.2`, `12.2` [wide], `12.3`, …); the displayed shorthand for an over is a token string (see `CMTRY-004`).
- **CMTRY-004** `[PRD]` **Over shorthand tokens**: `.` = dot; `1 2 3 4 6` = runs off the bat; boundary four / six presentation `[PRD]`; `W` = wicket; `wd` = wide (`2wd` = wide + 1 run run + penalty); `nb` = no-ball (`nb1`, `1nb` = no-ball + 1 off bat per house style); `b`/`lb` = byes/leg-byes (`4b`, `1lb`); `+` = free hit marker. House-style variants are `[CFG]` `commentary_token_style`.
- **CMTRY-005** `[PRD]` A **generated summary string** (e.g. "Bumrah to Root, no run, defended to mid-off") MUST be produced from structured fields; a **free-text commentary** field MAY be attached/edited per ball (discovery `FR-064`).
- **CMTRY-006** `[PRD]` The timeline MUST also carry **non-delivery markers** as entries: innings start/end, over complete, drinks, interval, interruption start/resume, new ball, powerplay start/end, session/day (stumps), DLS revision, review, retirement, penalty runs, milestone reached, result.
- **CMTRY-007** `[PRD]` **Milestone inline flags**: batter fifty/hundred/etc., team 50/100/150…, 100 partnership, fifty/hundred stand records, bowler five-for, hat-trick ball, fastest fifty/hundred (optional analytics `[CFG]`).
- **CMTRY-008** `[PRD]` Illegal deliveries insert entries **without** advancing the legal-ball index; the over's legal-ball count and "balls remaining" reflect only legal balls, byes and leg-byes.
- **CMTRY-009** `[PRD]` Every commentary entry is **editable via amendment** (§33) with the change tracked; export order is always chronological.
- **CMTRY-010** `[EDGE]` A delivery that is voided by review/correction (e.g. no-ball found, or wicket overturned) keeps its entry, marked **amended**, with the superseding entry linked; the raw pre-amendment text is retained.
- **CMTRY-011** `[EDGE]` Non-striker run out before delivery (`NSRO`): a commentary entry is created (marked "dead ball / re-bowled" if unsuccessful, or the wicket if successful) that does **not** consume a legal-ball index.
- **CMTRY-012** `[EDGE]` Multiple penalties/events on one delivery: one delivery entry, multiple structured sub-events (penalty + overthrow + boundary), one composite summary string.
- **CMTRY-013** `[EDGE]` The Hundred: over.ball notation is ball-count based (`Ball 34`), grouped into 5/10-ball blocks; token shorthand groups by block.

---

## 33. Corrections & Scoring Amendments — `CORR`

- **CORR-001** `[PRD]` Every recorded event (delivery, wicket, penalty, DLS revision, lineup entry, result, non-delivery marker) is **immutable**. A correction is a **new superseding event** that references the original (append-only log).
- **CORR-002** `[PRD]` **Amendment types**: change a delivery's outcome; **insert** a missed delivery at a position; **void** a delivery entered in error; reassign bowler / striker / non-striker; change dismissal mode / fielder / bowler credit; adjust extras or short runs; add/adjust/reverse penalty runs; add/reverse a DLS revision; correct a manual target; correct the result; correct a lineup / batting order / toss; reclassify bye↔leg-bye, run-out↔stumped, caught↔bowled, etc.
- **CORR-003** `[PRD]` Each amendment MUST record: amending user, role, timestamp, device, **reason (mandatory free-text)**, the **before** and **after** structured values, and the **recomputation scope** (which aggregates were affected).
- **CORR-004** `[PRD]` **Deterministic recomputation**: after any amendment, all derived data — batting figures, bowling figures, extras, partnerships, fall of wickets, run rate, required rate, powerplay tallies, DLS par/target, milestones, result — MUST be recomputed from the event log so the record is always internally consistent (§34).
- **CORR-005** `[PRD]` **Cascade handling**: an amendment that changes **who was on strike** for subsequent deliveries (e.g. a corrected run count changing parity, or a voided wicket) MUST NOT silently re-attribute later deliveries; the system MUST recompute the intended state, **present the cascade for scorer review**, and require confirmation.
- **CORR-006** `[PRD]` **Amendment that changes an ending**: if a correction shows an over/innings/match ended prematurely or should have ended earlier (e.g. short run negates the winning run; a missed wide means an extra ball was owed), the affected scope MUST re-open (`STATE-006`) and be re-resolved.
- **CORR-007** `[LAW]` **Umpire-directed corrections**: scorers act on the umpires' instruction; the instructing umpire MUST be recorded (`OFCL-007`). Where scorer and umpire records disagree, the **umpires' determination of the facts prevails**; the disagreement and resolution are logged.
- **CORR-008** `[LAW]` Scorers reconcile **at every interval and at the close**; the system MUST support an **end-of-innings** and **end-of-match reconciliation checkpoint** producing the invariant report (§34) and a list of items "confirmed with the umpires".
- **CORR-009** `[PRD]` **Pre-sign-off vs post-sign-off**: before `FINAL`, an authorised scorer amends freely (with reason + log). After `FINAL`, an amendment requires an **elevated role**, a reason, and **re-sign-off**; the prior `FINAL` scorecard version is retained and remains retrievable (`SCRD-021`).
- **CORR-010** `[PRD]` **Dual-scorer amendments** are **proposed and confirmed** — no unilateral overwrite of the other scorer's record (discovery `FR-118/119`); the agreed value is appended to both logs.
- **CORR-011** `[PRD]` **Time-travel**: the system MUST reconstruct the full match state and scorecard **as at any event ordinal or timestamp** (`SCRD-022`).
- **CORR-012** `[PRD]` **Amendment log** on the scorecard: a summarised, human-readable list of post-first-ball corrections (and, prominently, all post-`FINAL` ones), each with reason and net effect.
- **CORR-013** `[EDGE]` **Insert a missed delivery** several overs back: all subsequent legal-ball indices, over boundaries, bowler over-counts, strike, and "balls remaining" shift; the system MUST recompute and flag every downstream over whose bowler/maiden/figures changed.
- **CORR-014** `[EDGE]` **Void the last delivery** vs **void an interior delivery**: voiding the last is a simple truncation; voiding an interior delivery triggers the full cascade (`CORR-005`).
- **CORR-015** `[EDGE]` **Retrospective DLS correction** (wrong overs-lost entered): reverse the DLS revision event, re-enter it, recompute the par ladder and target; if the match had been called on the wrong par, the result is re-derived and, if changed, `FINAL` is revoked pending re-sign-off.
- **CORR-016** `[EDGE]` **Result correction after publication** (e.g. NRR-affecting extras error found next day): post-`FINAL` amendment; new scorecard version; competition standings recompute from the corrected `FINAL` (discovery `BR-015`).
- **CORR-017** `[EDGE]` **Lineup correction** (wrong player entered as keeper / wrong batting order): permitted; if it changes a dismissal string ("c †Smith" → "c Jones") the affected wicket events are amended and re-rendered.
- **CORR-018** `[EDGE]` **Conflicting simultaneous amendments** to the same event by two authorised users: the system MUST serialise them and surface the conflict; last proposal does not silently win.
- **CORR-019** `[EDGE]` An amendment that would **reduce wickets below the number of batters already dismissed on the card** (e.g. reversing a retired-out) MUST re-open the batting order and re-seat the reinstated batter (`RTOU-005`).

---

## 34. Cross-cutting Invariants & Reconciliation — `INV`

The system MUST continuously evaluate these; a violation blocks sign-off unless explicitly overridden with a reason (discovery `BR-037`, `FR-104/105`).

- **INV-001** `[PRD]` **Total identity**: `innings_total = Σ batter_runs + b + lb + w + nb + pen` (`INN-008`).
- **INV-002** `[PRD]` **Ball identity**: `legal_balls_bowled_in_innings = Σ over.legal_balls`; and `overs_display = legal_balls // balls_per_over . legal_balls % balls_per_over`.
- **INV-003** `[PRD]` **Bowler balls identity**: `Σ bowler.legal_balls = legal_balls_bowled_in_innings`; `Σ bowler.wides = innings.w_count_attributable`; `Σ bowler.no_balls = innings.nb_count`.
- **INV-004** `[PRD]` **Bowler runs identity**: `Σ bowler.runs_charged = Σ batter_runs_off_that_bowler + w + nb_penalties` and `= innings_total − b − lb − pen − (runs off other-bowler byes/lb)`.
- **INV-005** `[PRD]` **Wickets identity**: `wickets_lost = count(dismissal events) ≤ wickets_for_all_out`; `retired–not out` and `absent` are **not** counted.
- **INV-006** `[PRD]` **Fall-of-wickets consistency**: FoW has exactly `wickets_lost` entries; each FoW score ≤ the next; the last FoW score = `innings_total` iff the side is all out.
- **INV-007** `[PRD]` **Partnership sum**: `Σ partnership_runs (all segments) = innings_total`; `Σ partnership_balls` reconciles with legal balls + byes/leg-byes deliveries.
- **INV-008** `[PRD]` **Batter balls**: `Σ batter.balls_faced = legal_balls + no_balls_faced` (`BAT-002`), minus wides.
- **INV-009** `[PRD]` **Boundary tally**: `Σ batter.4s×4 + Σ batter.6s×6 ≤ Σ batter_runs`.
- **INV-010** `[PRD]` **Extras attribution**: every extra run is attributed to exactly one of `b/lb/w/nb/pen`.
- **INV-011** `[PRD]` **Strike continuity**: for every delivery n>1, `striker(n)` is derivable from `outcome(n−1)` + end-of-over rule + logged overrides; unexplained discontinuities are flagged.
- **INV-012** `[PRD]` **Over legality**: no over contains more than `balls_per_over` legal balls; every over except possibly the innings' last has exactly `balls_per_over` legal balls.
- **INV-013** `[PRD]` **Bowler rules**: no bowler bowls consecutive overs; no bowler exceeds the cap (unless overridden with reason).
- **INV-014** `[PRD]` **Result consistency**: the stored result statement is re-derivable from the two innings totals (+ DLS/Super Over data); a mismatch is flagged.
- **INV-015** `[PRD]` **DLS consistency**: `resources_used ≤ 100%` per side; par ladder monotonic within each uninterrupted phase; revised target ≥ 1.
- **INV-016** `[PRD]` **Two-innings**: `aggregate = innings1 + innings3` (side A) vs `innings2 + innings4` (side B); "innings win" only if the losing side's aggregate < the winner's single innings.
- **INV-017** `[PRD]` **Timeline monotonicity**: event ordinals strictly increasing; timestamps non-decreasing (device-clock skew flagged, not rejected — discovery `OFR-017`).
- **INV-018** `[PRD]` **Reconciliation report** MUST enumerate each invariant with `PASS` / `FAIL(detail)` and is produced at each interval checkpoint and at sign-off (`CORR-008`).

---

## 35. Configuration Registry — `CFG-REG`

Every `[CFG]` key, its meaning, allowed values, and default per baseline profile. The authoritative default set per profile is data, maintained centrally per `ADM-105` / discovery `BR-045`.

| Key | Values | LAWS | TEST | ODI | T20I | CLUB_LO | HUNDRED |
|---|---|---|---|---|---|---|---|
| `format.innings_per_side` | 1 \| 2 | 2 | 2 | 1 | 1 | 1 | 1 |
| `format.balls_per_over` | int | 6 | 6 | 6 | 6 | 6 | 5/10 block |
| `format.overs_per_innings` | int \| unlimited | unlimited | unlimited | 50 | 20 | 40 | 100 balls |
| `format.days` | int | — | 5 | 1 | 1 | 1 | 1 |
| `max_overs_per_bowler` | int \| none | none | none | 10 | 4 | 8 | 20 balls |
| `new_ball_policy` | ONE \| TWO_NEW \| AFTER_N_OVERS | AFTER_N (80) | AFTER_N (80) | TWO_NEW | ONE | ONE | ONE |
| `wickets_for_all_out` | 1–10 | 10 | 10 | 10 | 10 | 10 | 10 |
| `no_ball_penalty_runs` | 1 \| 2 | 1 | 1 | 1 | 1 | 1 | 2 |
| `wide_penalty_runs` | 1 \| 2 | 1 | 1 | 1 | 1 | 1 | 1 |
| `wide_interpretation` | LAWS_STANDARD \| STRICT_WHITE_BALL | LAWS_STANDARD | LAWS_STANDARD | STRICT_WHITE_BALL | STRICT_WHITE_BALL | STRICT_WHITE_BALL | STRICT_WHITE_BALL |
| `nb_wd_secondary_extras_itemised` | bool | false | false | false | false | false | false |
| `no_ball_counts_as_ball_faced` | bool | true | true | true | true | true | true |
| `free_hit_enabled` | bool | false | false | true | true | false | true |
| `free_hit_trigger` | ALL_NO_BALLS \| FOOT_FAULT_ONLY | — | — | ALL_NO_BALLS | ALL_NO_BALLS | — | ALL_NO_BALLS |
| `bouncers_per_over` | int | 2 | 2 | 2 | 1 *(open note)* | 2 | 1 |
| `powerplay_model` | NONE \| ODI_3PHASE \| T20_6OVER \| HUNDRED_25BALL \| CUSTOM | NONE | NONE | ODI_3PHASE | T20_6OVER | CUSTOM | HUNDRED_25BALL |
| `odi_close_catchers_first10` | bool | — | — | true | — | — | — |
| `powerplay_reduction_table` | ref | — | — | ICC ODI | ICC T20I | competition | ECB Hundred |
| `drs_enabled` | bool | false | true | true | true | false | false |
| `player_reviews_per_innings` | int | — | 3 | 2 | 2 | — | — |
| `umpires_call_enabled` | bool | — | true | true | true | — | — |
| `review_request_seconds` | int | — | 15 | 15 | 15 | — | — |
| `timed_out_limit_seconds` | int | 180 | 120 *(open note)* | 120 | 120 | 180 | 120 |
| `declarations_permitted` | bool | true | true | false | false | true *(if declaration match)* | false |
| `follow_on_margin` | int (derived from days) | 200/150/100/75 | 200 | — | — | — | — |
| `minimum_overs_for_result` | int (per side) | — | — | 20 | 5 | 20 | 25 balls *(open note)* |
| `tie_breaker` | NONE \| SUPER_OVER \| BOUNDARY_COUNTBACK \| BOWL_OUT \| SHARED | NONE | NONE (draw model) | SUPER_OVER *(knockouts)* / NONE *(bilateral)* | SUPER_OVER *(knockouts)* / NONE | per competition | SUPER_OVER |
| `super_over_batting_order` | rule | — | — | SECOND_BATS_FIRST | SECOND_BATS_FIRST | — | SECOND_BATS_FIRST |
| `super_over_tie_resolution` | REPEAT \| BOUNDARY_COUNTBACK \| SHARED | — | — | REPEAT | REPEAT | — | REPEAT |
| `rain_method` | DLS_STANDARD \| DLS_PROFESSIONAL \| VJD \| NONE | NONE | NONE | DLS_STANDARD | DLS_STANDARD | NONE | DLS_STANDARD |
| `dls_g50` | number | — | — | *(current ICC value)* | *(T20 value)* | — | *(Hundred value)* |
| `dls_resource_table` | ref/version | — | — | Standard vX | Standard vX | — | Hundred vX |
| `concussion_replacement_enabled` | bool | false | true | true | true | false | true |
| `impact_player_enabled` | bool | false | false | false | false | false | false |
| `keeper_substitute_requires_consent` | bool | true | true | true | true | true | true |
| `runners_enabled` | bool | false | false | false | false | false | false |
| `mankad_enabled` | bool | true | true | true | true | true | true |
| `penalty_run_amount` | int | 5 | 5 | 5 | 5 | 5 | 5 |
| `over_rate_penalty_model` | NONE \| T20I_INFIELD \| WTC_POINTS \| RUNS_PENALTY | NONE | WTC_POINTS | NONE | T20I_INFIELD | NONE | per competition |
| `track_batting_minutes` | bool | true | true | false | false | false | false |
| `bowling_figures_unit` | OVERS \| BALLS | OVERS | OVERS | OVERS | OVERS | OVERS | BALLS |
| `commentary_token_style` | enum | house | house | house | house | house | house |
| `last_man_stands` | bool | false | false | false | false | false | false |
| `projection_rates` | list | [current] | — | [6,8,10] | [8,10,12] | [6,8,10] | [8,10,12] |

**Open clarification notes (feed spike SPK-01 and product decisions):**
1. `bouncers_per_over` for T20I — ICC has trialled 2 per over; confirm the value to ship as default.
2. `timed_out_limit_seconds` — confirm current ICC value (120 vs 180) per format edition in force.
3. `minimum_overs_for_result` for The Hundred — confirm the balls-per-side threshold.
4. `dls_g50` and `dls_resource_table` — **blocked on DLS licensing (SPK-01)**; if unlicensed, ship `rain_method = NONE` (manual targets only) and treat all DLS requirements as `[CFG]`-off.
5. `nb_wd_secondary_extras_itemised` default — confirm against the accredited-scorer convention the pilot leagues use (ACS&S vs ICC/CA).
6. `new_ball_policy` for ODI — monitor the ICC single-ball-from-over-35 change; keep as `[CFG]`.

---

## 36. Glossary (selected)

- **All out** — batting side cannot continue for want of available batters (normally 10 dismissed).
- **Dead ball** — the ball is not in play; no runs or dismissals (bar prior penalties).
- **Draw** — multi-innings match, time expired, no side won on aggregate/completion. **≠ Tie.**
- **Extras / sundries** — runs not credited to a batter: byes, leg-byes, wides, no-balls, penalty runs.
- **Free hit** — the delivery after a (qualifying) no-ball on which the striker can be out only run out / obstructing / hit the ball twice.
- **Maiden** — an over with no runs off the bat and no wides/no-balls conceded.
- **Par score (DLS)** — the score the side batting second must equal at a given point to be level on DLS.
- **Powerplay** — a phase with tighter fielding restrictions (fewer fielders permitted outside the circle).
- **Resources (DLS)** — the percentage combining overs remaining and wickets in hand.
- **Retired – not out / retired hurt** — a batter leaves the crease for an unavoidable cause; not a dismissal; may resume.
- **Retired out** — a batter leaves for any other cause without opposing-captain consent to return; counts as a wicket, no bowler credit.
- **Strike** — which batter is facing; changes on odd running and at the end of an over.
- **Super Over** — one-over-per-side eliminator to break a tie.
- **Tie** — scores exactly level with the side batting last having completed its innings (or aggregates level).

---

## 37. Change Log

| Version | Date | Summary |
|---|---|---|
| **0.1.0** | 2026-09-02 | Initial draft. Full coverage of the requested domain areas with `[LAW]/[PRD]/[CFG]/[EDGE]` classification and stable requirement IDs. **Not yet reviewed by an accredited scorer.** DLS section provisional pending licensing (SPK-01). Open clarification notes in §35. |

**Ratification checklist before v1.0.0:** accredited-scorer review of every `[LAW]` and `[EDGE]` item against the current MCC Laws and ICC Playing Conditions editions; resolve §35 open notes; confirm DLS licensing; add worked examples per dismissal mode and per DLS scenario as the conformance-suite oracle (discovery `NFR-053`).

---

## Requirement count (v0.1.0)

| Area | IDs | Area | IDs |
|---|---|---|---|
| Formats `FMT` | 16 | Free hit `FH` | 12 |
| Teams `TEAM` | 11 | Wickets general `WKT` | 15 |
| Players `PLYR` | 13 | Bowled `BWLD` | 8 |
| Officials `OFCL` | 11 | Caught `CAUT` | 13 |
| State `STATE` | 7 | LBW `LBW` | 7 |
| Innings `INN` | 15 | Stumped `STMP` | 7 |
| Overs `OVER` | 15 | Run out `RNO` | 14 |
| Balls `BALL` | 13 | Non-striker RO `NSRO` | 9 |
| Runs `RUN` | 18 | Hit wicket `HITW` | 7 |
| Strike `STRK` | 17 | Obstructing `OBSF` | 8 |
| Extras `EXT` | 9 | Hit ball twice `HBT` | 6 |
| No-ball `NB` | 16 | Timed out `TIMO` | 7 |
| Wide `WD` | 14 | Retired hurt `RTHO` | 9 |
| Bye `BYE` | 8 | Retired out `RTOU` | 6 |
| Leg-bye `LB` | 10 | Bowling `BOWL` | 16 |
| Penalty `PEN` | 11 | Batting `BAT` | 12 |
| Partnerships `PART` | 8 | Powerplays `PP` | 12 |
| Reviews `DRS` | 14 | Declarations `DECL` | 8 |
| Follow-on `FLW` | 8 | Results `RES` | 16 |
| Target `TGT` | 11 | DLS `DLS` | 18 |
| Super Over `SO` | 18 | Scorecard `SCRD` | 28 |
| Commentary `CMTRY` | 13 | Corrections `CORR` | 19 |
| Invariants `INV` | 18 | Config registry `CFG-REG` | ~55 keys |

**≈ 640 classified requirements** across 34 domain areas.

---

### Next steps

1. **Accredited-scorer ratification pass** — mark each `[LAW]`/`[EDGE]` as *confirmed* against a cited Law/PC clause; this becomes the conformance-suite oracle.
2. **Resolve §35 open notes** and **SPK-01 (DLS licensing)** — until then, ship `rain_method = NONE`.
3. **Worked examples** — one per dismissal mode, per extra type, and a benchmark DLS scenario set, each traced to its requirement IDs.
4. Every downstream feature spec under `docs/specs/` defers to these IDs rather than restating rules.
