/**
 * TASK-0035: server-side event-ingest re-validation, the push half of
 * offline-first-specification.md §7.1 and the idempotency mechanism
 * of §9.1.
 *
 * HONEST SCOPE NOTE: §7.1 step 3 lists four checks -- schema,
 * SVC-AUTHORIZER role check, device_seq contiguity, hash-chain
 * continuity, and "full domain re-validation (live-scoring.md §5)".
 * Only the sequence/hash-chain checks are implemented here.
 * SVC-AUTHORIZER's role check is TASK-0014's authorize()
 * (backend/src/authz/), composed by whichever command handler calls
 * this, not duplicated here. Full domain re-validation is
 * DeliveryValidator.kt's logic (shared/, Kotlin) -- unreachable from
 * this TypeScript module without cross-language FFI this backlog has
 * never set up; a real command handler would need to call both.
 *
 * ALSO FLAGGED: §3.3's write-ordering invariant (TASK-0033's Kotlin
 * side, isValidNextDeviceSeq) deliberately did not assume a starting
 * device_seq convention, since it only tracks per-session local state.
 * The SERVER side, checking a genuinely shared, cross-device history,
 * needs an actual starting convention for the check to mean anything
 * at all -- this module picks 0 as that convention (the first event
 * for a stream must declare device_seq = 0), resolving that open
 * question rather than leaving it unresolved on this side too.
 *
 * `TASK-0144` closes the "full domain re-validation" half of the gap
 * named above, via a deliberate TypeScript PORT of
 * `DeliveryValidator.kt` (`backend/src/validation/deliveryValidator.ts`)
 * rather than a true FFI -- `pushEvents.ts` (`TASK-0143`) is the
 * command handler that composes it with this module's own sequence/
 * hash-chain checks. `IncomingPushEvent` gains optional `type`/
 * `eventVersion` fields (`api-specification.md §12.1`'s own wire
 * shape) so that composition can tell which events need it.
 *
 * `TASK-0148` widens `IncomingPushEvent` once more, for the identical
 * reason: `api-specification.md §12.1`'s own full per-event wire shape
 * (`{ eventId, deviceSeq, hlc, eventOrdinal, type, eventVersion,
 * payload, supersedes?, voids?, actorRef, provenance, recordedAt,
 * prevHash, hash }`) carries several fields this module's own
 * sequence/hash-chain logic has never needed to read --
 * `hlc`/`eventOrdinal`/`actorRef`/`provenance`/`recordedAt`/
 * `supersedes`/`voids`. They matter only to the real `match_events`
 * persistence layer (`backend/src/sync/syncEventsPersistence.ts`),
 * which needs the full row to `INSERT`. **`eventOrdinal` is
 * client-supplied, confirmed directly from `§12.1`'s own field table**
 * -- the device computes its own dense ordinal and the server stores
 * it verbatim (`system-architecture.md`'s own "the client is the
 * deriver" framing, `SYNC-005`/`SEC-014`), so this module's own
 * `InMemoryMatchEventStore.nextOrdinal` counter was always a test-only
 * stand-in, never something a real adapter needs to replicate. All
 * seven new fields are optional, the same "every pre-existing
 * construction site keeps compiling unchanged" reasoning `TASK-0144`'s
 * own widening already used.
 */
/**
 * §7.1 step 3 + §9.1. Validates each event in the batch IN ORDER,
 * against the store's state as it stands after each prior event in
 * the SAME batch is accepted -- a batch can legitimately extend a
 * stream by more than one event in a single call.
 */
