import { describe, expect, it } from "vitest";
import { getFeatureFlag, InMemoryFeatureFlagStore, listFeatureFlags, setFeatureFlag } from "../src/commands/featureFlags.js";

describe("setFeatureFlag (TASK-0132)", () => {
  it("sets a new flag", () => {
    const store = new InMemoryFeatureFlagStore();
    const result = setFeatureFlag("NEW_SCORING_UI", true, "admin-1", store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("set");
    if (result.outcome !== "set") throw new Error("unreachable");
    expect(result.row.enabled).toBe(true);
    expect(result.row.updatedBy).toBe("admin-1");
  });

  it("upserts -- toggling an existing flag replaces the row, not a second one", () => {
    const store = new InMemoryFeatureFlagStore();
    setFeatureFlag("NEW_SCORING_UI", true, "admin-1", store, "now", "req-1");
    setFeatureFlag("NEW_SCORING_UI", false, "admin-2", store, "later", "req-2");

    const flag = getFeatureFlag("NEW_SCORING_UI", store);
    expect(flag.enabled).toBe(false);
    expect(flag.updatedBy).toBe("admin-2");
    expect(listFeatureFlags(store)).toHaveLength(1);
  });

  it("missing key is a schema failure (400)", () => {
    const store = new InMemoryFeatureFlagStore();
    const result = setFeatureFlag("", true, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing enabled is a schema failure (400)", () => {
    const store = new InMemoryFeatureFlagStore();
    const result = setFeatureFlag("NEW_SCORING_UI", undefined, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("accepts any non-empty key -- no canonical list to validate against", () => {
    const store = new InMemoryFeatureFlagStore();
    const result = setFeatureFlag("SOME_NOVEL_EXPERIMENT", true, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("set");
  });
});

describe("getFeatureFlag (TASK-0132)", () => {
  it("returns the stored flag when one exists", () => {
    const store = new InMemoryFeatureFlagStore();
    setFeatureFlag("NEW_SCORING_UI", true, "admin-1", store, "now", "req-1");
    expect(getFeatureFlag("NEW_SCORING_UI", store).enabled).toBe(true);
  });

  it("defaults to disabled when the flag was never explicitly created -- never 404s", () => {
    const store = new InMemoryFeatureFlagStore();
    const flag = getFeatureFlag("NEVER_SET", store);
    expect(flag.enabled).toBe(false);
  });
});

describe("listFeatureFlags (TASK-0132)", () => {
  it("returns every flag that has ever been set", () => {
    const store = new InMemoryFeatureFlagStore();
    setFeatureFlag("FLAG_A", true, "admin-1", store, "now", "req-1");
    setFeatureFlag("FLAG_B", false, "admin-1", store, "now", "req-2");

    expect(listFeatureFlags(store)).toHaveLength(2);
  });

  it("returns an empty array when no flag has ever been set", () => {
    const store = new InMemoryFeatureFlagStore();
    expect(listFeatureFlags(store)).toEqual([]);
  });
});
