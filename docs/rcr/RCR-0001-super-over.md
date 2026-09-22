# RCR-0001 — Super Over is unspecified in `live-scoring.md`

| | |
|---|---|
| Type | Spec-Change (`ai-development-harness.md §3` T3) |
| Status | **Draft — queued behind `RCR-0003`**, which was moved to Gate G3 first at the requester's direction. Not implemented, not approved. Storage location (`docs/rcr/`) is provisional pending `ai-development-harness.md HQ-1`'s resolution of where `RCR-*` records live. |
| Source finding | `adversarial-verification-report.md AVF-SE-03` |

## Requirement reference (current text)

`live-scoring.md` contains **zero** mentions of "Super Over" anywhere in its 25 sections, despite `FR-092/093/094` requiring a native Super Over workflow as stated MVP/P1 scope (`A-20` permits a manually-scored Super Over as an interim for the very first shippable, but a native workflow is expected soon after). `acceptance-criteria.md`'s own `B-G1` criterion already works around this gap by citing "analogous general-innings wicket-cap logic applied to the Super Over container" — the corpus already silently knows the rule doesn't exist.

## Reason

A Super Over needs rules that genuinely differ from a normal innings (a 2-wicket cap instead of the format's normal all-out threshold; a bowler guardrail that must reset rather than carry over from the preceding innings) — it cannot simply reuse §4–§15 unmodified, and nothing currently states what changes. `data-specification.md §7.1`'s `innings.innings_number` field has no slot for a Super Over innings at all, confirming this is a real gap, not just missing prose.

## Proposed new text

A new subsection in `live-scoring.md`, after §15 (innings/match-end evaluation):

> **§15A. Super Over**
>
> A Super Over is triggered when both teams' totals are level at the end of the second innings' normal completion (§15's target-reached/all-out/overs-complete conditions produce an equal score) **and** the match's playing-conditions profile designates `SUPER_OVER` as the configured tie-breaker (`FR-021`).
>
> A Super Over reuses the standard pipeline (§4–§14) with exactly two overrides:
> 1. **Innings-end condition** (overriding §15 point 1): a Super Over innings ends at **1 completed over OR 2 wickets lost**, whichever occurs first — not the match's normal all-out threshold.
> 2. **Bowler guardrail reset** (overriding §4.5): a bowler who bowled the final over of the preceding full innings **is** permitted to bowl the Super Over — it is a new, distinct innings container, not a continuation of over-sequence.
>
> If the Super Over itself ties and the profile's tie-breaker is "repeat Super Over" (`FR-021`), the same rules apply recursively to a new Super Over container with newly-nominated batting/bowling selections (never automatically reusing the prior one's XI). If the profile's tie-breaker is "boundary count-back," no Super Over pipeline applies — result determination happens entirely outside ball-processing (same out-of-scope treatment §15 point 4 already gives declaration/forfeiture).
>
> New event: `EVT-SUPER-OVER-STARTED`, carrying the parent match reference and a `super_over_sequence_number` (1, 2, 3… for repeats).

## Impact analysis

| Document | Change needed |
|---|---|
| `live-scoring.md` | New §15A; a new `INV-*` reconciliation touchpoint for the Super Over's independent reconciliation; §20's traceability table updated |
| `data-specification.md` | `innings` needs a way to represent "this is a Super Over innings, sequence N" — either new columns on `innings` or a parallel structure; needs a design decision, not assumed here |
| `acceptance-criteria.md` | Replace `B-G1`'s "borrowed by analogy" criterion with a real one traced to §15A |
| `testing-strategy.md` / `live-scoring.md §21` | New conformance cases (`C56+`) for the 2-wicket cap and guardrail-reset behavior |
| `api-specification.md` | A start-Super-Over command endpoint, matching the existing match-lifecycle command pattern (§11) |
| `implementation-task-backlog.md` | A new epic/tasks once approved — none currently exist for Super Over |

## Requested approver

The scoring-rules domain owner (this needs the same accredited-scorer ratification the corpus already calls for over every `[LAW]`/`[EDGE]` item) plus architecture sign-off for the schema implication. Per `ai-development-harness.md §11.3`, this cannot self-approve — Gate `G3` only.
