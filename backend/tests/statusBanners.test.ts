import { describe, expect, it } from "vitest";
import { getStatusBanner, InMemoryStatusBannerStore, listActiveStatusBanners, listStatusBanners, setStatusBanner } from "../src/commands/statusBanners.js";

describe("setStatusBanner (TASK-0138)", () => {
  it("sets a new banner", () => {
    const store = new InMemoryStatusBannerStore();
    const result = setStatusBanner("banner-1", { message: "Scheduled maintenance tonight", severity: "WARNING", active: true }, "admin-1", store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("set");
    if (result.outcome !== "set") throw new Error("unreachable");
    expect(result.row.message).toBe("Scheduled maintenance tonight");
    expect(result.row.active).toBe(true);
  });

  it("upserts -- a repeat call for the same id replaces the row, not a second one", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "first", active: true }, "admin-1", store, "now", "req-1");
    setStatusBanner("banner-1", { message: "second", active: false }, "admin-2", store, "later", "req-2");

    const all = listStatusBanners(store);
    expect(all).toHaveLength(1);
    expect(all[0].message).toBe("second");
    expect(all[0].active).toBe(false);
  });

  it("missing id is a schema failure (400)", () => {
    const store = new InMemoryStatusBannerStore();
    const result = setStatusBanner("", { message: "x", active: true }, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing message is a schema failure (400)", () => {
    const store = new InMemoryStatusBannerStore();
    const result = setStatusBanner("banner-1", { active: true }, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing active is a schema failure (400)", () => {
    const store = new InMemoryStatusBannerStore();
    const result = setStatusBanner("banner-1", { message: "x" }, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("severity and the starts/ends window are both optional", () => {
    const store = new InMemoryStatusBannerStore();
    const result = setStatusBanner("banner-1", { message: "x", active: true }, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("set");
    if (result.outcome !== "set") throw new Error("unreachable");
    expect(result.row.severity).toBeNull();
    expect(result.row.startsAt).toBeNull();
    expect(result.row.endsAt).toBeNull();
  });
});

describe("getStatusBanner (TASK-0138)", () => {
  it("returns the banner when it exists", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "x", active: true }, "admin-1", store, "now", "req-1");
    const result = getStatusBanner("banner-1", store, "req-1");
    expect(result.outcome).toBe("found");
  });

  it("404s on an unknown banner id -- unlike feature_flags, there is no sensible default", () => {
    const store = new InMemoryStatusBannerStore();
    const result = getStatusBanner("no-such-banner", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listStatusBanners (TASK-0138)", () => {
  it("returns every banner ever created, including inactive ones", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "a", active: true }, "admin-1", store, "now", "req-1");
    setStatusBanner("banner-2", { message: "b", active: false }, "admin-1", store, "now", "req-2");

    expect(listStatusBanners(store)).toHaveLength(2);
  });
});

describe("listActiveStatusBanners (TASK-0138)", () => {
  it("excludes an inactive banner", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "a", active: false }, "admin-1", store, "now", "req-1");

    expect(listActiveStatusBanners("2026-10-04T12:00:00Z", store)).toHaveLength(0);
  });

  it("includes an active banner with no start/end window", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "a", active: true }, "admin-1", store, "now", "req-1");

    expect(listActiveStatusBanners("2026-10-04T12:00:00Z", store)).toHaveLength(1);
  });

  it("excludes an active banner before its own startsAt", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "a", active: true, startsAt: "2026-10-05T00:00:00Z" }, "admin-1", store, "now", "req-1");

    expect(listActiveStatusBanners("2026-10-04T12:00:00Z", store)).toHaveLength(0);
  });

  it("excludes an active banner past its own endsAt", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "a", active: true, endsAt: "2026-10-03T00:00:00Z" }, "admin-1", store, "now", "req-1");

    expect(listActiveStatusBanners("2026-10-04T12:00:00Z", store)).toHaveLength(0);
  });

  it("includes an active banner within its own window", () => {
    const store = new InMemoryStatusBannerStore();
    setStatusBanner("banner-1", { message: "a", active: true, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-10T00:00:00Z" }, "admin-1", store, "now", "req-1");

    expect(listActiveStatusBanners("2026-10-04T12:00:00Z", store)).toHaveLength(1);
  });
});
