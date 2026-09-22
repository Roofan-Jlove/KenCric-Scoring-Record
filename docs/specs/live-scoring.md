# Cricket Scoring Book — Live Scoring: Ball-Processing Specification

| | |
|---|---|
| **Document** | Live Scoring Ball-Processing Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-21 |
| **Upstream** | `docs/specs/cricket-rules-reference.md` v0.1.0 · `docs/domain/domain-model.md` v0.1.0 · `docs/specs/software-requirements-specification.md` v0.1.0 · `docs/architecture/system-architecture.md` v0.1.0 · `docs/ux/ux-specification.md` v0.1.0 |
| **Downstream** | The shared scoring core implementation (`SVC-STRIKE-RESOLVER`, `SVC-EXTRAS-DECOMPOSER`, `SVC-INNINGS-END-EVALUATOR`, `SVC-CASCADE-RECOMPUTER`, `SVC-RECONCILER`) · the cricket-rules conformance suite |
| **Status** | A **deterministic rules specification** — decision tables, formulas, and structured algorithm steps that a developer implements against. **Not source code** (no target-language syntax is used) and **not UI design** (see `docs/ux/ux-specification.md` UX-10…UX-19 for screens; this document is what those screens call). |

> Models every scorer action, ball by ball, as one deterministic processing pipeline plus a set of composable decision rules. For every delivery it fixes: Input, Validation, Score calculation, Batter state, Bowler state, Team score, Over state, Wicket state, Strike state, Event generated, Audit record, Undo behavior, and Correction behavior — so two independent implementations (Web and Android, per `ADR-T01`/`ADR-04`) produce byte-identical results for identical input, which is the parity requirement (`NFR-047/048`) this whole document exists to satisfy.

---

## 1. Purpose, determinism contract, and structure

### 1.1 What "deterministic" means here

**Same pre-state + same input ⇒ same output, always, on every platform, forever.** No step below consults wall-clock time, randomness, or any external service to decide a scoring outcome. Every rule is a pure function of (a) the current match/innings/over/batter/bowler state and (b) the scorer's explicit input. This is the concrete implementation target for `NFR-034` (deterministic, replayable engine) and `NFR-047/048` (cross-platform parity).

### 1.2 Why this document is structured as rules, not a delivery-type list

A naive "for every delivery type, define these 13 things" reading would enumerate deliveries combinatorially (legal/wide/no-ball × 0–6+ runs × boundary/not × wicket/not × 12 dismissal modes × free-hit/not × short-run/not …) — thousands of nominal combinations, most of them thin restatements of the same few rules. That approach cannot be exhaustive and does not give developers rules "without guessing" — it gives them a finite example list and leaves the gaps to guesswork.

Instead, §5–§20 define **one general processing pipeline** with **general, composable rules per step** — these rules cover *every* combination by construction, not by enumeration. §22 then supplies a **compact case catalogue** (~50 rows) as a concrete conformance-test vector set, and §23 gives **fully worked examples** for the dozen trickiest cases, walking through all 13 required dimensions in full. Together: general rules for completeness, worked cases for verification.

### 1.3 Classification tags

Reused from `cricket-rules-reference.md §0.1`, plus one addition:

| Tag | Meaning |
|---|---|
| `[LAW]` | Directly from the MCC Laws of Cricket / ICC Standard Playing Conditions. |
| `[PRD]` | A product/scoring convention where the Laws are silent or where common scoring practice, not Law text, governs (e.g. how a value is tallied on a card). |
| `[CFG]` | Configurable per `CFG-REG`; the rule states the default and that it is a config point. |
| `[EDGE]` | A rare but legally real case, handled explicitly so it isn't missed. |
| `[OPEN]` | **New in this document.** A rule this specification states as its working default but that is **not yet confirmed** by an accredited-scorer ratification pass (per `docs/README.md` Status). Implement the stated default; do not treat it as beyond question. |

### 1.4 Notation

- `Σ` = sum. `mod` = modulo. `⇒` = "implies." `∈ {…}` = "is one of."
- Identifiers are written `like_this` as pseudo-field-names — they name a concept precisely; they are **not** a programming-language declaration.
- A rule stated as a table row is as binding as a rule stated in prose; tables exist for scannability, not to demote precision.
- "Delivery" and "ball" are used interchangeably per the glossary; "legal ball" specifically means a delivery that counts toward the six-ball (or configured block-length) over.

---

## 2. The delivery pre-state

Before any delivery can be processed, the engine holds this state (all of it is either config, frozen at first ball, or the output of folding prior delivery events — nothing here is asserted independently, per `MBR-01/06`):

| State object | Key fields the pipeline reads |
|---|---|
| **ConditionsProfile** *(frozen at first ball, `MINV-05`)* | `ballsPerOver` (default 6; block length for Hundred-style formats), `bowlerOverCap`, `freeHitOnNoBall` (bool), `freeHitTriggerNoBallKinds` (subset, default = all), `maxWicketsPerInnings` (default 10), `powerplayPlan`, `lastManStands` (bool, default false), `rainMethod`. |
| **InningsState** | `inningsId`, `battingTeamId`, `bowlingTeamId`, `totalRuns`, `extras` (by category), `wicketsLost`, `legalBallsBowled`, `target` (nullable), `freeHitPending` (bool), `strikerBatterId`, `nonStrikerBatterId`, `currentBowlerId`, `previousOverBowlerId`. |
| **OverState** (current over) | `overNumber`, `legalBallCount` (0..`ballsPerOver`), `runsThisOver`, `wicketsThisOver`, `isMaidenSoFar` (bool, starts true). |
| **BatterCardLine** (per batter) | `runs`, `ballsFaced`, `fours`, `sixes`, `status` (`NOT_OUT` \| `OUT` \| `RETIRED_NOT_OUT` \| `RETIRED_OUT` \| `ABSENT`), `dismissal` (nullable detail). |
| **BowlerCardLine** (per bowler) | `legalBallsBowled`, `oversBowled` (derived display), `maidens`, `runsCharged`, `wickets`, `widesBowled`, `noBallsBowled`. |
| **XI context** | Batting XI, fielding XI, who is captain/keeper, substitute pool, not-yet-out batters remaining. |

All of these are **derived by folding the active event stream** (`MBR-07`); none is independently stored truth. The pipeline below reads them as inputs and the outputs it produces are exactly the deltas that, folded again, reproduce the same numbers — this is what makes Undo and Correction safe (§19–§20).

---

## 3. The canonical Delivery Input schema

**Every** delivery — legal, wide, no-ball, or dead ball, with or without a wicket — is captured through this one input shape. The scorer's UI (`docs/ux/ux-specification.md` UX-11/12/13) collects a subset of these fields per screen; they are combined into one `DeliveryInput` before validation. **Legality and run classification are always an explicit scorer declaration** — the engine has no independent way to observe the physical ball, so it never infers legality; it only validates the declared input for internal consistency.

| Field | Type | Required | Notes |
|---|---|---|---|
| `legality` | `LEGAL` \| `WIDE` \| `NO_BALL` \| `DEAD_BALL` | always | Declared by the scorer (UX-11 default = `LEGAL`; UX-13 sets `WIDE`/`NO_BALL`). |
| `strikerBatterId` | id | always | The crease context *at the moment this ball is bowled* — captured explicitly on the event, not re-derived later, per `MINV-04`. |
| `nonStrikerBatterId` | id | always | As above. |
| `bowlerId` | id | always | As above. |
| `isFreeHit` | bool | always | Copied from `InningsState.freeHitPending` at the moment of entry (read-only badge in UX-11, not user-editable). |
| `runEvents` | list of `RunEvent` (§7.1) | always (may be empty list) | The full run decomposition for this delivery — see §7. |
| `shortRuns` | integer ≥ 0 | optional, default 0 | Runs disallowed for failing to ground bat/person (§8). |
| `wicket` | `WicketDetail`\|`null` (§9.2) | optional | Present only if a dismissal occurred on this delivery. |
| `deadBallReason` | string | required iff `legality = DEAD_BALL` | Free text or preset reason. |
| `commentary` | string \| `null` | optional | Never blocks submission (`FR-062`). |
| `overrideReason` | string \| `null` | required iff a guardrail is being overridden (§4) | Audited per `AUD-005`. |

**Cross-field constraint:** if `legality = DEAD_BALL`, `runEvents` **must** be empty and `wicket` **must** be `null` (§6.4). If `wicket` is present, `wicket.outBatterId ∈ {strikerBatterId, nonStrikerBatterId}`.

---

## 4. Guardrail preconditions (pipeline Step 0)

Before any input is even accepted for validation, the following must hold, or the delivery is refused outright (not merely flagged):

1. The innings is in an active, scoreable state (`SM-INNINGS` = `IN_PROGRESS`; not `INNINGS_BREAK`, not `COMPLETE`).
2. The match is not paused (`UX-19` not in `Paused` state).
3. `strikerBatterId`, `nonStrikerBatterId`, and `bowlerId` are all set (`FR-042`; if not, the client must not even present ball-entry — this is enforced defensively here too).
4. No other blocking guardrail modal is currently open for this innings (bowler-change prompt, over-completion interstitial) — those must be resolved first, in the order they arose.
5. The current bowler is legal to bowl this over: not the immediately preceding over's bowler (`BR-027`) and not already at `bowlerOverCap` (`BR-028`) — **unless** `overrideReason` is supplied by an authorised role (§2.5 pattern in the UX spec; `AUD-005`).

Any failure of 1–4 is a hard refusal (input never reaches Step 1). Failure of 5 without an override is a blocking guardrail (`UX-15`); with a valid override it proceeds and the override is recorded on the resulting event's `overrideReason` field.

---

## 5. Validation rules (Step 1)

Field-level and cross-field checks run **after** guardrails pass and **before** any state mutation. All must pass for the delivery to be accepted; any failure returns a specific, field-attributed rejection (never a generic error, per `docs/ux/ux-specification.md §2.2`).

| # | Rule | Scope |
|---|---|---|
| V1 | `legality` ∈ the four allowed values. | field |
| V2 | Every `RunEvent.value ≥ 0`; every `RunEvent.origin`/`method` combination is one of the valid pairs in §7.3. | field |
| V3 | `shortRuns ≤` the sum of `RunEvent.value` where `method = RUN` (cannot disallow more running-runs than were attempted). | cross-field |
| V4 | If any `RunEvent.method = BOUNDARY`, no `RunEvent.method = OVERTHROW` may exist on the same delivery (§7.4 — a boundary means the ball is already dead; an overthrow requires the ball still in play). | cross-field |
| V5 | If `wicket` is present, `wicket.mode` is a member of the set of modes **valid for this delivery's `legality`/`isFreeHit`** (§9.1's matrix) — an invalid mode for the context is rejected, not silently downgraded. | state-dependent |
| V6 | If `wicket.mode ∈ {BOWLED, CAUGHT, LBW, STUMPED, HIT_BALL_TWICE}`, all `RunEvent`s **must** total zero (§9.3 — no runs are possible on a delivery ending in one of these five modes). | state-dependent |
| V7 | If `wicket` is present and `wicket.mode` requires a fielder (`CAUGHT`, `RUN_OUT`, `STUMPED`, `OBSTRUCTING_THE_FIELD` when a fielder is involved), `wicket.fielderIds` is non-empty. | state-dependent |
| V8 | `wicket.incomingBatterId`, when required (§9.5), is a batter in the batting XI with `status = NOT_OUT` who has not yet batted this innings (or is legitimately resuming, §9.6). | state-dependent |
| V9 | If `legality = NO_BALL` and `isFreeHit = true` simultaneously is impossible **as input** (a free hit is a property of the *next legal* delivery, not of a no-ball itself) — reject if both are set. | cross-field |
| V10 | `overrideReason` is non-empty whenever a guardrail override is in effect (§4.5, or a reconciliation override at sign-off, out of scope here). | field |
| V11 | If `legality = DEAD_BALL`: `runEvents = []`, `wicket = null`, `deadBallReason` non-empty (mirrors the Input schema constraint, enforced here as a validation rule, not just a schema note). | cross-field |

---

