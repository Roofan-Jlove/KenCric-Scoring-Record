# Cricket Scoring — Domain Glossary (Ubiquitous Language)

| | |
|---|---|
| **Document** | Domain Glossary |
| **Version** | 0.1.0 (Draft) |
| **Date** | 2026-09-02 |
| **Upstream** | `docs/specs/cricket-rules-reference.md` v0.1.0 |
| **Companion** | `docs/domain/domain-model.md` |

This is the shared vocabulary. Every term used in the domain model, feature specs, code, tests and conversation MUST use these words with these meanings. Terms are grouped; each entry notes the model object(s) that carry it and the source requirement area.

---

## A. Structural terms

| Term | Meaning | Model carrier |
|---|---|---|
| **Match** | One contest between two Teams, governed by one Playing Conditions Profile, producing one Result. | `Match` aggregate root |
| **Format** | The shape of a match: innings per side, over limits, ball rules, permitted endings. | `Format` (VO), `FMT-*` |
| **Playing Conditions Profile** | The complete resolved set of configurable rule values (`[CFG]`) in force for a match, frozen at first delivery. | `PlayingConditionsProfile` (VO) |
| **Innings** | One period in which one Team bats and the other bowls, ending by a defined reason. A match has 1 or 2 innings per side. | `Innings` entity |
| **Over** | A set of legal deliveries (6 by default) bowled from one end by one bowler; ends changed each over. | `Over` entity |
| **Block** (The Hundred) | 5 or 10 consecutive legal balls bowled by one bowler; replaces the "no two consecutive overs" rule. | `Over` entity (variant) |
| **Delivery** | The atomic scoring event: one ball bowled (legal or illegal) with its full outcome. | `Delivery` entity |
| **Ball** | Informal synonym for Delivery; "legal ball" = a delivery that counts toward the over. | — |
| **Super Over** | A one-over-per-side tie-breaker mini-innings pair, max 2 wickets each. | `SuperOver` entity |
| **Match Timeline** | The ordered log of every domain event for a match (deliveries + non-delivery markers). | `Match` aggregate event stream |

## B. Scoring outcome terms

| Term | Meaning | Model carrier |
|---|---|---|
| **Run** | A unit of score. Off the bat → credited to the striker; otherwise an extra. | `RunLine` (VO) |
| **Boundary** | 4 (ball reaches boundary along ground / after bouncing) or 6 (over the boundary on the full from the bat). | `RunLine.boundary` |
| **Extra / Sundry** | A run not credited to a batter: bye, leg-bye, wide, no-ball, penalty. | `ExtrasBreakdown` (VO) |
| **Bye** | Runs when a legal delivery passes the striker untouched; legal ball; team extra. | `DeliveryOutcome` |
| **Leg-bye** | Runs off the striker's body (not bat) when a shot or evasion was attempted; legal ball; team extra. | `DeliveryOutcome` |
| **Wide** | An illegal delivery out of the striker's reach; 1-run penalty + any runs, all wides; re-bowled. | `DeliveryLegality = WIDE` |
| **No-ball** | An illegal delivery (foot fault, throw, dangerous, fielding breach, etc.); penalty + runs; re-bowled; may trigger a free hit. | `DeliveryLegality = NO_BALL` |
| **Penalty runs** | 5 runs awarded to a side for an infringement by the other; no ball faced. | `PenaltyRuns` event / `ExtrasBreakdown.penalty` |
| **Free hit** | The delivery after a qualifying no-ball on which the striker can be out only run out / obstructing / hit the ball twice. | `Delivery.isFreeHit` |
| **Short run** | A run not completed because a batter did not ground bat/person behind the crease; not scored. | `RunLine.shortRuns` |
| **Overthrow** | Extra runs (incl. a boundary) resulting from a wild throw / wilful fielder act. | `RunLine.overthrow` |
| **Dot ball** | A legal delivery from which no run is scored. | derived |
| **Maiden** | An over conceding no runs off the bat and no wides/no-balls (byes/leg-byes allowed). | `Over.isMaiden` (derived) |
| **Dead ball** | The ball is not in play; no runs or dismissals may occur. | `DeliveryLegality`/`DeadBall` outcome |

## C. Dismissal terms

| Term | Meaning | Model carrier |
|---|---|---|
| **Wicket** | A dismissal; also the physical stumps+bails ("the wicket is put down"). Count of dismissals = wickets lost. | `Wicket` entity |
| **Dismissal Mode** | One of: bowled, caught, caught & bowled, LBW, run out, non-striker run out (mankad), stumped, hit wicket, obstructing the field, hit the ball twice, timed out, retired out. | `DismissalMode` (enum VO) |
| **Bowler credit** | Whether the dismissal is attributed to the bowler's figures (bowled, caught, LBW, stumped, hit wicket only). | `Wicket.creditsBowler` (derived) |
| **Fall of Wicket (FoW)** | The record of each dismissal: team score, wicket number, batter, over.ball. | `FallOfWicket` (VO) |
| **Retired – not out / retired hurt** | A batter leaves the crease for an unavoidable cause; not a dismissal; may resume. | `BatterCardLine.status` |
| **Retired out** | A batter leaves for any other cause without opposing-captain consent; counts as a wicket, no bowler credit. | `Wicket` (mode = RETIRED_OUT) |
| **Absent** | A batter unavailable to bat at all; not a dismissal; does not count toward wickets. | `BatterCardLine.status` |
| **All out** | An innings ends because the batting side has no further available batters (usually 10 dismissed; fewer with absent/retired-not-out). | `InningsEndReason = ALL_OUT` |

