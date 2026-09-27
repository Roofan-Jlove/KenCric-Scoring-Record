import { useState } from "react";
import { attemptSignOff, failingChecks, type ReconciliationCheck, type Role } from "./signOffForm";

/**
 * TASK-0079: `ux-specification.md UX-22` -- Match Summary. Styling not
 * applied, same scope boundary as every earlier screen this session.
 * `resultHeadline` is caller-supplied -- no result-statement computation
 * exists anywhere in `shared/` yet, the same flag `TASK-0075` raised.
 */

export interface MatchSummaryScreenProps {
  resultHeadline: string;
  checks: readonly ReconciliationCheck[];
  actorRole: Role;
  previousVersion: number;
  isSignedFinal: boolean;
  onSignedOff: (version: number, overrideUsed: boolean) => void;
}

export function MatchSummaryScreen({ resultHeadline, checks, actorRole, previousVersion, isSignedFinal, onSignedOff }: MatchSummaryScreenProps) {
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastOverrideUsed, setLastOverrideUsed] = useState(false);

  function handleSignOff() {
    const result = attemptSignOff({ checks, actorRole, overrideReason: overrideReason || null }, previousVersion);
    if (result.outcome === "rejected") {
      if (result.code === "auth/forbidden") {
        setError("Sign Off requires the Head Scorer role");
      } else {
        setError(`Reconciliation failed: ${result.failingChecks.map((c) => c.invariantId).join(", ")}`);
      }
      return;
    }
    setError(null);
    setLastOverrideUsed(result.overrideUsed);
    onSignedOff(result.version, result.overrideUsed);
  }

  const failing = failingChecks(checks);

  return (
    <div>
      <h1>{resultHeadline}</h1>

      {isSignedFinal && <p role="status">Official</p>}
      {lastOverrideUsed && <p role="status">Signed off with a reconciliation override</p>}

      <ul aria-label="Reconciliation report">
        {checks.map((check) => (
          <li key={check.invariantId}>
            <span aria-hidden="true">{check.status === "PASS" ? "✓" : "✗"}</span>
            {check.invariantId}: {check.status}
            {check.detail ? ` — ${check.detail}` : ""}
          </li>
        ))}
      </ul>

      {failing.length > 0 && !isSignedFinal && (
        <div>
          <label htmlFor="override-reason">Reason for override</label>
          <input id="override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {!isSignedFinal && (
        <button type="button" aria-label="Sign Off (consequential action)" onClick={handleSignOff}>
          Sign Off
        </button>
      )}

      <button type="button">Share</button>
      <button type="button">Export</button>
      <button type="button">Return to Dashboard</button>
    </div>
  );
}