export function ingestPushBatch(events, store) {
    const outcomes = [];
    for (const event of events) {
        // §9.1: re-submitting an event whose event_id has already been
        // durably accepted is a no-op that returns the IDENTICAL
        // successful outcome as the original acceptance -- never a
        // duplicate row, never a distinct error, never a second effect.
        if (store.has(event.eventId)) {
            outcomes.push({ eventId: event.eventId, status: "ACCEPTED" });
            continue;
        }
        const expectedSeq = (store.lastConfirmedDeviceSeq(event.streamId) ?? -1) + 1;
        if (event.deviceSeq !== expectedSeq) {
            outcomes.push({
                eventId: event.eventId,
                status: "REJECTED",
                reasonCode: "DEVICE_SEQ_GAP",
                detail: `expected device_seq ${expectedSeq}, got ${event.deviceSeq}`,
            });
            continue;
        }
        const expectedPrevHash = store.lastHash(event.streamId);
        if (expectedPrevHash !== null && event.prevHash !== expectedPrevHash) {
            outcomes.push({
                eventId: event.eventId,
                status: "REJECTED",
                reasonCode: "HASH_CHAIN_BROKEN",
                detail: "prevHash does not match the stream's last stored hash",
            });
            continue;
        }
        store.insert(event);
        outcomes.push({ eventId: event.eventId, status: "ACCEPTED" });
    }
    return outcomes;
}
/**
 * An in-memory MatchEventStore for tests -- not a production adapter.
 *
 * Also assigns and exposes `event_ordinal` (TASK-0036) -- server-
 * assigned at insert time, never client-supplied (unlike `device_seq`),
 * per system-architecture.md's HLC-based canonical ordering. Extended
 * here rather than duplicated into a second store, since push and pull
 * share the same underlying table in a real system.
 *
 * **CORRECTION, `TASK-0148`:** the claim directly above is wrong,
 * found while building the real Postgres persistence layer
 * (`syncEventsPersistence.ts`, see that module's own doc comment for
 * the full re-check against `system-architecture.md §3.7` and
 * `api-specification.md §12.1`). `event_ordinal` is in fact
 * **client-supplied**, like `device_seq` -- the server only performs
 * "ordinal sanity" checking on ingest (§3.7's own Push-flow text), it
 * never generates the value. This class's own `nextOrdinal` counter is
 * harmless only because it backs `eventsAfter()`'s pull-side pagination
 * in tests -- nothing in this module's own accept/reject logic
 * (`ingestPushBatch`/`ingestPushBatchWithFenceCheck`) ever reads
 * `event_ordinal` at all. Left AS-IS here deliberately -- fixing this
 * class's own test-only ordinal generation is a real, bounded
 * follow-up, out of `TASK-0148`'s own scope (that task's diff is the
 * new persistence layer only, which correctly stores the client's own
 * `eventOrdinal` verbatim instead of relying on this counter).
 */
export class InMemoryMatchEventStore {
    eventsById = new Map();
    lastSeqByStream = new Map();
    lastHashByStream = new Map();
    ordinalByEventId = new Map();
    nextOrdinal = 1;
    has(eventId) {
        return this.eventsById.has(eventId);
    }
    insert(event) {
        this.eventsById.set(event.eventId, event);
        this.lastSeqByStream.set(event.streamId, event.deviceSeq);
        this.lastHashByStream.set(event.streamId, event.hash);
        this.ordinalByEventId.set(event.eventId, this.nextOrdinal++);
    }
    lastConfirmedDeviceSeq(streamId) {
        return this.lastSeqByStream.get(streamId) ?? null;
    }
    lastHash(streamId) {
        return this.lastHashByStream.get(streamId) ?? null;
    }
    /** §7.3 step 2-3: everything after [afterOrdinal] for [streamId], in canonical ordinal-ascending order. */
    eventsAfter(streamId, afterOrdinal) {
        return [...this.eventsById.values()]
            .filter((e) => e.streamId === streamId)
            .map((e) => ({ event: e, ordinal: this.ordinalByEventId.get(e.eventId) }))
            .filter(({ ordinal }) => afterOrdinal === null || ordinal > afterOrdinal)
            .sort((a, b) => a.ordinal - b.ordinal)
            .map(({ event, ordinal }) => ({ eventId: event.eventId, streamId: event.streamId, eventOrdinal: ordinal, payload: event.payload }));
    }
}
//# sourceMappingURL=ingestPushBatch.js.map