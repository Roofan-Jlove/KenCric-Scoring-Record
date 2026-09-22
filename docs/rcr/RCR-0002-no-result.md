# RCR-0002 — "No result" has no ending condition or schema value

| | |
|---|---|
| Type | Spec-Change (`ai-development-harness.md §3` T3) |
| Status | **Draft — queued behind `RCR-0003`**, which was moved to Gate G3 first at the requester's direction. Not implemented, not approved. Storage location (`docs/rcr/`) is provisional pending `HQ-1`. |
| Source finding | `adversarial-verification-report.md AVF-SE-05` |

## Requirement reference (current text)

`live-scoring.md §15` lists exactly 4 innings/match-ending conditions: all-out, overs-complete, target-reached, and declaration/forfeiture (the last explicitly flagged as out of this document's ball-processing scope). `data-specification.md §7.1`'s `innings.end_reason` enum is `{ALL_OUT, OVERS_COMPLETE, TARGET_REACHED, DECLARATION, FORFEITURE}`. `FR-088` precisely defines "no result" (second innings abandoned before `matches.min_overs_for_result`), and the schema already has `matches.min_overs_for_result` and `matches.state = ABANDONED` — but nothing connects that field to an actual ending condition or enum value at the innings level.

## Reason

Unlike declaration/forfeiture, which §15 point 4 explicitly scopes out of the pipeline, abandonment gets no equivalent statement — a reader can't tell whether it was deliberately excluded or simply missed. The schema-level gap is sharper: `matches.state` one level up already supports `ABANDONED`, but `innings.end_reason` has nowhere to record it, so even a correctly-abandoned match can't be represented consistently across the two tables.

## Proposed new text

A 5th ending condition appended to `live-scoring.md §15`:

> 5. **Abandonment below minimum overs** (externally triggered, out of this document's ball-processing scope — same treatment as declaration/forfeiture, point 4): when an official-triggered abandonment command is received and the second innings has not reached `matches.min_overs_for_result` legal overs bowled, the innings ends with `end_reason = ABANDONED_BELOW_MINIMUM`, and the match result is `NO_RESULT` unless a DLS revision determines otherwise (DLS/target integration is `AVF-SE-04`, a separate, lower-urgency open item — this RCR does not resolve that one).

And add `ABANDONED_BELOW_MINIMUM` to `data-specification.md §7.1`'s `innings.end_reason` enum.

## Impact analysis

| Document | Change needed |
|---|---|
| `live-scoring.md` | New §15 point 5; §20's traceability table gains a mapping for whichever of the currently-unmapped `INV-014/016/018` corresponds (needs checking against the original intent of those IDs, not assumed here) |
| `data-specification.md` | `innings.end_reason` enum addition |
| `acceptance-criteria.md` | New Given/When/Then for the abandonment-below-minimum case, replacing the current gap |
| `testing-strategy.md` | New conformance case for a second-innings abandonment scenario |

## Requested approver

Scoring-rules domain owner + architecture (schema enum change). Per `ai-development-harness.md §11.3`, Gate `G3` only — no self-approval.
