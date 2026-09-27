/**
 * TASK-0079: `ux-specification.md UX-22` -- Match Summary, sign-off/
 * reconciliation-gate layer.
 *
 * Confirmed genuinely unbuilt logic: no sign-off/reconciliation Kotlin
 * logic exists anywhere in `shared/` -- only the database tables
 * (`sign_offs`/`reconciliation_reports`, `TASK-0011`) exist, no pipeline
 * validation function.
 *
 * CITATION NOTE: `UX-22`'s Trace `FR-104/105/106/108` are discovery-
 * level, matching this screen's own scope almost verbatim -- SRS's own
 * same-numbered `FR-104/105/106/108` are unrelated (Counter-signature;
 * Post-Final corrections [differently scoped]; Dispute lock/
 * adjudication; Independent per-scorer logs). `BR-005`/`BR-007` are
 * clean across both namespaces.
 *
 * Grounded directly in `acceptance-criteria.md`'s three cluster-H
 * cases: `N-H1` (passing reconciliation, Head Scorer signs off,
 * `sign_offs.version = 1`), `I-H1` (an open `FAIL` with no override
 * reason is rejected, naming the specific failing checks), `I-H2` (a
 * non-Head-Scorer attempt is rejected).
 */

export type ReconciliationCheckStatus = "PASS" | "FAIL";

export interface ReconciliationCheck {
  invariantId: string;
  status: ReconciliationCheckStatus;
  detail: string | null;
}

export type Role = "HEAD_SCORER" | "ASSISTANT_SCORER" | "UMPIRE" | "ADMIN";

export interface SignOffAttempt {
  checks: readonly ReconciliationCheck[];
  actorRole: Role;
  overrideReason: string | null;
}

export type SignOffResult =
  | { outcome: "signed"; version: number; overrideUsed: boolean }
  | { outcome: "rejected"; code: "reconciliation/blocked"; failingChecks: readonly ReconciliationCheck[] }
  | { outcome: "rejected"; code: "auth/forbidden" };

export function failingChecks(checks: readonly ReconciliationCheck[]): ReconciliationCheck[] {
  return checks.filter((c) => c.status === "FAIL");
}

export function reconciliationPasses(checks: readonly ReconciliationCheck[]): boolean {
  return failingChecks(checks).length === 0;
}

/**
 * `I-H2`: a non-Head-Scorer attempt is rejected `403 auth/forbidden`,
 * checked before reconciliation. `I-H1`: an open `FAIL` with no
 * override reason is rejected `422 reconciliation/blocked`, naming the
 * specific failing checks. `N-H1`: a passing report signs off,
 * incrementing the version by exactly 1.
 */
export function attemptSignOff(attempt: SignOffAttempt, previousVersion: number): SignOffResult {
  if (attempt.actorRole !== "HEAD_SCORER") {
    return { outcome: "rejected", code: "auth/forbidden" };
  }
  const failing = failingChecks(attempt.checks);
  if (failing.length > 0 && (attempt.overrideReason === null || attempt.overrideReason.trim() === "")) {
    return { outcome: "rejected", code: "reconciliation/blocked", failingChecks: failing };
  }
  return { outcome: "signed", version: previousVersion + 1, overrideUsed: failing.length > 0 };
}
