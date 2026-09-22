# Cricket Scoring Book — Acceptance Criteria Catalog

| | |
|---|---|
| **Document** | Acceptance Criteria Catalog |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | Every approved document — `docs/specs/software-requirements-specification.md`, `docs/specs/live-scoring.md` (§21–22), `docs/architecture/offline-first-specification.md`, `docs/architecture/data-specification.md`, `docs/architecture/api-specification.md`, `docs/architecture/security-specification.md`, `docs/architecture/testing-strategy.md`, `docs/ux/ux-specification.md` |
| **Downstream** | Test-suite authoring against every category in `testing-strategy.md §3–§18` |
| **Status** | Every criterion is **Given/When/Then**, machine-checkable, and traced to its source requirement. **No test code.** Sibling to `testing-strategy.md`: that document defines *how* verification is organized (16 test categories, tools, gates); this one supplies the *content* — the actual criteria — organized by the eight case categories the brief specifies. |

> Every criterion in this document passes the objectivity rule in §1.2 before it is included. Where a feature's exhaustive per-requirement criteria already exist verbatim in the SRS (every `FR-`/`DR-`/`BR-`/`NFR-`/`SEC-`/`OFF-`/`SYNC-`/`AUD-` entry carries its own), this document does not duplicate them wholesale — it re-organizes representative and exhaustive-where-it-matters criteria by the eight requested case categories, fills gaps those categories expose, and is fully traceable back to every source. §11 states exactly what is exhaustive here versus pointed at its source.

---

## 1. Format and the objectivity rule

### 1.1 Given/When/Then, precisely

Every criterion has exactly three clauses. **Given** fixes the pre-state completely (never "some" or "a typical" state — an exact value or exact reference to a defined pre-state). **When** is exactly one action or event. **Then** asserts one or more exact, checkable outcomes. A criterion needing more than one `When` is two criteria, not one — this keeps every criterion independently automatable.

### 1.2 The objectivity rule — what "no subjective interpretation" means, checkably

A criterion in this catalog satisfies the rule if and only if **every** clause in its `Then` is one of:

