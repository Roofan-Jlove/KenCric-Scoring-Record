import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getUserLocale, InMemoryUserLocalePreferenceStore, setUserLocale } from "../src/commands/userLocalePreferences.js";

describe("setUserLocale (TASK-0131)", () => {
  it("sets a new locale preference", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    const result = setUserLocale("user-1", "fr", store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("set");
    if (result.outcome !== "set") throw new Error("unreachable");
    expect(result.row.locale).toBe("fr");
  });

  it("upserts -- a repeat call for the same user replaces the row, not a second one", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    setUserLocale("user-1", "fr", store, "now", "req-1");
    setUserLocale("user-1", "es", store, "later", "req-2");

    const row = getUserLocale("user-1", store);
    expect(row.locale).toBe("es");
    expect(row.updatedAt).toBe("later");
  });

  it("missing userId is a schema failure (400)", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    const result = setUserLocale("", "fr", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing locale is a schema failure (400)", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    const result = setUserLocale("user-1", undefined, store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("accepts any non-empty locale string -- no canonical list to validate against", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    const result = setUserLocale("user-1", "klingon", store, "now", "req-1");
    expect(result.outcome).toBe("set");
  });
});

describe("getUserLocale (TASK-0131)", () => {
  it("returns the stored preference when one exists", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    setUserLocale("user-1", "fr", store, "now", "req-1");

    expect(getUserLocale("user-1", store).locale).toBe("fr");
  });

  it("defaults to English when no preference has ever been set -- never 404s", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    const row = getUserLocale("user-1", store);
    expect(row.locale).toBe(DEFAULT_LOCALE);
  });

  it("never returns another user's preference", () => {
    const store = new InMemoryUserLocalePreferenceStore();
    setUserLocale("user-1", "fr", store, "now", "req-1");
    setUserLocale("user-2", "es", store, "now", "req-2");

    expect(getUserLocale("user-1", store).locale).toBe("fr");
    expect(getUserLocale("user-2", store).locale).toBe("es");
  });
});
