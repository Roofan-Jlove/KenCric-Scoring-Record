# Cricket Scoring Book — Adversarial Verification Report

| | |
|---|---|
| **Document** | Adversarial Verification Report |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/specs/live-scoring.md`, `docs/architecture/offline-first-specification.md`, `docs/architecture/security-specification.md`, cross-referenced against `docs/architecture/data-specification.md`, `docs/architecture/api-specification.md`, `docs/architecture/system-architecture.md`, `docs/specs/software-requirements-specification.md`, `docs/architecture/acceptance-criteria.md` |
| **Downstream** | `docs/implementation-task-backlog.md` (findings below gate several `TASK-*` items), any `RCR-*` a finding here is escalated into (`ai-development-harness.md §3 T3, §11`) |
| **Status** | A **findings report**, not a fix. Every finding below is analysis of the existing specification corpus; **no file was modified to produce or resolve any finding in this document.** Per the explicit instruction on the security pass — extended here to all three passes for consistency — nothing is fixed yet. |

> **Why this document exists:** three separate adversarial-verification requests were made against "the implemented system" / "the cricket scoring engine" / "offline-first behavior." At the time of every one of them, **no implementation existed anywhere in this repository** — confirmed repeatedly via directory listing: no `shared/`, `apps/`, `backend/`, or `database/`. Rather than decline the exercise or fabricate results against nonexistent code, each pass was honestly reframed as adversarial verification of the *specification* that such an implementation would be built against — hand-simulating complete matches, hard scenarios, and attack paths against the actual documented rules, hunting for contradictions, gaps, calculation errors, and unenforceable promises. This is legitimate, high-value pre-implementation QA: a spec bug caught here never becomes a shipped code bug.

---

## 0. How to read this report

Three independent passes, run separately, each grounded in real quoted/paraphrased spec text — no fabricated findings. Each pass kept its own severity vocabulary (the scoring-engine and offline-first passes used `CONTRADICTION`/`GAP`/`CALCULATION ERROR`/`AMBIGUITY`, matching what's actually being found; the security pass used the `CRITICAL`/`HIGH`/`MEDIUM`/`LOW` scale explicitly requested for that review). §5 gives a single cross-domain priority view for planning purposes — it does not re-classify what each pass concluded, only sequences it.

Every finding gets a global ID: `AVF-SE-##` (Scoring Engine), `AVF-OF-##` (Offline-First), `AVF-SEC-##` (Security).

---

## 1. Executive summary

| Pass | Categories checked | Clean PASS | Findings | Most severe |
|---|---|---|---|---|
| Scoring engine (`live-scoring.md`) | 17 | 12 | 8 (`AVF-SE-01…08`) | 2 contradictions (typo-class), 3 genuine spec gaps |
| Offline-first (`offline-first-specification.md`) | 13 | 3 | 9 (`AVF-OF-01…09`) | 1 elevated gap risking the spec's own zero-silent-loss principle |
| Security (`security-specification.md`) | 14 | 11 | 4 (`AVF-SEC-01…04`) | 1 HIGH — two documents specify mutually incompatible designs for the same feature |

**The single highest-priority finding across all three passes is `AVF-OF-01`** (recovery-after-corruption has no disclosure requirement) — it is the only finding that, if implemented literally as currently specified, would produce **silent data loss**, directly contradicting the offline-first specification's own opening promise. Everything else is either a spec gap (undefined behavior, not wrong behavior) or a low-cost documentation defect.

**Three findings are genuine spec defects requiring a Requirement Change Request** before the area they touch should be implemented (`ai-development-harness.md §11`, §3 T3): `AVF-SE-03` (Super Over), `AVF-OF-01` (corruption-recovery disclosure), `AVF-SEC-01` (webhook secret storage vs. HMAC delivery). **`AVF-OF-01` is resolved** (`RCR-0003`, approved 2026-09-23); the other two remain open as `RCR-0001`/`RCR-0002` (`docs/rcr/`), queued behind it at the requester's direction.

---

## 2. Scoring engine — `live-scoring.md`

**Method:** full read of all 25 sections; hand-traced against `data-specification.md §5/§7`, `software-requirements-specification.md §4.F/4.G`, `acceptance-criteria.md`.

### 2.1 Verdict by category

