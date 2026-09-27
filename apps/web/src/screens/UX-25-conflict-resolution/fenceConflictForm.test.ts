import { describe, expect, it } from "vitest";
import { resolveFenceConflict } from "./fenceConflictForm";

describe("resolveFenceConflict -- taking over requires explicit acknowledgement", () => {
  it("rejects a TAKE_OVER attempt without acknowledgement", () => {
    const result = resolveFenceConflict("TAKE_OVER", false);
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toContain("locked out");
  });

  it("succeeds with TAKE_OVER once acknowledged", () => {
    expect(resolveFenceConflict("TAKE_OVER", true)).toEqual({ outcome: "resolved", resolution: "TAKE_OVER" });
  });

  it("DISCARD_LOCALLY (cancel, keep the original device active) never requires acknowledgement", () => {
    expect(resolveFenceConflict("DISCARD_LOCALLY", false)).toEqual({ outcome: "resolved", resolution: "DISCARD_LOCALLY" });
    expect(resolveFenceConflict("DISCARD_LOCALLY", true)).toEqual({ outcome: "resolved", resolution: "DISCARD_LOCALLY" });
  });
});
