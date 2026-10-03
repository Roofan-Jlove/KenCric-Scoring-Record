import { describe, expect, it } from "vitest";
import { InMemoryNotificationPreferenceStore, listNotificationPreferences, setNotificationPreference } from "../src/commands/notificationPreferences.js";

describe("setNotificationPreference (TASK-0130)", () => {
  it("sets a new preference", () => {
    const store = new InMemoryNotificationPreferenceStore();
    const result = setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("set");
    if (result.outcome !== "set") throw new Error("unreachable");
    expect(result.row.enabled).toBe(false);
    expect(result.row.channel).toBe("PUSH");
    expect(result.row.eventType).toBe("WICKET");
  });

  it("upserts -- a repeat call for the same (userId, channel, eventType) replaces the row, not a second one", () => {
    const store = new InMemoryNotificationPreferenceStore();
    setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "now", "req-1");
    setNotificationPreference("user-1", "PUSH", "WICKET", true, store, "later", "req-2");

    const all = listNotificationPreferences("user-1", store);
    expect(all).toHaveLength(1);
    expect(all[0].enabled).toBe(true);
    expect(all[0].updatedAt).toBe("later");
  });

  it("missing userId is a schema failure (400)", () => {
    const store = new InMemoryNotificationPreferenceStore();
    const result = setNotificationPreference("", "PUSH", "WICKET", true, store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing channel is a schema failure (400)", () => {
    const store = new InMemoryNotificationPreferenceStore();
    const result = setNotificationPreference("user-1", "", "WICKET", true, store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing eventType is a schema failure (400)", () => {
    const store = new InMemoryNotificationPreferenceStore();
    const result = setNotificationPreference("user-1", "PUSH", "", true, store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing enabled is a schema failure (400)", () => {
    const store = new InMemoryNotificationPreferenceStore();
    const result = setNotificationPreference("user-1", "PUSH", "WICKET", undefined, store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("accepts any non-empty channel/eventType string -- no canonical list to validate against", () => {
    const store = new InMemoryNotificationPreferenceStore();
    const result = setNotificationPreference("user-1", "CARRIER_PIGEON", "SOMETHING_NOVEL", true, store, "now", "req-1");
    expect(result.outcome).toBe("set");
  });
});

describe("listNotificationPreferences (TASK-0130)", () => {
  it("returns every preference row for the given user", () => {
    const store = new InMemoryNotificationPreferenceStore();
    setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "now", "req-1");
    setNotificationPreference("user-1", "PUSH", "RESULT", true, store, "now", "req-2");

    const all = listNotificationPreferences("user-1", store);
    expect(all).toHaveLength(2);
  });

  it("never returns another user's preference rows", () => {
    const store = new InMemoryNotificationPreferenceStore();
    setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "now", "req-1");
    setNotificationPreference("user-2", "PUSH", "WICKET", true, store, "now", "req-2");

    const user1Prefs = listNotificationPreferences("user-1", store);
    expect(user1Prefs).toHaveLength(1);
    expect(user1Prefs[0].userId).toBe("user-1");
  });

  it("returns an empty array for a user with no preferences set", () => {
    const store = new InMemoryNotificationPreferenceStore();
    expect(listNotificationPreferences("user-1", store)).toEqual([]);
  });
});
