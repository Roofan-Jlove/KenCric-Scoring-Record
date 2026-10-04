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
 * **`TASK-0144` closes the "full domain re-validation" gap** -- via a
 * deliberate TypeScript PORT of `DeliveryValidator.kt`
 * (`backend/src/validation/deliveryValidator.ts`), not a true FFI (no
 * Kotlin↔TypeScript bridge exists anywhere in this backlog; see that
 * module's own doc comment for the full reasoning). For every
 * `DELIVERY_RECORDED` event, this module runs the ported `V1`-`V11`
 * checks BEFORE handing that single event to
 * `ingestPushBatchWithFenceCheck` -- a domain-invalid event is
 * rejected directly and never reaches the sequence/hash-chain/insert
 * step, so it correctly never advances the stream's own confirmed
 * state; a later event in the same batch that depended on it will
 * then fail its own sequence check naturally, cascading exactly the
 * way an out-of-order submission already would. Non-`DELIVERY_RECORDED`
 * events (`NON_STRIKER_RUN_OUT`/`STRIKER_OVERRIDDEN`/
 * `PLAYING_CONDITIONS_FROZEN`/`DELIVERY_VOIDED`) have no `V1`-`V11`
 * validator of their own in `shared/` either -- they pass straight
 * through to the structural checks unchanged, matching the Kotlin
 * pipeline's own scope exactly (only `DeliveryRecorded` ever calls
 * `validateDelivery`).
 *
 * **A real, additional scope boundary:** `validateDelivery`'s own
 * `BattingContext` parameter needs live match state (current XI, who
 * has already batted, who is out) that no layer in `backend/` has any
 * visibility into -- the real fold lives in `shared/`'s own
 * `InningsFolder.kt`, itself unported for the same toolchain reason.
 * This module calls the validator with `EMPTY_BATTING_CONTEXT`, which
 * means `V8` (`incomingBatterId` must be a valid NOT_OUT XI member)
 * will reject ANY wicket naming a specific incoming batter -- an empty
 * context can never satisfy it. Flagged here, not silently accepted.
 *
 * **Rate limiting (`429`, `SEC-010`) is NOT implemented** -- the same
 * `Should·P2`, correctly-out-of-MVP-scope finding `exportJobs.ts`
 * (`TASK-0103`) already made for the identical citation.
 *
 * **`TASK-0145` wires in the first real `feature_flags` gate** --
 * `featureFlags.ts` (`TASK-0132`) was storage-only until now, with its
 * own doc comment explicitly flagging "does NOT wire actual
 * flag-gating logic into any other endpoint" as future work. `FR-160`'s
 * own acceptance line is the justification: "Given a bad release, when
 * a feature flag is turned off, then the affected feature is disabled
 * without a client update" -- and this module's own domain
 * re-validation (`TASK-0144`) is an already-documented, concrete "bad
 * release" candidate: a hand-ported, never-compiled TypeScript
 * duplicate of `DeliveryValidator.kt`'s rules, flagged at the time as a
 * real drift risk. `DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY` names a
 * *bypass* flag, not the feature itself, deliberately -- `getFeatureFlag`
 * already has a fixed, universal convention ("never explicitly set
 * defaults to disabled") that every other flag in this codebase relies
 * on; naming it as the feature would invert that default the moment any
 * caller passed a store, silently turning validation off platform-wide.
 * Naming it as the bypass keeps "unset == disabled" meaning "bypass is
 * disabled, validation runs normally" -- today's exact behavior,
 * preserved by construction, not by a special-cased default. The flag
 * check runs once per request, not per-event, matching how every other
 * per-request value here (`fenceValue`, authz) is resolved once at the
 * top, not re-read mid-batch. `AdministrationScreen.tsx`'s own
 * `featureFlags`/`onToggleFeatureFlag` props remain unwired -- this is
 * one concrete backend gate, not the UI-facing console TASK-0132 also
 * flagged as outstanding.
 */

import { authForbidden, schemaValidationError, type ProblemDetails } from "../authz/errors.js";
import type { OfficialStore } from "../commands/officials.js";
import type { MatchOfficialStore } from "../commands/matchOfficials.js";
import { getFeatureFlag, type FeatureFlagStore } from "../commands/featureFlags.js";
import { ingestPushBatchWithFenceCheck } from "./writerFence.js";
import type { IncomingPushEvent, MatchEventStore, PushOutcome } from "./ingestPushBatch.js";
import type { WriterFenceStore } from "./writerFence.js";
import { EMPTY_BATTING_CONTEXT, validateDelivery, type DeliveryInput } from "../validation/deliveryValidator.js";

/**
 * `TASK-0145`: when this flag is explicitly set `enabled: true`, every
 * `DELIVERY_RECORDED` event in a batch skips `validateDelivery`
 * entirely and goes straight to `ingestPushBatchWithFenceCheck`, the
 * same path non-`DELIVERY_RECORDED` events already take. Unset (the
 * default) or explicitly `false` means validation runs -- unchanged
 * from `TASK-0144`'s own behavior.
 */
export const DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY = "delivery-domain-validation-bypass";

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

const VALID_LEGALITY = ["LEGAL", "WIDE", "NO_BALL", "DEAD_BALL"];

/**
 * A minimal runtime shape check -- `payload` is `unknown` on the wire,
 * same as `IncomingPushEvent.payload` always has been. Checks only
 * the fields `validateDelivery` itself requires non-null; a malformed
 * payload is reported the same way a failed `V1`-`V11` check is
 * (`DOMAIN_VALIDATION_FAILED`), not as a separate schema error -- by
 * the time an event reaches this per-event loop, the batch-level
 * schema check has already passed.
 */
function asDeliveryInput(payload: unknown): DeliveryInput | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.legality !== "string" || !VALID_LEGALITY.includes(p.legality)) return null;
  if (typeof p.strikerBatterId !== "string" || typeof p.nonStrikerBatterId !== "string" || typeof p.bowlerId !== "string") return null;
  if (typeof p.isFreeHit !== "boolean") return null;
  return p as unknown as DeliveryInput;
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
  featureFlagStore?: FeatureFlagStore,
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

  const domainValidationBypassed = featureFlagStore
    ? getFeatureFlag(DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY, featureFlagStore).enabled
    : false;

  // Per-event, not one bulk call: a domain-invalid DELIVERY_RECORDED
  // event must never reach ingestPushBatchWithFenceCheck's own insert
  // step at all -- calling it one event at a time (each call still
  // sees the full, correctly-updated store state from every prior
  // iteration) lets a domain rejection short-circuit cleanly, with
  // every later event's own sequence check cascading naturally against
  // whatever the stream's last ACTUALLY-accepted event was.
  const outcomes: PushOutcome[] = [];
  for (const event of request.events) {
    if (event.type === "DELIVERY_RECORDED" && !domainValidationBypassed) {
      const deliveryInput = asDeliveryInput(event.payload);
      if (!deliveryInput) {
        outcomes.push({ eventId: event.eventId, status: "REJECTED", reasonCode: "DOMAIN_VALIDATION_FAILED", detail: "payload does not match the DeliveryInput shape" });
        continue;
      }
      const domainResult = validateDelivery(deliveryInput, EMPTY_BATTING_CONTEXT);
      if (domainResult.outcome === "invalid") {
        const detail = domainResult.failures.map((f) => `${f.rule}: ${f.message}`).join("; ");
        outcomes.push({ eventId: event.eventId, status: "REJECTED", reasonCode: "DOMAIN_VALIDATION_FAILED", detail });
        continue;
      }
    }
    const [outcome] = ingestPushBatchWithFenceCheck([event], request.scorerStreamId, request.fenceValue, eventStore, fenceStore);
    outcomes.push(outcome);
  }

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
