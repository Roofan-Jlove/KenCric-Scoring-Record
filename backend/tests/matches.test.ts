import { describe, expect, it } from "vitest";
import { createMatch, InMemoryMatchStore, type CreateMatchPayload } from "../src/commands/matches.js";

function validPayload(overrides: Partial<CreateMatchPayload> = {}): Partial<CreateMatchPayload> {
  return {
    id: "match-1",
    organizationId: "org-1",
    originDeviceId: "device-1",
    homeTeamId: "team-A",
    awayTeamId: "team-B",
    format: "T20",
    matchTimezone: "Asia/Karachi",
    ...overrides,
  };
}

describe("createMatch (TASK-0039)", () => {
  // This task's own Expected Behavior, corrected: a valid payload
  // returns a created row with server-assigned audit fields.
  it("a valid payload creates the row with server-assigned audit fields", () => {
    const store = new InMemoryMatchStore();
    const result = createMatch(validPayload(), store, "user-1", "2026-09-24T00:00:00Z", "req-1");

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.id).toBe("match-1");
    expect(result.row.state).toBe("SCHEDULED");
    expect(result.row.rowVersion).toBe(1);
    expect(result.row.createdBy).toBe("user-1");
    expect(result.row.createdAt).toBe("2026-09-24T00:00:00Z");
    expect(store.get("match-1")).not.toBeNull();
  });

  // A null organizationId means a guest match -- confirmed distinctly
  // from an org-owned one (data-specification.md §5.1/§2.2).
  it("a null organizationId creates a GUEST-claimed match", () => {
    const store = new InMemoryMatchStore();
    const result = createMatch(validPayload({ organizationId: null }), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.claimStatus).toBe("GUEST");
  });

  it("an organizationId creates a CLAIMED match", () => {
    const store = new InMemoryMatchStore();
    const result = createMatch(validPayload({ organizationId: "org-1" }), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.claimStatus).toBe("CLAIMED");
  });

  // The corrected claim: a MISSING required field is a SCHEMA failure
  // (400), not the task's own originally-stated 422.
  it("a missing required field is rejected as validation/schema (400), not 422", () => {
    const store = new InMemoryMatchStore();
    const payload = validPayload();
    delete payload.homeTeamId;
    const result = createMatch(payload, store, "user-1", "now", "req-1");

    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
    expect(result.problem.type).toContain("validation/schema");
  });

  it("an invalid format enum value is a schema failure (400)", () => {
    const store = new InMemoryMatchStore();
    const result = createMatch(validPayload({ format: "INVALID" as never }), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  // The genuine business-rule (422) case: a well-formed payload that
  // violates the table's own CK constraint.
  it("home_team_id equal to away_team_id is rejected as validation/business-rule (422)", () => {
    const store = new InMemoryMatchStore();
    const result = createMatch(validPayload({ homeTeamId: "team-A", awayTeamId: "team-A" }), store, "user-1", "now", "req-1");

    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
    expect(result.problem.type).toContain("validation/business-rule");
  });

  it("creating with an already-existing id is rejected, not silently overwritten", () => {
    const store = new InMemoryMatchStore();
    createMatch(validPayload(), store, "user-1", "now", "req-1");
    const second = createMatch(validPayload(), store, "user-2", "later", "req-2");

    expect(second.outcome).toBe("rejected");
    // The original row is untouched -- confirms no silent overwrite.
    expect(store.get("match-1")?.createdBy).toBe("user-1");
  });

  it("optional fields default correctly when omitted", () => {
    const store = new InMemoryMatchStore();
    const result = createMatch(validPayload(), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.rainMethod).toBe("NONE");
    expect(result.row.homeXi).toBeNull();
    expect(result.row.tossWinnerTeamId).toBeNull();
    expect(result.row.result).toBeNull();
  });
});
