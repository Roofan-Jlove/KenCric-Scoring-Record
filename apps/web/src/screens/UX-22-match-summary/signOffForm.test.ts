import { describe, expect, it } from "vitest";
import {
  attemptSignOff,
  failingChecks,
  reconciliationPasses,
  type ReconciliationCheck,
  type SignOffAttempt,
} from "./signOffForm";

const passingChecks: ReconciliationCheck[] = [
  { invariantId: "INV-001", status: "PASS", detail: null },
  { invariantId: "INV-002", status: "PASS", detail: null },
];

const failingCheck: ReconciliationCheck = { invariantId: "INV-003", status: "FAIL", detail: "Total mismatch" };

describe("failingChecks / reconciliationPasses", () => {
  it("no failing checks when every check passes", () => {
    expect(failingChecks(passingChecks)).toEqual([]);
    expect(reconciliationPasses(passingChecks)).toBe(true);
  });

  it("identifies the specific failing check", () => {
    const checks = [...passingChecks, failingCheck];
    expect(failingChecks(checks)).toEqual([failingCheck]);
    expect(reconciliationPasses(checks)).toBe(false);
  });
});

// N-H1
describe("attemptSignOff -- N-H1", () => {
  it("a Head Scorer signs off successfully with a passing reconciliation report, version becomes 1", () => {
    const attempt: SignOffAttempt = { checks: passingChecks, actorRole: "HEAD_SCORER", overrideReason: null };
    expect(attemptSignOff(attempt, 0)).toEqual({ outcome: "signed", version: 1, overrideUsed: false });
  });

  it("a re-sign-off increments the version from a non-zero previous version", () => {
    const attempt: SignOffAttempt = { checks: passingChecks, actorRole: "HEAD_SCORER", overrideReason: null };
    expect(attemptSignOff(attempt, 1)).toEqual({ outcome: "signed", version: 2, overrideUsed: false });
  });
});

// I-H1
describe("attemptSignOff -- I-H1", () => {
  it("rejects with reconciliation/blocked when a check fails and no override reason is supplied", () => {
    const attempt: SignOffAttempt = { checks: [...passingChecks, failingCheck], actorRole: "HEAD_SCORER", overrideReason: null };
    expect(attemptSignOff(attempt, 0)).toEqual({ outcome: "rejected", code: "reconciliation/blocked", failingChecks: [failingCheck] });
  });

  it("rejects when the override reason is blank", () => {
    const attempt: SignOffAttempt = {
      checks: [...passingChecks, failingCheck],
      actorRole: "HEAD_SCORER",
      overrideReason: "   ",
    };
    const result = attemptSignOff(attempt, 0);
    expect(result.outcome).toBe("rejected");
  });

  it("succeeds with a non-blank override reason, flagging overrideUsed", () => {
    const attempt: SignOffAttempt = {
      checks: [...passingChecks, failingCheck],
      actorRole: "HEAD_SCORER",
      overrideReason: "Confirmed with umpires",
    };
    expect(attemptSignOff(attempt, 0)).toEqual({ outcome: "signed", version: 1, overrideUsed: true });
  });
});

// I-H2
describe("attemptSignOff -- I-H2", () => {
  it("rejects a non-Head-Scorer attempt with auth/forbidden, even with a passing report", () => {
    const attempt: SignOffAttempt = { checks: passingChecks, actorRole: "ASSISTANT_SCORER", overrideReason: null };
    expect(attemptSignOff(attempt, 0)).toEqual({ outcome: "rejected", code: "auth/forbidden" });
  });

  it("the role check takes priority over the reconciliation check", () => {
    const attempt: SignOffAttempt = { checks: [...passingChecks, failingCheck], actorRole: "UMPIRE", overrideReason: null };
    expect(attemptSignOff(attempt, 0)).toEqual({ outcome: "rejected", code: "auth/forbidden" });
  });
});
