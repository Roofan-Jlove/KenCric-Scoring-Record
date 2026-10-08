/**
 * TASK-0121: `POST /players/{playerId}/merge` (`api-specification.md
 * §11.6`) -- the seventh `§11` match-lifecycle command, and the first
 * one built from `§6.3`'s own deferred V1/V2/Future list rather than
 * the originally-tractable P1 set. **A deliberate, explicit priority-
 * scope override, not a silent one:** `FR-039`/`BR-031`/`BR-044` are
 * each `Should`/`Must·P2` in the SRS and `V2·Should` in
 * `product-roadmap.md` -- genuinely later-phase by every reading this
 * session has used all along (`FA-8`). Picked anyway per the user's
 * own explicit direction (asked via `AskUserQuestion` which `§6.3` item
 * to pull into scope; the user asked for the model's own
 * recommendation, then said to proceed with it) -- flagged here rather
 * than silently built as if it were always MVP scope.
 *
 * **A real, significant architectural boundary found and flagged, not
 * silently resolved:** `FR-039`'s own text says a merge "re-points all
 * historical appearances to the survivor." Taken completely literally,
 * this would mean rewriting `player_id` references inside
 * `match_events` (the hash-chained, append-only event store --
 * `MINV-01…03`) and its direct read-model descendants (`deliveries`,
 * `overs`, `wickets`, `batter_card_lines`, `bowler_card_lines`) --
 * which would break the hash-chain integrity invariant this session
 * established as early as `TASK-0007`/`0014`. **This task does NOT do
 * that.** It implements only the literal, minimal contract
 * `§11.6`'s own Request/Response text actually specifies: flip the
 * losing `players` row to `status=MERGED`/`merged_into_player_id`, and
 * return the surviving row unchanged. "Re-pointing" for every
 * historical table above is left as a *read-time resolution* through
 * `merged_into_player_id` (any future stats/career-aggregation query
 * joins through this self-reference), never a bulk rewrite of
 * immutable history -- the acceptance criterion's own wording
 * ("the losing ID **resolves to** the surviving ID") supports this
 * reading as much as a literal-rewrite one, and only the resolution
 * reading is compatible with the event store's own immutability.
 *
 * **The `422` conflict check (`§11.6`'s own "overlapping matches on
 * the same date needing manual review" note) needs appearance-date
 * data this module's own `PlayerStore` cannot provide** (appearances
 * live in `matches.home_xi`/`away_xi` and the scoring read model, not
 * `players` itself) -- modeled as an explicit `PlayerAppearanceLookup`
 * port, the same "take the missing service as a caller-supplied input"
 * shape `signOffMatch.ts` (`TASK-0105`) already used for
 * `SVC-RECONCILER`.
 *
 * **`§11.6`'s own "with the merge logged" text (`FR-039`, `AUD-002`)
 * is now wired, by `TASK-0146`** -- `mergePlayers` takes a new optional
 * trailing `auditLog` parameter; on success only, a `category:
 * "PLAYER_MERGE"` row is written with `payload.reason` persisted
 * directly (the exact field `§10.1`'s own required-reason note already
 * matched one-for-one). Optional and appended last so every
 * pre-existing call site in `mergePlayers.test.ts` is untouched.
 *
 * `Authz: Org-admin or platform-admin` left to RLS, per `FA-7` -- the
 * default every `§6.1`/`§11` module except `signOffMatch` already uses
 * (`§11.6`'s own Errors line names no explicit role-check contract the
 * way `§11.1`'s own registry does).
 */
import { businessRuleValidationError, invalidTransitionError, notFoundError, schemaValidationError } from "./errors.js";
import { writeAuditLogEntry } from "./auditLog.js";
/**
 * `survivingPlayerId` is the path parameter -- the id that survives.
 * `payload.losingPlayerId` is merged into it and marked `MERGED`.
 */
export function mergePlayers(survivingPlayerId, payload, store, appearanceLookup, actorRef, nowIso, instance, auditLog) {
    if (!payload.losingPlayerId) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: losingPlayerId", instance) };
    }
    if (!payload.reason) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: reason", instance) };
    }
    if (payload.losingPlayerId === survivingPlayerId) {
        return { outcome: "rejected", problem: businessRuleValidationError("A player cannot be merged into itself", instance) };
    }
    const survivor = store.get(survivingPlayerId);
    if (!survivor) {
        return { outcome: "rejected", problem: notFoundError(`No player visible with id ${survivingPlayerId}`, instance) };
    }
    const loser = store.get(payload.losingPlayerId);
    if (!loser) {
        return { outcome: "rejected", problem: notFoundError(`No player visible with id ${payload.losingPlayerId}`, instance) };
    }
    if (survivor.status === "MERGED") {
        return {
            outcome: "rejected",
            problem: invalidTransitionError(`Player ${survivingPlayerId} is itself already merged -- merge into its own ultimate survivor instead`, instance),
        };
    }
    if (loser.status === "MERGED") {
        return { outcome: "rejected", problem: invalidTransitionError(`Player ${payload.losingPlayerId} is already merged`, instance) };
    }
    const survivorDates = new Set(appearanceLookup.listAppearanceDates(survivingPlayerId));
    const conflictingDates = appearanceLookup.listAppearanceDates(payload.losingPlayerId).filter((d) => survivorDates.has(d));
    if (conflictingDates.length > 0) {
        return {
            outcome: "rejected",
            problem: businessRuleValidationError(`Players ${survivingPlayerId} and ${payload.losingPlayerId} both have appearances on: ${conflictingDates.join(", ")} -- needs manual review before merging`, instance),
        };
    }
    const updatedLoser = {
        ...loser,
        status: "MERGED",
        mergedIntoPlayerId: survivingPlayerId,
        rowVersion: loser.rowVersion + 1,
        updatedAt: nowIso,
        updatedBy: actorRef,
    };
    store.update(updatedLoser);
    if (auditLog) {
        writeAuditLogEntry({
            id: auditLog.newId,
            category: "PLAYER_MERGE",
            actorRef,
            targetRef: survivingPlayerId,
            action: "MERGE",
            detail: { survivingPlayerId, losingPlayerId: payload.losingPlayerId },
            reason: payload.reason,
        }, auditLog.store, nowIso);
    }
    return { outcome: "merged", row: survivor };
}
/** An in-memory PlayerAppearanceLookup for tests -- not a production adapter. */
export class InMemoryPlayerAppearanceLookup {
    datesByPlayerId = new Map();
    seed(playerId, dates) {
        this.datesByPlayerId.set(playerId, [...dates]);
    }
    listAppearanceDates(playerId) {
        return this.datesByPlayerId.get(playerId) ?? [];
    }
}
//# sourceMappingURL=mergePlayers.js.map