/**
 * TASK-0036: server-side pull mechanics.
 *
 * CITATION CORRECTION: this task's own Requirement IDs field cites
 * "offline-first-specification.md §7.2" for "the pull half" -- §7.2 is
 * actually "Acknowledgment semantics," a push-side concern unrelated to
 * pulling. The real pull section is §7.3 ("Pull (download)"), used
 * here as the authoritative source instead; flagged rather than
 * silently followed.
 */

export interface PulledEvent {
  eventId: string;
  streamId: string;
  eventOrdinal: number;
  payload: unknown;
}

/** Satisfied by `InMemoryMatchEventStore` (`ingestPushBatch.ts`) -- the same store, extended, not a second one. */
export interface PullableMatchEventStore {
  eventsAfter(streamId: string, afterOrdinal: number | null): PulledEvent[];
}

/** §7.3 steps 2-3: everything after [cursor] for [streamId], in canonical order. */
export function pullEvents(
  store: PullableMatchEventStore,
  streamId: string,
  cursor: number | null,
): PulledEvent[] {
  return store.eventsAfter(streamId, cursor);
}
