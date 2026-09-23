import { describe, expect, it } from "vitest";
import {
  detectAndRecordDivergences,
  detectDivergences,
  InMemoryDivergenceStore,
  type StreamDeliveryRecord,
} from "../src/sync/divergenceDetector.js";

describe("detectDivergences (TASK-0038)", () => {
  it("agreeing streams produce no divergences", () => {
    const streamA: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1, striker: "A" } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1, striker: "A" } }];
    expect(detectDivergences("match-1", "stream-A", streamA, "stream-B", streamB)).toEqual([]);
  });

  // This task's own core claim: two independent streams disagreeing on
  // a recorded fact produces a divergence with both values retained.
  it("a mismatched field produces exactly one divergence with both values intact", () => {
    const streamA: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1 } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 4 } }];
    const divergences = detectDivergences("match-1", "stream-A", streamA, "stream-B", streamB);

    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toEqual({
      matchId: "match-1", overBall: "8.3", field: "runs",
      streamAId: "stream-A", streamBId: "stream-B",
      valueA: 1, valueB: 4, status: "OPEN",
    });
  });

  it("multiple mismatched fields at the same over.ball each produce their own divergence", () => {
    const streamA: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1, striker: "A" } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 4, striker: "B" } }];
    const divergences = detectDivergences("match-1", "stream-A", streamA, "stream-B", streamB);
    expect(divergences.map((d) => d.field).sort()).toEqual(["runs", "striker"]);
  });

  // §10.2: an over.ball only one stream has reached is not yet
  // comparable -- not a divergence, just not-yet-caught-up.
  it("an over.ball only one stream has reached is not treated as a divergence", () => {
    const streamA: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1 } }, { overBall: "8.4", fields: { runs: 0 } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1 } }]; // hasn't reached 8.4 yet
    expect(detectDivergences("match-1", "stream-A", streamA, "stream-B", streamB)).toEqual([]);
  });

  // A structural (nested) value must be compared correctly, not just
  // primitives -- e.g. a wicket detail object.
  it("compares structured (object) field values, not just primitives", () => {
    const streamA: StreamDeliveryRecord[] = [{ overBall: "9.1", fields: { wicket: { mode: "CAUGHT", outBatterId: "A" } } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "9.1", fields: { wicket: { mode: "BOWLED", outBatterId: "A" } } }];
    const divergences = detectDivergences("match-1", "stream-A", streamA, "stream-B", streamB);
    expect(divergences).toHaveLength(1);
    expect(divergences[0].field).toBe("wicket");
  });

  it("identical structured values do not falsely diverge", () => {
    const streamA: StreamDeliveryRecord[] = [{ overBall: "9.1", fields: { wicket: { mode: "CAUGHT", outBatterId: "A" } } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "9.1", fields: { wicket: { mode: "CAUGHT", outBatterId: "A" } } }];
    expect(detectDivergences("match-1", "stream-A", streamA, "stream-B", streamB)).toEqual([]);
  });
});

describe("detectAndRecordDivergences (TASK-0038)", () => {
  it("re-running the alignment pass never creates a duplicate row for an already-open divergence", () => {
    const store = new InMemoryDivergenceStore();
    const streamA: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 1 } }];
    const streamB: StreamDeliveryRecord[] = [{ overBall: "8.3", fields: { runs: 4 } }];

    const first = detectAndRecordDivergences("match-1", "stream-A", streamA, "stream-B", streamB, store);
    const second = detectAndRecordDivergences("match-1", "stream-A", streamA, "stream-B", streamB, store);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0); // already OPEN -- no duplicate
    expect(store.all()).toHaveLength(1);
  });

  it("a genuinely new divergence at a different over.ball is still recorded", () => {
    const store = new InMemoryDivergenceStore();
    detectAndRecordDivergences(
      "match-1", "stream-A", [{ overBall: "8.3", fields: { runs: 1 } }],
      "stream-B", [{ overBall: "8.3", fields: { runs: 4 } }],
      store,
    );
    const second = detectAndRecordDivergences(
      "match-1", "stream-A", [{ overBall: "9.1", fields: { runs: 2 } }],
      "stream-B", [{ overBall: "9.1", fields: { runs: 0 } }],
      store,
    );
    expect(second).toHaveLength(1);
    expect(store.all()).toHaveLength(2);
  });
});