## D. Role & participant terms

| Term | Meaning | Model carrier |
|---|---|---|
| **Team** | One of the two sides in a match; links to a canonical competition team or is ad-hoc. | `Team` aggregate |
| **Squad** | The pool of players a team may pick from. | `Squad` (VO / entity in Team aggregate) |
| **Playing XI / Nominated Side** | The (usually) 11 players nominated to play, given before the toss. | `NominatedSide` (VO) |
| **Player** | A person who plays; has a canonical registry identity where linked. | `Player` aggregate |
| **Striker / Non-striker** | The batter facing / at the bowler's end. | `Innings.batStriker` / `batNonStriker` |
| **Batter** | A player currently or previously batting in an innings. | `BatterCardLine` entity |
| **Bowler** | A player bowling / who has bowled in an innings. | `BowlerCardLine` entity |
| **Wicket-keeper** | The one player per side positioned behind the stumps; may change during an innings. | `NominatedSide.keeper` / `Innings.currentKeeper` |
| **Captain** | The one acting captain per side; makes toss, declaration, follow-on, review decisions. | `NominatedSide.captain` |
| **Substitute fielder** | A non-XI player fielding for an absent fielder; may not bat/bowl/keep/captain. | `SubstituteAppearance` (VO) |
| **Concussion replacement** | A sanctioned like-for-like replacement who takes a full part; replaced player takes no further part. | `PlayerReplacement` entity |
| **Impact / replacement player** | A competition-specific full replacement (default disabled). | `PlayerReplacement` entity |
| **Runner** | A substitute who runs for an injured batter (not in the Laws; default disabled). | `PlayerReplacement` (variant) |
| **Umpire** | One of two on-field officials; also third/fourth/reserve and match referee. | `MatchOfficials` (VO) |
| **Scorer** | One of the (usually two) officials keeping the record; may be Head Scorer or Assistant/Co-Scorer. | `ScorerAssignment` (VO) |

## E. Result & interruption terms

| Term | Meaning | Model carrier |
|---|---|---|
| **Toss** | The pre-match coin toss; winner elects to bat or field; sets initial innings order. | `Toss` (VO) |
| **Target** | The score the side batting last must reach to win: opponent total + 1, or DLS-revised. | `Target` (VO) |
| **Result** | The outcome of the match: win (by runs / wickets / innings / DLS / Super Over), tie, draw, no result, abandoned, awarded. | `Result` (VO) |
| **Draw** | A multi-innings match where time expired with no positive result. Distinct from a tie. | `ResultType = DRAW` |
| **Tie** | Scores exactly level with the side batting last having completed its innings (or aggregates level). | `ResultType = TIE` |
| **No result** | A limited-overs match that did not reach the minimum overs for a result and cannot be decided by DLS. | `ResultType = NO_RESULT` |
| **Abandoned** | A match called off; optionally "without a ball bowled". | `ResultType = ABANDONED` |
| **Declaration** | The batting captain closes an innings early (formats not limited by overs). | `Declaration` event |
| **Forfeiture** | A captain gives up an innings; it counts as completed. | `Forfeiture` event |
| **Follow-on** | Requiring the side that trailed by ≥ the margin to bat again immediately (two-innings formats). | `FollowOnDecision` (VO) |
| **Interruption** | A stoppage (rain, bad light, etc.) with a start and end time; may cause overs lost. | `Interruption` entity |
| **DLS Revision** | A versioned recalculation of target/par using the Duckworth–Lewis–Stern method after an interruption. | `DlsRevision` entity |
| **Par score** | The score the side batting second must equal at a given point to be level on DLS. | `DlsRevision.parLadder` |
| **Net Run Rate (NRR)** | A competition tie-break metric: runs-per-over for minus against, all-out counted as full quota. | Competition read model |
| **Powerplay** | A phase with tighter fielding restrictions; recorded per delivery as a phase label. | `PowerplayPhase` (VO) |
| **Review (DRS)** | A challenge to an on-field decision; outcome is upheld / overturned / umpire's call. | `Review` entity |

## F. Record-integrity terms

| Term | Meaning | Model carrier |
|---|---|---|
| **Event** | An immutable fact that happened in the domain, named in the past tense. | Domain events |
| **Command** | A request to change state, which may be accepted (emitting events) or rejected. | Commands |
| **Amendment / Correction** | A superseding event that changes a prior record without deleting it. | `*Corrected` events |
| **Superseding** | The relationship from an amendment to the original event it replaces. | `supersedes` link |
| **Cascade** | The downstream recomputation and re-evaluation triggered by an amendment (esp. strike continuity). | domain service |
| **Reconciliation** | Checking that all derived figures satisfy the invariants; done at each interval and at sign-off. | `ReconciliationReport` (VO) |
| **Sign-off** | The Head Scorer's act of making a match `FINAL`; may require counter-signature. | `SignOff` (VO) / event |
| **Provenance** | Who/what/when/where a piece of the record came from (scorer, device, app version). | `Provenance` (VO) |
| **Snapshot / Scorecard-at** | A materialised view of the match state as at a given event ordinal or timestamp. | `ScorecardSnapshot` read model |
| **Divergence** | A per-delivery disagreement between two independent scorer logs of the same match. | `Divergence` (VO), dual-scorer |
| **Playing Conditions freeze** | The rule that `[CFG]` values are fixed at the first delivery and only changed by explicit amendment. | `Match.conditionsFrozenAt` |
