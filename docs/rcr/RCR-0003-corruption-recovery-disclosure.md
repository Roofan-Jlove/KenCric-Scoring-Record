# RCR-0003 — Corruption recovery can silently lose unsynced data

| | |
|---|---|
| Type | Spec-Change (`ai-development-harness.md §3` T3) |
| Status | **Approved at Gate G3 (2026-09-23) and applied.** Approved with one refinement: disclosure must require the scorer's explicit acknowledgment before scoring resumes, not merely a passive notification (aligning with `live-scoring.md §19`'s existing acknowledgment-required pattern for corrections). Applied to `offline-first-specification.md §15.4` — see that document's change log. This RCR is closed. |
| Source finding | `adversarial-verification-report.md AVF-OF-01` |

## Requirement reference (current text)

`offline-first-specification.md §15.4` ("Local storage corruption — verify before trusting"): *"Silently continuing on a log that has failed its own integrity check is explicitly disallowed."* This is correct as far as it goes, but it forbids *continuing on the corrupted log* — it does not require *disclosing what was lost* before the device resumes on a recovered (older) state. Compare `§15.2`, which explicitly states the loss bound for an unacknowledged-event loss scenario — `§15.4` has no equivalent statement for the corruption-recovery scenario.

## Reason

This tensions directly with `§1.1`'s governing principle: *"never inventing, discarding, or silently overwriting a fact."* A literal implementation could detect corruption, pull the server's last-synced state, and resume scoring — all correctly, per the letter of `§15.4` — while never telling the scorer that everything recorded since the last sync (potentially a large unsynced tail, e.g. dozens of deliveries) just vanished. That is a silent discard, which `§1.1` forbids, even though `§15.4` as currently worded doesn't catch it.

## Proposed new text (original draft)

Append to `offline-first-specification.md §15.4`:

> The recovery flow **MUST** explicitly disclose the loss bound — the exact point (the last verified-good local state) the device is recovering to — to the scorer **before** scoring resumes, using the same disclosure model `§15.2` already applies to an unacknowledged-event loss. Silently resuming from a recovered state without this disclosure is prohibited, matching this document's own `§1.1` principle.

## Approved text (as applied, 2026-09-23)

Refined at Gate G3 to require explicit acknowledgment, not merely disclosure — a passive notification could be missed for something this consequential:

> **Disclosure is mandatory, not optional** `[POLICY]` (`RCR-0003`): the recovery flow **must** explicitly disclose the loss bound — the exact point (the last verified-good local state) the device is recovering to — to the scorer, **who must explicitly acknowledge it before scoring resumes**; a passive notification (a toast, a banner) is not sufficient. This uses the same disclosure model §15.2 already applies to an unacknowledged-event loss, and the same acknowledgment-required pattern `live-scoring.md §19`'s Correction model already requires for a mandatory reason — a consequential, potentially-data-losing action is never surfaced ambiently. Silently resuming from a recovered state without this disclosure and acknowledgment is prohibited, matching this document's own §1.1 principle: never discarding a fact silently.

This is now live at `offline-first-specification.md §15.4`.

This has a UX consequence not yet designed: whether `UX-23` Offline Mode gains a new "recovering from corruption" state, or this is a dedicated modal/screen — flagged for the UX spec owner, not resolved by this RCR.

## Impact analysis

| Document | Change needed |
|---|---|
| `offline-first-specification.md` | `§15.4` amended as above |
| `ux-specification.md` | New state content — `UX-23` extension or a new dedicated screen; needs a UX design decision |
| `acceptance-criteria.md` | New Recovery-category Given/When/Then asserting the disclosure happens before resumption |
| `testing-strategy.md` | The offline-chaos suite (`§8.1`) needs a corruption-then-resume-with-disclosure scenario added |
| `implementation-task-backlog.md TASK-0033/0034` | These offline-persistence tasks should not be implemented against the current `§15.4` text until this RCR resolves — implementing now would build the silent-loss risk directly into the local-recovery code path |

## Requested approver

Architecture + UX owner (this crosses into UX scope) + product (data-loss disclosure is a trust decision, ties to `OBJ-07` Verifiability & trust). Per `ai-development-harness.md §11.3`, Gate `G3` only — no self-approval.
