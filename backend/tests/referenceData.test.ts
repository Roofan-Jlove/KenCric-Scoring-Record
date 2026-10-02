import { describe, expect, it } from "vitest";
import {
  getLatestReferenceData,
  getReferenceData,
  InMemoryReferenceDataStore,
  listReferenceData,
  publishReferenceData,
  type PublishReferenceDataPayload,
} from "../src/commands/referenceData.js";

function validPayload(overrides: Partial<PublishReferenceDataPayload> = {}): Partial<PublishReferenceDataPayload> {
  return {
    kind: "CONDITIONS_PROFILE",
    version: 1,
    payload: { oversAllotted: 20 },
    publishedBy: "platform-admin-1",
    ...overrides,
  };
}

describe("publishReferenceData (TASK-0100)", () => {
  it("a valid first publish (version 1) succeeds", () => {
    const store = new InMemoryReferenceDataStore();
    const result = publishReferenceData(validPayload(), store, "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("published");
    if (result.outcome !== "published") throw new Error("unreachable");
    expect(result.row.version).toBe(1);
    expect(result.row.publishedBy).toBe("platform-admin-1");
    expect(result.row.publishedAt).toBe("2026-10-03T00:00:00Z");
  });

  it("an invalid kind is a schema failure (400)", () => {
    const store = new InMemoryReferenceDataStore();
    const result = publishReferenceData(validPayload({ kind: "NOT_A_REAL_KIND" }), store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a missing payload is a schema failure (400)", () => {
    const store = new InMemoryReferenceDataStore();
    const result = publishReferenceData({ kind: "CONDITIONS_PROFILE", version: 1, publishedBy: "admin" }, store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("publishing version 2 after version 1 succeeds", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ version: 1 }), store, "now", "req-1");
    const result = publishReferenceData(validPayload({ version: 2 }), store, "later", "req-2");
    expect(result.outcome).toBe("published");
  });

  it("re-publishing an already-published version is 409, never a silent overwrite, even with identical payload", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ version: 1 }), store, "now", "req-1");
    const result = publishReferenceData(validPayload({ version: 1 }), store, "later", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(store.get("CONDITIONS_PROFILE", 1)?.publishedAt).toBe("now");
  });

  it("a version that skips ahead of the monotonic sequence is rejected (422)", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ version: 1 }), store, "now", "req-1");
    const result = publishReferenceData(validPayload({ version: 5 }), store, "later", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("a version is not required to start at 1 for a different kind -- each kind has its own sequence", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ kind: "CONDITIONS_PROFILE", version: 1 }), store, "now", "req-1");
    const result = publishReferenceData(validPayload({ kind: "DLS_TABLE", version: 1 }), store, "now", "req-2");
    expect(result.outcome).toBe("published");
  });
});

describe("getReferenceData (TASK-0100)", () => {
  it("returns the exact version when it exists", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ version: 1 }), store, "now", "req-1");
    expect(getReferenceData("CONDITIONS_PROFILE", 1, store, "req-1").outcome).toBe("found");
  });

  it("404s when that version does not exist", () => {
    const store = new InMemoryReferenceDataStore();
    const result = getReferenceData("CONDITIONS_PROFILE", 1, store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listReferenceData (TASK-0100)", () => {
  it("returns every version for a kind, oldest first", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ version: 1 }), store, "now", "req-1");
    publishReferenceData(validPayload({ version: 2 }), store, "later", "req-2");
    const result = listReferenceData("CONDITIONS_PROFILE", store);
    expect(result.map((r) => r.version)).toEqual([1, 2]);
  });

  it("never mixes kinds", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ kind: "CONDITIONS_PROFILE", version: 1 }), store, "now", "req-1");
    publishReferenceData(validPayload({ kind: "DLS_TABLE", version: 1 }), store, "now", "req-2");
    expect(listReferenceData("CONDITIONS_PROFILE", store)).toHaveLength(1);
    expect(listReferenceData("DLS_TABLE", store)).toHaveLength(1);
  });
});

describe("getLatestReferenceData (TASK-0100)", () => {
  it("returns the highest-version row for a kind", () => {
    const store = new InMemoryReferenceDataStore();
    publishReferenceData(validPayload({ version: 1 }), store, "now", "req-1");
    publishReferenceData(validPayload({ version: 2 }), store, "later", "req-2");
    publishReferenceData(validPayload({ version: 3 }), store, "latest", "req-3");

    const result = getLatestReferenceData("CONDITIONS_PROFILE", store, "req-1");
    expect(result.outcome).toBe("found");
    if (result.outcome !== "found") throw new Error("unreachable");
    expect(result.row.version).toBe(3);
  });

  it("404s when nothing has ever been published for that kind", () => {
    const store = new InMemoryReferenceDataStore();
    const result = getLatestReferenceData("APP_CONFIG", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});
