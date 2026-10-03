/**
 * TASK-0143: `POST /sync/events` (`api-specification.md §12.1`) --
 * `CMD-RECORD-DELIVERY` and every other `CMD-*` that produces a
 * `match_events` row trace to THIS endpoint, not a separate
 * synchronous "record a delivery" command. `offline-first-
 * specification.md`'s whole premise is that scoring writes always
 * flow through the event-sourced sync-push protocol, online or
 * offline, with no separate fast path -- confirmed directly by
 * re-reading §12.1's own Trace line before building anything, rather
 * than assuming a missing REST command needed to be invented from
 * scratch.
 *
 * **What was actually missing, found by reading the already-built
 * pieces before writing a new one:** `ingestPushBatch.ts` (`TASK-0035`)
 * and `writerFence.ts` (`TASK-0037`, `ingestPushBatchWithFenceCheck`)
 * already implement the sequence/hash-chain/fence-check layers of
 * `§7.1` step 3 -- but nothing composes them into the actual endpoint
 * `§12.1` specifies: no module validates the top-level request shape,
 * checks the Authz line ("Head/Assistant Scorer on the match owning
 * `matchId`"), or shapes the response envelope (`results[]` +
 * `confirmedThroughSeq`). This module is that composition -- it adds
 * no new sync-protocol *logic*, it wires the existing logic into the
 * endpoint contract.
 *
 * **A real authz-precision finding:** `backend/src/authz/authorize.ts`
 * (`TASK-0014`) checks org-wide `memberships.roles`, not per-match
 * officiating -- insufficient for this endpoint's own Authz line,
 * which needs "assigned Head/Assistant Scorer ON THIS MATCH," a fact
 * that lives in `match_officials` (`TASK-0099`), keyed by `officials.id`
 * (`TASK-0098`), not directly by `users.id` (an official is "typically,
 * but not necessarily, also a users account holder"). This module
 * resolves the chain itself (`userId` → matching `officials` rows →
 * `match_officials` lookup) rather than reusing `authorize()` for a
 * check it was never built to answer.
 *
 * **Full domain re-validation (`DeliveryValidator.kt`'s own cricket-
 * rules logic) remains out of reach from this TypeScript module** --
 * the same honest gap `ingestPushBatch.ts`'s own doc comment already
 * flagged (no Kotlin↔TypeScript FFI exists anywhere in this backlog).
 * This module still only performs the structural checks (schema,
 * authz, fence, sequence, hash-chain); it does not independently
 * verify that a pushed delivery is cricket-rules-valid.
 *
 * **Rate limiting (`429`, `SEC-010`) is NOT implemented** -- the same
 * `Should·P2`, correctly-out-of-MVP-scope finding `exportJobs.ts`
 * (`TASK-0103`) already made for the identical citation.
 */

import { authForbidden, schemaValidationError, type ProblemDetails } from "../authz/errors.js";
import type { OfficialStore } from "../commands/officials.js";
import type { MatchOfficialStore } from "../commands/matchOfficials.js";
import { ingestPushBatchWithFenceCheck } from "./writerFence.js";
import type { IncomingPushEvent, MatchEventStore, PushOutcome } from "./ingestPushBatch.js";
import type { WriterFenceStore } from "./writerFence.js";

/** `§12.1`'s own request field table. */
export interface PushEventsRequest {
  matchId?: string;
  scorerStreamId?: string;
  deviceId?: string;
  fenceValue?: string;
  events?: readonly IncomingPushEvent[];
}

/** `[DEFAULT] 200` per `§12.1`'s own `events` field note. */
export const MAX_BATCH_SIZE = 200;

export interface PushEventResultItem {
  eventId: string;
  outcome: "ACCEPTED" | "REJECTED";
  newHighWaterSeq?: number;
  errorCode?: string;
  errorDetail?: string;
}

export interface PushEventsResponse {
  results: PushEventResultItem[];
  /**
   * The contiguous-prefix watermark (`§7.1` step 4) -- the highest
   * `deviceSeq` among a run of `ACCEPTED` results starting from the
   * very first event in the submitted batch. `null` if the first
   * event itself was rejected (nothing to advance to).
   */
  confirmedThroughSeq: number | null;
}

export type PushEventsResult =
  | { outcome: "ok"; response: PushEventsResponse }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * Resolves whether `userId` is assigned `HEAD_SCORER` or
 * `ASSISTANT_SCORER` on `matchId`, via the `officials`→`match_officials`
 * chain -- `officials.userId` is nullable (an official need not hold an
 * account), so a user with no linked `officials` row is never
 * authorized, by construction.
 */
function isAuthorizedScorerOnMatch(
  userId: string,
  matchId: string,
  officialStore: OfficialStore,
  matchOfficialStore: MatchOfficialStore,
): boolean {
  const officialIds = officialStore.list().filter((o) => o.userId === userId).map((o) => o.id);
  for (const officialId of officialIds) {
    if (matchOfficialStore.get(matchId, officialId, "HEAD_SCORER")) return true;
    if (matchOfficialStore.get(matchId, officialId, "ASSISTANT_SCORER")) return true;
  }
  return false;
}

/** `confirmedThroughSeq`: the longest `ACCEPTED` run starting from the batch's own first event, by `deviceSeq`. */
function computeConfirmedThroughSeq(events: readonly IncomingPushEvent[], outcomes: readonly PushOutcome[]): number | null {
  let confirmed: number | null = null;
  for (let i = 0; i < outcomes.length; i++) {
    if (outcomes[i].status !== "ACCEPTED") break;
    confirmed = events[i].deviceSeq;
  }
  return confirmed;
}

/** `POST /sync/events`. */
export function pushEvents(
  request: PushEventsRequest,
  userId: string,
  eventStore: MatchEventStore,
  fenceStore: WriterFenceStore,
  officialStore: OfficialStore,
  matchOfficialStore: MatchOfficialStore,
  instance: string,
): PushEventsResult {
  if (!request.matchId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: matchId", instance) };
  }
  if (!request.scorerStreamId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: scorerStreamId", instance) };
  }
  if (!request.deviceId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: deviceId", instance) };
  }
  if (!request.fenceValue) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: fenceValue", instance) };
  }
  if (!request.events) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: events", instance) };
  }
  if (request.events.length > MAX_BATCH_SIZE) {
    return { outcome: "rejected", problem: schemaValidationError(`events exceeds the maximum batch size of ${MAX_BATCH_SIZE}`, instance) };
  }

  if (!isAuthorizedScorerOnMatch(userId, request.matchId, officialStore, matchOfficialStore)) {
    return { outcome: "rejected", problem: authForbidden("You are not authorized to score this match.", instance) };
  }

  const outcomes = ingestPushBatchWithFenceCheck(request.events, request.scorerStreamId, request.fenceValue, eventStore, fenceStore);

  const results: PushEventResultItem[] = outcomes.map((outcome, i) =>
    outcome.status === "ACCEPTED"
      ? { eventId: outcome.eventId, outcome: "ACCEPTED", newHighWaterSeq: request.events![i].deviceSeq }
      : { eventId: outcome.eventId, outcome: "REJECTED", errorCode: outcome.reasonCode, errorDetail: outcome.detail },
  );

  return {
    outcome: "ok",
    response: {
      results,
      confirmedThroughSeq: computeConfirmedThroughSeq(request.events, outcomes),
    },
  };
}
