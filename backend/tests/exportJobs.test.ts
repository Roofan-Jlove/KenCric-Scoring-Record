import { describe, expect, it } from "vitest";
import {
  createExportJob,
  getExportJob,
  InMemoryExportJobStore,
  InMemoryIdempotencyStore,
  markExportFailed,
  markExportProcessing,
  markExportReady,
} from "../src/commands/exportJobs.js";

describe("createExportJob (TASK-0103)", () => {
  it("a valid request queues a new job", () => {
    const store = new InMemoryExportJobStore();
    const idempotencyStore = new InMemoryIdempotencyStore();

    const result = createExportJob(
      { matchId: "match-1", format: "PDF", includeBranding: true },
      store,
      idempotencyStore,
      "key-1",
      "user-1",
      "export-1",
      "2026-10-03T00:00:00Z",
      "req-1",
    );

    expect(result.outcome).toBe("queued");
    if (result.outcome !== "queued") throw new Error("unreachable");
    expect(result.row.status).toBe("QUEUED");
    expect(result.row.downloadUrl).toBeNull();
    expect(result.row.includeBranding).toBe(true);
    expect(result.row.requestedBy).toBe("user-1");
  });

  it("includeBranding defaults to false when omitted", () => {
    const store = new InMemoryExportJobStore();
    const result = createExportJob({ matchId: "match-1", format: "CSV" }, store, new InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1");
    if (result.outcome !== "queued") throw new Error("unreachable");
    expect(result.row.includeBranding).toBe(false);
  });

  it("a missing matchId is a schema failure (400)", () => {
    const store = new InMemoryExportJobStore();
    const result = createExportJob({ format: "PDF" }, store, new InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an invalid format is a schema failure (400)", () => {
    const store = new InMemoryExportJobStore();
    const result = createExportJob({ matchId: "match-1", format: "XLSX" }, store, new InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("replaying the same idempotency key returns the identical prior result, without reprocessing", () => {
    const store = new InMemoryExportJobStore();
    const idempotencyStore = new InMemoryIdempotencyStore();

    const first = createExportJob({ matchId: "match-1", format: "PDF" }, store, idempotencyStore, "key-1", "user-1", "export-1", "now", "req-1");
    const second = createExportJob({ matchId: "match-2", format: "CSV" }, store, idempotencyStore, "key-1", "user-2", "export-2", "later", "req-2");

    expect(second).toEqual(first);
    if (second.outcome !== "queued") throw new Error("unreachable");
    expect(second.row.matchId).toBe("match-1");
    expect(second.row.exportId).toBe("export-1");
  });
});

describe("getExportJob (TASK-0103)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemoryExportJobStore();
    createExportJob({ matchId: "match-1", format: "PDF" }, store, new InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1");
    expect(getExportJob("export-1", store, "req-1").outcome).toBe("found");
  });

  it("404s on an unknown id", () => {
    const store = new InMemoryExportJobStore();
    const result = getExportJob("no-such-export", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("the export-job state machine (TASK-0103)", () => {
  function queued(store: InMemoryExportJobStore) {
    const result = createExportJob({ matchId: "match-1", format: "PDF" }, store, new InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1");
    if (result.outcome !== "queued") throw new Error("seed failed");
    return result.row;
  }

  it("QUEUED -> PROCESSING succeeds", () => {
    const store = new InMemoryExportJobStore();
    queued(store);
    const result = markExportProcessing("export-1", store, "req-1");
    expect(result.outcome).toBe("transitioned");
    if (result.outcome !== "transitioned") throw new Error("unreachable");
    expect(result.row.status).toBe("PROCESSING");
  });

  it("PROCESSING -> READY succeeds, with the download details", () => {
    const store = new InMemoryExportJobStore();
    queued(store);
    markExportProcessing("export-1", store, "req-1");
    const result = markExportReady("export-1", "https://storage.example/export-1.pdf", "2026-10-10T00:00:00Z", store, "req-1");
    expect(result.outcome).toBe("transitioned");
    if (result.outcome !== "transitioned") throw new Error("unreachable");
    expect(result.row.status).toBe("READY");
    expect(result.row.downloadUrl).toBe("https://storage.example/export-1.pdf");
  });

  it("PROCESSING -> FAILED succeeds, with a failure reason", () => {
    const store = new InMemoryExportJobStore();
    queued(store);
    markExportProcessing("export-1", store, "req-1");
    const result = markExportFailed("export-1", "renderer crashed", store, "req-1");
    expect(result.outcome).toBe("transitioned");
    if (result.outcome !== "transitioned") throw new Error("unreachable");
    expect(result.row.status).toBe("FAILED");
    expect(result.row.failureReason).toBe("renderer crashed");
  });

  it("QUEUED -> READY directly is rejected (409) -- cannot skip PROCESSING", () => {
    const store = new InMemoryExportJobStore();
    queued(store);
    const result = markExportReady("export-1", "url", "later", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("a terminal READY job cannot be re-processed", () => {
    const store = new InMemoryExportJobStore();
    queued(store);
    markExportProcessing("export-1", store, "req-1");
    markExportReady("export-1", "url", "later", store, "req-1");
    const result = markExportProcessing("export-1", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("a terminal FAILED job cannot be marked ready afterward", () => {
    const store = new InMemoryExportJobStore();
    queued(store);
    markExportProcessing("export-1", store, "req-1");
    markExportFailed("export-1", "renderer crashed", store, "req-1");
    const result = markExportReady("export-1", "url", "later", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("404s on an unknown export id for every transition function", () => {
    const store = new InMemoryExportJobStore();
    expect(markExportProcessing("no-such-export", store, "req-1").outcome).toBe("rejected");
    expect(markExportReady("no-such-export", "url", "later", store, "req-1").outcome).toBe("rejected");
    expect(markExportFailed("no-such-export", "reason", store, "req-1").outcome).toBe("rejected");
  });
});
