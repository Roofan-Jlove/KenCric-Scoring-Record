import { describe, expect, it } from "vitest";
import { createMatch, InMemoryMatchStore, updateMatch, type CreateMatchPayload, type UpdateMatchPayload } from "../src/commands/matches.js";

function seedMatch(store: InMemoryMatchStore, overrides: Partial<CreateMatchPayload> = {}) {
  const payload: Partial<CreateMatchPayload> = {
    id: "match-1",
    organizationId: "org-1",
    originDeviceId: "device-1",
    homeTeamId: "team-A",
    awayTeamId: "team-B",
    format: "T20",
    matchTimezone: "Asia/Karachi",
    ...overrides,
  };
  const result = createMatch(payload, store, "user-1", "2026-09-24T00:00:00Z", "req-seed");
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("updateMatch (TASK-0044)", () => {
  it("a valid update with the current row_version succeeds and increments row_version by exactly 1", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store);

    const result = updateMatch("match-1", { rowVersion: 1, venue: "National Stadium" }, store, "user-2", "2026-09-24T01:00:00Z", "req-1");

    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.venue).toBe("National Stadium");
    expect(result.row.updatedBy).toBe("user-2");
    expect(result.row.updatedAt).toBe("2026-09-24T01:00:00Z");
    // Fields the payload never touched are unchanged.
    expect(result.row.homeTeamId).toBe("team-A");
    expect(result.row.createdBy).toBe("user-1");
    expect(result.row.createdAt).toBe("2026-09-24T00:00:00Z");
  });

  it("only fields present in the payload change -- a partial update", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store, { venue: "Old Venue", minOversForResult: 20 });

    const result = updateMatch("match-1", { rowVersion: 1, venue: "New Venue" }, store, "user-1", "later", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.venue).toBe("New Venue");
    expect(result.row.minOversForResult).toBe(20);
  });

  it("an update against a non-existent id is 404, identical whether missing or RLS-hidden", () => {
    const store = new InMemoryMatchStore();
    const result = updateMatch("no-such-match", { rowVersion: 1 }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
    expect(result.problem.type).toContain("not-found");
  });

  it("a missing row_version is a schema failure (400)", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store);
    const result = updateMatch("match-1", {} as UpdateMatchPayload, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  // This task's own core claim: a stale row_version is rejected, the
  // stored row left completely untouched -- never a silent overwrite.
  it("a stale row_version is rejected 409, and the stored row is provably unchanged", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store);

    const result = updateMatch("match-1", { rowVersion: 999, venue: "Attempted Venue" }, store, "user-2", "later", "req-1");

    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(result.problem.type).toContain("concurrency/stale-version");

    const stored = store.get("match-1");
    expect(stored?.rowVersion).toBe(1);
    expect(stored?.venue).toBeNull();
  });

  it("changing a frozen field after it has already been set to a different value is rejected 422", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store, { homeXi: { players: ["p1", "p2"] } });

    const result = updateMatch(
      "match-1",
      { rowVersion: 1, homeXi: { players: ["p3", "p4"] } },
      store,
      "user-1",
      "later",
      "req-1",
    );

    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
    expect(result.problem.type).toContain("validation/business-rule");
  });

  it("setting a frozen field for the first time (currently null) succeeds", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store); // homeXi defaults to null

    const result = updateMatch("match-1", { rowVersion: 1, homeXi: { players: ["p1"] } }, store, "user-1", "later", "req-1");
    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.homeXi).toEqual({ players: ["p1"] });
  });

  it("re-submitting a frozen field with the SAME value it already has is not blocked", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store, { homeXi: { players: ["p1"] } });

    const result = updateMatch("match-1", { rowVersion: 1, homeXi: { players: ["p1"] } }, store, "user-1", "later", "req-1");
    expect(result.outcome).toBe("updated");
  });

  it("a partial update that would make home_team_id equal the existing away_team_id is rejected 422", () => {
    const store = new InMemoryMatchStore();
    seedMatch(store); // homeTeamId=team-A, awayTeamId=team-B

    const result = updateMatch("match-1", { rowVersion: 1, homeTeamId: "team-B" }, store, "user-1", "later", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });
});
