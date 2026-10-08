/**
 * TASK-0102: `POST /matches/{matchId}/claim` (`api-specification.md
 * §11.7`) -- the second `§11` match-lifecycle command in this backlog.
 *
 * `§11.7`'s own Trace cites `FR-004, BR-022` -- `FR-004` is clean, but
 * SRS `BR-022` is "Share links are read-only and revocable," wholly
 * unrelated to guest-match-claim. The real entry is SRS `SEC-016`
 * ("Guest-to-account boundary"), which traces to discovery `BR-022` --
 * a cross-category renumbering (discovery `BR` -> SRS `SEC`) on top of
 * the usual same-number collision (SRS's own `BR-022` independently
 * means something unrelated). `SEC-016` is the real citation.
 *
 * Same Idempotency-Key pattern `deactivateMember.ts` (`TASK-0101`)
 * established, per `§11`'s own intro. A deliberate DIFFERENCE from
 * that task's own "already-deactivated is a safe no-op" choice: a
 * genuinely new claim attempt (different key) against an
 * already-`CLAIMED` match is REJECTED, not a no-op -- claiming
 * establishes ownership, so silently succeeding a second claim by a
 * different actor would be wrong, unlike deactivation whose end state
 * doesn't depend on who deactivated first.
 */
import { invalidTransitionError, notFoundError } from "./errors.js";
/**
 * Transitions `claimStatus` from `GUEST` to `CLAIMED`, optionally
 * binding `organizationId` (`null` = a personal, non-org claim).
 * `matchId`, timeline, and provenance (`originDeviceId`/`createdAt`/
 * `createdBy`) are untouched, per `FR-004`'s own acceptance line.
 */
export function claimMatch(matchId, payload, matchStore, idempotencyStore, actorRef, nowIso, idempotencyKey, instance) {
    const priorResult = idempotencyStore.getPriorSuccess(idempotencyKey);
    if (priorResult) {
        return priorResult;
    }
    const existing = matchStore.get(matchId);
    if (!existing) {
        // Not cached against the key -- §8.2: a failed attempt never
        // "poisons" the key.
        return { outcome: "rejected", problem: notFoundError(`No match visible with id ${matchId}`, instance) };
    }
    if (existing.claimStatus === "CLAIMED") {
        // Unlike deactivateMember's own no-op choice: claiming establishes
        // ownership, so a genuinely new attempt (different key) must be
        // refused, never silently re-granted.
        return {
            outcome: "rejected",
            problem: invalidTransitionError(`Match ${matchId} is already claimed`, instance),
        };
    }
    const updatedRow = {
        ...existing,
        claimStatus: "CLAIMED",
        organizationId: payload.organizationId,
        rowVersion: existing.rowVersion + 1,
        updatedAt: nowIso,
        updatedBy: actorRef,
    };
    matchStore.update(updatedRow);
    const result = { outcome: "claimed", row: updatedRow };
    idempotencyStore.recordSuccess(idempotencyKey, result);
    return result;
}
/** An in-memory IdempotencyStore for tests -- not a production adapter. */
export class InMemoryIdempotencyStore {
    successesByKey = new Map();
    getPriorSuccess(key) {
        return this.successesByKey.get(key) ?? null;
    }
    recordSuccess(key, result) {
        this.successesByKey.set(key, result);
    }
}
//# sourceMappingURL=claimMatch.js.map