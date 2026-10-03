import { describe, expect, it } from "vitest";
import { InMemoryDivergenceStore, type DivergenceRecord } from "../src/sync/divergenceDetector.js";
import { confirmDivergenceResolution, proposeDivergenceResolution } from "../src/commands/divergenceResolution.js";

function seedOpenDivergence(store: InMemoryDivergenceStore): DivergenceRecord {
  const record: DivergenceRecord = {
    matchId: "match-1",
    overBall: "8.3",
    field: "runs",
    streamAId: "stream-A",
    streamBId: "stream-B",
    valueA: 1,
    valueB: 4,
    status: "OPEN",
  };
  store.insert(record);
  return record;
}

describe("proposeDivergenceResolution (TASK-0125)", () => {
  it("proposes a resolution for an OPEN divergence", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);

    const result = proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");

    expect(result.outcome).toBe("proposed");
    if (result.outcome !== "proposed") throw new Error("unreachable");
    expect(result.row.status).toBe("PROPOSED");
    expect(result.row.proposedValue).toBe(4);
    expect(result.row.proposedBy).toBe("scorer-A");
  });

  it("missing proposedValue is a schema failure (400)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    const result = proposeDivergenceResolution(seeded.id!, {}, "scorer-A", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("404s on an unknown divergence id", () => {
    const store = new InMemoryDivergenceStore();
    const result = proposeDivergenceResolution("no-such-divergence", { proposedValue: 1 }, "scorer-A", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects proposing on an already-PROPOSED divergence (409)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");

    const result = proposeDivergenceResolution(seeded.id!, { proposedValue: 1 }, "scorer-B", store, "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects proposing on an already-RESOLVED divergence (409)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");
    confirmDivergenceResolution(seeded.id!, { resolvedEventId: "event-1" }, "scorer-B", store, "req-2");

    const result = proposeDivergenceResolution(seeded.id!, { proposedValue: 1 }, "scorer-A", store, "req-3");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });
});

describe("confirmDivergenceResolution (TASK-0125)", () => {
  it("confirms a PROPOSED divergence with a distinct scorer", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");

    const result = confirmDivergenceResolution(seeded.id!, { resolvedEventId: "event-1" }, "scorer-B", store, "req-2");

    expect(result.outcome).toBe("confirmed");
    if (result.outcome !== "confirmed") throw new Error("unreachable");
    expect(result.row.status).toBe("RESOLVED");
    expect(result.row.confirmedBy).toBe("scorer-B");
    expect(result.row.resolvedEventId).toBe("event-1");
    expect(result.row.proposedBy).toBe("scorer-A");
  });

  it("missing resolvedEventId is a schema failure (400)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");

    const result = confirmDivergenceResolution(seeded.id!, {}, "scorer-B", store, "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("404s on an unknown divergence id", () => {
    const store = new InMemoryDivergenceStore();
    const result = confirmDivergenceResolution("no-such-divergence", { resolvedEventId: "event-1" }, "scorer-B", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects confirming a still-OPEN divergence (409)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    const result = confirmDivergenceResolution(seeded.id!, { resolvedEventId: "event-1" }, "scorer-B", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects confirming an already-RESOLVED divergence (409)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");
    confirmDivergenceResolution(seeded.id!, { resolvedEventId: "event-1" }, "scorer-B", store, "req-2");

    const result = confirmDivergenceResolution(seeded.id!, { resolvedEventId: "event-2" }, "scorer-B", store, "req-3");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects when confirmedBy matches proposedBy -- the same scorer cannot self-confirm (422, MINV-14)", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");

    const result = confirmDivergenceResolution(seeded.id!, { resolvedEventId: "event-1" }, "scorer-A", store, "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("neither log changes while only proposed, not yet confirmed", () => {
    const store = new InMemoryDivergenceStore();
    const seeded = seedOpenDivergence(store);
    proposeDivergenceResolution(seeded.id!, { proposedValue: 4 }, "scorer-A", store, "req-1");

    const row = store.get(seeded.id!);
    expect(row?.valueA).toBe(1);
    expect(row?.valueB).toBe(4);
    expect(row?.status).toBe("PROPOSED");
  });
});