| # | Category | Verdict |
|---|---|---|
| 1 | Batter scores | PASS |
| 2 | Bowler figures | PASS |
| 3 | Team score | PASS |
| 4 | Overs | PASS |
| 5 | Extras | PASS |
| 6 | Wickets | PARTIAL — `AVF-SE-01` |
| 7 | Strike rotation | PASS |
| 8 | Partnerships | PARTIAL — `AVF-SE-08` |
| 9 | Innings transitions | PARTIAL — `AVF-SE-07` |
| 10 | Target calculations | **GAP** — `AVF-SE-04` |
| 11 | Match completion | PARTIAL — innings-level PASS; match-level result-type determination is out of this document's scope entirely |
| 12 | Super Over | **GAP** — `AVF-SE-03` |
| 13 | No result | **GAP** — `AVF-SE-05` |
| 14 | Tie | PARTIAL — mechanically falls out of §15 by absence of target-reached; ties into `AVF-SE-03` |
| 15 | Corrections | PASS |
| 16 | Undo | PASS |
| 17 | Retrospective scoring changes | PASS |

One hypothesis brought into this pass was disproven by actually reading the text and is worth recording as such: §19.2 **does** symmetrically handle both "innings ends earlier than originally recorded" and "innings un-ends" (an all-out wicket later corrected to not-out) — not a gap, confirmed PASS.

### 2.2 Findings

**`AVF-SE-01` — CONTRADICTION — Wickets.** §9.2 states `mode` is "one of the **11** dismissal modes," but exactly **10** are ever defined, confirmed independently in three places: §9.1's validity matrix, §9.4's bowler-credit table, and `data-specification.md §7.5`'s `wickets.mode` enum — all three enumerate `BOWLED, CAUGHT, LBW, RUN_OUT, STUMPED, HIT_WICKET, OBSTRUCTING_THE_FIELD, HIT_BALL_TWICE, TIMED_OUT, RETIRED_OUT`.
*Reproduction:* count `mode` occurrences across §9.1/§9.4/`data-specification.md §7.5` — 10 everywhere, never 11.
*Correction (not applied):* fix "11" → "10" in §9.2. Trivial, no behavior change.

**`AVF-SE-02` — CONTRADICTION — self-consistency.** §22's intro claims "**Twelve** cases walked through all thirteen required dimensions"; the section actually contains `EX-01…EX-13` (13 examples — §25's own change log correctly says "13 fully worked examples"). §22.3 contains two examples, which is why the heading count undercounts.
*Correction (not applied):* fix "Twelve" → "Thirteen" in §22's intro.

**`AVF-SE-03` — GAP — Super Over.** Zero mentions of "Super Over" anywhere in `live-scoring.md`, despite `FR-092/093/094` requiring a native Super Over workflow as P1 scope. No rule states whether it reuses the standard over/innings pipeline (§13, §15) or needs its own state machine; no wicket-cap-at-2 rule exists anywhere (structurally different from the normal all-out threshold, §15 point 1). `acceptance-criteria.md`'s own `B-G1` criterion already silently works around this by borrowing "analogous general-innings wicket-cap logic" — the corpus knows the gap exists but never promoted it to `live-scoring.md §24`'s open-items list. Schema corroboration: `data-specification.md §7.1`'s `innings.innings_number` has no slot for a Super Over innings ("1, 2 (limited-overs); up to 4 (first-class)").
*Reproduction:* a match tied after the second innings, `wicketsLost < 10` for both sides; starting a Super Over hits no rule for which `InningsState`/`OverState` shape applies, what ends it at 2 wickets, or whether §4.5's "bowler didn't bowl the immediately preceding over" guardrail wrongly blocks a bowler who bowled the main innings' last over.
*Correction (not applied):* needs an RCR adding a Super Over subsection to `live-scoring.md`, reusing §5–§14's pipeline with an explicit 2-wicket override to §15 point 1 and its own guardrail-reset rule.

**`AVF-SE-04` — GAP — Target calculations.** `InningsState.target` (§2) and the "target reached" check (§15 point 3) both exist, but no rule specifies how `target` is initially populated or updated mid-match by a DLS revision (`FR-083…087`). Whether a DLS revision is its own event type, and whether it can trigger §15's mid-delivery target check, is entirely unaddressed. `acceptance-criteria.md`'s `ACQ-2` already flags DLS criteria as "not yet authorable — Blocked on `SPK-01`," but that acknowledgment lives in the wrong document — `live-scoring.md §24`'s own `LSQ-*` list never mentions it.
*Correction (not applied):* lower urgency than `AVF-SE-03` (legitimately blocked on `SPK-01`), but should be added to `live-scoring.md §24` as an explicit `[OPEN]` item pointing at the blocker.