## 6. Legality classification and ball-count contribution (Step 2)

`legality` is scorer-declared (§3), so "classification" here means **deriving its two downstream consequences** deterministically — nothing more is inferred.

### 6.1 Does this delivery consume a legal-ball slot?

| `legality` | Consumes a legal-ball slot? | Rationale |
|---|---|---|
| `LEGAL` | **Yes** | The baseline case, always. |
| `WIDE` | **No** | Re-bowled (`BR-035`). |
| `NO_BALL` | **No** | Re-bowled (`BR-035`). |
| `DEAD_BALL` | **No** | Not in play; void in every respect. |

This is independent of whether the delivery carried byes/leg-byes: **a bye or leg-bye is a `RunEvent.origin`, not a `legality` value** (§7) — the underlying delivery can be `LEGAL` (the normal case) or, rarely, `NO_BALL` (a no-ball on which byes/leg-byes also occurred). A bye/leg-bye on a `LEGAL` delivery still consumes a legal-ball slot (it *is* a legal ball); a bye/leg-bye on a `NO_BALL` does not (the no-ball classification governs, per row above).

### 6.2 Does the striker's `ballsFaced` increment?

| `legality` | `ballsFaced` increments? | `[LAW]`/`[PRD]` basis |
|---|---|---|
| `LEGAL` | **Yes** | `[LAW]` |
| `WIDE` | **No** | `[LAW]` — the delivery was not a fair attempt to reach the striker. |
| `NO_BALL` | **Yes** | `[LAW]` — the striker did face it; only the *legal-ball count* excludes no-balls, not the batting figures (`INV-008`: `Σ batter.balls_faced = legal_balls + no_balls_faced`, minus wides). |
| `DEAD_BALL` | **No** | The delivery is void in full. |

### 6.3 Bowler's `legalBallsBowled` increment

Identical to §6.1's legal-ball-slot rule — the bowler's over progress and the innings' over progress are the same counter (`INV-002/003`).

### 6.4 `DEAD_BALL` short-circuits everything

If `legality = DEAD_BALL`: **no** `RunEvent`s, **no** wicket, **no** ball-count change on either the over or the striker, **no** bowler-figure change. The only state change is that the event is recorded (for the ball-by-ball log and audit trail) with its `deadBallReason`. Processing skips directly from Step 2 to Step 13 (event emission) for this case.

---

## 7. Score calculation — the `RunEvent` model (Step 3)

This is the single mechanism that makes runs/extras composable rather than combinatorial: **a delivery's total is a list of independent `RunEvent`s**, each individually classified, then aggregated by formula. Every run scenario in cricket — off the bat, byes, leg-byes, wides, no-ball penalties, no-ball-plus-byes, penalty runs, overthrows, and every combination of these — is expressed as one or more `RunEvent`s. Nothing is hard-coded per scenario; the aggregation formulas in §7.2 apply uniformly.

### 7.1 `RunEvent` structure

| Field | Values | Meaning |
|---|---|---|
| `origin` | `OFF_BAT` \| `BYE` \| `LEG_BYE` \| `WIDE` \| `NO_BALL_PENALTY` \| `NO_BALL_BAT` \| `NO_BALL_BYE` \| `NO_BALL_LEG_BYE` \| `PENALTY` | What category of run this is — drives which score bucket it lands in. |
| `value` | integer ≥ 0 | The number of runs this specific `RunEvent` contributes. |
| `method` | `RUN` \| `BOUNDARY` \| `OVERTHROW` \| `AUTOMATIC` | **How** the runs arose — this, not `origin`, drives strike-rotation eligibility (§14). |
| `awardedToTeamId` | id, only on `PENALTY` | Penalty runs may be awarded to either side (§7.6); every other origin implicitly belongs to the batting side. |

