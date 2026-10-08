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
 *
 * **`TASK-0125` widens `DivergenceRecord`/`DivergenceStore`** (adding
 * `id`/`proposedValue`/`proposedBy`/`confirmedBy`/`resolvedEventId`,
 * and `get`/`update`) to support `divergenceResolution.ts`'s own
 * `proposeDivergenceResolution`/`confirmDivergenceResolution` commands
 * -- the `§6.3` `UX-25` dual-scorer item, pulled into scope by explicit
 * priority override. All additions are optional/additive; this
 * module's own detection logic and tests are unchanged.
 */
/** Structural equality sufficient for primitive/plain-object field values (runs, wicket detail, striker id, …) -- not a general-purpose deep-equal library, deliberately kept minimal for this task's own scope. */
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null)
        return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length)
        return false;
    return aKeys.every((key) => deepEqual(a[key], b[key]));
}
/**
 * §10.2: "a separate, explicit alignment pass... comparing them
 * field-by-field per over.ball and producing divergence records."
 * Only positions BOTH streams have reached are comparable -- an
 * over.ball only one stream has recorded so far is not a divergence,
 * it is simply not yet comparable (the other stream may still catch up
 * with an agreeing value).
 */
export function detectDivergences(matchId, streamAId, streamARecords, streamBId, streamBRecords) {
    const byOverBallB = new Map(streamBRecords.map((r) => [r.overBall, r]));
    const divergences = [];
    for (const recordA of streamARecords) {
        const recordB = byOverBallB.get(recordA.overBall);
        if (!recordB)
            continue;
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
/**
 * Detects divergences and records only genuinely NEW ones. The
 * alignment pass runs "once both streams have reached a common point
 * in a completed sync cycle" (§10.2) -- meaning potentially on EVERY
 * sync cycle, not once ever -- so re-running it must never create a
 * duplicate `divergences` row for a mismatch already `OPEN` or
 * `PROPOSED` (this task's own Verification procedure: "produces
 * exactly one `divergences` row").
 */
export function detectAndRecordDivergences(matchId, streamAId, streamARecords, streamBId, streamBRecords, store) {
    const detected = detectDivergences(matchId, streamAId, streamARecords, streamBId, streamBRecords);
    const newlyRecorded = [];
    for (const divergence of detected) {
        if (!store.hasUnresolved(matchId, divergence.overBall, divergence.field)) {
            store.insert(divergence);
            newlyRecorded.push(divergence);
        }
    }
    return newlyRecorded;
}
/** An in-memory DivergenceStore for tests -- not a production adapter. */
export class InMemoryDivergenceStore {
    records = [];
    nextId = 1;
    hasUnresolved(matchId, overBall, field) {
        return this.records.some((r) => r.matchId === matchId && r.overBall === overBall && r.field === field && r.status !== "RESOLVED");
    }
    /** `TASK-0125`: assigns `id` here, simulating a real DB's server-generated id -- `data-specification.md §8.5`'s own field table gives `divergences.id` no "client-generated" note, unlike most other tables in this schema. */
    insert(record) {
        if (record.id === undefined) {
            record.id = `divergence-${this.nextId++}`;
        }
        this.records.push(record);
    }
    get(id) {
        return this.records.find((r) => r.id === id) ?? null;
    }
    update(record) {
        const index = this.records.findIndex((r) => r.id === record.id);
        if (index !== -1)
            this.records[index] = record;
    }
    all() {
        return this.records;
    }
}
//# sourceMappingURL=divergenceDetector.js.map