**`AVF-SE-05` — GAP — No result / match completion.** `FR-088` precisely defines "no result"; the schema has both `matches.min_overs_for_result` and `matches.state = ABANDONED`. But §15's 4 ending conditions have no 5th case for it, and — sharper — `innings.end_reason`'s enum (`ALL_OUT, OVERS_COMPLETE, TARGET_REACHED, DECLARATION, FORFEITURE`) has no value for abandonment at all, even though `matches.state` one level up explicitly supports it. Unlike declaration/forfeiture, which §15 point 4 explicitly flags as out-of-scope, abandonment isn't flagged either way — a reader can't tell if it was deliberately excluded or missed.
*Correction (not applied):* needs an RCR adding a 5th `ABANDONED_BELOW_MINIMUM` condition to §15 (externally-triggered, matching declaration/forfeiture's pattern) and the matching `innings.end_reason` enum value.

**`AVF-SE-06` — GAP — `live-scoring.md §20` self-consistency.** §20 claims to map rules to `INV-001…018`, but only `INV-001…013` and `INV-017` are actually mapped; `INV-014/015/016/018` never appear. `INV-015` (a DLS-resources-used reconciliation check, per `acceptance-criteria.md`'s `B-F1`) is directly tied to `AVF-SE-04` — its omission is a symptom of the same hole, not a separate defect.

**`AVF-SE-07` — AMBIGUITY — Innings transitions.** No statement of whether an abandonment/no-result determination is delivery-triggered or a purely external administrative command like declaration/forfeiture — §15 point 4 explicitly scopes declaration/forfeiture out; abandonment gets no equivalent statement either way. Compounds `AVF-SE-05`.

**`AVF-SE-08` — AMBIGUITY — Partnerships.** No explicit rule for how a retired-hurt batter's resumption (§9.8) interacts with `partnerships`' segment-by-`wicket_number` model. Traced through and found no actual contradiction — plausibly handled correctly by extension of the existing crease-pair design — but it's an unstated assumption, worth one confirming sentence in §9.8.

**Confirmed sound, not findings:** batter/bowler/team arithmetic, over-boundary strike-rotation composition, extras decomposition, and the Undo/Correction refold mechanics (including over-boundary and no-ball-reclassification composition) were all traced through concrete pre-state + input sequences and held up — no counter-example found.

---

## 3. Offline-first behavior — `offline-first-specification.md`

**Method:** full read of all 21 sections; cross-referenced against `data-specification.md §8.3–9.3` and `system-architecture.md §3.17–3.18/4.3–4.5`.

### 3.1 Verdict by category

| Category | Verdict |
|---|---|
| a. Complete offline match | PASS |
| b. Intermittent internet | PARTIAL — `AVF-OF-06` |
| c. Reconnection | PASS |
| d. Duplicate events | PARTIAL — `AVF-OF-03` |
| e. Delayed events | PARTIAL — `AVF-OF-07` |
| f. Device restart | PARTIAL — `AVF-OF-05` |
| g. App crash | PASS (same root cause as f, no distinct issue) |
| h. Server failure | **GAP** — `AVF-OF-02` |
| i. Network failure | PARTIAL — `AVF-OF-08` |
| j. Simultaneous edits | PARTIAL — `AVF-OF-09` |
| k. Conflicting score updates | PASS |
| l. Multiple scorers (>2) | **GAP** — `AVF-OF-04` |
| m. Recovery after corruption | **GAP (elevated — risks violating the spec's own §1.1 principle)** — `AVF-OF-01` |

### 3.2 Findings

**`AVF-OF-01` — GAP (elevated) — Corruption recovery has no stated disclosure requirement. `[RESOLVED 2026-09-23 via RCR-0003]`** §15.4 forbade *continuing on* a corrupted log ("silently continuing on a log that has failed its own integrity check is explicitly disallowed") but never required the recovery flow to *disclose* what, if anything, was lost from the unsynced tail before resuming — unlike §15.2, which explicitly states the loss bound elsewhere. This directly tensioned with §1.1's opening promise: "never inventing, discarding, or silently overwriting a fact." **`offline-first-specification.md §15.4` now requires explicit disclosure and scorer acknowledgment before scoring resumes — see `docs/rcr/RCR-0003-corruption-recovery-disclosure.md`.**
*Reproduction:* device scores 40 deliveries offline (only 10 acknowledged server-side); local storage corrupts (a torn write); app restarts, hash-chain verification fails (§15.4), device pulls from the server's last-synced state (10 events) and resumes. Per the spec as written: undetermined whether the scorer is ever told the other 30 are gone. Actual risk: silent 30-event loss.
*Correction (not applied):* add to §15.4 — "the recovery flow must explicitly disclose the loss bound (§15.2's model) before resuming, never silently resume from a point earlier than the device's pre-corruption local state."

**`AVF-OF-02` — GAP — Server failure is unaddressed within this document's own stated scope.** The document's intro claims to be "the exact rule set" making zero-data-loss "mechanically true," but §1.3's relationship table never lists `system-architecture.md §3.17/§3.18` (Failure model, Recovery scenarios) among what it reuses, and §19/§20 never mention server crash/outage. The actual mechanism — atomic `INSERT ... ON CONFLICT (event_id) DO NOTHING` plus idempotent retry (`system-architecture.md §4.5`) — is architecturally sound, but this document never states or cross-references it.
*Correction (not applied):* add a cross-reference in §7.1/§10.3/§19 to `system-architecture.md §3.17/§3.18/§4.5`, or add an explicit `[INVARIANT]`: "server-side event ingest is atomic per batch; a server crash mid-ingest is equivalent to a rejected batch, safely retryable under §9's idempotency."

**`AVF-OF-03` — GAP — Stream-identity assignment (take-over vs. new stream) is never specified.** §18.4.A (fence take-over, same `scorer_stream_id`) and §18.4.B (two independent streams) describe structurally different outcomes for "a new device joins a match already being scored," but no rule states the trigger that decides which path applies.
*Reproduction:* Scorer A is mid-match on Device 1; Device 2 opens the same match. Nothing says whether this is a device-swap (take over A's stream) or dual-scorer (start a second stream) — the wrong default either merges two people's records or fractures one person's continuous stream into spurious conflict.
*Correction (not applied):* add an explicit rule (§7.6 or a new §10.4) stating what UI action or server-side signal creates a new stream vs. requests take-over.

**`AVF-OF-04` — GAP — The dual-scorer model's binary-only limit is never explicitly stated.** §10.2/§18.4.B consistently say "two streams"; `data-specification.md §8.5`'s `divergences` table hardcodes exactly `stream_a_id`/`stream_b_id`. Nowhere is "exactly two concurrent independent streams; a third is out of scope" stated as a deliberate `[INVARIANT]` — and the schema literally cannot represent a three-way divergence.
*Correction (not applied):* add an explicit `[INVARIANT]` to §10.2 stating the two-stream limit and what happens on a third concurrent attempt.

**`AVF-OF-05` — AMBIGUITY — Local-write atomicity is assumed, not stated, in this document.** §3.1/§6.1 both depend on the local event write and outbox-enqueue being one atomic operation; this document never states that requirement itself — it's only inferable from `system-architecture.md §4.3/4.4`'s implementation notes.
*Correction (not applied):* add `[INVARIANT]` to §3.1 stating the write and enqueue occur in one atomic local transaction.

**`AVF-OF-06` — AMBIGUITY — Backoff behavior under rapid connectivity flapping is unspecified.** §8.2 doesn't state whether a fresh transient failure after a brief reconnect resets the retry delay or continues the prior streak; §12.1's health-check has no stated minimum interval distinct from §18.1's 30s default.
*Correction (not applied):* state explicitly in §8.2 whether backoff state persists across distinct connectivity-loss events within some window.

**`AVF-OF-07` — GAP — No viewer-facing rule for an unresolved (OPEN/PROPOSED) divergence.** §13.4 defines the viewer-facing "provisional" badge for partial sync; no equivalent exists for what a third-party viewer sees while two scorer streams disagree and haven't converged.
*Correction (not applied):* add a viewer-facing rule to §11.2 or §18.4.B, analogous to §13.4's pattern.

**`AVF-OF-08` — AMBIGUITY (low) — Unparseable payloads aren't classified.** §8.1's Terminal list starts at "schema-invalid payload" (implies valid JSON, failed schema); a genuinely malformed/unparseable request isn't placed in either the Transient or Terminal column.
*Correction (not applied):* extend §8.1's Terminal row to include "malformed/unparseable request."

**`AVF-OF-09` — AMBIGUITY (low) — Whether corrections participate in divergence alignment is inferred, not stated.** §10.2 defines divergence over "a value... at the same over.ball position" without confirming correction events are subject to the same alignment pass as original deliveries.
*Correction (not applied):* add one clause to §10.2 confirming this explicitly.

**Confirmed sound, not findings:** large-outbox chunking composes correctly across multiple batches (§6.5/§7.1/§7.4); reconnection is deliberately, explicitly duration-agnostic (§9.5/§6.5); the apparent writer-fence-vs-divergence overlap resolves cleanly — fence checks are always synchronous-at-push and divergence detection is always post-hoc, so temporal ordering (not a precedence rule) prevents contradiction; fence take-over needs no TTL because explicit take-over (§11.1) is always available; the restart-mid-sync + in-doubt-response composition is safe because idempotency (§9) is unconditional, not session-scoped.

---

## 4. Security — `security-specification.md`

**Method:** full read of all 18 sections; cross-referenced against `api-specification.md §1–13` and `data-specification.md`'s `audit_log`/RLS/audit-field sections. Severity scale as requested for this pass: `CRITICAL`/`HIGH`/`MEDIUM`/`LOW`.

### 4.1 Verdict by category

| # | Category | Verdict |
|---|---|---|
| 1 | Authentication | PASS |
| 2 | Authorization | PASS |
| 3 | Roles | PASS |
| 4 | APIs | PASS |
| 5 | Local storage | PASS |
| 6 | Offline data | PASS |
| 7 | Sync | PASS |
| 8 | Secrets | PARTIAL — **HIGH**, `AVF-SEC-01` |
| 9 | Input validation | PASS |
| 10 | Injection risks | PASS |
| 11 | Session security | PARTIAL — MEDIUM, `AVF-SEC-03` |
| 12 | Audit logs | PARTIAL — MEDIUM, `AVF-SEC-02` |
| 13 | Data exposure | PASS |
| 14 | Abuse scenarios | PASS |

Two leads fed into this pass were refuted by the actual text — reported as such rather than dropped: the filtering API has no client-controlled column names anywhere (no dynamic-query injection surface), and sync traffic is explicitly covered by `SR-A01`'s blanket TLS requirement plus its own dedicated rate-limit tier — not implicitly exempt from either control.

### 4.2 Findings

**`AVF-SEC-01` — HIGH — Secrets: webhook-secret storage requirement is incompatible with how webhook signing works.** `SR-D06` requires a webhook secret to "never be retrievable after creation, only re-rotatable" — the same hash-only-at-rest rule as an API key. But `api-specification.md §13.4`'s webhook delivery HMAC-signs every outbound payload, which requires the **server to retain and reuse the plaintext secret** — structurally impossible under hash-only storage. A password only ever needs one-way verification; a signing secret doesn't. As written, the two documents specify mutually exclusive implementations of the same V2 feature.
*Reproduction:* attempt to implement `SR-D06` literally (hash-only) and `api-specification.md §13.4`'s HMAC-signed delivery simultaneously — no implementation satisfies both.
*Correction (not applied):* either scope `SR-D06`'s "never retrievable" clause to API keys only and give webhook secrets their own, explicitly different at-rest protection (encrypted-and-retrievable, not hashed), or redesign delivery to avoid server-side secret retention (e.g. asymmetric signing) — a design decision for whoever owns this V2 feature.

**`AVF-SEC-02` — MEDIUM — Audit logs: no category for a denied/failed authorization attempt outside the admin plane.** `data-specification.md §10.1`'s `audit_log.category` enum (`AUTH, MEMBERSHIP, IMPERSONATION, OVERRIDE, EXPORT, SHARE_LINK, ADMIN, RETENTION, DISPUTE, PLAYER_MERGE`) has no slot for an ordinary member's denied write attempt on a match they don't own. RLS still blocks the write correctly — no security bypass — but there's no way to detect a *pattern* of such attempts from the audit trail.
*Reproduction:* a non-assigned member repeatedly calls the sync-push endpoint for a match they don't own; each call is correctly `403`'d, but no `audit_log` row exists anywhere to correlate the pattern.
*Correction (not applied):* add an `ACCESS_DENIED` category (or equivalent), complementing `SR-H05`'s existing anomalous-volume monitoring, which currently covers only the public surface.

**`AVF-SEC-03` — MEDIUM — Session security: a session can outlive its own refresh token.** `SR-C03`'s 14-day offline grace window and `SR-C01`'s 30-day refresh-token TTL (from last use) can compose badly: offline at day 0, still scoring locally in degraded guest-mode past day 14, reconnecting at day 35 — 5 days after the refresh token independently expired. Nothing specifies whether the interim work re-links to the original account on fresh sign-in or is stranded as permanently guest-owned.
*Reproduction:* authenticate, go offline 35 days while continuing to score locally (permitted per `SR-C03`), reconnect. Undetermined whether token-refresh failure blocks re-linking the interim work.
*Correction (not applied):* add an explicit acceptance criterion to `SR-C01`/`SR-C03` for this composed scenario.

**`AVF-SEC-04` — LOW — Documentation self-inconsistency: requirement count.** `security-specification.md §18`'s change log states "60 `SR-XXX` requirements total"; the actual count across §3–§14 sums to 76 (matching the front-matter/index description used elsewhere in the corpus).
*Correction (not applied):* fix "60" → "76" in §18.

**Confirmed sound, not findings:** anti-enumeration design is consistently correct — identical failure responses for wrong-password vs. non-existent account (`SR-A03`), for used/expired/never-existed tokens (`SR-A05`), and for RLS-excluded vs. truly-nonexistent resources (`api-specification.md §5.2`) — no authz-oracle leak found anywhere checked. The encryption-vs-integrity distinction is handled correctly, not conflated: confidentiality is deliberately OS-level only for low-sensitivity scoring data (`SR-E03`), while tamper-evidence is a separate hash-chain mechanism (`SR-F04`). The on-device-attacker residual risk (a rooted device with valid credentials fabricating a plausible event) is stated as an honest, accepted limitation with a named human-reconciliation backstop (§2.3 B1), not silently ignored.

---

## 5. Consolidated findings register

All 21 findings, cross-domain severity view for planning purposes only (each pass's own classification in §2–§4 remains authoritative for its domain):

| ID | Domain | Native severity | One-line | Needs |
|---|---|---|---|---|
| `AVF-OF-01` | Offline | GAP (elevated) | Corruption recovery can silently lose unsynced data | **Resolved** — `RCR-0003`, applied to `offline-first-specification.md §15.4` |
| `AVF-SEC-01` | Security | HIGH | Webhook secret storage vs. HMAC delivery are incompatible | RCR |
| `AVF-SE-03` | Scoring | GAP | Super Over entirely unaddressed in the pipeline spec | RCR |
| `AVF-SE-05` | Scoring | GAP | No result / abandonment has no ending condition or enum value | RCR |
| `AVF-OF-02` | Offline | GAP | Server failure unaddressed within this document's scope | Cross-reference fix |
| `AVF-OF-03` | Offline | GAP | No rule for stream take-over vs. new stream on device join | New rule |
| `AVF-OF-04` | Offline | GAP | Dual-scorer binary-only limit is implicit, not stated | New invariant |
| `AVF-SEC-02` | Security | MEDIUM | Denied-authorization attempts aren't audited | New audit category |
| `AVF-SEC-03` | Security | MEDIUM | Session can outlive its own refresh token | New acceptance criterion |
| `AVF-SE-04` | Scoring | GAP | Target/DLS integration into the pipeline is unaddressed | Open item (blocked on `SPK-01`) |
| `AVF-OF-07` | Offline | GAP | No viewer-facing rule for an unresolved divergence | New rule |
| `AVF-SE-01` | Scoring | CONTRADICTION | "11" vs. 10 actual dismissal modes | Trivial doc fix |
| `AVF-SE-02` | Scoring | CONTRADICTION | "Twelve" vs. 13 actual worked examples | Trivial doc fix |
| `AVF-SE-06` | Scoring | GAP | §20's `INV-*` mapping is incomplete | Trivial doc fix |
| `AVF-OF-05` | Offline | AMBIGUITY | Local-write atomicity assumed, not stated | New invariant |
| `AVF-OF-06` | Offline | AMBIGUITY | Backoff behavior under rapid flapping unspecified | Clarification |
| `AVF-OF-08` | Offline | AMBIGUITY | Unparseable payloads unclassified | Clarification |
| `AVF-OF-09` | Offline | AMBIGUITY | Corrections' role in divergence alignment inferred | Clarification |
| `AVF-SE-07` | Scoring | AMBIGUITY | Abandonment's scope (in/out of pipeline) unstated | Clarification |
| `AVF-SE-08` | Scoring | AMBIGUITY | Retired-hurt × partnerships interaction unconfirmed | Clarification |
| `AVF-SEC-04` | Security | LOW | Requirement-count self-inconsistency (60 vs. 76) | Trivial doc fix |

**8 findings need an actual Requirement Change Request or new rule/invariant before the area they touch is implemented; 4 are one-clause clarifications; 4 are trivial documentation fixes with no behavioral content; 3 are lower-priority acceptance-criteria additions.** None have been actioned by this report.

---

## 6. Recommended next steps against the implementation backlog

Cross-referencing `docs/implementation-task-backlog.md`'s epic map (its own §3):

- **`E-08…E-14` (shared scoring core, `TASK-0016…0030`)** should not include Super Over or DLS-target work until `AVF-SE-03`/`AVF-SE-04` are resolved via RCR — the backlog's §6.3 already deferred V1 scope (DLS, Super Over) for this exact reason (blocked on `SPK-01`/`SPK-04`), so this finding confirms rather than changes that plan.
- **`E-16` (offline persistence, `TASK-0033…0034`)** should incorporate `AVF-OF-01`'s now-approved disclosure-and-acknowledgment requirement (`offline-first-specification.md §15.4`, `RCR-0003`) into its Plan stage (`ai-development-harness.md §1.3`) — this is no longer a blocker, it's the current spec text to build against. **`E-18` (conflict detection, `TASK-0037…0038`)** still needs `AVF-OF-03`'s stream-assignment rule resolved before its Plan stage.
- **`E-07` (auth & RLS foundation, `TASK-0013…0015`)** is unaffected by any HIGH/MEDIUM security finding — `AVF-SEC-01` is V2-scoped (webhooks), `AVF-SEC-02`/`03` are additive (a new audit category, a new acceptance criterion), neither blocks P1 foundation work.
- The four trivial documentation fixes (`AVF-SE-01/02/06`, `AVF-SEC-04`) can be corrected in `live-scoring.md`/`security-specification.md` at any time via a normal `Docs-Only` task (`ai-development-harness.md §4`) — they carry no behavioral risk and don't need to block anything.

---

## 7. Traceability

Each finding, if actioned, routes through `ai-development-harness.md §10.4`'s regression root-cause classification as a **spec defect** (not an implementation defect — there is no implementation) — meaning the correct next step per that process is a `T3` Requirement Change Request (§3) to Gate `G3` (§8), never a silent edit to the cited document. This report itself performs none of those edits.

---

## 8. Open items

| ID | Question |
|---|---|
| `AVQ-1` | Should `AVF-SE-03` (Super Over) and `AVF-SE-05` (no result) be resolved as one combined RCR (both are "match-completion path" gaps in `live-scoring.md §15`'s ending-condition list) or two separate ones? |
| `AVQ-2` | Does `AVF-OF-01`'s disclosure requirement need a corresponding UX screen state (`ux-specification.md UX-23` Offline Mode, or a new one), or is a data-layer guarantee sufficient without a specified user-facing surface? |
| `AVQ-3` | `AVF-SEC-01`'s resolution choice (scope `SR-D06` narrower vs. redesign webhook delivery) is a real architectural decision, not a documentation call — who owns V2 webhook scope to decide it? |
| `AVQ-4` | Should this report's findings be re-run (a fourth adversarial pass) after the RCRs in §5 land, to confirm each fix actually closes the gap rather than just changing its shape? |

---

## 9. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial draft. Consolidates three adversarial-verification passes (scoring engine, offline-first behavior, security) run against the specification corpus in the absence of any implementation. 21 findings total (`AVF-SE-01…08`, `AVF-OF-01…09`, `AVF-SEC-01…04`), none actioned — report only, per explicit instruction. |
| 0.1.0 | 2026-09-23 | `AVF-OF-01` marked resolved — `RCR-0003` approved at Gate G3 and applied to `offline-first-specification.md §15.4`. First finding in this report to move from "surfaced" to "actioned." |
