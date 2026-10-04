import { describe, expect, it } from "vitest";
import { pickHighestPriorityRole } from "../src/commands/signOffMatchPersistence.js";

// Only pickHighestPriorityRole is pure and unit-tested here --
// resolveActorRole/resolvePreviousVersion/resolveCurrentServerEventOrdinal/
// persistSignOff/signOffMatchReal are real async Supabase IO, left
// untested, the same precedent roleContext.ts/session.ts/
// syncEventsPersistence.ts already set in this codebase.

describe("pickHighestPriorityRole (TASK-0149)", () => {
  it("HEAD_SCORER takes priority when the user holds multiple roles on the same match", () => {
    expect(pickHighestPriorityRole(new Set(["ASSISTANT_SCORER", "HEAD_SCORER"]))).toBe("HEAD_SCORER");
  });

  it("falls back to ASSISTANT_SCORER when only that role is held", () => {
    expect(pickHighestPriorityRole(new Set(["ASSISTANT_SCORER"]))).toBe("ASSISTANT_SCORER");
  });

  it("falls back to UMPIRE when only that role is held", () => {
    expect(pickHighestPriorityRole(new Set(["UMPIRE"]))).toBe("UMPIRE");
  });

  it("falls back to the ASSISTANT_SCORER placeholder when the set is empty (no match assignment at all)", () => {
    expect(pickHighestPriorityRole(new Set())).toBe("ASSISTANT_SCORER");
  });

  it("falls back to the ASSISTANT_SCORER placeholder when the set holds only an unrecognised role (e.g. REFEREE/THIRD_UMPIRE)", () => {
    expect(pickHighestPriorityRole(new Set(["REFEREE"]))).toBe("ASSISTANT_SCORER");
  });
});
