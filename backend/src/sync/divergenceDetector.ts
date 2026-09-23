/**
 * TASK-0038: value-level divergence detection, `SVC-DIVERGENCE-DETECTOR`
 * -- offline-first-specification.md §10.2, data-specification.md §8.5's
 * `divergences` table.
 *
 * Entirely server-side by design, not split with `shared/commonMain`
 * like `TASK-0035`-`0037` -- `§10.2`'s own text: "each stream's writer
 * never sees the other's data while composing it... this is inherently
 * a post-hoc detection, not an ingest-time one," and `§8.5`'s own "Sync
 * model" note: "server-computed... not itself pushed by a client."
 * There is nothing for a client-side type to do here at all.
 */

export interface StreamDeliveryRecord {
  overBall: string;
  fields: Record<string, unknown>;
}

/**
 * data-specification.md §8.5's full status enum -- this task only ever
 * constructs `OPEN` records (detection, not resolution); `PROPOSED`/
 * `RESOLVED` are reachable only through §11.2's propose/confirm flow,
 * out of this task's own scope (no resolution UI is built here).
 */
export type DivergenceStatus = "OPEN" | "PROPOSED" | "RESOLVED";

export interface DivergenceRecord {
  matchId: string;
  overBall: string;
  field: string;
  streamAId: string;
  streamBId: string;
  valueA: unknown;
  valueB: unknown;
  status: DivergenceStatus;
}

/** Structural equality sufficient for primitive/plain-object field values (runs, wicket detail, striker id, …) -- not a general-purpose deep-equal library, deliberately kept minimal for this task's own scope. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/**
 * §10.2: "a separate, explicit alignment pass... comparing them
 * field-by-field per over.ball and producing divergence records."
 * Only positions BOTH streams have reached are comparable -- an
 * over.ball only one stream has recorded so far is not a divergence,
 * it is simply not yet comparable (the other stream may still catch up
 * with an agreeing value).
 */
export function detectDivergences(
  matchId: string,
  streamAId: string,
  streamARecords: readonly StreamDeliveryRecord[],
  streamBId: string,
  streamBRecords: readonly StreamDeliveryRecord[],
): DivergenceRecord[] {
  const byOverBallB = new Map(streamBRecords.map((r) => [r.overBall, r]));
  const divergences: DivergenceRecord[] = [];

  for (const recordA of streamARecords) {
    const recordB = byOverBallB.get(recordA.overBall);
    if (!recordB) continue;

    const allFields = new Set([...Object.keys(recordA.fields), ...Object.keys(recordB.fields)]);
    for (const field of allFields) {
      const valueA = recordA.fields[field];
      const valueB = recordB.fields[field];
      if (!deepEqual(valueA, valueB)) {
        divergences.push({ matchId, overBall: recordA.overBall, field, streamAId, streamBId, valueA, valueB, status: "OPEN" });
      }
    }
  }

  return divergences;
}

/** Satisfied by `data-specification.md §8.5`'s `divergences` table. */
export interface DivergenceStore {
  hasUnresolved(matchId: string, overBall: string, field: string): boolean;
  insert(record: DivergenceRecord): void;
}

/**
 * Detects divergences and records only genuinely NEW ones. The
 * alignment pass runs "once both streams have reached a common point
 * in a completed sync cycle" (§10.2) -- meaning potentially on EVERY
 * sync cycle, not once ever -- so re-running it must never create a
 * duplicate `divergences` row for a mismatch already `OPEN` or
 * `PROPOSED` (this task's own Verification procedure: "produces
 * exactly one `divergences` row").
 */
export function detectAndRecordDivergences(
  matchId: string,
  streamAId: string,
  streamARecords: readonly StreamDeliveryRecord[],
  streamBId: string,
  streamBRecords: readonly StreamDeliveryRecord[],
  store: DivergenceStore,
): DivergenceRecord[] {
  const detected = detectDivergences(matchId, streamAId, streamARecords, streamBId, streamBRecords);
  const newlyRecorded: DivergenceRecord[] = [];
  for (const divergence of detected) {
    if (!store.hasUnresolved(matchId, divergence.overBall, divergence.field)) {
      store.insert(divergence);
      newlyRecorded.push(divergence);
    }
  }
  return newlyRecorded;
}

/** An in-memory DivergenceStore for tests -- not a production adapter. */
export class InMemoryDivergenceStore implements DivergenceStore {
  private readonly records: DivergenceRecord[] = [];

  hasUnresolved(matchId: string, overBall: string, field: string): boolean {
    return this.records.some(
      (r) => r.matchId === matchId && r.overBall === overBall && r.field === field && r.status !== "RESOLVED",
    );
  }

  insert(record: DivergenceRecord): void {
    this.records.push(record);
  }

  all(): readonly DivergenceRecord[] {
    return this.records;
  }
}
