/**
 * TASK-0037: writer-fence conflict detection, the P1 single-writer
 * enforcement mechanism -- offline-first-specification.md §10.1.
 */

import { ingestPushBatch, type IncomingPushEvent, type MatchEventStore, type PushOutcome } from "./ingestPushBatch.js";

/** Satisfied by `data-specification.md §9.2`'s `writer_fences` table (TASK-0012) -- server-authoritative. */
export interface WriterFenceStore {
  /** The fence value currently valid for [streamId], or null if never acquired. */
  currentFence(streamId: string): string | null;
}

export type FenceCheckResult =
  | { valid: true }
  | { valid: false; reasonCode: "STALE_FENCE"; detail: string };

/**
 * §10.1: "The server compares the batch's asserted fence value against
 * the currently valid lease for that stream; a mismatch is a terminal
 * rejection (§8.1) for the entire remaining batch, with reason
 * STALE_FENCE." A stream with no fence acquired yet (`currentFence`
 * returns null) accepts any asserted value -- there is nothing yet to
 * be stale against.
 */
export function checkWriterFence(streamId: string, assertedFence: string, store: WriterFenceStore): FenceCheckResult {
  const current = store.currentFence(streamId);
  if (current !== null && current !== assertedFence) {
    return {
      valid: false,
      reasonCode: "STALE_FENCE",
      detail: `asserted fence "${assertedFence}" does not match the currently valid lease "${current}" for stream ${streamId}`,
    };
  }
  return { valid: true };
}

/**
 * §10.1's fence check, composed in front of `TASK-0035`'s
 * `ingestPushBatch` -- a stale fence terminally rejects the ENTIRE
 * batch (every event gets `STALE_FENCE`, none reach per-event
 * device_seq/hash-chain validation at all, none are inserted); a valid
 * fence delegates to `ingestPushBatch` unchanged.
 */
export function ingestPushBatchWithFenceCheck(
  events: readonly IncomingPushEvent[],
  streamId: string,
  assertedFence: string,
  eventStore: MatchEventStore,
  fenceStore: WriterFenceStore,
): PushOutcome[] {
  const fenceCheck = checkWriterFence(streamId, assertedFence, fenceStore);
  if (!fenceCheck.valid) {
    return events.map((event) => ({
      eventId: event.eventId,
      status: "REJECTED",
      reasonCode: fenceCheck.reasonCode,
      detail: fenceCheck.detail,
    }));
  }
  return ingestPushBatch(events, eventStore);
}

/** An in-memory WriterFenceStore for tests -- not a production adapter. */
export class InMemoryWriterFenceStore implements WriterFenceStore {
  private readonly fenceByStream = new Map<string, string>();

  currentFence(streamId: string): string | null {
    return this.fenceByStream.get(streamId) ?? null;
  }

  /** Test/setup helper -- a real implementation acquires this via the lease-negotiation handshake (§7.6), not modeled by this task. */
  setFence(streamId: string, fence: string): void {
    this.fenceByStream.set(streamId, fence);
  }
}
