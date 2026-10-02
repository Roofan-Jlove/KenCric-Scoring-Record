/**
 * TASK-0105: `POST /matches/{matchId}/sign-off` (`api-specification.md
 * §11.1`) -- the fifth `§11` match-lifecycle command, and the last
 * tractable P1 one (auth endpoints, `§11.10`, are left to Supabase
 * Auth directly).
 *
 * `§11.1`'s own Trace cites `FR-106, BR-005/007` -- SRS's own
 * `FR-106` is "Dispute lock and adjudication," unrelated; the real
 * entry is `FR-103` ("Head-scorer sign-off to Final"), which traces
 * to discovery `FR-106`. `BR-005`/`BR-007` check out cleanly. `FR-102`
 * ("Reconciliation gates sign-off") is a real on-topic citation
 * missing from `§11.1`'s own Trace line entirely.
 *
 * `§11.1`'s own note: this endpoint "re-runs `SVC-RECONCILER`/
 * `SVC-RESULT-DERIVER` server-side" -- neither service exists in
 * `backend/` (both live only as pure Kotlin in `shared/`). The
 * reconciliation check list and the server's own current event
 * ordinal are taken as explicit caller-supplied inputs.
 *
 * Mirrors `apps/web/src/screens/UX-22-match-summary/signOffForm.ts`
 * (`TASK-0079`) field-for-field at this backend-command layer --
 * `ReconciliationCheck`/`Role`/`failingChecks`/`reconciliationPasses`
 * and `attemptSignOff`'s own logic (role-check before reconciliation,
 * `previousVersion + 1` incrementing, supporting post-Final
 * re-sign-off per `data-specification.md §8.1`'s own `supersedes_
 * version`), the same "reuse the pattern across packages" approach
 * `TASK-0104` already established for `exportJobs.ts`.
 *
 * A deliberate departure from this session's own "don't check roles"
 * precedent: `§11.1`'s own error registry explicitly names `403 (not
 * Head Scorer on this match)` as part of ITS OWN contract, and
 * `signOffForm.ts` already implements this as real business logic,
 * not merely advisory UI hiding -- mirrored here, not left to RLS
 * alone.
 */

import { authForbidden, invalidTransitionError, reconciliationBlockedError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export type ReconciliationCheckStatus = "PASS" | "FAIL";

export interface ReconciliationCheck {
  invariantId: string;
  status: ReconciliationCheckStatus;
  detail: string | null;
}

export type Role = "HEAD_SCORER" | "ASSISTANT_SCORER" | "UMPIRE" | "ADMIN";

export function failingChecks(checks: readonly ReconciliationCheck[]): ReconciliationCheck[] {
  return checks.filter((c) => c.status === "FAIL");
}

export function reconciliationPasses(checks: readonly ReconciliationCheck[]): boolean {
  return failingChecks(checks).length === 0;
}

export type SignOffReconciliationState = "PASS" | "OVERRIDE";

export interface SignOffRow {
  id: string;
  matchId: string;
  version: number;
  signedBy: string;
  reconciliationState: SignOffReconciliationState;
  overrideReason: string | null;
  signedAt: string;
  supersedesVersion: number | null;
}

export interface SignOffStore {
  get(id: string): SignOffRow | null;
  insert(row: SignOffRow): void;
}

export interface SignOffMatchInput {
  matchId: string;
  actorRole: Role;
  checks: readonly ReconciliationCheck[];
  overrideReason: string | null;
  asOfEventOrdinal: number;
  currentServerEventOrdinal: number;
  previousVersion: number;
  signedBy: string;
}

export type SignOffMatchResult =
  | { outcome: "signed"; row: SignOffRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** Per-endpoint idempotency-key cache. */
export interface IdempotencyStore {
  getPriorSuccess(key: string): SignOffMatchResult | null;
  recordSuccess(key: string, result: SignOffMatchResult): void;
}

/**
 * Mirrors `signOffForm.ts`'s own `attemptSignOff`: `I-H2` (role check)
 * before `I-H1` (reconciliation gate), `N-H1` (version increments by
 * exactly 1). Adds the ordinal-staleness check (`§11.1`'s own text)
 * and persistence, neither of which exist at the UI layer.
 */
export function signOffMatch(
  input: SignOffMatchInput,
  store: SignOffStore,
  idempotencyStore: IdempotencyStore,
  idempotencyKey: string,
  newSignOffId: string,
  nowIso: string,
  instance: string,
): SignOffMatchResult {
  const priorResult = idempotencyStore.getPriorSuccess(idempotencyKey);
  if (priorResult) {
    return priorResult;
  }

  if (!input.matchId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: matchId", instance) };
  }

  if (input.actorRole !== "HEAD_SCORER") {
    return { outcome: "rejected", problem: authForbidden("Only the Head Scorer may sign off this match", instance) };
  }

  if (input.asOfEventOrdinal < input.currentServerEventOrdinal) {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(
        `asOfEventOrdinal ${input.asOfEventOrdinal} is behind the server's current view (${input.currentServerEventOrdinal}) -- re-pull and retry`,
        instance,
      ),
    };
  }

  const failing = failingChecks(input.checks);
  if (failing.length > 0 && (input.overrideReason === null || input.overrideReason.trim() === "")) {
    return {
      outcome: "rejected",
      problem: reconciliationBlockedError(
        `Reconciliation failed: ${failing.map((c) => c.invariantId).join(", ")} -- supply overrideReason to proceed anyway`,
        instance,
      ),
    };
  }

  const row: SignOffRow = {
    id: newSignOffId,
    matchId: input.matchId,
    version: input.previousVersion + 1,
    signedBy: input.signedBy,
    reconciliationState: failing.length > 0 ? "OVERRIDE" : "PASS",
    overrideReason: failing.length > 0 ? input.overrideReason : null,
    signedAt: nowIso,
    supersedesVersion: input.previousVersion > 0 ? input.previousVersion : null,
  };

  store.insert(row);

  const result: SignOffMatchResult = { outcome: "signed", row };
  idempotencyStore.recordSuccess(idempotencyKey, result);
  return result;
}

/** An in-memory SignOffStore for tests -- not a production adapter. */
export class InMemorySignOffStore implements SignOffStore {
  private readonly rows = new Map<string, SignOffRow>();

  get(id: string): SignOffRow | null {
    return this.rows.get(id) ?? null;
  }

  insert(row: SignOffRow): void {
    this.rows.set(row.id, row);
  }
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly successesByKey = new Map<string, SignOffMatchResult>();

  getPriorSuccess(key: string): SignOffMatchResult | null {
    return this.successesByKey.get(key) ?? null;
  }

  recordSuccess(key: string, result: SignOffMatchResult): void {
    this.successesByKey.set(key, result);
  }
}
