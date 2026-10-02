import { describe, expect, it } from "vitest";
import {
  getPersonalDataExport,
  InMemoryAccountDeletionStore,
  InMemoryDeletionIdempotencyStore,
  InMemoryExportIdempotencyStore,
  InMemoryPersonalDataExportStore,
  markAccountDeletionCompleted,
  markPersonalDataExportFailed,
  markPersonalDataExportProcessing,
  markPersonalDataExportReady,
  requestAccountDeletion,
  requestPersonalDataExport,
} from "../src/commands/accountDataLifecycle.js";

describe("requestPersonalDataExport (TASK-0104)", () => {
  it("queues a new export job", () => {
    const store = new InMemoryPersonalDataExportStore();
    const idempotencyStore = new InMemoryExportIdempotencyStore();

    const result = requestPersonalDataExport("user-1", store, idempotencyStore, "key-1", "export-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("queued");
    if (result.outcome !== "queued") throw new Error("unreachable");
    expect(result.row.status).toBe("QUEUED");
    expect(result.row.userId).toBe("user-1");
  });

  it("a missing userId is a schema failure (400)", () => {
    const store = new InMemoryPersonalDataExportStore();
    const result = requestPersonalDataExport("", store, new InMemoryExportIdempotencyStore(), "key-1", "export-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("replaying the same idempotency key returns the identical prior result", () => {
    const store = new InMemoryPersonalDataExportStore();
    const idempotencyStore = new InMemoryExportIdempotencyStore();

    const first = requestPersonalDataExport("user-1", store, idempotencyStore, "key-1", "export-1", "now", "req-1");
    const second = requestPersonalDataExport("user-2", store, idempotencyStore, "key-1", "export-2", "later", "req-2");

    expect(second).toEqual(first);
    if (second.outcome !== "queued") throw new Error("unreachable");
    expect(second.row.userId).toBe("user-1");
  });

  it("the full export transition chain works, strictly enforced", () => {
    const store = new InMemoryPersonalDataExportStore();
    requestPersonalDataExport("user-1", store, new InMemoryExportIdempotencyStore(), "key-1", "export-1", "now", "req-1");

    const processing = markPersonalDataExportProcessing("export-1", store, "req-1");
    expect(processing.outcome).toBe("transitioned");

    const ready = markPersonalDataExportReady("export-1", "https://storage.example/export-1.json", "2026-10-10T00:00:00Z", store, "req-1");
    expect(ready.outcome).toBe("transitioned");
    if (ready.outcome !== "transitioned") throw new Error("unreachable");
    expect(ready.row.status).toBe("READY");
    expect(ready.row.downloadUrl).toBe("https://storage.example/export-1.json");
  });

  it("marking failed only succeeds from PROCESSING", () => {
    const store = new InMemoryPersonalDataExportStore();
    requestPersonalDataExport("user-1", store, new InMemoryExportIdempotencyStore(), "key-1", "export-1", "now", "req-1");

    const tooEarly = markPersonalDataExportFailed("export-1", "renderer crashed", store, "req-1");
    expect(tooEarly.outcome).toBe("rejected");
    if (tooEarly.outcome !== "rejected") throw new Error("unreachable");
    expect(tooEarly.problem.status).toBe(409);

    markPersonalDataExportProcessing("export-1", store, "req-1");
    const result = markPersonalDataExportFailed("export-1", "renderer crashed", store, "req-1");
    expect(result.outcome).toBe("transitioned");
  });

  it("getPersonalDataExport 404s on an unknown id", () => {
    const store = new InMemoryPersonalDataExportStore();
    const result = getPersonalDataExport("no-such-export", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("requestAccountDeletion (TASK-0104)", () => {
  it("marks the account PROCESSING on first request", () => {
    const store = new InMemoryAccountDeletionStore();
    const idempotencyStore = new InMemoryDeletionIdempotencyStore();

    const result = requestAccountDeletion("user-1", store, idempotencyStore, "key-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("processing");
    if (result.outcome !== "processing") throw new Error("unreachable");
    expect(result.row.status).toBe("PROCESSING");
    expect(result.row.userId).toBe("user-1");
  });

  it("a missing userId is a schema failure (400)", () => {
    const store = new InMemoryAccountDeletionStore();
    const result = requestAccountDeletion("", store, new InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("replaying the same idempotency key returns the identical prior result", () => {
    const store = new InMemoryAccountDeletionStore();
    const idempotencyStore = new InMemoryDeletionIdempotencyStore();

    const first = requestAccountDeletion("user-1", store, idempotencyStore, "key-1", "now", "req-1");
    const second = requestAccountDeletion("user-1", store, idempotencyStore, "key-1", "much-later", "req-2");

    expect(second).toEqual(first);
  });

  it("re-requesting with a genuinely new key while already PROCESSING is a safe no-op, not an error", () => {
    const store = new InMemoryAccountDeletionStore();
    requestAccountDeletion("user-1", store, new InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1");

    const result = requestAccountDeletion("user-1", store, new InMemoryDeletionIdempotencyStore(), "key-2", "later", "req-2");
    expect(result.outcome).toBe("processing");
    if (result.outcome !== "processing") throw new Error("unreachable");
    expect(result.row.requestedAt).toBe("now");
  });

  it("re-requesting after COMPLETED (a new key) is also a safe no-op", () => {
    const store = new InMemoryAccountDeletionStore();
    requestAccountDeletion("user-1", store, new InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1");
    markAccountDeletionCompleted("user-1", "2026-10-05T00:00:00Z", store, "req-1");

    const result = requestAccountDeletion("user-1", store, new InMemoryDeletionIdempotencyStore(), "key-2", "later", "req-2");
    expect(result.outcome).toBe("processing");
    if (result.outcome !== "processing") throw new Error("unreachable");
    expect(result.row.status).toBe("COMPLETED");
  });
});

describe("markAccountDeletionCompleted (TASK-0104)", () => {
  it("PROCESSING -> COMPLETED succeeds", () => {
    const store = new InMemoryAccountDeletionStore();
    requestAccountDeletion("user-1", store, new InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1");

    const result = markAccountDeletionCompleted("user-1", "2026-10-05T00:00:00Z", store, "req-1");
    expect(result.outcome).toBe("transitioned");
    if (result.outcome !== "transitioned") throw new Error("unreachable");
    expect(result.row.status).toBe("COMPLETED");
    expect(result.row.completedAt).toBe("2026-10-05T00:00:00Z");
  });

  it("404s when no deletion was ever requested", () => {
    const store = new InMemoryAccountDeletionStore();
    const result = markAccountDeletionCompleted("no-such-user", "now", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("cannot complete an already-COMPLETED deletion again (409)", () => {
    const store = new InMemoryAccountDeletionStore();
    requestAccountDeletion("user-1", store, new InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1");
    markAccountDeletionCompleted("user-1", "2026-10-05T00:00:00Z", store, "req-1");

    const result = markAccountDeletionCompleted("user-1", "later", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });
});
