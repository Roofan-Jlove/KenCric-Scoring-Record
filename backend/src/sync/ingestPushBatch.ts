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
 */

export interface IncomingPushEvent {
  eventId: string;
  streamId: string;
  deviceId: string;
  deviceSeq: number;
  prevHash: string;
  hash: string;
  payload: unknown;
}

export type PushOutcome =
  | { eventId: string; status: "ACCEPTED" }
  | { eventId: string; status: "REJECTED"; reasonCode: string; detail: string };

/**
 * The server's event store, abstracted so this module is testable
 * without a real Postgres/Supabase environment (none exists anywhere
 * in this backlog) -- a real implementation backs this with
 * `match_events` (data-specification.md §6.1, TASK-0006/0007).
 */
export interface MatchEventStore {
  has(eventId: string): boolean;
  insert(event: IncomingPushEvent): void;
  lastConfirmedDeviceSeq(streamId: string): number | null;
  lastHash(streamId: string): string | null;
}

/**
 * §7.1 step 3 + §9.1. Validates each event in the batch IN ORDER,
 * against the store's state as it stands after each prior event in
 * the SAME batch is accepted -- a batch can legitimately extend a
 * stream by more than one event in a single call.
 */
export function ingestPushBatch(
  events: readonly IncomingPushEvent[],
  store: MatchEventStore,
): PushOutcome[] {
  const outcomes: PushOutcome[] = [];

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
 */
export class InMemoryMatchEventStore implements MatchEventStore {
  private readonly eventsById = new Map<string, IncomingPushEvent>();
  private readonly lastSeqByStream = new Map<string, number>();
  private readonly lastHashByStream = new Map<string, string>();
  private readonly ordinalByEventId = new Map<string, number>();
  private nextOrdinal = 1;

  has(eventId: string): boolean {
    return this.eventsById.has(eventId);
  }

  insert(event: IncomingPushEvent): void {
    this.eventsById.set(event.eventId, event);
    this.lastSeqByStream.set(event.streamId, event.deviceSeq);
    this.lastHashByStream.set(event.streamId, event.hash);
    this.ordinalByEventId.set(event.eventId, this.nextOrdinal++);
  }

  lastConfirmedDeviceSeq(streamId: string): number | null {
    return this.lastSeqByStream.get(streamId) ?? null;
  }

  lastHash(streamId: string): string | null {
    return this.lastHashByStream.get(streamId) ?? null;
  }

  /** §7.3 step 2-3: everything after [afterOrdinal] for [streamId], in canonical ordinal-ascending order. */
  eventsAfter(streamId: string, afterOrdinal: number | null): Array<{ eventId: string; streamId: string; eventOrdinal: number; payload: unknown }> {
    return [...this.eventsById.values()]
      .filter((e) => e.streamId === streamId)
      .map((e) => ({ event: e, ordinal: this.ordinalByEventId.get(e.eventId)! }))
      .filter(({ ordinal }) => afterOrdinal === null || ordinal > afterOrdinal)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(({ event, ordinal }) => ({ eventId: event.eventId, streamId: event.streamId, eventOrdinal: ordinal, payload: event.payload }));
  }
}
