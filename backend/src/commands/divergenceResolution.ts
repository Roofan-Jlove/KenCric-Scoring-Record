/**
 * TASK-0125: `CMD-PROPOSE-DIVERGENCE-RESOLUTION` / `CMD-CONFIRM-
 * DIVERGENCE-RESOLUTION` (`domain-model.md`) -- the third task pulled
 * from `§6.3`'s deferred V1/V2/Future list, and the first one with no
 * written `api-specification.md` endpoint to port at all (the other
 * three this session each had a fully-specified contract, just gated
 * by priority or a missing schema piece; this one genuinely has no
 * endpoint spec anywhere). The contract below is therefore synthesized
 * directly from `data-specification.md §8.5`'s own already-complete
 * `divergences` table, `domain-model.md`'s own `VO-DIVERGENCE`/
 * `MINV-14`/`CMD-PROPOSE-DIVERGENCE-RESOLUTION` entries, and SRS
 * `FR-110`/`FR-111`/`BR-008`/`SYNC-013`/`SYNC-014` -- not invented from
 * nothing, but genuinely designed here rather than ported, flagged
 * explicitly as a different kind of task from every prior `§6.3` item.
 *
 * **A real citation collision found, the eleventh instance of this
 * session's own discovery-vs-SRS shape:** `domain-model.md`'s own
 * `CMD-PROPOSE-DIVERGENCE-RESOLUTION` row cites `FR-116…119` -- SRS's
 * own `FR-116…120` are "Partnerships"/"Batting and bowling metrics"/
 * "Milestone flags"/"Standard match charts"/"Wagon wheel and pitch
 * map," all wholly unrelated. The real entries are SRS `FR-110`
 * ("Propose-and-confirm reconciliation," traces to discovery
 * `FR-118/119` consolidated) and `FR-111` ("Block sign-off on
 * unresolved divergence," traces to discovery `FR-120`) -- confirmed
 * by reading both SRS entries directly, not assumed from the citation
 * alone.
 *
 * **A real cross-document terminology mismatch found and resolved in
 * favour of the schema:** `domain-model.md`'s own `VO-DIVERGENCE`
 * names its terminal status `CONFIRMED`; `data-specification.md §8.5`'s
 * own `divergences.status` enum names it `RESOLVED`. This module uses
 * the schema's own literal value (`RESOLVED`) since that is the actual
 * persisted contract, not the domain-model's prose name for the same
 * concept.
 *
 * **`FR-111`/`SYNC-014`'s "block sign-off on unresolved divergence"
 * needs no new work here** -- `signOffMatch.ts` (`TASK-0105`) already
 * takes its own reconciliation `checks: ReconciliationCheck[]` as an
 * explicit caller-supplied input, not computed internally; a caller
 * wanting this gate simply includes an "no OPEN/PROPOSED divergences"
 * check in that list. Structurally satisfiable already, not a gap.
 *
 * **A real scope boundary, flagged rather than silently assumed:**
 * `SYNC-013`'s own text says a confirmed resolution "shall be recorded
 * as an event" -- `data-specification.md §8.5`'s own `resolved_event_id`
 * column is an FK into `match_events`. This module does NOT create
 * that event; `resolvedEventId` is taken as an explicit caller-supplied
 * input, the same "the real event-ingest mechanism is out of this
 * module's own scope" boundary `disputeMatch.ts` (`TASK-0123`) already
 * used for `resultingCorrections` -- no backend HTTP write-path into
 * `match_events` exists anywhere in `backend/` at all.
 */

import { businessRuleValidationError, invalidTransitionError, notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";
import type { DivergenceRecord, DivergenceStore } from "../sync/divergenceDetector.js";

export interface ProposeDivergenceResolutionPayload {
  proposedValue?: unknown;
}

export type ProposeDivergenceResolutionResult =
  | { outcome: "proposed"; row: DivergenceRecord }
  | { outcome: "rejected"; problem: ProblemDetails };

/** Only an `OPEN` divergence may have a resolution proposed. */
export function proposeDivergenceResolution(
  divergenceId: string,
  payload: ProposeDivergenceResolutionPayload,
  proposedBy: string,
  store: DivergenceStore,
  instance: string,
): ProposeDivergenceResolutionResult {
  if (payload.proposedValue === undefined) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: proposedValue", instance) };
  }

  const existing = store.get(divergenceId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No divergence visible with id ${divergenceId}`, instance) };
  }

  if (existing.status !== "OPEN") {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(`Divergence ${divergenceId} is ${existing.status}, not OPEN -- cannot propose a resolution`, instance),
    };
  }

  const updated: DivergenceRecord = { ...existing, status: "PROPOSED", proposedValue: payload.proposedValue, proposedBy };
  store.update(updated);
  return { outcome: "proposed", row: updated };
}

export interface ConfirmDivergenceResolutionPayload {
  resolvedEventId?: string;
}

export type ConfirmDivergenceResolutionResult =
  | { outcome: "confirmed"; row: DivergenceRecord }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * Only a `PROPOSED` divergence may be confirmed, and only by a scorer
 * distinct from whoever proposed it (`MINV-14`/`BR-008` -- the same
 * `confirmed_by IS DISTINCT FROM proposed_by` invariant `§8.5`'s own
 * `CK` already enforces at the database layer; checked here too so
 * the rejection carries a specific, actionable `422`, not a generic
 * constraint-violation error from the database).
 */
export function confirmDivergenceResolution(
  divergenceId: string,
  payload: ConfirmDivergenceResolutionPayload,
  confirmedBy: string,
  store: DivergenceStore,
  instance: string,
): ConfirmDivergenceResolutionResult {
  if (!payload.resolvedEventId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: resolvedEventId", instance) };
  }

  const existing = store.get(divergenceId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No divergence visible with id ${divergenceId}`, instance) };
  }

  if (existing.status !== "PROPOSED") {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(`Divergence ${divergenceId} is ${existing.status}, not PROPOSED -- cannot confirm`, instance),
    };
  }

  if (confirmedBy === existing.proposedBy) {
    return {
      outcome: "rejected",
      problem: businessRuleValidationError("confirmedBy must be a distinct scorer from proposedBy (MINV-14/BR-008)", instance),
    };
  }

  const updated: DivergenceRecord = {
    ...existing,
    status: "RESOLVED",
    confirmedBy,
    resolvedEventId: payload.resolvedEventId,
  };
  store.update(updated);
  return { outcome: "confirmed", row: updated };
}