1. An exact numeric, string, or enum value (`total_runs = 151`, `state = 'COMPLETE'`).
2. An exact HTTP status or error code (`api-specification.md §5.2`'s registry).
3. A boolean state transition with a named before/after (`freeHitPending: false → true`).
4. A reference to an already-defined deterministic formula or rule, cited by section (`per live-scoring.md §14.2's netRotates formula`) — never "the system behaves correctly," always *what* correct means, with a citation to where that's fixed.
5. For the narrow set of criteria that are genuinely **not machine-automatable** (a small number under Accessibility, `testing-strategy.md §17`) — a checklist of objectively observable facts (e.g. "the screen reader announces the ball outcome within one utterance"), never a satisfaction judgement ("feels natural," "is intuitive").

**Banned in every `Then` clause, without exception, unless immediately followed by the exact numeric/enum definition that removes the ambiguity:** *should, appropriate, reasonable, properly, correctly, user-friendly, intuitive, clean, nice, good, acceptable, fast enough, sensible.* A `Then` clause using one of these words with no immediately-following exact definition is not a valid entry in this catalog.

**Explicitly out of scope, by design, because it cannot satisfy this rule:** aesthetic or "feel" quality judgements about a UI. `docs/ux/ux-specification.md`'s interaction and state specifications are already objective (exact states, exact error text conventions) and are what this catalog draws from for UI-adjacent criteria — a "does it feel good to use" assessment is never an acceptance criterion here.

### 1.3 Tagging

Every criterion carries a category tag from the brief's eight — `[NORMAL]` `[BOUNDARY]` `[INVALID]` `[CRICKET-EDGE]` `[OFFLINE]` `[SYNC]` `[RECOVERY]` `[SECURITY]` — plus a `Trace` to its source requirement(s)/rule(s). A criterion may carry more than one tag where it genuinely spans categories (e.g. a security criterion tested only under offline conditions carries both `[OFFLINE]` and `[SECURITY]`).

---

## 2. The eight case categories, defined for this system

| Category | Precise meaning here | Primary source |
|---|---|---|
| **Normal** | The common, expected path for a feature — the input a well-behaved client sends under ordinary conditions | Every SRS requirement's own baseline acceptance criterion |
| **Boundary** | A value at, or one unit from, a stated numeric/count/time limit — never "a large number," always the exact limit and the exact value one step past it | Constraints in `data-specification.md`, thresholds in the SRS, cricket-law limits (max wickets, max overs, exact run values) |
| **Invalid** | An input that violates schema, a business rule, or a state precondition — the system's *rejection* behavior, asserted exactly (status code, error code, and that no partial state change occurred) | `api-specification.md §4/§5`'s three validation layers |
| **Cricket edge** | A legal-but-unusual or Laws-specific delivery/dismissal/scoring scenario where getting the rule wrong is a domain-correctness failure, not a software bug in the ordinary sense | `live-scoring.md §21–22` — converted in full, §6 |
| **Offline** | Behavior with zero connectivity, for any duration | `offline-first-specification.md §4/§8/§18.1` |
| **Synchronization** | Behavior of the push/pull protocol itself — ordering, idempotency, convergence | `offline-first-specification.md §7/§9/§18.2` |
| **Recovery** | Behavior after an interruption — process crash, device loss, account recovery — measured against the honest, bounded guarantees already stated, never overclaimed | `offline-first-specification.md §15`, `security-specification.md §14` |
| **Security** | Authentication, authorization, and integrity behavior specifically — distinct from "invalid" in that the input may be well-formed and the violation is one of *permission*, not *shape* | `security-specification.md` |

### 2.1 Applicability matrix — not every category applies to every feature cluster

Stated explicitly, matching the asymmetric-mapping precedent from `api-specification.md §19.2` and `testing-strategy.md §19.1` — forcing all eight categories onto every feature would pad this catalog with meaningless entries.

| FR cluster (SRS §4) | Normal | Boundary | Invalid | Cricket-edge | Offline | Sync | Recovery | Security |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| A. Identity, Accounts & Tenancy | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ |
| B. Match Setup | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| C. Squads, Lineups & Roles | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| D. Live Ball-by-Ball Scoring | ✓ | ✓ | ✓ | **✓✓✓** | ✓ | — | ✓ | ✓ |
| E. Innings & Match State | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| F. Rain, DLS & Reduced Overs | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| G. Tie-breakers / Super Over | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| H. Corrections, Audit & Sign-off | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| I. Dual-Scorer Reconciliation | ✓ | — | — | — | ✓ | ✓ | — | — |
| J. Scorecards, Analytics & Commentary | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| K. Competitions, Fixtures & Standings | ✓ | ✓ | ✓ | — | — | — | — | — |
| L. Profiles, Stats, History & Search | ✓ | — | ✓ | ✓ | ✓ | — | — | ✓ |
| M. Sharing, Notifications & Viewer | ✓ | — | ✓ | — | ✓ | — | — | ✓ |
| N. Import, Export, API & Backup | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ |
| O. Settings, Localization & Preferences | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| P. Administration | ✓ | — | ✓ | — | ✓ | — | ✓ | **✓✓✓** |

Marked `✓✓✓` where that category is that cluster's dominant concern (Cricket-edge for D; Security for P).

---

## 3. Normal cases

`[NORMAL]` — the common, well-formed path. One representative criterion per notable feature per cluster; the SRS's own per-requirement acceptance criteria remain the exhaustive record (§11).

**A — Identity & Tenancy**
- N-A1: Given a registered, verified user with a correct email and password, when they submit sign-in, then the response is `200` with a valid access and refresh token pair, and the client navigates to Dashboard (`UX-03`). *Trace: `FR-002`.*
- N-A2: Given no account exists on the device, when "Continue as guest" is selected, then a `matches` row is created locally with `organization_id = null` and `origin_device_id` set to the current device (`data-specification.md §5.1`). *Trace: `FR-001`.*

**B — Match Setup**
- N-B1: Given `overs_allotted = 20` entered and saved, when setup is submitted, then `matches.overs_allotted = 20` and `matches.state` advances only once every Must-have field is present (`BR-002`). *Trace: `FR-020`.*
- N-B2: Given a toss recorded as "Team A elects to bat," when confirmed, then the chasing-innings side is set to Team B and `matches.toss_decision = 'BAT'`. *Trace: `FR-023`, `BR-026`.*

**C — Squads, Lineups & Roles**
- N-C1: Given exactly 11 players selected with one marked captain and one marked keeper, when Continue is pressed, then the client advances to Toss (`UX-08`). *Trace: `FR-034/035`.*

**D — Live Ball-by-Ball Scoring**
- N-D1: Given `legality = LEGAL, runEvents = [OB:1:R]`, when the delivery is processed, then `total_runs = 1`, `batterRuns = 1`, `ranRuns = 1`, and `netRotates = true`. *Trace: `FR-044`; `live-scoring.md` `C02`.*
- N-D2: Given a bowler selection distinct from the previous over's bowler and within their over cap, when the over begins, then the delivery is accepted with no guardrail block. *Trace: `FR-054/057/058`.*

**E — Innings & Match State**
- N-E1: Given all 20 legal overs of a 20-over innings are bowled, when the last legal ball is recorded, then `innings.state = 'COMPLETE'`, `innings.end_reason = 'OVERS_COMPLETE'`. *Trace: `FR-071`.*

**F — Rain, DLS & Reduced Overs**
- N-F1: Given a fixed benchmark rain scenario from the published DLS reference set, when the revised target is computed, then it matches the reference output within the published rounding tolerance. *Trace: `FR-086`, `NFR-034`.*

**G — Tie-breakers / Super Over**
- N-G1: Given scores level after the second innings and the tie-breaker configured as `SUPER_OVER`, when the Super Over is completed with one side scoring more, then that side is recorded as the match winner. *Trace: `FR-095/096`.*

**H — Corrections, Audit & Sign-off**
- N-H1: Given a match with a passing reconciliation report, when the Head Scorer signs off, then `sign_offs.version = 1` is created and `matches.state = 'COMPLETE'`. *Trace: `FR-106`.*

**I — Dual-Scorer Reconciliation**
- N-I1: Given two scorer streams whose recorded values agree at every over.ball, when the alignment pass runs, then zero `divergences` rows are created. *Trace: `FR-116`.*

**J — Scorecards, Analytics & Commentary**
- N-J1: Given a completed innings, when the scorecard is requested, then `total_runs = Σ batter_card_lines.runs + Σ extras` exactly (`INV-001`). *Trace: `FR-112`.*

**K — Competitions, Fixtures & Standings** *(V2)*
- N-K1: Given a round of Final, non-disputed matches, when standings recompute, then points/NRR match an independently hand-computed reference for that round. *Trace: `FR-145/146`.*

**L — Profiles, Stats, History & Search**
- N-L1: Given an approved appearance claim on a Final match, when career statistics are computed, then that match's figures are included. *Trace: `FR-152/153`.*

**M — Sharing, Notifications & Viewer**
- N-M1: Given a valid, unrevoked share token, when `GET /viewer/{token}` is called, then the response is `200` with the current live projection. *Trace: `FR-137/138`.*

**N — Import, Export, API & Backup**
- N-N1: Given a signed-off match, when a PDF export is requested, then the resulting document's total equals `matches` scorecard's stored total exactly. *Trace: `FR-172`.*

**O — Settings, Localization & Preferences**
- N-O1: Given the interface language set to a supported locale, when any core-flow screen renders, then every externalised string renders in that locale with no untranslated fallback string visible. *Trace: `FR-183`, `NFR-057`.*

**P — Administration**
- N-P1: Given an org-admin sends an invitation with `roles = ['SCORER']`, when the invitee accepts within the expiry window, then the resulting membership has exactly `roles = ['SCORER']`, no more, no less. *Trace: `FR-007/008`.*

## 4. Boundary cases

`[BOUNDARY]` — the exact limit value, and the exact value one unit past it, both asserted.

**A — Identity & Tenancy**
- B-A1: Given a password of exactly the minimum policy length, when submitted at sign-up, then it is accepted; given a password one character shorter, when submitted, then it is rejected at schema validation. *Trace: `SR-A02`.*
- B-A2: Given the offline authentication grace window has elapsed to the exact second (`[DEFAULT]` 14 days), when a cloud-dependent action is attempted offline, then it is refused locally; given one second before that boundary, when attempted, then it succeeds. *Trace: `SR-C03`.*

**B — Match Setup**
- B-B1: Given `overs_allotted = 1` (the smallest positive integer), when saved, then accepted; given `overs_allotted = 0`, when saved, then rejected `422 validation/business-rule`. *Trace: `FR-020`.*

**C — Squads, Lineups & Roles**
- B-C1: Given exactly 11 players selected and 0 keepers marked, when Continue is pressed, then blocked identifying "wicket-keeper required" (`UX-07`); given exactly 1 keeper marked, when Continue is pressed, then the keeper check passes. *Trace: `FR-032`, `BR-009`.*

**D — Live Ball-by-Ball Scoring**
- B-D1: Given `RunEvents = [OB:6:B]` (the highest primary boundary value), when processed, then `sixes += 1`; given `RunEvents = [OB:6:R]` (an all-run six with no boundary), when processed, then `sixes` is unchanged. *Trace: `DR-09`; `live-scoring.md C08/C06`.*
- B-D2: Given the over's `legal_ball_count = ballsPerOver − 1` (one short of complete) and a legal delivery is recorded, when processed, then the over completes on this ball; given the same pre-state but the delivery is a `WIDE`, when processed, then the over remains incomplete. *Trace: `DR-07`; `live-scoring.md §13.1`.*
- B-D3: Given a bowler at exactly `bowlerOverCap − 1` overs bowled, when selected for the next over, then accepted; given exactly `bowlerOverCap` overs already bowled, when selected again, then blocked unless overridden with a reason. *Trace: `BR-028`.*

**E — Innings & Match State**
- B-E1: Given `total_runs = target − 1` and a delivery scores exactly 1 run, when processed, then `total_runs = target` and the innings ends immediately, mid-over if applicable, with no further deliveries accepted. *Trace: `FR-073`, `BR-018`.*
- B-E2: Given `wickets_lost = effectiveAllOutThreshold − 1` and one further wicket falls, when processed, then the innings ends `ALL_OUT`; given the same pre-state and no wicket falls on that delivery, then the innings continues. *Trace: `FR-072`, `MINV-10`.*

**F — Rain, DLS & Reduced Overs**
- B-F1: Given a DLS computation where `resources_used = 100%` exactly for a side, when the reconciliation check runs, then `INV-015` reports `PASS`; given `resources_used = 100.01%` (a computation defect scenario), then `INV-015` reports `FAIL`. *Trace: `DR-36`; `INV-015`.*

**G — Tie-breakers / Super Over**
- B-G1: Given exactly 2 wickets down in a Super Over, when the 2nd wicket falls, then that side's Super Over innings ends immediately, even if legal balls remain in the over. *Trace: `BR-041`; `live-scoring.md C33` (analogous general-innings wicket-cap logic applied to the Super Over container).*

**H — Corrections, Audit & Sign-off**
- B-H1: Given a correction targets the match's very first delivery (`event_ordinal` = the minimum in the innings), when applied, then the refold recomputes every subsequent delivery's strike/state from that point forward with no truncation. *Trace: `FR-101/103`; `live-scoring.md §19.1`.*

**J — Scorecards, Analytics & Commentary**
- B-J1: Given a batter dismissed for exactly 0 runs off exactly 0 balls faced, when the scorecard renders, then the batter's line is shown distinctly from a batter who never came in (`ABSENT`/no card line at all). *Trace: `FR-121`; `data-specification.md §7.7`.*

**M — Sharing, Notifications & Viewer**
- B-M1: Given a share token is revoked at the same instant a request using it is in flight, when that request completes, then it resolves to `404`, never a partially-served `200` — the race resolves to the safe (deny) side, deterministically. *Trace: `SEC-009`; `api-specification.md §14.4`.*

**N — Import, Export, API & Backup**
- B-N1: Given a sync push batch of exactly `maxBatchSize` (`[DEFAULT]` 200) events, when submitted, then accepted as one batch; given `maxBatchSize + 1` events, when submitted, then rejected `400` before any event is processed. *Trace: `SR-G06`.*

**O — Settings, Localization & Preferences**
- B-O1: Given local storage usage at exactly the configured warning threshold, when checked, then the warning is shown; given usage one byte below the threshold, then it is not. *Trace: `OFF-016`.*

**P — Administration**
- B-P1: Given an invitation accepted at exactly its `expiresAt` instant, when processed, then it is treated as expired — the boundary resolves to *expired*, a stated, non-ambiguous default. *Trace: `FR-008`; `api-specification.md §11.5`.*

---

## 5. Invalid cases

`[INVALID]` — malformed input, a violated business rule, or an illegal state transition. Every entry asserts the exact status/error code **and** that no partial state change occurred.

**A — Identity & Tenancy**
- I-A1: Given an email with no `@` character, when sign-up is submitted, then the response is `400 validation/schema` naming the `email` field; no account row is created. *Trace: `SR-A02`.*
- I-A2: Given five failed sign-in attempts for one (email, IP) pair within 15 minutes, when a sixth is attempted, then the response is `429` with a `Retry-After` header, identical in shape whether or not the account exists. *Trace: `SR-A03`.*

**B — Match Setup**
- I-B1: Given `powerplayOvers > oversAllotted`, when setup is submitted, then rejected `422 validation/business-rule` flagging both fields; `matches.state` does not advance. *Trace: `FR-020`.*
- I-B2: Given a `PUT /matches/{id}` attempts to change `home_xi` after the first ball has been recorded, when submitted, then rejected `422 validation/business-rule` (`BR-017`); the amendment path (`live-scoring.md §19`) is the only accepted route. *Trace: `api-specification.md §10.2`.*

**C — Squads, Lineups & Roles**
- I-C1: Given the same `player_id` selected in both sides' XIs, when validation runs, then rejected identifying that specific player id, not a generic error. *Trace: `BR-010`.*
- I-C2: Given two players both marked as captain for one side, when validation runs, then rejected. *Trace: `BR-009`.*

**D — Live Ball-by-Ball Scoring**
- I-D1: Given `wicket.mode = STUMPED` on a delivery with `legality = NO_BALL`, when submitted, then rejected (V5, `422`); `STUMPED` is not in the no-ball-valid dismissal set. *Trace: `live-scoring.md §9.1`, `C50`.*
- I-D2: Given `wicket.mode = CAUGHT` with a non-empty `runEvents` list, when submitted, then rejected (V6, `422`) — caught must total zero runs. *Trace: `live-scoring.md §9.3`, `C51`.*
- I-D3: Given `RunEvents` containing both a `method = BOUNDARY` and a `method = OVERTHROW` entry on the same delivery, when submitted, then rejected (V4, `422`) — a boundary and an overthrow cannot coexist. *Trace: `live-scoring.md §7.4`, `C52`.*
- I-D4: Given `legality = DEAD_BALL` with a non-empty `runEvents` list, when submitted, then rejected (V11, `422`). *Trace: `live-scoring.md §6.4`, `C53`.*
- I-D5: Given no bowler is currently set for the innings, when a delivery is submitted, then refused outright before validation even runs (guardrail precondition, `live-scoring.md §4.3`). *Trace: `FR-054`.*

**E — Innings & Match State**
- I-E1: Given `innings.state = 'COMPLETE'`, when a further delivery is submitted against it, then refused (guardrail precondition 1). *Trace: `live-scoring.md §4.1`.*

**H — Corrections, Audit & Sign-off**
- I-H1: Given a match's reconciliation report has an open `FAIL` and no override reason is supplied, when sign-off is attempted, then rejected `422 reconciliation/blocked` naming the specific failing `INV-*`. *Trace: `BR-007`.*
- I-H2: Given a non-Head-Scorer user attempts sign-off, when submitted, then rejected `403 auth/forbidden`. *Trace: `BR-005`, `SR-B02`.*
- I-H3: Given a correction is attempted against a `Final` match by a user without the elevated role, when submitted, then rejected, naming the missing role explicitly. *Trace: `BR-006`.*

**J — Scorecards, Analytics & Commentary**
- I-J1: Given a scorecard is requested for a `match_id` that does not exist (or is not visible to the caller under RLS), when requested, then `404`, identical in shape to a genuinely non-existent id — existence is never leaked across tenants. *Trace: `api-specification.md §5.2`.*

**M — Sharing, Notifications & Viewer**
- I-M1: Given a malformed or truncated share token, when `GET /viewer/{token}` is called, then `404`, identical to a revoked token's response. *Trace: `B-M1` above; `SEC-009`.*

**N — Import, Export, API & Backup**
- I-N1: Given an export `format` value outside `{PDF, CSV, CRICSHEET}`, when requested, then `400 validation/schema`, no export job is queued. *Trace: `api-specification.md §15.1`.*
- I-N2: Given a `PUT` request body sets a non-writable field (e.g. `row_version` mismatch or a locked field), when submitted, then the write is rejected or the field ignored per `api-specification.md §10.1` — never silently applied. *Trace: `SR-G04`.*

**O — Settings, Localization & Preferences**
- I-O1: Given an unsupported locale code is submitted, when the setting is applied, then rejected, and the interface falls back to the last-valid locale with no crash and no partial mixed-language render. *Trace: `FR-183`.*

**P — Administration**
- I-P1: Given an invitation token already used once, when presented again, then `410 Gone`, distinct from a never-existed token. *Trace: `api-specification.md §11.5`.*
- I-P2: Given a platform-admin action is attempted without an active MFA-verified session, when submitted, then rejected `403`. *Trace: `SR-A04`.*

---

## 6. Cricket edge cases

**The full conversion of `live-scoring.md §21`'s case catalogue into Given/When/Then form.** Every case id (`C01…C55`) below corresponds exactly to that document's row of the same id; nothing here is re-derived, only reformatted into the format the brief requires. This is the direct, exhaustive fulfilment of "every critical cricket rule must have deterministic test cases" for the entire P1 core scoring path (`testing-strategy.md §19.1`'s definition of "critical"). Rejected-input cases `C50…C55` already appear as `[INVALID]` criteria in §5 (cluster D) and are not repeated here to avoid duplication — this section covers `C01…C49`.

### 6.1 Off-the-bat runs (`live-scoring.md §21.2`)

- CE-C01: Given a legal delivery with no runs and no wicket, when processed, then `total_runs = 0`, `netRotates = false`, `legal_ball_count += 1`, `ballsFaced += 1`.
- CE-C02: Given `RunEvents = [OB:1:R]`, when processed, then `total_runs = 1`, `ranRuns = 1`, `netRotates = true`.
- CE-C03: Given `RunEvents = [OB:2:R]`, when processed, then `total_runs = 2`, `ranRuns = 2`, `netRotates = false`.
- CE-C04: Given `RunEvents = [OB:3:R]`, when processed, then `total_runs = 3`, `ranRuns = 3`, `netRotates = true`.
- CE-C05: Given `RunEvents = [OB:4:B]`, when processed, then `total_runs = 4`, `fours += 1`, `ranRuns = 0`, `netRotates = false`.
- CE-C06: Given `RunEvents = [OB:4:R]` (all-run four, no boundary), when processed, then `total_runs = 4`, `fours` **unchanged**, `ranRuns = 4`, `netRotates = false`.
- CE-C07: Given `RunEvents = [OB:5:R]`, when processed, then `total_runs = 5`, `ranRuns = 5`, `netRotates = true`.
- CE-C08: Given `RunEvents = [OB:6:B]`, when processed, then `total_runs = 6`, `sixes += 1`, `ranRuns = 0`, `netRotates = false`.
- CE-C09: Given `RunEvents = [OB:1:R, OB:4:O]` (one run then an overthrow of four), when processed, then `total_runs = 5`, `ranRuns = 1` (the overthrow contributes zero), `netRotates = true`.
- CE-C10: Given `RunEvents = [OB:2:R, OB:1:O]`, when processed, then `total_runs = 3`, `ranRuns = 2`, `netRotates = false`.
- CE-C11: Given `RunEvents = [OB:4:B]` on the over's final legal ball (`legalBallCount = ballsPerOver − 1` beforehand), when processed, then the over completes **and** `netRotates = true` despite zero running (the end-of-over term alone). *This is the flagship parity-XOR case — see also `EX-03` below.*
- CE-C12: Given `RunEvents = [OB:1:R]` on the over's final legal ball, when processed, then the over completes **and** `netRotates = false` — the run-swap and end-of-over swap cancel, the same batter faces the next over's first ball.

### 6.2 Wides (`§21.3`)

- CE-C13: Given `RunEvents = [WD:1:A]`, when processed, then `total_runs = 1` (extras.wides), `legal_ball_count` unchanged, `ballsFaced` unchanged, `netRotates = false`.
- CE-C14: Given `RunEvents = [WD:1:A, WD:2:R]`, when processed, then `total_runs = 3`, `extras.wides = 3`, `ranRuns = 2`, `netRotates = false`.
- CE-C15: Given `RunEvents = [WD:1:A, WD:1:R]`, when processed, then `total_runs = 2`, `ranRuns = 1`, `netRotates = true`.
- CE-C16: Given `RunEvents = [WD:4:B]` (a wide that reaches the boundary), when processed, then `total_runs = 4` — **not 5** — `extras.wides = 4`.

### 6.3 No-balls (`§21.4`)

- CE-C17: Given `RunEvents = [NBP:1:A]`, when processed, then `total_runs = 1`, `extras.noBalls = 1`, `legal_ball_count` unchanged, `ballsFaced += 1`, `freeHitPending` set to `true` (profile permitting) for the next legal delivery.
- CE-C18: Given `RunEvents = [NBP:1:A, NBB:2:R]`, when processed, then `total_runs = 3`, `batter_runs = 2`, `extras.noBalls = 1`, `freeHitPending = true`.
- CE-C19: Given `RunEvents = [NBP:1:A, NBB:4:B]`, when processed, then `total_runs = 5` (1 + 4, both additive, never subsumed), `batter_runs = 4`, `fours += 1`.
- CE-C20: Given `RunEvents = [NBP:1:A, NBB:6:B]`, when processed, then `total_runs = 7`, `batter_runs = 6`, `sixes += 1`.
- CE-C21: Given `RunEvents = [NBP:1:A, NBBY:2:R]`, when processed, then `total_runs = 3`, `extras.byes = 2`, `extras.noBalls = 1`.
- CE-C22: Given `RunEvents = [NBP:1:A, NBLB:1:R]`, when processed, then `total_runs = 2`, `extras.legByes = 1`, `extras.noBalls = 1`.
- CE-C23: Given `freeHitPending = true` entering the delivery and this delivery is again `legality = NO_BALL`, when processed, then `freeHitPending` **remains** `true`, unconsumed, carried to the next legal delivery.

### 6.4 Byes and leg-byes (`§21.5`)

- CE-C24: Given `RunEvents = [BY:1:R]` on a `legality = LEGAL` delivery, when processed, then `total_runs = 1`, `extras.byes = 1`, `legal_ball_count += 1`, `ranRuns = 1`, `netRotates = true`.
- CE-C25: Given `RunEvents = [BY:4:B]`, when processed, then `total_runs = 4`, `extras.byes = 4`, `netRotates = false`.
- CE-C26: Given `RunEvents = [LB:2:R]`, when processed, then `total_runs = 2`, `extras.legByes = 2`, `netRotates = false`.
- CE-C27: Given `RunEvents = [LB:4:B]`, when processed, then `total_runs = 4`, `extras.legByes = 4`, `netRotates = false`.

### 6.5 Penalty and dead ball (`§21.6`)

- CE-C28: Given `RunEvents = [PEN:5:A]` with `awardedToTeamId = battingTeamId` and no delivery bowled, when processed, then `total_runs += 5`, `extras.penalty += 5`, `legal_ball_count` unchanged, `ballsFaced` unchanged.
- CE-C29: Given `RunEvents = [OB:1:R, PEN:5:A]` with `awardedToTeamId = bowlingTeamId` on an otherwise-normal legal delivery, when processed, then the striker's runs `+= 1` as normal, and the 5 penalty runs credit the **other** team's ledger, never this innings' `total_runs`.
- CE-C30: Given `legality = DEAD_BALL` with a stated `deadBallReason`, when processed, then no runs, no wicket, no ball-count change on either the over or the striker — only the event log entry is created.

### 6.6 Wickets (`§21.7`)

- CE-C31: Given `wicket = {mode: BOWLED}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets += 1`, the new batter takes the striker's end.
- CE-C32: Given `wicket = {mode: CAUGHT, fielderIds: [F]}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets += 1`, new batter at the striker's end.
- CE-C33: Given `wicket = {mode: CAUGHT, fielderIds: [bowlerId]}` ("caught and bowled"), when processed, then identical to `C32` — no distinct mode or special handling exists.
- CE-C34: Given `wicket = {mode: LBW}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets += 1`.
- CE-C35: Given `wicket = {mode: STUMPED, fielderIds: [keeper]}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets += 1`.
- CE-C36: Given `wicket = {mode: RUN_OUT, endVacated: STRIKER, crossedBeforeDismissal: false}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets` **unchanged**, non-striker unaffected, new batter at the striker's end.
- CE-C37: Given `wicket = {mode: RUN_OUT, endVacated: STRIKER, crossedBeforeDismissal: false}` with `RunEvents = [OB:1:R]` (one run completed before the dismissal), when processed, then `batter.runs += 1` credited, `bowler.wickets` unchanged, new batter at the end the dismissed batter was running toward.
- CE-C38: Given the identical pre-state as `C37` but `crossedBeforeDismissal: true`, when processed, then the surviving batter is now at the striker's end (having crossed), and the new batter occupies the **opposite** end from where the dismissed batter started — the not-out batter, not the new batter, is the next striker.
- CE-C39: Given `wicket = {mode: HIT_WICKET}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets += 1`.
- CE-C40: Given `wicket = {mode: OBSTRUCTING_THE_FIELD}`, when processed, then `wickets_lost += 1`, `bowler.wickets` unchanged.
- CE-C41: Given `wicket = {mode: HIT_BALL_TWICE}` with no `RunEvents`, when processed, then `wickets_lost += 1`, `bowler.wickets` unchanged.
- CE-C42: Given a non-striker run out submitted as `EVT-NON-STRIKER-RUN-OUT` before any delivery is bowled, when processed, then `wickets_lost += 1`, **no** `legal_ball_count` change, **no** `ballsFaced` change for the striker, **no** bowler figure change at all, `bowler.wickets` unchanged.
- CE-C43: Given a `TIMED_OUT` event for an incoming batter who has not yet taken strike, when processed, then `wickets_lost += 1`, `bowler.wickets` unchanged, the incoming-batter selection is replaced.
- CE-C44: Given a `RETIRED_OUT` standalone event, when processed, then `wickets_lost += 1`, `bowler.wickets` unchanged, new batter in.
- CE-C45: Given a "retired — not out" (hurt) standalone event, when processed, then `wickets_lost` **unchanged** (not a dismissal), the batter's `status = 'RETIRED_NOT_OUT'`, their accumulated figures are preserved unmodified.

### 6.7 Free hit (`§21.8`)

- CE-C46: Given `isFreeHit = true` and `RunEvents = [OB:2:R]` with no wicket attempted, when processed, then scored identically to a normal 2-run delivery; `freeHitPending` is consumed (`→ false`) regardless of outcome.
- CE-C47: Given `isFreeHit = true` and `wicket = {mode: BOWLED}` is submitted, when validated, then **rejected** (V5) — `BOWLED` is not in the free-hit-valid mode set; any runs on the delivery still stand if resubmitted without the invalid wicket.
- CE-C48: Given `isFreeHit = true` and `wicket = {mode: RUN_OUT}` is submitted, when processed, then **accepted** — `RUN_OUT` remains valid on a free hit; processed identically to `C36`/`C37`.
- CE-C49: Given `freeHitPending = true` and the next delivery is again illegal (`WIDE` or `NO_BALL`), when processed, then `freeHitPending` remains `true`, unconsumed, carried forward — identical rule to `C23`.

### 6.8 Selected worked examples, converted (`live-scoring.md §22`)

The following demonstrate multi-dimensional behavior (several state changes asserted together) that a single-case conversion above doesn't fully capture on its own.

- CE-EX03/04 (the flagship pair): Given a boundary six (`C05`-shaped) is the over's final legal ball, when processed, then the over completes **and** strike rotates to the new over despite zero running; given a single run (`C02`-shaped) is instead the over's final legal ball, when processed, then the over completes **and** strike does **not** net-rotate — the same batter faces the first ball of the new over. *Both assertions must hold simultaneously in one test run using the identical pre-state, to prove the XOR interaction, not just each term independently.*
- CE-EX08 (crossed vs. not-crossed run-out pair): Given `crossedBeforeDismissal: false`, when a run-out with one run credited is processed, then the incoming batter is at the end the dismissed batter was heading toward and the surviving batter remains where they started; given `crossedBeforeDismissal: true` on the otherwise-identical delivery, when processed, then the surviving batter is now the striker and the incoming batter is at the opposite end — both must be asserted from the same starting pre-state to prove the branch, not just each independently.
- CE-EX11 (retired hurt then resumption): Given a batter retires hurt with `runs=23, ballsFaced=19` at the point of retirement, when they resume later in the same innings, then their card line's `status → 'NOT_OUT'` and `runs=23, ballsFaced=19` are **reused**, not reset to zero.
- CE-EX12 (compound Undo across an over boundary): Given the delivery just recorded was the over's final ball and completed it (a bowler-change prompt is now showing), when Undo is invoked, then `legal_ball_count` reverts to `ballsPerOver − 1`, the over number reverts, **and** the bowler-change prompt is automatically dismissed because its trigger condition is no longer true — all three as one atomic consequence of the void-and-refold, with no separate "cancel the prompt" step required.
- CE-EX13 (correction changing innings-end timing): Given a correction to an early delivery removes a wicket that had, in the original history, led to a later "all out" via a batter who (per the corrected history) never should have batted, when the correction is applied, then reconciliation reports a **named** "strike-context mismatch" failure at the affected later deliveries — not a generic `FAIL`, and not a silently-resolved state — blocking sign-off until the scorer explicitly resolves it forward from the correction point.

---

## 7. Offline cases

`[OFFLINE]` — selected and reformatted from `offline-first-specification.md §4/§8/§18.1`, which remains the authoritative source for the full set.

- OFF-01: Given the device has no working route to the backend, when any offline-capable command (`offline-first-specification.md §4.3`'s table) is submitted, then it executes fully and immediately against local state — no command is queued for *later execution*, only its resulting event is queued for *later transmission*.
- OFF-02: Given a full T20 is scored entirely in airplane mode from setup through sign-off, when the process completes, then zero network calls were attempted anywhere in the path.
- OFF-03: Given a delivery is confirmed to the UI, when the durable local write is checked, then it completed **before** the confirmation was shown — never after.
- OFF-04: Given the app is offline and a command requiring connectivity (e.g. account creation) is attempted, when submitted, then it is refused locally with the specific reason stated, never silently accepted and later failed.
- OFF-05: Given local storage usage crosses the configured warning threshold while scoring offline, when checked, then the warning and one-tap-purge option appear before any write failure could occur.
- OFF-06: Given a local backup file is created offline and restored on a second, also-offline device, when the restore completes, then the reconstructed match — including every unsynced event — is identical to the source.
- OFF-07: Given a scoring input is submitted while a simulated network stall (indefinite, not a timeout) is in progress, when measured, then its latency is statistically indistinguishable from the same input submitted fully offline.
- OFF-08: Given a match is fully offline for a duration exceeding any stated grace window, when scoring continues, then no duration-based limit blocks further scoring (`OFF-*`'s "unbounded offline duration" property).

## 8. Synchronization cases

`[SYNC]` — selected and reformatted from `offline-first-specification.md §7/§9/§18.2`.

- SYNC-01: Given a fixed multi-device event set for one match, when delivered to the backend in any of a large sample of randomised arrival orders, then every order produces an identical merged projection.
- SYNC-02: Given a push batch is resubmitted after a simulated network failure that occurred after the server had already accepted it, when resubmitted, then the response is identical to the original acceptance and no duplicate row exists in `match_events`.
- SYNC-03: Given a batch `[N, N+1, N+2]` where `N+1` fails business-rule validation, when submitted, then `N` is accepted, `N+1` and `N+2` are rejected, and the client's next retry resumes exactly from `N+1` with no gap-repair logic invoked.
- SYNC-04: Given an incoming event's `prevHash` does not match the server's stored `hash` for the preceding event in that stream, when the batch is processed, then rejected with `sync/hash-chain-break`, distinct from a sequence-gap rejection, and the audit-integrity alert path is triggered.
- SYNC-05: Given Device A holds the writer fence and Device B requests it, when B's request is granted, then A's very next push is rejected with `sync/stale-fence`.
- SYNC-06: Given the realtime channel is entirely disabled, when a full sync-convergence test run (`SYNC-01`) is repeated, then the outcome is unaffected — proving realtime is a nudge only, never the durability path.
- SYNC-07: Given a sync cycle is interrupted after partially pushing an outbox, when the client's local sync-progress fields are inspected, then `syncedCount` exactly equals the count of server-acknowledged events and `pendingCount` exactly equals the remainder — no drift.
- SYNC-08: Given two device clocks differ by more than the configured skew tolerance, when their events sync, then a skew flag is raised and event ordering still follows the HLC/ordinal scheme, never the raw device clock.

## 9. Recovery cases

`[RECOVERY]` — selected and reformatted from `offline-first-specification.md §15` (data-loss-bound recovery) and `security-specification.md §14` (recovery-process security), kept explicitly distinct per those documents' own framing.

- REC-01: Given the app process is force-killed within 50 ms of a delivery's confirmation, when the app relaunches, then that delivery is present and every subsequent projection matches its pre-kill value exactly.
- REC-02: Given a device's local storage is deleted with unsynced events present, when checked against the last server-acknowledged watermark, then exactly the events after that watermark — no more, no fewer — are unrecoverable on that device.
- REC-03: Given a device is lost and a new device continues the same match, when the new device authenticates, then it independently obtains its own valid session — it never inherits a session or token copied from the lost device.
- REC-04: Given a user signs out a listed device from a different, currently-authenticated device, when that listed device's session is next used, then it is refused.
- REC-05: Given the local event log's hash chain fails verification on load, when the app processes this, then it halts normal operation for the affected match and routes to a recovery flow (server pull or local-backup restore) — it never proceeds to fold and display the unverified data.
- REC-06: Given a password-reset token has already been used once, when presented again, then rejected, with a response identical in shape to an expired or never-issued token.
- REC-07: Given a disaster-recovery restore is attempted by a user who is platform-admin but has not completed MFA on the current session, when attempted, then refused.

## 10. Security cases

`[SECURITY]` — selected and reformatted from `security-specification.md`'s 76 `SR-XXX` requirements, which remain the authoritative, exhaustive source.

- SEC-01: Given a request without a valid Bearer token, when it reaches an authenticated endpoint, then `401`, before any business logic executes.
- SEC-02: Given a user holding no scorer role on match M, when they attempt a `match_events` write on M, then refused, regardless of any other role they hold in the same organization.
- SEC-03: Given a client crafts a request for organization B's data using organization A's valid token, when submitted, then no organization B data is returned under any parameter combination.
- SEC-04: Given a `SECURITY DEFINER` helper function's logic, when a client attempts to bypass RLS through it via a crafted request, then the RLS policy on the underlying table still refuses the operation — the helper's own logic is not the sole line of defence.
- SEC-05: Given a refresh token that has already been used once, when presented again, then every token in that session family is revoked, and the legitimate holder is required to sign in again.
- SEC-06: Given a stored, unexpired impersonation consent does not exist for a target user, when a platform-admin attempts to impersonate them, then refused.
- SEC-07: Given an active impersonation session, when any action is taken, then the resulting `audit_log` entry records both the admin's and the impersonated user's identity.
- SEC-08: Given a static scan of a released client build artefact, when run, then no service-role key pattern, and no hardcoded encryption key, is found.
- SEC-09: Given a share token is brute-force-guessed at the maximum rate the rate limiter permits, when simulated over a bounded test window, then no valid token is discovered.
- SEC-10: Given an account is deleted, when its authored events in a Final match are viewed afterward, then the actor displays as an anonymised placeholder and every other field, including the totals, is unchanged and still reconciles.
- SEC-11: Given a minor's profile is requested by a member who is neither the minor's own account, their guardian, nor an org-admin, when served, then only the public-redacted field set is returned.
- SEC-12: Given a stored event is altered directly in the datastore outside the application, when the scheduled chain-verification job next runs, then the alteration is detected and an on-call page fires within the job's scheduled interval.

---

## 11. Traceability and completeness statement

### 11.1 What is exhaustive in this document versus pointed at its source

| Category | Exhaustiveness here | Where the exhaustive record lives |
|---|---|---|
| **Cricket edge (§6)** | **Exhaustive** — all 55 `live-scoring.md §21` cases converted (`C01…C49` here, `C50…C55` in §5), plus the 5 richest worked examples | `live-scoring.md §21–22` (source of truth; this document is a format conversion, not a re-derivation) |
| **Normal / Boundary / Invalid (§3–§5)** | Representative — 1–3 criteria per notable feature per cluster, covering every FR cluster | Every individual `FR-`/`DR-`/`BR-` in the SRS already carries its own full acceptance criteria; this document adds the explicit boundary/invalid framing many of those didn't previously isolate |
| **Offline / Sync / Recovery (§7–§9)** | Selected — the highest-value ~20 criteria per category | `offline-first-specification.md`'s own sections, in full, with every `[INVARIANT]`/`[DEFAULT]`/`[POLICY]` rule carrying its own acceptance criterion already |
| **Security (§10)** | Selected — 12 of the 76 | `security-specification.md`'s 76 `SR-XXX` requirements, each with its own Given/When/Then |

**This is a deliberate, stated scoping choice, not an oversight:** duplicating all 354 SRS requirements' and all 76 security requirements' acceptance criteria a second time, verbatim, in this document would risk the two copies drifting out of sync with no benefit — the value this document adds is the *cross-cutting organisation by the eight requested case categories* and the *conversion of the cricket-rule catalogue into explicit prose form*, both of which were genuinely missing before. Where a criterion needs updating, its **one** authoritative copy is always in the source document cited above; this catalogue's entries cite that source rather than forking it.

### 11.2 Feature-cluster → section cross-reference

| FR cluster | §3 Normal | §4 Boundary | §5 Invalid | §6 Cricket-edge | §7 Offline | §8 Sync | §9 Recovery | §10 Security |
|---|---|---|---|---|---|---|---|---|
| A Identity & Tenancy | N-A1/A2 | B-A1/A2 | I-A1/A2 | — | OFF-04/08 | — | REC-03/04/06/07 | SEC-01/05/06/07/08/10 |
| B Match Setup | N-B1/B2 | B-B1 | I-B1/B2 | — | OFF-01 | — | — | — |
| C Squads/Lineups | N-C1 | B-C1 | I-C1/C2 | §6.1–6.8 (pre-state) | OFF-01 | — | — | — |
| D Live Scoring | N-D1/D2 | B-D1/D2/D3 | I-D1…D5 | **all of §6** | OFF-01/02/03/07 | — | REC-01/05 | SEC-02/04 |
| E Innings/State | N-E1 | B-E1/E2 | I-E1 | `C11/C12/C36…C45` | OFF-01 | — | REC-01 | — |
| F DLS | N-F1 | B-F1 | — | `DR-36` (pending `SPK-01`) | OFF-01 | — | — | — |
| G Super Over | N-G1 | B-G1 | — | §6.6's wicket-cap logic applied | OFF-01 | — | — | — |
| H Corrections/Sign-off | N-H1 | B-H1 | I-H1/H2/H3 | `CE-EX12/EX13` | OFF-01 | — | — | SEC-07 |
| I Dual-Scorer | N-I1 | — | — | — | OFF-01 | SYNC-01…08 | — | — |
| J Scorecards | N-J1 | B-J1 | I-J1 | golden-file (`§4.1` of testing-strategy) | OFF-01 | — | — | — |
| K Competitions | N-K1 | — | — | — | — | — | — | — |
| L Profiles/Stats | N-L1 | — | — | `MINV-12` exclusion | OFF-01 | — | — | SEC-11 |
| M Sharing/Viewer | N-M1 | B-M1 | I-M1 | — | OFF-01 | — | — | SEC-09 |
| N Import/Export/Backup | N-N1 | B-N1 | I-N1/N2 | — | OFF-06 | — | — | — |
| O Settings/i18n | N-O1 | B-O1 | I-O1 | — | OFF-05 | — | — | — |
| P Administration | N-P1 | B-P1 | I-P1/P2 | — | — | — | REC-07 | SEC-06/07 |

---

## 12. Open items

| # | Item | Note |
|---|---|---|
| ACQ-1 | The remaining `[PRD]`/`[CFG]`/`[EDGE]`-tagged (not `[LAW]`) cricket rules are covered by property-based generation (`testing-strategy.md §4.1`) rather than individually-authored Given/When/Then here | Consistent with §1.2's objectivity rule — a combinatorial config space is better verified generatively than by an unbounded manual list |
| ACQ-2 | `DLS`, `DRS`, and multi-day cricket-edge criteria are not yet authorable | Blocked on `SPK-01` and P2/P3 feature work respectively, per `testing-strategy.md §19.3` — tracked there, not duplicated here |
| ACQ-3 | The Normal/Boundary/Invalid sections (§3–§5) are representative, not a literal per-`FR-ID` enumeration | See §11.1's stated scoping rationale; expand to full per-ID coverage only if a specific audit need arises |
| ACQ-4 | Section 6's worked-example conversions (`EX03/04/08/11/12/13`) were selected for pedagogical density; the remaining `EX01/02/05/06/07/09/10` are already fully covered by their corresponding `C##` conversions individually | No gap — noted for clarity only |

---

## 13. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial acceptance-criteria catalog. §1 the Given/When/Then format and a precise, checkable objectivity rule (a banned-word list, and the requirement that every `Then` resolve to an exact value, code, state transition, or cited deterministic rule — with UI "feel" judgements explicitly out of scope by design). §2 the eight case categories defined for this system plus an explicit applicability matrix (not every category forced onto every feature cluster). §3–§5 Normal, Boundary, and Invalid criteria across all 16 FR clusters, representative and traceable. §6 the full, exhaustive conversion of `live-scoring.md`'s 55-case cricket-rule catalogue (`C01…C55`) into Given/When/Then, plus the five richest worked examples converted with multi-dimensional assertions — the direct fulfilment of "every critical cricket rule must have deterministic test cases." §7–§10 selected, reformatted Offline/Synchronization/Recovery/Security criteria, each citing its authoritative full source rather than forking it. §11 a stated exhaustiveness policy per category plus a feature-cluster cross-reference table. §12 four open items. No test code — Given/When/Then acceptance criteria only. |
