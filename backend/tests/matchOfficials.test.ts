import { describe, expect, it } from "vitest";
import { addMatchOfficial, getMatchOfficial, InMemoryMatchOfficialStore, listMatchOfficials, removeMatchOfficial } from "../src/commands/matchOfficials.js";

describe("addMatchOfficial (TASK-0099)", () => {
  it("a valid add creates the row with server-assigned provenance", () => {
    const store = new InMemoryMatchOfficialStore();
    const result = addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("added");
    if (result.outcome !== "added") throw new Error("unreachable");
    expect(result.row.role).toBe("UMPIRE");
    expect(result.row.createdBy).toBe("user-1");
  });

  it("a missing matchId is a schema failure (400)", () => {
    const store = new InMemoryMatchOfficialStore();
    const result = addMatchOfficial("", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an invalid role is a schema failure (400)", () => {
    const store = new InMemoryMatchOfficialStore();
    const result = addMatchOfficial("match-1", "official-1", "FOURTH_UMPIRE", store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("is idempotent -- re-adding the exact same triple is a no-op, never rejected", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "2026-10-03T00:00:00Z", "req-1");
    const result = addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-2", "later", "req-2");
    expect(result.outcome).toBe("added");
    if (result.outcome !== "added") throw new Error("unreachable");
    expect(result.row.createdBy).toBe("user-1");
    expect(result.row.createdAt).toBe("2026-10-03T00:00:00Z");
  });

  it("the same official may hold two different roles on the same match, as two distinct rows", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    const result = addMatchOfficial("match-1", "official-1", "REFEREE", store, "user-1", "now", "req-2");
    expect(result.outcome).toBe("added");
    expect(listMatchOfficials("match-1", store)).toHaveLength(2);
  });

  it("rejects a second HEAD_SCORER on the same match (OFCL-003)", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "now", "req-1");
    const result = addMatchOfficial("match-1", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("a second HEAD_SCORER is allowed on a different match", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "now", "req-1");
    const result = addMatchOfficial("match-2", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-2");
    expect(result.outcome).toBe("added");
  });

  it("multiple ASSISTANT_SCORER or UMPIRE assignments on the same match are allowed", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    const result = addMatchOfficial("match-1", "official-2", "UMPIRE", store, "user-1", "now", "req-2");
    expect(result.outcome).toBe("added");
  });
});

describe("getMatchOfficial (TASK-0099)", () => {
  it("returns the row when the exact triple exists", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    expect(getMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1").outcome).toBe("found");
  });

  it("404s when the role does not match, even if matchId/officialId do", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    const result = getMatchOfficial("match-1", "official-1", "REFEREE", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listMatchOfficials (TASK-0099)", () => {
  it("lists only the given match's panel", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    addMatchOfficial("match-1", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-1");
    addMatchOfficial("match-2", "official-3", "UMPIRE", store, "user-1", "now", "req-1");

    const result = listMatchOfficials("match-1", store);
    expect(result.map((r) => r.officialId).sort()).toEqual(["official-1", "official-2"]);
  });

  it("an empty panel returns an empty list, not an error", () => {
    const store = new InMemoryMatchOfficialStore();
    expect(listMatchOfficials("match-1", store)).toEqual([]);
  });
});

describe("removeMatchOfficial (TASK-0099)", () => {
  it("removes the exact triple outright, no gate", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    const result = removeMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1");
    expect(result.outcome).toBe("removed");
    expect(getMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1").outcome).toBe("rejected");
  });

  it("404s when the exact triple does not exist", () => {
    const store = new InMemoryMatchOfficialStore();
    const result = removeMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("removing one role leaves the same official's other role on the same match intact", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1");
    addMatchOfficial("match-1", "official-1", "REFEREE", store, "user-1", "now", "req-2");
    removeMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1");
    expect(getMatchOfficial("match-1", "official-1", "REFEREE", store, "req-1").outcome).toBe("found");
  });

  it("after removing the sole HEAD_SCORER, a new HEAD_SCORER may be added", () => {
    const store = new InMemoryMatchOfficialStore();
    addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "now", "req-1");
    removeMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "req-1");
    const result = addMatchOfficial("match-1", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-2");
    expect(result.outcome).toBe("added");
  });
});