`method` meanings: `RUN` = completed by the batters running between the wickets (contributes to strike rotation). `BOUNDARY` = the ball crossed the boundary, no running occurred for this portion (never contributes to rotation). `OVERTHROW` = additional runs from a fielding error after the ball was already returned/in play, credited to the same `origin` as the original stroke, but **never** itself a running-contribution (the batters didn't run these; see §7.5). `AUTOMATIC` = a fixed award not tied to running or a boundary (the base wide/no-ball penalty run, penalty runs) — never contributes to rotation.

A single delivery normally carries **one** `RunEvent`, but composite scenarios (e.g. 1 run completed, then an overthrow for 4 more) carry **multiple**, each independently valid.

### 7.2 Aggregation formulas

Given a delivery's `runEvents` list `R`:

- **Total runs on the delivery:** `total = Σ r.value for r in R` (before the `shortRuns` deduction, §8).
- **Runs credited to the batter (off the bat):** `batterRuns = Σ r.value for r in R where r.origin ∈ {OFF_BAT, NO_BALL_BAT}`.
- **Runs to a specific extras category:** `extras[category] = Σ r.value for r in R where r.origin maps to that category`, using the mapping: `BYE → byes`, `LEG_BYE → legByes`, `WIDE → wides`, `{NO_BALL_PENALTY} → noBalls`, `NO_BALL_BYE → byes` *(the byes bucket, even though it occurred on a no-ball — `[PRD]`, matches standard scorecards which show one "b" column)*, `NO_BALL_LEG_BYE → legByes` *(same reasoning)*, `PENALTY → penalty`. Note `NO_BALL_BAT` is **not** an extra — it is batter runs, exactly like `OFF_BAT`, that merely happened to occur on an illegal delivery; the no-ball's own penalty run (`NO_BALL_PENALTY`) is the only part of a no-ball that is itself an extra.
- **Runs charged to the bowler:** `bowlerRunsCharged = Σ r.value for r in R where r.origin ∈ {OFF_BAT, NO_BALL_PENALTY, NO_BALL_BAT, WIDE}` — i.e. everything **except** byes, leg-byes (in any form, including on a no-ball) and penalty runs (`[LAW]`, underlies `INV-004`).
- **Runs "ran" (used only for strike rotation, §14):** `ranRuns = Σ r.value for r in R where r.method = RUN`.

### 7.3 Valid `(origin, method)` pairs

| `origin` | Valid `method` values |
|---|---|
| `OFF_BAT` | `RUN`, `BOUNDARY`, `OVERTHROW` |
| `NO_BALL_BAT` | `RUN`, `BOUNDARY`, `OVERTHROW` |
| `BYE` | `RUN`, `BOUNDARY`, `OVERTHROW` |
| `LEG_BYE` | `RUN`, `BOUNDARY`, `OVERTHROW` |
| `NO_BALL_BYE` | `RUN`, `BOUNDARY`, `OVERTHROW` |
| `NO_BALL_LEG_BYE` | `RUN`, `BOUNDARY`, `OVERTHROW` |
| `WIDE` | `RUN`, `BOUNDARY` *(an overthrow on top of a wide is legal but vanishingly rare; permitted — `OVERTHROW` is not excluded, listed here for completeness)* |
| `NO_BALL_PENALTY` | `AUTOMATIC` only — always `value = 1` |
| `PENALTY` | `AUTOMATIC` only — always `value = 5` (`[LAW]`, `BR-036`) |

Any other pairing fails validation rule V2.

### 7.4 Boundary/overthrow mutual exclusivity `[LAW]`

Once a `RunEvent` with `method = BOUNDARY` exists, the ball is dead — nothing further can be added on that delivery via `OVERTHROW` (V4). An overthrow can only occur while the ball is still live and being returned, which by definition means it had **not** yet reached the boundary.

### 7.5 Overthrow crediting `[LAW]`

Overthrow runs are always credited to the **same** `origin` as the `RunEvent` immediately preceding them on the same delivery (an overthrow after a batted run is `OFF_BAT`/`OVERTHROW`; an overthrow after a bye is `BYE`/`OVERTHROW`, etc.) and are **additive** to the total, but **contribute zero to `ranRuns`** — the batters did not run the overthrow portion; it was awarded for the fielding error. Example: striker runs 1 (`OFF_BAT`/`RUN`, value 1), then the return throw is fumbled and goes for an extra 4 (`OFF_BAT`/`OVERTHROW`, value 4) → `batterRuns = 5`, `ranRuns = 1` (odd → strike rotates, driven by the 1 that was genuinely run, not by the total of 5).

### 7.6 Boundary extras "subsume," no-ball penalty is always additive `[LAW]`

- A **wide, bye, or leg-bye that reaches the boundary untouched** is scored as the boundary value alone (typically 4) — the boundary **replaces**, does not add to, whatever minimum would otherwise apply. E.g. a wide that runs away to the fence is **4 wides total**, represented as one `RunEvent(origin=WIDE, value=4, method=BOUNDARY)` — **not** `1 (automatic wide) + 4 (boundary)`. There is no separate "automatic 1" `RunEvent` in this case at all.
- A **no-ball hit for four by the bat** is different: the no-ball's penalty run is independent of what the batter then does with the ball. This is **two** `RunEvent`s: `NO_BALL_PENALTY` (value 1, `AUTOMATIC`) **plus** `NO_BALL_BAT` (value 4, `BOUNDARY`) = **5 total**. The penalty is never subsumed.
- A **plain wide with no boundary** (the batters do not run) is one `RunEvent(origin=WIDE, value=1, method=AUTOMATIC)`. If the batters *do* run additional byes-equivalent runs on a wide (rare but legal), it is `RunEvent(origin=WIDE, value=1, method=AUTOMATIC)` **plus** `RunEvent(origin=WIDE, value=n, method=RUN)` for the `n` additional runs actually run.

### 7.7 Penalty runs `[LAW]`

A `PENALTY` `RunEvent` always has `value = 5`, `method = AUTOMATIC`, and a mandatory `awardedToTeamId` which may be **either** side (`BR-036`). It never faces a delivery in the cricketing sense, though the config point in §7.8 governs whether it consumes a legal-ball slot when it accompanies an otherwise-normal delivery.

- If `awardedToTeamId = battingTeamId`: add 5 to `InningsState.extras.penalty` and to `totalRuns`, as normal.
- If `awardedToTeamId = bowlingTeamId` *(i.e. the fielding side, awarded against the batting side's infringement)*: add 5 to that **other** team's running total directly — a ledger entry against the fielding team's eventual own innings, **not** a deduction from the current batting side's total (`[EDGE]`). This is surfaced on the fielding team's own scorecard as a pre-credited "penalty" line once their innings begins.

### 7.8 Penalty-with-or-without-a-delivery `[CFG]`

Per `DR-16`/`CFG-REG`, a penalty may be configured as (a) awarded with **no delivery bowled** (the commonest case — the engine processes it as its own zero-legal-ball, zero-batter-figure event, entirely separate from any `DeliveryInput`), or (b) **attached to** a normal delivery that is also bowled and scored in the usual way, in which case the `PENALTY` `RunEvent` simply appears alongside whatever other `RunEvent`s that delivery carries, and legal-ball/batter-figure consequences follow the delivery's own `legality` exactly as they would without the penalty.

---

## 8. Short runs (Step 4)

`shortRuns` (§3) is a non-negative integer stating how many attempted running-runs are disallowed for failing to ground bat or person. **Deduction rule `[LAW]`:** the disallowed run(s) are always taken from the **end of the sequence** — batters keep credit for every run completed *before* the short one; only the incomplete run (and any after it, since play cannot continue past it in that channel) is voided.

`effectiveRanRuns = ranRuns − shortRuns` (never below 0; V3 already guarantees `shortRuns ≤ ranRuns`). This adjusted value — not the raw `ranRuns` — is what flows into `batterRuns`, `bowlerRunsCharged`, extras totals, and the strike-rotation calculation in §14. Concretely: if the striker's `RunEvent` was `(OFF_BAT, value=2, method=RUN)` and `shortRuns=1`, the effective credited value is 1, not 2, across every downstream total. No penalty runs are awarded for an *accidental* short run `[LAW]`; deliberate short running to gain an advantage is a distinct, separately-adjudicated offence carrying a 5-run penalty to the fielding side (`[EDGE]`, out of this document's normal-play scope — modelled, if needed, as an additional `PENALTY` `RunEvent` alongside the short-run deduction).

---

## 9. Wicket resolution (Step 5)

### 9.1 Dismissal-mode validity by delivery context — the determinism table

This is the single most important table in this document; a wicket that is not in the set below **must be rejected** (V5), never silently accepted or silently downgraded.

| Delivery context | Valid dismissal modes | Basis |
|---|---|---|
| `LEGAL`, normal (not a free hit) | `BOWLED`, `CAUGHT`, `LBW`, `RUN_OUT`, `STUMPED`, `HIT_WICKET`, `OBSTRUCTING_THE_FIELD`, `HIT_BALL_TWICE` | `[LAW]` |
| `LEGAL`, **free hit** (`isFreeHit = true`) | `RUN_OUT`, `OBSTRUCTING_THE_FIELD`, `HIT_BALL_TWICE` only | `[LAW]` (`BR-033`) — bowled/caught/LBW/stumped/hit-wicket are **not offered**, even if the ball's physical outcome would otherwise qualify (e.g. the ball hits the stumps: not out). |
| `NO_BALL` | `RUN_OUT`, `OBSTRUCTING_THE_FIELD`, `HIT_BALL_TWICE` only | `[LAW]` — **broader** than "no stumping": bowled, caught, LBW, stumped, **and** hit-wicket are all invalid off a no-ball, not only stumping. |
| `WIDE` | `RUN_OUT`, `STUMPED`, `OBSTRUCTING_THE_FIELD`, `HIT_BALL_TWICE` | `[LAW]` for run-out/obstructing/hit-twice; `[LAW]` for stumped (valid off a wide, unlike off a no-ball — the keeper may legitimately stump a batter who steps out to a wide). `HIT_WICKET` off a wide: **`[OPEN]`** — this specification's default is **not offered** (conservative, consistent with the no-ball treatment) pending accredited-scorer ratification. |
| `DEAD_BALL` | none | `[LAW]` — the ball is not in play; V11 already guarantees no `wicket` is submitted here. |
| **Pre-delivery** (non-striker run out, "mankad") | `RUN_OUT` (non-striker specifically) | `[LAW]` (`DR-19` NSRO) — occurs before delivery classification even applies; see §9.6. |
| N/A — not tied to a delivery at all | `TIMED_OUT`, `RETIRED_OUT` | `[LAW]` — these are their own event shape, not a `DeliveryInput.wicket` at all; see §9.7. |

### 9.2 `WicketDetail` structure

| Field | Values | Notes |
|---|---|---|
| `mode` | one of the 11 dismissal modes | Validated against §9.1 for this delivery's context. |
| `outBatterId` | id | Defaults to the striker; editable for a run out where the non-striker is out instead. |
| `fielderIds` | list of ids | Required for `CAUGHT`; for `RUN_OUT`/`STUMPED`/`OBSTRUCTING_THE_FIELD` when a fielder effected it; empty for `BOWLED`, `LBW`, `HIT_WICKET`, `HIT_BALL_TWICE`. **"Caught and bowled" is not a distinct mode** — it is `CAUGHT` with `fielderIds = [bowlerId]`; no separate handling is needed anywhere in this specification (`[PRD]`). |
| `endVacated` | `STRIKER` \| `NON_STRIKER` | Which crease position is now empty. |
| `crossedBeforeDismissal` | bool, required for `RUN_OUT` only | Whether the batters had already crossed when the dismissal occurred — determines which batter ends up at which end (§9.5). |
| `incomingBatterId` | id \| `null` | The next batter, captured as **part of the same atomic wicket entry** (per `UX-12`'s chained flow) so the whole dismissal — including the replacement — is one undoable/correctable unit (§19). `null` only when the innings ends on this wicket (no replacement needed). |

### 9.3 Runs credited on a wicket delivery `[LAW]`

Dismissal modes split into two groups, and the split is not "all clean-bowled-style dismissals are zero" — it is specifically about whether the mode is physically compatible with a run-scoring or running sequence having already started:

- **Always-zero-runs modes: `BOWLED`, `CAUGHT`, `LBW`, `STUMPED`, `HIT_BALL_TWICE`.** For every one of these, `batterRuns` **must** be zero and no `RunEvent` of any origin may be present (V6). Each is instantaneous and ends the delivery before any run, bye, or leg-bye could have been completed: a ball that is bowled or caught is immediately dead; an LBW appeal is adjudicated at the instant of impact, before any running; a stumping occurs on a delivery the batter did not connect with well enough to run from; hitting the ball twice (other than to guard the stumps) stops play at that instant. A "boundary catch" is not a boundary at all — the ball never crossed the rope — it is simply a catch with zero runs.
- **Modes that may carry credited runs: `RUN_OUT`, `HIT_WICKET`, `OBSTRUCTING_THE_FIELD`.** These can occur mid-running-sequence. Any runs completed by running **strictly before** the dismissal act count in full, using the normal §7 aggregation and the §8 short-run adjustment; the delivery's scoring simply stops at the moment of dismissal.
  - **`RUN_OUT`:** runs completed before the specific run that was interrupted are credited in full (§8's logic applies identically — the interrupted run and any after it are voided, not by a `shortRuns` flag but by the dismissal itself truncating the delivery). `endVacated` and `crossedBeforeDismissal` together determine the not-out batter's resulting end (§9.5).
  - **`HIT_WICKET`:** the striker may dislodge their own stumps while playing a shot or while setting off for a run that has already begun; any runs completed strictly before that instant are credited exactly as for `RUN_OUT`.
  - **`OBSTRUCTING_THE_FIELD`:** typically occurs during an attempted run; the same before-the-act crediting applies.

### 9.4 Bowler credit `[LAW]`

`wicket.creditsBowler` is a **pure function of `mode`**, never independently set:

| Bowler-credited (`true`) | Not bowler-credited (`false`) |
|---|---|
| `BOWLED`, `CAUGHT`, `LBW`, `STUMPED`, `HIT_WICKET` | `RUN_OUT`, `OBSTRUCTING_THE_FIELD`, `HIT_BALL_TWICE`, `TIMED_OUT`, `RETIRED_OUT` |

When `creditsBowler = true`, `BowlerCardLine.wickets += 1` (Step 7, §11). No other mode ever increments a bowler's wicket tally, regardless of who effected the dismissal (`MINV-07`).

### 9.5 Batter replacement — which end the new batter occupies `[LAW]`

1. If `mode ≠ RUN_OUT`: the new batter always occupies `endVacated` (the exact end the dismissed batter left — striker's end if the striker was out, non-striker's end otherwise).
2. If `mode = RUN_OUT`:
   - If `crossedBeforeDismissal = false`: the surviving batter stays at their original end; the new batter occupies the end the dismissed batter was running **toward** (i.e. `endVacated` as declared).
   - If `crossedBeforeDismissal = true`: the surviving batter has swapped ends with the dismissed batter (they completed the physical crossing before the dismissal was completed); the new batter occupies the end the dismissed batter would have reached — i.e. the **opposite** of where the dismissed batter started this delivery.
3. **Order of application:** batter replacement is resolved **after** the run-rotation consequence of any runs credited before the dismissal (§9.3) and **before** the end-of-over swap, if any (§14.4) — see the worked example in §23.10.

### 9.6 Non-striker run out ("mankad") — a pre-delivery event `[LAW]` (`DR-19` NSRO)

This occurs **before** the ball is delivered, so no `legality` classification applies at all — it is modelled as its own event type (`EVT-NON-STRIKER-RUN-OUT`, §17.3), not a `DeliveryInput`. Consequences:

- **No legal-ball slot is consumed** (the over's `legalBallCount` is unaffected).
- **No `ballsFaced` increment** for the striker (they never faced anything on this attempt).
- **No bowler-figure change at all** except that the event is attributed to the bowler's over for sequencing/log purposes — it does **not** count as a ball bowled and **does not** credit a wicket to the bowler (`creditsBowler = false`, per §9.4's table).
- The dismissed party is always the **non-striker**; `endVacated = NON_STRIKER` always.
- Displayed as occupying an ordinal position immediately **before** the next legal delivery in that over (e.g. rendered as "9.3 (before delivery)"), using the dense `event_ordinal` scheme (`MINV-03`) rather than perturbing the over.ball counter.

### 9.7 Timed out and retired out — not delivery-attached `[LAW]`

`TIMED_OUT` (an incoming batter fails to be ready within the permitted time) and `RETIRED_OUT` (a batter retires for a reason other than the permitted unavoidable cause, without the opposing captain's consent — `BR-030`) are **not** carried on a `DeliveryInput.wicket` at all; they are their own standalone event, occurring between deliveries. Both count as a wicket (`InningsState.wicketsLost += 1`) and neither credits the bowler (§9.4). `RETIRED_OUT` requires `incomingBatterId` exactly as a normal wicket does (§9.2); `TIMED_OUT` applies to a batter who has not yet taken strike, so it replaces the *incoming* batter selection itself rather than an existing card line.

### 9.8 Retired — not out (hurt/ill) — distinct from every dismissal mode `[LAW]` (`DR-19` RTHO, `BR-030`)

Not a `wicket` at all. Modelled as its own event (`EVT-BATTER-RETIRED`, out of this document's per-delivery scope but noted here for completeness): the batter's `BatterCardLine.status → RETIRED_NOT_OUT`, `InningsState.wicketsLost` is **unaffected**, and a replacement batter comes in at the vacated end using the same end-resolution logic as §9.5 rule 1. The retired batter **may resume later** in the innings (between deliveries only, never fully substituting an in-progress dismissal flow) — on resumption, `status → NOT_OUT` again and they retake their original card line's accumulated figures (nothing is reset). The effective all-out threshold used by innings-end evaluation is reduced by the count of currently `RETIRED_NOT_OUT` (and `ABSENT`) batters (`MINV-10`), consistent with `FR-051/072`.

---

## 10. Batter state update rules (Step 6)

Applied to the **striker's** `BatterCardLine` unless noted. The non-striker's card line is untouched by a normal delivery except when they are the one dismissed (§9) or when a manual strike override (§14.6) changes who is recorded as which.

| Field | Update rule |
|---|---|
| `runs` | `+= batterRuns` (§7.2's formula, after the §8 short-run adjustment is folded into the underlying `RunEvent` values used). |
| `ballsFaced` | `+= 1` iff §6.2's table says this `legality` counts as faced; `CAUGHT` and any other wicket mode do **not** suppress this — a dismissal still counts as a ball faced (the one exception is the pre-delivery mankad, §9.6, which never reaches this step at all). |
| `fours` | `+= 1` iff exactly one `RunEvent` exists with `origin ∈ {OFF_BAT, NO_BALL_BAT}`, `method = BOUNDARY`, `value = 4`. `[PRD]` — an all-run 4 (`method = RUN`, `value = 4`) does **not** increment this counter; it is 4 runs but not a "boundary" for tally purposes. |
| `sixes` | `+= 1` iff exactly one `RunEvent` exists with `origin ∈ {OFF_BAT, NO_BALL_BAT}`, `method = BOUNDARY`, `value = 6`. |
| `status`, `dismissal` | Set per §9 if a wicket occurred against this batter this delivery; otherwise unchanged. |

**A batter's card line is never modified by extras run through `BYE`/`LEG_BYE`/`WIDE`/`NO_BALL_PENALTY`/`PENALTY` origins** — those add to the team total and the relevant extras bucket only (`BR-034`).

---

## 11. Bowler state update rules (Step 7)

Applied to `BowlerCardLine` for `bowlerId`.

| Field | Update rule |
|---|---|
| `legalBallsBowled` | `+= 1` iff §6.1's table says this `legality` consumes a legal-ball slot. |
| `runsCharged` | `+= bowlerRunsCharged` (§7.2's formula). |
| `wickets` | `+= 1` iff `wicket.creditsBowler = true` (§9.4). |
| `widesBowled` | `+= extras[wides]` contributed by this delivery. |
| `noBallsBowled` | `+= 1` iff `legality = NO_BALL` (a count of no-ball *deliveries*, not runs). |
| `oversBowled` (display) | Derived, never stored independently: `wholeOvers = legalBallsBowled div ballsPerOver`, `remainder = legalBallsBowled mod ballsPerOver`, rendered `wholeOvers.remainder` (e.g. `4.2`). |
| `maidens` | Evaluated **only at over completion** (§13.3), not per delivery. |

---

## 12. Team / innings score update rules (Step 8)

| Field | Update rule |
|---|---|
| `InningsState.totalRuns` | `+= total` (§7.2, after short-run adjustment) `+` any `PENALTY` `RunEvent` awarded to the batting side. Runs from a `PENALTY` awarded to the **fielding** side do **not** touch this field (§7.7). |
| `InningsState.extras.{byes, legByes, wides, noBalls, penalty}` | Each `+=` its respective bucket from §7.2's `extras[category]` formula. |
| `InningsState.wicketsLost` | `+= 1` for any confirmed dismissal of any mode (all 11 modes count as a wicket **except** `RETIRED_NOT_OUT`, which is not a dismissal at all — §9.8). Capped conceptually at `maxWicketsPerInnings`; reaching the cap is itself the all-out trigger (§16). |

This is the field-level basis of `INV-001` (total identity: `innings_total = Σ batter_runs + byes + legByes + wides + noBalls + penalty`) — every rule above is written so that identity holds by construction, not as a separately-checked afterthought.

---

## 13. Over state update rules (Step 9)

### 13.1 Legal-ball counting and over completion `[LAW]`

`OverState.legalBallCount += 1` iff §6.1 says this delivery consumes a slot. When `legalBallCount = ballsPerOver` (the configured over/block length, `[CFG]`), the over is **complete**: `InningsState.legalBallsBowled` reflects the new total, `overNumber += 1` for the next over, `previousOverBowlerId ← bowlerId` (feeding the next over's `BR-027` guardrail, §4.5), and a fresh `OverState` begins with `legalBallCount = 0`, `runsThisOver = 0`, `isMaidenSoFar = true`.

An innings' **final** over may complete with fewer than `ballsPerOver` legal balls if the innings ends mid-over (all out, target reached) — this is not a special case of over-completion, it is innings-completion pre-empting it (§15); the partial over is simply the innings' last recorded state, not "completed" in the bowling-figures sense.

### 13.2 `runsThisOver`

`+= total` (§7.2's `total`, after short-run adjustment), tracked for the over-completion interstitial (`UX-16`) regardless of `legality` — a wide or no-ball's runs still count toward "runs conceded this over" even though they don't consume a ball.

### 13.3 Maiden-over evaluation `[LAW]`

Evaluated once, at over completion (§13.1), not incrementally: an over is a **maiden** iff, across every delivery in it, `batterRuns = 0` **and** no delivery had `legality ∈ {WIDE, NO_BALL}`. Byes, leg-byes, and penalty runs occurring in the over **do not** break maiden status (`[LAW]`, matches the glossary definition exactly). On over completion, if this holds, `BowlerCardLine.maidens += 1`.

### 13.4 Free-hit persistence `[LAW]/[CFG]` (`MINV-09`)

`InningsState.freeHitPending` transitions:

- **Set to `true`** when a delivery with `legality = NO_BALL` occurs and the conditions profile's `freeHitOnNoBall = true` (and, if `freeHitTriggerNoBallKinds` is a restricted subset rather than "all," the specific no-ball reason is in that subset — `[CFG]`, default subset = all no-ball kinds).
- **Persists unchanged** across any further `WIDE` or `NO_BALL` (an intervening illegal delivery does not consume or extend the free hit — it simply delays which delivery it applies to).
- **Consumed (set to `false`)** by the **next `LEGAL`** delivery, regardless of that delivery's own outcome (runs, dot ball, or a wicket via one of the still-valid modes) — the free hit applies to exactly one legal delivery, no more.
- Every delivery's `DeliveryInput.isFreeHit` (§3) must equal `InningsState.freeHitPending` as read **before** this delivery is processed — the value is a read-only reflection, not independently settable by the scorer (V9 already forbids the one contradictory combination).

### 13.5 Block-length formats `[CFG]`

Where `ballsPerOver` is not 6 (e.g. a 5- or 10-ball "block" format), every rule in §6, §11, and this section applies identically with `ballsPerOver` substituted from the conditions profile; **the only Law difference** such formats typically also carry is that the "no two consecutive overs by the same bowler" guardrail (§4.5) is replaced by an equivalent "no two consecutive blocks" rule — the mechanism (`previousOverBowlerId` check) is unchanged, only its label.

---

## 14. Strike state resolution (Step 10) — `SVC-STRIKE-RESOLVER`

This is the algorithm most often implemented incorrectly, because "strike rotates on odd runs and at the end of the over" is true but incomplete: the two triggers **compound**, they do not simply stack. The correct model is explained once here, precisely, then given as a single formula.

### 14.1 Why rotation is really about physical position, not a scoring convention

Two fixed ends exist, call them End A and End B. A bowler bowls a whole over from one end; the batter standing at the *opposite* end (the one the bowler is delivering **toward**) is the striker. When the batters complete a run by running, they physically swap which end they occupy. **At the end of an over, only the bowling end changes** (the next over is bowled from the other end) — the batters' physical positions do **not** move on their own account. Whoever ends up standing at the end the *new* bowler is delivering toward is the striker for the new over. This single physical fact is what produces both halves of the familiar rule, and their interaction:

- If the last ball of the over involved **no net running-swap** (an even number of `ranRuns`, including zero): the striker is still standing where they were, but the bowling end has now swapped — so they are now standing at what is newly the *non-striking* end. **Strike rotates**, purely because the ends changed, even though nobody ran.
- If the last ball of the over involved an **odd** number of `ranRuns`: the batters already swapped physical ends as part of completing that run. Combined with the bowling-end swap, the two effects cancel — the batter who is now facing the new bowler is the **same person** who faced the last ball of the previous over. **Strike does not net-rotate.**

### 14.2 The formula

For any delivery:

```
netRotates = (effectiveRanRuns mod 2 = 1)  XOR  (this delivery is the over's final legal ball)
```

Where `effectiveRanRuns` is the §8-adjusted value from §7.2/§8, and "the over's final legal ball" means `legality` consumes a slot (§6.1) **and** doing so brings `legalBallCount` to `ballsPerOver`. A `WIDE`, `NO_BALL`, or `DEAD_BALL` is **never** "the over's final ball" by this definition (it doesn't consume a slot at all) — the over only truly ends on a legal delivery, so rotation-by-end-of-over can only ever combine with a legal delivery's own run-parity, never with a wide/no-ball's.

If `netRotates = true`, the striker and non-striker identifiers swap for the next delivery's `strikerBatterId`/`nonStrikerBatterId`. If `false`, they remain as they are (subject to §14.3–§14.5 overriding for a wicket or a manual override).

### 14.3 Order of resolution when a wicket also occurs

1. Apply §14.2's rotation based on runs credited *before* the dismissal (§9.3) — this determines which physical end each *surviving* batter occupies at the instant of dismissal.
2. Apply batter replacement (§9.5) — the incoming batter occupies the resolved `endVacated`.
3. **Then**, if this was also the over's final legal ball, apply the end-of-over swap on top (§14.2's `XOR` already includes this as one term — in practice this means: compute `netRotates` using the *pre-dismissal* `ranRuns`, apply it to determine ends, replace the dismissed batter at their end, and the surviving/incoming pairing that results **is** the correct striker/non-striker for the next delivery; no further separate swap is needed since it's already inside the same formula).

### 14.4 Extras and rotation

Byes and leg-byes involve genuine running and use `ranRuns` exactly as batted runs do (§7.2 already includes `BYE`/`LEG_BYE` origins with `method = RUN` in the `ranRuns` sum). Wides: the base automatic wide-run itself (`method = AUTOMATIC`) contributes **zero** to `ranRuns`; any *additional* runs actually run on a wide (`method = RUN`) do contribute. A boundary of any origin (`method = BOUNDARY`) always contributes zero. An overthrow (`method = OVERTHROW`) always contributes zero (§7.5) — only the portion genuinely run before it counts.

### 14.5 Manual override

A scorer-initiated strike override (`UX-14`) sets the next delivery's `strikerBatterId`/`nonStrikerBatterId` directly, bypassing §14.2's computed result, and **requires** a non-empty reason, recorded on its own `EVT-STRIKER-OVERRIDDEN` event (§16.4) rather than folded into the triggering delivery's event. The computed §14.2 rule resumes governing automatically from the *next* delivery onward unless overridden again — an override is never "sticky" beyond the one delivery it targets.

### 14.6 Non-striker run out (mankad) and strike

Per §9.6, only the non-striker is ever dismissed this way, before any ball is bowled; the striker's identity is completely unaffected. The incoming batter (§9.2) occupies the non-striker's end; §14.2's rotation formula does not run at all for this event (there were no `ranRuns` and no "delivery" to be the over's final ball).

---

## 15. Innings and match-end evaluation (Step 11) — `SVC-INNINGS-END-EVALUATOR`

Evaluated **after every delivery is fully processed** (Steps 5–10 complete), in this fixed priority order — the first condition met wins, and evaluation stops there for this delivery:

1. **All out:** `InningsState.wicketsLost ≥ effectiveAllOutThreshold`, where `effectiveAllOutThreshold = maxWicketsPerInnings − (count of batters currently RETIRED_NOT_OUT or ABSENT)` (`MINV-10`, `FR-072`). Includes the case where fewer than `maxWicketsPerInnings − 1` dismissals have occurred but no further eligible batter remains.
2. **Overs complete:** `legalBallsBowled = oversAllotted × ballsPerOver` for the innings (`FR-071`).
3. **Target reached or passed** (second innings only): `totalRuns ≥ target` (`FR-073`, `BR-018`) — evaluated the instant it becomes true, potentially mid-over, even mid-delivery relative to further hypothetical balls that are simply never bowled.
4. **Declaration / forfeiture** (multi-day formats only, `FR-076/077`) — a captain-initiated event, not a delivery-triggered one; out of this document's ball-processing scope.

On any of 1–3 becoming true, the innings transitions to `COMPLETE` and no further `DeliveryInput` is accepted against it (guardrail precondition 1, §4, now fails for this innings). The match then transitions per `SM-MATCH` — to the next innings (`UX-09`, re-run for the new innings) or to match completion (`UX-22`) — which is outside this document's ball-processing scope (see `docs/domain/domain-model.md §6.1`).

---

## 16. Event generation (Step 12)

### 16.1 Design decision: derived facts are never independently emitted

Over-completion, maiden status, innings-end, and free-hit state are **all derived** from the delivery event stream by the rules above — the engine never emits a separate "over completed" or "innings ended" event. This is deliberate (`MBR-01`/`MBR-06`: no side channel may assert match facts) and prevents an entire class of drift bugs where a derived fact and its source could disagree. Any implementation that persists "over completed" as its own stored fact is **non-conformant** with this specification.

### 16.2 `EVT-DELIVERY-RECORDED` — the primary event

Emitted for every `DeliveryInput` that is **not** a pre-delivery mankad (§16.3). Payload:

| Field | Source |
|---|---|
| `eventId` | client-generated UUID (idempotency key, `system-architecture.md §3.7`) |
| `matchId`, `inningsId`, `scorerStreamId` | context |
| `deviceId`, `deviceSeq`, `hlc`, `eventOrdinal` | sync substrate (`system-architecture.md §3.7`) |
| `legality`, `strikerBatterId`, `nonStrikerBatterId`, `bowlerId`, `isFreeHit`, `runEvents`, `shortRuns`, `wicket`, `deadBallReason`, `commentary`, `overrideReason` | copied from the validated `DeliveryInput` (§3) verbatim |
| `actorRef`, `provenance` (`appVersion`, `platform`, `deviceModel`, `osVersion`, `buildHash`) | the recording scorer's session (`AUD-002`) |
| `recordedAt`, `serverReceivedAt` | device clock at commit; server clock on ingest |
| `prevHash`, `hash` | tamper-evidence chain (`AUD-003`) |
| `supersedes` | `null` for a fresh delivery; set only by a correction (§19) |

### 16.3 `EVT-NON-STRIKER-RUN-OUT`

Emitted instead of `EVT-DELIVERY-RECORDED` for the mankad case (§9.6). Payload mirrors §16.2 minus `legality`/`runEvents`/`isFreeHit` (none apply), plus `wicket` (always `mode = RUN_OUT`, `endVacated = NON_STRIKER`) and `incomingBatterId`.

### 16.4 `EVT-STRIKER-OVERRIDDEN`

Emitted for a manual strike override (§14.5), independent of any delivery event. Payload: `newStrikerBatterId`, `newNonStrikerBatterId`, `reason` (mandatory), plus the standard provenance/audit fields.

### 16.5 `EVT-PLAYING-CONDITIONS-FROZEN`

Emitted **once**, automatically, alongside (same transaction as) the very first `EVT-DELIVERY-RECORDED` of the match — never again (`MBR-05`). Carries a snapshot of the resolved `ConditionsProfile`. Not otherwise part of per-delivery processing; noted here for completeness since Step 12 is where an implementation must remember to check "is this the first delivery of the match?" and emit it.

---

## 17. Audit record (Step 13)

Every event in §16 **is** its own audit record — there is no separate audit-log write for ordinary delivery scoring (the append-only, hash-chained `match_events` stream *is* the audit trail for scoring facts, per `system-architecture.md §3.12`). The fields that make this true, restated as requirements on any implementation:

1. `actorRef` is **never** null and is never inferred — it is the authenticated (or guest-device) identity of the session that issued the command (`AUD-002`).
2. `provenance` is captured **at write time**, not reconstructed later — `appVersion`/`buildHash` specifically enable reproducing a historical bug against the exact logic that produced a given event.
3. `prevHash`/`hash` are computed over a **canonicalised** serialisation of the event (stable field order, fixed number formatting) so the same logical event always hashes identically regardless of platform (`system-architecture.md §4.8`) — this is what makes cross-platform parity checkable, not just claimed.
4. A guardrail override (`overrideReason`, §4.5) or any other reason field is part of the **same** event, never a separate "note" attached after the fact — the reason for an unusual action must be inseparable from the action itself in the record.
5. Nothing about §17 differs between `LEGAL`, `WIDE`, `NO_BALL`, `DEAD_BALL`, or a wicket delivery — audit completeness is uniform across every case in this document by construction (every field in §16.2's table is always present, even if some sub-fields are null/empty for a given case).

---

## 18. Undo behavior

### 18.1 The universal rule

**Undo is defined once, uniformly, for every case in this document — there is no per-delivery-type reversal logic to implement.**

1. Identify the most recent **active** (non-voided, non-superseded) event in the current innings' active scorer stream.
2. Emit `EVT-DELIVERY-VOIDED` (or the equivalent void marker for `EVT-NON-STRIKER-RUN-OUT` / `EVT-STRIKER-OVERRIDDEN`), referencing that event's `eventId`. **The original event is never mutated or deleted** (`MINV-01`) — it remains in the log, marked inactive.
3. **Recompute every projection** (`InningsState`, `OverState`, both `BatterCardLine`s, `BowlerCardLine`, `freeHitPending`, `strikerBatterId`/`nonStrikerBatterId`) by folding the **active** event set only — i.e. by re-running Steps 5–11 over every remaining active event in order, from the start of the innings.

This is correct **by construction** for every case in §6–§15, because those rules are already defined as pure functions of the active event stream, not as incremental deltas that would need bespoke reversal. There is no scenario in this document where Undo requires special-casing: undoing a wicket automatically restores the outgoing batter (their card line reappears with `status = NOT_OUT` since the wicket event that set it otherwise is now inactive) and automatically removes the incoming batter's card line (it never existed in the active fold); undoing the over's final ball automatically un-completes the over (`legalBallCount` drops back below `ballsPerOver` in the refold) and automatically retracts the now-premature bowler-change prompt; undoing a delivery that had triggered all-out or target-reached automatically reopens the innings to further scoring, because innings-end (§15) is itself derived from the same active-event fold.

### 18.2 Scope and availability

- Undo acts **only** on the single most recent active event — never on an arbitrary earlier one (that is Correction, §19).
- Available whenever a most-recent active event exists in the current innings and no blocking guardrail modal is open (§4.4).
- **Redo** re-activates a just-voided event (reverses the void, does not re-derive it) and is available only until a new event is recorded, at which point the redo window closes permanently for that voided event (`UX-18`).
- Undo requires **no reason** and is never itself audited as an "override" — the void event's own provenance (§17) is its complete record.
- Undo works identically **offline** — it is a purely local recomputation with no network dependency (`OFF-*`), and syncs as an ordinary void event like any other.

### 18.3 What Undo cannot do

If the most recent active event is not the very thing the scorer wants reversed (they want to fix something from three overs earlier), Undo is not applicable — that is always Correction (§19). A UI that lets a scorer attempt to "undo" a non-most-recent event must instead route them into the correction flow (`UX-17`); this specification defines no partial or selective undo.

---

## 19. Correction behavior

### 19.1 The universal rule

Correction targets **any** prior active event, not only the most recent one, and — unlike Undo — always carries a **mandatory reason** and produces a **new superseding event**, never a void.

1. The scorer locates the target event (`UX-17`'s navigator) and edits its correctable fields, producing a new `DeliveryInput`-shaped payload (or `WicketDetail`, or strike-override payload, as appropriate to the target's type).
2. The new payload passes through **the same validation** as original entry (§5) — a correction cannot introduce a state that fresh entry would have rejected.
3. Emit `EVT-DELIVERY-CORRECTED` (or the type-appropriate equivalent), with `supersedes = <original eventId>` and the mandatory `reason` field populated. The **original event remains in the log**, now marked superseded rather than active (`MINV-01`, `BR-004`).
4. **Recompute every projection** by folding the active event set — identical mechanism to §18.1 step 3, with one addition: because the target event may be anywhere in the timeline, every event **after** the correction point is, in effect, re-evaluated against the corrected history. In particular, `strikerBatterId`/`nonStrikerBatterId` for every subsequent delivery are **re-derived from scratch** via §14, since strike is never stored as independent truth (`MBR-09`) — a correction to an early delivery's run value can legitimately flip who was on strike for every following ball, and the refold produces the correct result automatically.
5. `SVC-CASCADE-RECOMPUTER` (`system-architecture.md §2.4`) produces a **cascade summary**: which projections changed value, and specifically whether strike-continuity was broken anywhere in the replay that the scorer should be shown before confirming (`AUD-010`). This summary is presented (`UX-17`, "reviewing-cascade" state) **before** the correction is finalised, not only after.

### 19.2 The innings-end-timing edge case — flagged, never silently resolved

A correction can change **whether or when** the innings would have ended. Two sub-cases, both handled by the same principle — **the engine never silently invents deliveries the scorer never entered**:

- **The innings now appears to have ended earlier than it originally did** (e.g. a correction changes a dot ball into the ball on which the target was actually reached, three deliveries before the recorded end). The refold recomputes state only up to that earlier true end point; every event recorded *after* it in the original log is still present in the store (nothing is deleted) but is now **outside the active innings boundary**. The engine surfaces this explicitly as a flagged state — "this correction ends the innings earlier; N later deliveries are now outside the innings and require review" — and does **not** auto-discard or auto-reinterpret them. A scorer must explicitly acknowledge and, if appropriate, void the now-orphaned later events (via the same correction/void mechanisms) before reconciliation can pass.
- **The innings now appears not to have ended when it originally did** (e.g. a correction turns the wicket that had produced "all out" into a not-out delivery, so the effective-all-out threshold is no longer met at that point). The refold cannot invent the deliveries that would have followed in reality — **no further deliveries exist in the active stream past that point** — so the innings is left in an explicit **"correction requires continuation"** state: reconciliation reports this as a distinct, named failure (not folded into a generic FAIL), and the scorer is routed back into live scoring for that innings to enter the deliveries that should have occurred, before sign-off can proceed.

Both sub-cases are **blocking**, not silent, and both are visible on the Match Summary / Sign-off screen (`UX-22`) as specific, named reconciliation items — this is the deterministic behaviour: *"never guess what the scorer would have done — surface it and require an explicit human decision."*

### 19.3 Post-Final corrections

Identical mechanism to §19.1, with two additional preconditions enforced *before* step 1 can begin: the correcting actor holds an elevated role, and completing the correction produces a **new sign-off version** rather than mutating the existing Final record — the prior Final scorecard remains independently retrievable (`BR-006`, `AUD-008`). Everything in §19.1's steps 2–5 is otherwise unchanged.

### 19.4 Offline and sync

Corrections are recorded and take full effect **locally**, offline, exactly as fresh entry does (`OFF-017`); they sync as ordinary superseding events. If two devices (dual-scorer, P2) each correct the *same* original event differently before syncing, this is not resolved by this document's rules at all — it becomes a divergence (`docs/ux/ux-specification.md UX-25`, `MINV-14`), never a silent last-one-wins overwrite (`SYNC-010`).

---

## 20. Reconciliation touchpoints

This document's rules are written so that `SVC-RECONCILER`'s checks (`cricket-rules-reference.md §34`, `INV-001…018`) pass **by construction** for any sequence of valid `DeliveryInput`s processed through §5–§15 — reconciliation exists to catch the case where that construction has been violated (a bug, a partial/interrupted write, or an in-progress correction cascade per §19.2), not to compute anything this document doesn't already define. The direct mapping:

| Invariant | Guaranteed by |
|---|---|
| `INV-001` total identity | §12's formulas, derived from §7.2 |
| `INV-002/003` ball/bowler-ball identity | §6.1, §11's `legalBallsBowled` rule |
| `INV-004` bowler runs identity | §7.2's `bowlerRunsCharged` formula |
| `INV-005/006` wickets/FoW consistency | §9.4, §12's `wicketsLost` rule, §15's all-out threshold |
| `INV-007` partnership sum | Derived entirely from §10's per-batter `runs` (out of this document's direct scope — a read-model concern) |
| `INV-008` batter balls | §6.2's table exactly |
| `INV-009` boundary tally | §10's `fours`/`sixes` rules |
| `INV-010` extras attribution | §7.2's `extras[category]` mapping — every `RunEvent` maps to exactly one bucket |
| `INV-011`/`MINV-04` strike continuity | §14 in full |
| `INV-012`/`MINV-08` over legality | §6.1, §13.1 |
| `INV-013` bowler rules | §4.5's guardrails |
| `INV-017`/`MINV-03` timeline monotonicity | The sync substrate's `event_ordinal`/`hlc`/`device_seq` (`system-architecture.md §3.7`), outside this document's scope but assumed as a precondition throughout |

---

## 21. Case catalogue — conformance-test vectors

A concrete instance of §5–§15's rules for ~50 legal and important cases. Intended to seed the cricket-rules conformance suite (`NFR-033`) directly: each row is one test vector. **Not exhaustive by design** (§1.2) — it is a representative, verification-oriented sample; the general rules in §5–§15 remain the authority for any case not listed here.

### 21.1 Notation

`RunEvents` are written `origin:value:method` joined by `+`. Origins: `OB`=`OFF_BAT`, `BY`=`BYE`, `LB`=`LEG_BYE`, `WD`=`WIDE`, `NBP`=`NO_BALL_PENALTY`, `NBB`=`NO_BALL_BAT`, `NBBY`=`NO_BALL_BYE`, `NBLB`=`NO_BALL_LEG_BYE`, `PEN`=`PENALTY`. Methods: `R`=`RUN`, `B`=`BOUNDARY`, `O`=`OVERTHROW`, `A`=`AUTOMATIC`. `Rot?` = does §14.2's `netRotates` evaluate true (assuming this is **not** the over's final ball unless stated). `LB✓`/`BF✓` = legal-ball slot consumed / striker's `ballsFaced` incremented (§6.1/§6.2).

### 21.2 Off-the-bat runs (legal deliveries, no wicket)

| # | Scenario | RunEvents | Total | BatterRuns | BowlerCharged | ranRuns | Rot? | LB✓ | BF✓ | Event |
|---|---|---|---|---|---|---|---|---|---|---|
| C01 | Dot ball | *(none)* | 0 | 0 | 0 | 0 | No | Yes | Yes | `EVT-DELIVERY-RECORDED` |
| C02 | Single | `OB:1:R` | 1 | 1 | 1 | 1 | **Yes** | Yes | Yes | " |
| C03 | Two runs | `OB:2:R` | 2 | 2 | 2 | 2 | No | Yes | Yes | " |
| C04 | Three runs | `OB:3:R` | 3 | 3 | 3 | 3 | **Yes** | Yes | Yes | " |
| C05 | Boundary four | `OB:4:B` | 4 | 4 | 4 | 0 | No | Yes | Yes | " |
| C06 | All-run four (no boundary) | `OB:4:R` | 4 | 4 | 4 | 4 | No | Yes | Yes | Distinguish from C05: `fours` tally **does not** increment (§10) |
| C07 | All-run five | `OB:5:R` | 5 | 5 | 5 | 5 | **Yes** | Yes | Yes | Rare but legal |
| C08 | Boundary six | `OB:6:B` | 6 | 6 | 6 | 0 | No | Yes | Yes | " |
| C09 | One run + overthrow four | `OB:1:R + OB:4:O` | 5 | 5 | 5 | 1 | **Yes** | Yes | Yes | Rotation driven by the `1`, not the `5` (§7.5) |
| C10 | Two runs + overthrow one | `OB:2:R + OB:1:O` | 3 | 3 | 3 | 2 | No | Yes | Yes | Rotation driven by the `2` |
| C11 | Boundary four, last ball of the over | `OB:4:B` | 4 | 4 | 4 | 0 | **Yes** *(end-of-over term)* | Yes | Yes | `netRotates = false XOR true = true` — strike changes for the new over despite the boundary (§14.1) |
| C12 | Single, last ball of the over | `OB:1:R` | 1 | 1 | 1 | 1 | **No** *(cancels)* | Yes | Yes | `netRotates = true XOR true = false` — same batter keeps strike into the new over (§14.1) — the classic "gotcha" |

### 21.3 Wides

| # | Scenario | RunEvents | Total | Extras bucket | ranRuns | Rot? | LB✓ | BF✓ |
|---|---|---|---|---|---|---|---|---|
| C13 | Plain wide | `WD:1:A` | 1 | wides +1 | 0 | No | No | No |
| C14 | Wide + 2 run | `WD:1:A + WD:2:R` | 3 | wides +3 | 2 | No | No | No |
| C15 | Wide + 1 run | `WD:1:A + WD:1:R` | 2 | wides +2 | 1 | **Yes** | No | No |
| C16 | Wide to the boundary | `WD:4:B` | **4** *(not 5 — §7.6)* | wides +4 | 0 | No | No | No |

### 21.4 No-balls

| # | Scenario | RunEvents | Total | Extras/BatterRuns | ranRuns | Free hit after? | LB✓ | BF✓ |
|---|---|---|---|---|---|---|---|---|
| C17 | Plain no-ball | `NBP:1:A` | 1 | noBalls +1 | 0 | **Yes** | No | Yes |
| C18 | No-ball + 2 off the bat | `NBP:1:A + NBB:2:R` | 3 | noBalls+1, batterRuns+2 | 2 | **Yes** | No | Yes |
| C19 | No-ball hit for four | `NBP:1:A + NBB:4:B` | **5** | noBalls+1, batterRuns+4 | 0 | **Yes** | No | Yes |
| C20 | No-ball hit for six | `NBP:1:A + NBB:6:B` | **7** | noBalls+1, batterRuns+6 | 0 | **Yes** | No | Yes |
| C21 | No-ball + 2 byes | `NBP:1:A + NBBY:2:R` | 3 | noBalls+1, byes+2 | 2 | **Yes** | No | Yes |
| C22 | No-ball + 1 leg-bye | `NBP:1:A + NBLB:1:R` | 2 | noBalls+1, legByes+1 | 1 | **Yes** | No | Yes |
| C23 | Second consecutive no-ball (free hit was already pending) | `NBP:1:A` | 1 | noBalls+1 | 0 | **Still Yes** *(persists, §13.4)* | No | Yes |

### 21.5 Byes and leg-byes (on a legal delivery)

| # | Scenario | RunEvents | Extras | ranRuns | Rot? | LB✓ | BF✓ |
|---|---|---|---|---|---|---|---|
| C24 | One bye | `BY:1:R` | byes +1 | 1 | **Yes** | Yes | Yes |
| C25 | Boundary bye (4) | `BY:4:B` | byes +4 | 0 | No | Yes | Yes |
| C26 | Two leg-byes | `LB:2:R` | legByes +2 | 2 | No | Yes | Yes |
| C27 | Boundary leg-bye (4) | `LB:4:B` | legByes +4 | 0 | No | Yes | Yes |

### 21.6 Penalty and dead ball

| # | Scenario | RunEvents | Effect | LB✓ | BF✓ |
|---|---|---|---|---|---|
| C28 | Penalty to batting side, no delivery bowled | `PEN:5:A` (`awardedToTeamId = battingTeamId`) | `totalRuns +5`, `extras.penalty +5`; no delivery bowled at all (§7.8a) | No | No |
| C29 | Penalty to fielding side, attached to a 1-run legal delivery | `OB:1:R + PEN:5:A` (`awardedToTeamId = bowlingTeamId`) | Striker `+1` run as normal; the 5 penalty runs credit the **other** team's ledger directly, not this innings' total (§7.7) | Yes | Yes |
| C30 | Dead ball — bail dislodged accidentally | *(none)*, `deadBallReason` set | Nothing changes except the log entry (§6.4) | No | No |

### 21.7 Wickets

| # | Scenario | Mode | RunEvents (pre-dismissal) | Bowler credit | Rot? / end resolution |
|---|---|---|---|---|---|
| C31 | Clean bowled | `BOWLED` | *(none — §9.3)* | **Yes** | New batter takes striker's end (§9.5 rule 1) |
| C32 | Caught | `CAUGHT`, `fielderIds=[fielder]` | *(none)* | **Yes** | New batter takes striker's end |
| C33 | Caught and bowled | `CAUGHT`, `fielderIds=[bowlerId]` | *(none)* | **Yes** | Same as C32 — no special handling (§9.2 note) |
| C34 | LBW | `LBW` | *(none)* | **Yes** | New batter takes striker's end |
| C35 | Stumped | `STUMPED`, `fielderIds=[keeper]` | *(none)* | **Yes** | New batter takes striker's end |
| C36 | Run out, striker, no runs completed | `RUN_OUT`, `endVacated=STRIKER`, `crossedBeforeDismissal=false` | *(none)* | **No** | Non-striker unaffected; new batter takes striker's end |
| C37 | Run out attempting a 2nd run, 1 completed, not crossed on the 2nd | `RUN_OUT`, `endVacated=STRIKER`, `crossedBeforeDismissal=false` | `OB:1:R` | **No** | 1 run credited; new batter takes the end the dismissed batter was running toward (§9.5 rule 2a) |
| C38 | Run out attempting a 2nd run, 1 completed, **had crossed** | `RUN_OUT`, `endVacated=STRIKER`, `crossedBeforeDismissal=true` | `OB:1:R` | **No** | 1 run credited; new batter takes the **opposite** end from where the dismissed batter started (§9.5 rule 2b) — see worked example §22.10 |
| C39 | Hit wicket | `HIT_WICKET` | *(none, or runs if mid-run — see general rule)* | **Yes** | New batter takes striker's end |
| C40 | Obstructing the field | `OBSTRUCTING_THE_FIELD` | *(as applicable)* | **No** | Per §9.5 |
| C41 | Hit the ball twice | `HIT_BALL_TWICE` | *(none)* | **No** | New batter takes striker's end |
| C42 | Non-striker run out ("mankad"), before delivery | `RUN_OUT` via `EVT-NON-STRIKER-RUN-OUT` | n/a — no delivery occurred | **No** | Non-striker's end replaced; no ball/over/figures affected at all (§9.6) |
| C43 | Timed out | `TIMED_OUT` (standalone event) | n/a | **No** | Replaces the incoming batter selection itself (§9.7) |
| C44 | Retired out | `RETIRED_OUT` (standalone event) | n/a | **No** | Counts as a wicket; new batter in |
| C45 | Retired — not out (hurt) | *(not a wicket — §9.8)* | n/a | n/a | `wicketsLost` unaffected; batter may resume later |

### 21.8 Free hit

| # | Scenario | Context | Outcome |
|---|---|---|---|
| C46 | Free hit, struck for 2, no wicket attempted | Preceding ball was a free-hit-triggering no-ball | Scored exactly as C03 (2 runs); `isFreeHit=true` recorded on the event; consumed after this ball (§13.4) |
| C47 | Free hit, ball would "bowl" the striker | `wicket.mode = BOWLED` submitted on a free-hit delivery | **Rejected** (V5) — `BOWLED` is not in the valid set for a free hit (§9.1); not out, any runs scored stand |
| C48 | Free hit, run out while attempting a 2nd | `wicket.mode = RUN_OUT` on a free-hit delivery | **Accepted** — `RUN_OUT` remains valid on a free hit (§9.1); processed exactly as C37/C38 |
| C49 | No-ball bowled *during* an already-pending free hit | Second illegal delivery before the free hit is used | `freeHitPending` remains `true`, unconsumed, carried to the next legal delivery (§13.4) — same as C23 |

### 21.9 Rejected inputs (validation failures — the negative test vectors)

| # | Attempted input | Rejected by | Reason |
|---|---|---|---|
| C50 | `wicket.mode = STUMPED` on a `NO_BALL` delivery | V5 | Not in the no-ball valid set (§9.1) — broader than "no stumping off a no-ball" would suggest at first glance; stumped **is** invalid off a no-ball, valid off a wide. |
| C51 | `wicket.mode = CAUGHT` with `runEvents = [OB:2:R]` | V6 | Caught must total zero runs (§9.3). |
| C52 | `RunEvents = [OB:4:B, OB:2:O]` on one delivery | V4 | A boundary and an overthrow cannot coexist on the same delivery (§7.4). |
| C53 | `legality = DEAD_BALL` with a non-empty `runEvents` | V11 | A dead ball carries no runs by definition (§6.4). |
| C54 | `isFreeHit = true` submitted together with `legality = NO_BALL` | V9 | A free hit is a property of the *next legal* delivery, never of the no-ball itself (§13.4). |
| C55 | `shortRuns = 2` when the delivery's only `RUN`-method value is `1` | V3 | Cannot disallow more running-runs than were attempted (§8). |

---

## 22. Fully worked examples

Twelve cases walked through all thirteen required dimensions in full. Pre-state for every example unless noted: over 8.3 (3 legal balls bowled this over), striker **A**, non-striker **B**, bowler **X**, innings score 61/2, no free hit pending.

### 22.1 EX-01 — Plain dot ball (the baseline)

1. **Input:** `legality=LEGAL`, `runEvents=[]`, `wicket=null`.
2. **Validation:** passes trivially (V1–V11 all vacuous or satisfied).
3. **Score calculation:** `total=0`, `batterRuns=0`, `bowlerRunsCharged=0`, `ranRuns=0`.
4. **Batter state:** A's `ballsFaced += 1`; `runs` unchanged.
5. **Bowler state:** X's `legalBallsBowled += 1`; `runsCharged` unchanged.
6. **Team score:** `totalRuns` unchanged (61/2); no extras change.
7. **Over state:** `legalBallCount → 4`; `runsThisOver` unchanged; over not yet complete (4 < 6).
8. **Wicket state:** none.
9. **Strike state:** `netRotates = (0 mod 2=1 → false) XOR (not the over's final ball → false) = false`. A remains striker.
10. **Event generated:** one `EVT-DELIVERY-RECORDED`.
11. **Audit record:** the event itself; `actorRef`=the scoring session; full provenance/hash chain per §17.
12. **Undo behavior:** voids this event; refold restores over.ball to 8.2, A's `ballsFaced -1`, X's `legalBallsBowled -1` — all automatically, per §18.1.
13. **Correction behavior:** if later corrected to, say, 2 runs, a superseding event is created; the refold recomputes everything from this point forward including strike for every subsequent ball (§19.1).

### 22.2 EX-02 — Single, mid-over

1. **Input:** `legality=LEGAL`, `runEvents=[OB:1:R]`.
2. **Validation:** passes.
3. **Score calculation:** `total=1`, `batterRuns=1`, `bowlerRunsCharged=1`, `ranRuns=1`.
4. **Batter state:** A: `runs → +1`, `ballsFaced += 1`.
5. **Bowler state:** X: `legalBallsBowled → 4`, `runsCharged → +1`.
6. **Team score:** `totalRuns → 62/2`.
7. **Over state:** `legalBallCount → 4`; not complete.
8. **Wicket state:** none.
9. **Strike state:** `netRotates = (1 mod 2=1 → true) XOR (false) = true`. **B is now striker, A is non-striker.**
10. **Event generated:** one `EVT-DELIVERY-RECORDED`.
11. **Audit record:** as EX-01.
12. **Undo behavior:** voids the event; refold restores A as striker and B as non-striker automatically (strike is re-derived, never separately stored — §14, §18.1).
13. **Correction behavior:** standard §19.1 flow.

### 22.3 EX-03/EX-04 — The over-boundary parity pair (the flagship "gotcha")

Same pre-state, but this is the **sixth and final legal ball** of the over (`legalBallCount = 5` beforehand).

**EX-03 — boundary six on the last ball:**
1. **Input:** `legality=LEGAL`, `runEvents=[OB:6:B]`.
3. **Score calculation:** `total=6`, `batterRuns=6`, `ranRuns=0`.
4. **Batter state:** A: `runs +6`, `ballsFaced +1`, `sixes +1`.
5. **Bowler state:** X: `legalBallsBowled → 6`, `runsCharged +6`.
6. **Team score:** `totalRuns → 67/2`.
7. **Over state:** `legalBallCount → 6 = ballsPerOver` ⇒ **over complete.** `overNumber → 9`, `previousOverBowlerId ← X`, fresh `OverState` begins.
9. **Strike state:** `netRotates = (0 mod 2=1 → false) XOR (this is the over's final legal ball → true) = true`. **B becomes striker for over 9**, even though the six itself involved no running — the swap is purely the end-of-over effect (§14.1).
10. **Event generated:** one `EVT-DELIVERY-RECORDED`. No separate "over completed" event (§16.1) — over-completion is read off `legalBallCount` reaching 6.

**EX-04 — single on the last ball, same pre-state:**
1. **Input:** `runEvents=[OB:1:R]`.
3. **Score calculation:** `total=1`, `ranRuns=1`.
7. **Over state:** over complete exactly as EX-03.
9. **Strike state:** `netRotates = (1 mod 2=1 → true) XOR (true) = false`. **A retains strike for over 9** — the run-swap and the end-swap cancel (§14.1's derivation). This is the case implementers most often get backward.

Both examples: **Undo** reopens the over (`legalBallCount` drops back to 5, `overNumber` reverts, the bowler-change prompt that had just appeared is automatically retracted since it was only triggered by the now-voided over-completion) — all as an automatic consequence of §18.1's refold, with no bespoke "un-complete the over" code required. **Correction** of either example to a different run value re-derives strike for the new over and every ball after it via the same refold (§19.1).

### 22.4 EX-05 — Wide to the boundary

1. **Input:** `legality=WIDE`, `runEvents=[WD:4:B]`.
2. **Validation:** passes — `(WIDE, BOUNDARY)` is a valid pair (§7.3).
3. **Score calculation:** `total=4` (**not 5** — §7.6), `extras.wides += 4`, `bowlerRunsCharged=4`, `ranRuns=0`.
4. **Batter state:** unaffected — A's `ballsFaced` does **not** increment (§6.2).
5. **Bowler state:** X: `legalBallsBowled` unchanged (wides never consume a slot); `runsCharged +4`; `widesBowled +4`.
6. **Team score:** `totalRuns → 65/2`; `extras.wides → +4`.
7. **Over state:** `legalBallCount` unchanged (still 3 pre-existing in this example's own local count); `runsThisOver += 4`.
8. **Wicket state:** none.
9. **Strike state:** `netRotates = (0 → false) XOR (a wide can never be the over's final ball, §14.2 → false) = false`. A remains striker.
10. **Event generated:** one `EVT-DELIVERY-RECORDED` with `legality=WIDE`.
12. **Undo behavior:** standard §18.1 — refold removes the 4 wide-runs from the team total and bowler figures exactly.
13. **Correction behavior:** if it turns out only 1 run was actually run (not a boundary), a superseding event with `runEvents=[WD:1:A, WD:0... ]` — more precisely `[WD:1:A]` alone (1 total) supersedes; downstream totals refold to the corrected, smaller figure.

### 22.5 EX-06 — No-ball hit for four, free hit triggered

1. **Input:** `legality=NO_BALL`, `runEvents=[NBP:1:A, NBB:4:B]`, `isFreeHit=false` (no free hit was pending beforehand).
2. **Validation:** passes; `NO_BALL` + `isFreeHit=false` is consistent (V9 only forbids the opposite combination).
3. **Score calculation:** `total=5`, `batterRuns=4` (from `NBB`), `extras.noBalls=1`, `bowlerRunsCharged=5`, `ranRuns=0`.
4. **Batter state:** A: `runs +4`, `ballsFaced +1` (a no-ball **does** count as faced, §6.2), `fours +1`.
5. **Bowler state:** X: `legalBallsBowled` unchanged; `runsCharged +5`; `noBallsBowled +1`.
6. **Team score:** `totalRuns +5`; `extras.noBalls +1`.
7. **Over state:** `legalBallCount` unchanged; `runsThisOver +5`; **maiden status for this over is now permanently false** regardless of what follows (§13.3 — a no-ball breaks a maiden even though its runs came off the bat here).
9. **Strike state:** no rotation (`ranRuns=0`).
11. **Free-hit state:** `InningsState.freeHitPending → true` (assuming the profile's `freeHitOnNoBall=true`), to be consumed by the next **legal** delivery (§13.4) — this no-ball's own boundary does not consume it.
10. **Event generated:** one `EVT-DELIVERY-RECORDED` with `legality=NO_BALL`.
12. **Undo behavior:** standard §18.1; the refold also correctly resets `freeHitPending` back to whatever it was before this event (`false`, in this example), since that too is derived, not stored.
13. **Correction behavior:** standard §19.1; note that correcting *this* no-ball to a `LEGAL` delivery would retroactively remove the free hit it had granted — the refold propagates that removal to every subsequent delivery's `isFreeHit` value, and if a later delivery had recorded `isFreeHit=true` on the strength of this one, that later event's stored `isFreeHit` now **disagrees** with the refolded derivation — this is exactly the kind of discrepancy §19.2's cascade-review step exists to surface before the correction is finalised.

### 22.6 EX-07 — Free hit: run-out remains valid, bowled would not

Pre-state: `freeHitPending=true` entering this ball.

1. **Input (variant a — accepted):** `legality=LEGAL`, `isFreeHit=true`, `runEvents=[OB:1:R]`, `wicket={mode:RUN_OUT, outBatterId:B, endVacated:NON_STRIKER, crossedBeforeDismissal:false, incomingBatterId:C}`.
2. **Validation:** `RUN_OUT` ∈ the free-hit-valid set (§9.1) — **accepted**.
3. **Score calculation:** `total=1`, `ranRuns=1` (credited before the run-out completed).
4. **Batter state:** A: `runs +1`, `ballsFaced +1`. B: `status → OUT`, `dismissal` recorded.
5. **Bowler state:** X: `legalBallsBowled +1`; `runsCharged +1`; **`wickets` unchanged** — `RUN_OUT` never credits the bowler (§9.4), free hit or not.
6. **Team score:** `totalRuns +1`; `wicketsLost +1`.
8. **Wicket state:** B out, run out, non-striker's end vacated; C comes in at the non-striker's end (§9.5 rule 1 — not rule 2, since it was the *non-striker* out here with `endVacated` already stating which end, and the crossing question only changes the *which end* answer when the dismissed batter was mid-run between ends; here B is simply removed from the non-striker's end directly).
9. **Strike state:** the run-out is resolved before free-hit consumption; A remains striker (unaffected by a non-striker dismissal); the 1 completed run does not itself change who's *facing*, only who occupies the non-striker slot.
11. **Free-hit state:** consumed (`freeHitPending → false`) — a free hit is used up by the next legal delivery regardless of its outcome, including a wicket (§13.4).

**Input (variant b — rejected):** identical except `wicket={mode:BOWLED, ...}` — **rejected at validation (V5)**; the UI must not even offer `BOWLED` as a selectable option on a free-hit delivery (`docs/ux/ux-specification.md UX-12`), and if it somehow reaches the engine, V5 refuses it outright, before any state changes.

### 22.7 EX-08 — Caught (zero runs enforced)

1. **Input:** `legality=LEGAL`, `runEvents=[]`, `wicket={mode:CAUGHT, outBatterId:A, fielderIds:[fielderId], endVacated:STRIKER, incomingBatterId:C}`.
2. **Validation:** V6 confirms `runEvents=[]` is required and satisfied for `CAUGHT`.
3. **Score calculation:** `total=0` in every category.
4. **Batter state:** A: `status → OUT`, `dismissal={mode:CAUGHT, fielderIds:[...]}`, `ballsFaced +1` (the dismissal ball still counts as faced). C's new card line initialises at 0/0.
5. **Bowler state:** X: `legalBallsBowled +1`; `wickets +1` (`CAUGHT` credits the bowler, §9.4).
6. **Team score:** `wicketsLost +1`; `totalRuns` unchanged.
8. **Wicket state:** C occupies the striker's end (vacated by A, §9.5 rule 1).
9. **Strike state:** C is the new striker (having taken A's exact end); B remains non-striker, unaffected.
10. **Event generated:** one `EVT-DELIVERY-RECORDED` carrying the full `wicket` detail including `incomingBatterId` as one atomic unit (§9.2).
12. **Undo behavior:** voids the event; refold removes C's card line entirely (it never existed in the active fold) and restores A to `status=NOT_OUT` at the striker's end with figures exactly as they were before this ball.

### 22.8 EX-09 — Run out with the batters having crossed

Pre-state: A striker, B non-striker. A hits the ball and they attempt two runs.

1. **Input:** `legality=LEGAL`, `runEvents=[OB:1:R]` (one run completed before the throw), `wicket={mode:RUN_OUT, outBatterId:A, fielderIds:[fielder], endVacated:STRIKER, crossedBeforeDismissal:true, incomingBatterId:C}` — A is run out attempting the second run, but **had already crossed** with B before the throw arrived.
3. **Score calculation:** `total=1`, `ranRuns=1` (credited).
4. **Batter state:** A: `runs +1` (the one completed run **is** credited to A even though A is the one dismissed — the run belongs to whoever was on strike when it was completed, §9.3), `status → OUT`. B: unaffected numerically.
8. **Wicket state (the subtle part, §9.5 rule 2b):** because `crossedBeforeDismissal=true`, B has physically swapped to the end A started at, and the incoming batter C occupies the **opposite** end from where A started — i.e. C takes the end B is now running toward, which is A's *original* end's counterpart. Concretely: A started at the striker's end; after the crossing, B is now physically at the striker's end and A (dismissed) was headed to the non-striker's end when run out; C therefore comes in at the **non-striker's end**, and **B — not C — is the striker** for the next ball.
9. **Strike state:** B is striker, C is non-striker. (Contrast directly with C37/§21.7 row, where `crossedBeforeDismissal=false` would instead leave B as non-striker and put C in at the striker's end.)
12. **Undo behavior:** refold restores A to `NOT_OUT` at the striker's end, B back to non-striker, removes C entirely — automatically, since all of it is re-derived, not separately tracked.

### 22.9 EX-10 — Non-striker run out ("mankad")

Pre-state: over 8.3, A striker, B non-striker, X about to bowl the 4th ball.

1. **Input:** a distinct event shape, not a `DeliveryInput` at all — `EVT-NON-STRIKER-RUN-OUT` with `wicket={mode:RUN_OUT, outBatterId:B, endVacated:NON_STRIKER, incomingBatterId:C}` (§9.6, §16.3).
2. **Validation:** the equivalent of V7/V8 applies to `fielderIds`/`incomingBatterId`; no `legality`/`runEvents` fields exist to validate at all.
3. **Score calculation:** none — no runs, no `RunEvent`s.
4. **Batter state:** B: `status → OUT`. A: **completely unaffected** — no `ballsFaced` change, no runs.
5. **Bowler state:** X: **no change at all** — not `legalBallsBowled`, not `runsCharged`, not `wickets` (`RUN_OUT` never credits the bowler regardless).
6. **Team score:** `wicketsLost +1` only.
7. **Over state:** `legalBallCount` unchanged — this was never a legal-ball-consuming event.
8. **Wicket state:** C comes in at the non-striker's end.
9. **Strike state:** A remains striker throughout; §14.2's formula does not even run (§14.6).
10. **Event generated:** `EVT-NON-STRIKER-RUN-OUT`, positioned by dense `event_ordinal` immediately before what will become "ball 4" of the over, displayed as "8.3 (before delivery)".
12. **Undo behavior:** voids the event; refold restores B as `NOT_OUT` at the non-striker's end, removes C, over.ball display reverts to showing the pre-delivery state exactly.

### 22.10 EX-11 — Retired hurt, then resumption

1. **Input (retirement):** a standalone `EVT-BATTER-RETIRED` event (not a `DeliveryInput`), `{batterId:A, reason:"injury"}`.
4. **Batter state:** A: `status → RETIRED_NOT_OUT`; figures (`runs`, `ballsFaced`, `fours`, `sixes`) **frozen as they stand**, not reset. C comes in at A's vacated end (same mechanism as §9.5 rule 1).
6. **Team score:** `wicketsLost` **unaffected** (§9.8 — not a dismissal).
15. **Effective all-out threshold:** reduced by 1 for the rest of the innings while A remains `RETIRED_NOT_OUT` (`MINV-10`, §15).
9. **Strike state:** C takes A's exact end.
**Resumption (later, between deliveries, A comes back in for C — or for whoever is out at that point):** A's `status → NOT_OUT` again; **the original card line's accumulated figures are reused unchanged** — a fresh card line is never created for a resuming batter.
12. **Undo behavior:** the retirement event and the (separate) resumption event each void independently per §18.1, exactly as any other event — a resumption is simply the most recent event if it's what's being undone.

### 22.11 EX-12 — Undo across an over boundary (compound case)

Pre-state: the delivery just recorded was C05-style (`OB:6:B`) and was also the over's final ball (as in EX-03) — the over has completed, `overNumber` has advanced, and the client is currently showing the bowler-change prompt (`UX-15`) for the new over.

1. **Undo invoked.** Per §18.1: the most recent active event (the six) is voided; the entire projection is recomputed by folding the active stream, which now stops one delivery earlier.
2. **Consequences, all automatic, none separately coded:** `legalBallCount` reverts to 5 (over not complete); `overNumber` reverts to the prior over; `previousOverBowlerId` reverts to whatever it was before; **the bowler-change prompt that was open is dismissed**, because its trigger condition (`legalBallCount = ballsPerOver`) is no longer true; strike reverts to whoever was striker before the six (§14's formula, re-evaluated, naturally un-applies the end-of-over swap since there is no longer an end-of-over); the team score, batter figures, and bowler figures all revert to their pre-six values.
3. **Redo**, if invoked immediately after with no intervening new entry, re-applies the exact same six and all of the above consequences return.

### 22.12 EX-13 — Correction that changes when the innings ended

Pre-state: the recorded log shows over 19.4 as a wicket (the 10th, all out), with the innings recorded as `COMPLETE` at that point; overs 19.5–19.6 were never bowled (the innings ended before them). The scorer now realises **over 12.1** — six overs earlier — was wrongly recorded as a wicket; it should have been a leg-bye.

1. **Correction submitted:** the scorer navigates to 12.1 (`UX-17`), changes `wicket:{...}` to `null` and `runEvents` to `[LB:1:R]`, supplies a reason, and confirms.
2. **Validation:** the new payload (a plain leg-bye, no wicket) passes §5 exactly as fresh entry would.
3. **Event emitted:** `EVT-DELIVERY-CORRECTED`, `supersedes = <the 12.1 event's id>`, `reason` populated. The original 12.1 event remains in the log, now superseded.
4. **Refold:** every event from 12.1 onward is re-evaluated. The batter who was dismissed at 12.1 in the original history is now **not out** and never left the crease; the batter who came in to replace them at 12.1 in the original history **never batted** — their card line, and every event that referenced them as striker/non-striker/bowler-of-record downstream, is now inconsistent with the refolded reality.
5. **`SVC-CASCADE-RECOMPUTER`'s summary (§19.1 step 5), shown before the correction is finalised:** flags exactly this — "this correction removes a batter who took strike from 12.1 onward; N later events reference a batter/strike configuration that no longer follows from the corrected history" — and additionally flags the innings-end-timing consequence (§19.2): since the *original* wicket at 19.4 that produced all-out is **still present and still active** (it was never itself corrected), the refold now reaches 19.4 through a **different route** — but 19.4's `strikerBatterId`/`nonStrikerBatterId` fields (§16.2, captured explicitly at write time) may no longer match what the refolded state says *should* have been on strike at that point, because the batter substitution six overs earlier has propagated forward.
6. **Deterministic handling — never guessed:** the engine does **not** attempt to auto-repair 19.4 or any event between 12.1 and 19.4. It surfaces every event whose recorded crease context now disagrees with the refolded derivation as a **named, itemised reconciliation failure** ("strike-context mismatch at over N.b" — distinct from a generic FAIL), blocking sign-off (`BR-007`) until the scorer works forward from 12.1, over by over, confirming or correcting each subsequent event's crease context explicitly. This is the direct, concrete instance of §19.2's principle: a correction with wide downstream consequences is never silently reconciled on the scorer's behalf.
7. **Undo of this correction:** voids the `EVT-DELIVERY-CORRECTED` (not the original — that was never touched), immediately restoring the pre-correction state in full, including whatever reconciliation status existed beforehand.

---

## 23. Traceability

| This document | Source |
|---|---|
| §6, §13 (legality, over/ball counting) | `cricket-rules-reference.md` `OVER-*`, `BALL-*`; `INV-002/003/012`; `MINV-08` |
| §7 (`RunEvent` model, score calculation) | `RUN-*`, `EXT-*`, `NB-*`, `WD-*`, `BYE-*`, `LB-*`, `PEN-*`; `INV-001/004/010`; `SVC-EXTRAS-DECOMPOSER` |
| §8 (short runs) | `RUN-*` (short run sub-area) |
| §9 (wicket resolution) | `WKT-*` and all dismissal-mode sub-areas (`BWLD/CAUT/LBW/STMP/RNO/NSRO/HITW/OBSF/HBT/TIMO/RTHO/RTOU`); `BR-030…033/038`; `INV-005/006`; `MINV-06/07/10` |
| §10 (batter state) | `BAT-*`; `INV-008/009` |
| §11 (bowler state) | `BOWL-*`; `INV-002/003/004`; `BR-027/028` |
| §12 (team score) | `INV-001` |
| §13.4 (free hit) | `FH-*`; `BR-033`; `MINV-09` |
| §14 (strike resolution) | `STRK-*`; `INV-011`; `MINV-04`; `MBR-09`; `SVC-STRIKE-RESOLVER` |
| §15 (innings/match end) | `INN-*`; `MINV-10`; `SVC-INNINGS-END-EVALUATOR`; `FR-071/072/073` |
| §16 (event generation) | `docs/domain/domain-model.md §9` `EVT-*`; `MBR-01/05/06` |
| §17 (audit record) | `AUD-001…005`; `system-architecture.md §3.12` |
| §18 (Undo) | `FR-059/061/062`; `MBR-07`; `MINV-01` |
| §19 (Correction) | `FR-097…103/108`; `BR-004/006`; `AUD-005/010`; `SVC-CASCADE-RECOMPUTER` |
| §20 (reconciliation) | `INV-001…018`; `SVC-RECONCILER`; `BR-007` |
| UI screens that call this pipeline | `docs/ux/ux-specification.md` UX-10…UX-19 |

---

## 24. Open items

| # | Item | Current default in this spec | Resolution path |
|---|---|---|---|
| LSQ-1 | Hit-wicket validity off a **wide** (§9.1) | Not offered (conservative, matches the no-ball treatment) | `[OPEN]` — accredited-scorer ratification pass (`docs/README.md` Status; parallels the pending pass over `cricket-rules-reference.md`) |
| LSQ-2 | Deliberate short running as a distinct penalty-bearing offence (§8) | Modelled only as an additional `PENALTY` `RunEvent`, not a first-class dismissal-adjacent flow | `[EDGE]`, low priority — confirm whether P1 needs an explicit UI path or whether the general penalty mechanism suffices |
| LSQ-3 | Exact set of no-ball *kinds* that trigger a free hit, where `freeHitTriggerNoBallKinds` is configured as a subset rather than "all" (§13.4) | Default subset = all no-ball kinds | `[CFG]` — competition-specific; resolved per `CFG-REG` value, not by this document |
| LSQ-4 | Whether an innings-end-timing correction (§19.2, second sub-case) should offer an **assisted** re-entry flow (e.g. pre-filling likely deliveries) versus the fully manual re-entry this specification defaults to | Fully manual — the engine never invents deliveries | Product decision; the deterministic floor (never guess) is fixed regardless of how much UI assistance is layered on top |
| LSQ-5 | Last-man-stands and one-short calls (`FR-072`, `foundation §7` P3 territory) | Out of this document's scope entirely | Deferred to the Future-phase multi-day/variant-format spec pass (`docs/roadmap/product-roadmap.md`) |

---

## 25. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-21 | Initial ball-processing specification. §1–§4: determinism contract, the delivery pre-state, the canonical `DeliveryInput` schema, guardrail preconditions. §5: 11 validation rules. §6: legality classification (legal-ball-slot and balls-faced tables). §7: the `RunEvent` model — the composable mechanism covering every run/extra combination by construction, including the wide/no-ball boundary-subsumption rule and overthrow crediting. §8: short runs. §9: the full dismissal-mode-by-delivery-context validity matrix (including the corrected, broadened always-zero-runs set {`BOWLED`,`CAUGHT`,`LBW`,`STUMPED`,`HIT_BALL_TWICE`} vs. the may-carry-runs set {`RUN_OUT`,`HIT_WICKET`,`OBSTRUCTING_THE_FIELD`}), bowler-credit rules, batter-replacement-end rules, the non-striker-run-out and retired-hurt/timed-out/retired-out special cases. §10–§13: batter, bowler, team, and over state update rules, including the maiden-over and free-hit-persistence algorithms. §14: the strike-rotation parity (XOR) algorithm with its full derivation from physical end-swapping — the document's central "gotcha" rule. §15: innings/match-end evaluation order. §16–§17: event generation (with the "derived facts are never independently emitted" design decision) and audit-record requirements. §18–§19: Undo defined as one universal void-and-refold algorithm (correct by construction for every case in this document) and Correction defined as supersede-and-refold, including the innings-end-timing edge case that is always flagged, never silently resolved. §20: direct mapping from this document's rules to `INV-001…018`. §21: ~55-row case catalogue as conformance-test vectors, including 6 rejected-input vectors. §22: 13 fully worked examples covering all 13 required dimensions explicitly, including the over-boundary parity pair, wide-to-boundary, no-ball-plus-boundary, free-hit run-out, caught, crossed-run-out, mankad, retired-hurt, a compound Undo, and a Correction that changes innings-end timing. §23 traceability. §24 five open items, tagged `[OPEN]` where genuinely unresolved. No production code — a deterministic rules specification (decision tables, formulas, structured algorithm steps) for implementers of the shared scoring core. |

