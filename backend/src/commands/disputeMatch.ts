/**
 * TASK-0123: `POST /matches/{matchId}/dispute` and `POST /matches/
 * {matchId}/dispute/adjudicate` (`api-specification.md §11.4`) --
 * the second task pulled from `§6.3`'s deferred V1/V2/Future list, a
 * deliberate, flagged priority-scope override (`FR-106` is `Should·P2`
 * in the SRS, `BR-016` `Must·P2`). Unblocked by `TASK-0122`'s own
 * schema RCR (`data-specification.md §8.6` `disputes`; a new
 * `DISPUTED` value on `matches.state`).
 *
 * **A real citation collision found, the tenth instance of this
 * session's own discovery-vs-SRS shape:** `§11.4`'s own Trace cites
 * `FR-112` -- SRS's own `FR-112` is "Full scorecard," wholly unrelated.
 * The real entry is SRS `FR-106` ("Dispute lock and adjudication"),
 * which traces to **discovery** `FR-112` directly (confirmed by
 * reading `FR-106`'s own Trace line: "discovery FR-112; BR-016;
 * SM-DISPUTE") -- `§11.4`'s own citation is the discovery-level number,
 * not SRS's renumbered one, the exact same collision shape found nine
 * times already this session.
 *
 * **A real domain-model tension, already flagged in `TASK-0122`'s own
 * schema RCR, carried over here:** `domain-model.md`'s `ENT-DISPUTE`
 * lives entirely under the unbuilt `CTX-COMPETITION` context. This
 * task follows `§11.4`'s own match-scoped contract instead -- a match
 * can be disputed with no competition/fixture involved at all.
 *
 * **A real, significant scope boundary, flagged rather than silently
 * assumed:** `§11.4`'s own Lock-response text says "scoring writes to
 * this match are refused (`409 state/invalid-transition`) until
 * adjudicated." This task does NOT implement that refusal -- no
 * backend HTTP write-path for recording a delivery exists anywhere in
 * `backend/` at all (the real scoring pipeline lives only as pure
 * Kotlin in `shared/`, never wired to a `backend/` command module in
 * this entire session). Enforcing the refusal is therefore out of
 * scope for this task; it belongs to whichever future task builds that
 * endpoint, which would check `matches.state !== "DISPUTED"` the same
 * way `validateFrozenFields` already checks other match-state
 * invariants in `matches.ts`.
 *
 * **`TASK-0124` extends this module with `getDispute`/`listDisputes`**
 * (`GET /disputes/{id}` / `GET /disputes`) -- the one remaining `§6.3`
 * item with no invented contract at all: `FR-159`'s own Description
 * text names "view dispute trails" as part of the org-admin console,
 * and list/get-one is the same mechanical, non-speculative shape every
 * other `§6.1` resource's own module already uses, applied here to the
 * `disputes` table rather than ported from a written endpoint spec
 * (none exists for this specific pair, unlike every prior `§6.1`/`§11`
 * task) -- the closest this cluster gets to "no invention needed."
 */

import { businessRuleValidationError, invalidTransitionError, notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";
import type { MatchRow, MatchState, MatchStore } from "./matches.js";

export type DisputeStatus = "OPEN" | "ADJUDICATED";

export interface DisputeRow {
  id: string;
  matchId: string;
  status: DisputeStatus;
  reason: string;
  lockedFromState: MatchState;
  lockedBy: string;
  lockedAt: string;
  ruling: string | null;
  resultingCorrections: string[] | null;
  adjudicatedBy: string | null;
  adjudicatedAt: string | null;
  rowVersion: number;
}

export interface DisputeStore {
  get(id: string): DisputeRow | null;
  /** Backs the app-level "at most one OPEN dispute per match" rule (§8.6's own note). */
  getOpenByMatchId(matchId: string): DisputeRow | null;
  insert(row: DisputeRow): void;
  update(row: DisputeRow): void;
  /** TASK-0124: backs `listDisputes` -- every row, unfiltered; filtering/paging happens in `listDisputes` itself, same division of labor every other `§6.1` resource's own `list()` method already uses. */
  list(): DisputeRow[];
}

export interface LockMatchForDisputePayload {
  reason?: string;
}

export type LockMatchForDisputeResult =
  | { outcome: "locked"; row: DisputeRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `POST /matches/{matchId}/dispute`. */
export function lockMatchForDispute(
  matchId: string,
  payload: LockMatchForDisputePayload,
  matchStore: MatchStore,
  disputeStore: DisputeStore,
  newDisputeId: string,
  actorRef: string,
  nowIso: string,
  instance: string,
): LockMatchForDisputeResult {
  if (!payload.reason) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: reason", instance) };
  }

  const match = matchStore.get(matchId);
  if (!match) {
    return { outcome: "rejected", problem: notFoundError(`No match visible with id ${matchId}`, instance) };
  }

  if (match.state === "DISPUTED") {
    return { outcome: "rejected", problem: invalidTransitionError(`Match ${matchId} is already locked for dispute`, instance) };
  }

  if (disputeStore.getOpenByMatchId(matchId)) {
    return { outcome: "rejected", problem: businessRuleValidationError(`Match ${matchId} already has an open dispute`, instance) };
  }

  const disputeRow: DisputeRow = {
    id: newDisputeId,
    matchId,
    status: "OPEN",
    reason: payload.reason,
    lockedFromState: match.state,
    lockedBy: actorRef,
    lockedAt: nowIso,
    ruling: null,
    resultingCorrections: null,
    adjudicatedBy: null,
    adjudicatedAt: null,
    rowVersion: 1,
  };
  disputeStore.insert(disputeRow);

  const updatedMatch: MatchRow = { ...match, state: "DISPUTED", rowVersion: match.rowVersion + 1, updatedAt: nowIso, updatedBy: actorRef };
  matchStore.update(updatedMatch);

  return { outcome: "locked", row: disputeRow };
}

export interface AdjudicateDisputePayload {
  ruling?: string;
  resultingCorrections?: string[] | null;
}

export type AdjudicateDisputeResult =
  | { outcome: "adjudicated"; row: DisputeRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `POST /matches/{matchId}/dispute/adjudicate`. Unlocks the match back to its pre-lock state. */
export function adjudicateDispute(
  matchId: string,
  payload: AdjudicateDisputePayload,
  matchStore: MatchStore,
  disputeStore: DisputeStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): AdjudicateDisputeResult {
  if (!payload.ruling) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: ruling", instance) };
  }

  const dispute = disputeStore.getOpenByMatchId(matchId);
  if (!dispute) {
    return { outcome: "rejected", problem: notFoundError(`No open dispute visible for match ${matchId}`, instance) };
  }

  const match = matchStore.get(matchId);
  if (!match) {
    return { outcome: "rejected", problem: notFoundError(`No match visible with id ${matchId}`, instance) };
  }

  const updatedDispute: DisputeRow = {
    ...dispute,
    status: "ADJUDICATED",
    ruling: payload.ruling,
    resultingCorrections: payload.resultingCorrections ?? null,
    adjudicatedBy: actorRef,
    adjudicatedAt: nowIso,
    rowVersion: dispute.rowVersion + 1,
  };
  disputeStore.update(updatedDispute);

  const updatedMatch: MatchRow = { ...match, state: dispute.lockedFromState, rowVersion: match.rowVersion + 1, updatedAt: nowIso, updatedBy: actorRef };
  matchStore.update(updatedMatch);

  return { outcome: "adjudicated", row: updatedDispute };
}

/**
 * TASK-0124: `GET /disputes/{id}`. `FR-159`'s own Description text
 * names "view dispute trails" as part of the org-admin console --
 * mechanical, non-invented, the same generic get-one shape every other
 * `§6.1` resource already uses, now applied to the `disputes` table
 * `TASK-0122` built.
 */
export type GetDisputeResult =
  | { outcome: "found"; row: DisputeRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getDispute(id: string, store: DisputeStore, instance: string): GetDisputeResult {
  const row = store.get(id);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No dispute visible with id ${id}`, instance) };
  }
  return { outcome: "found", row };
}

export interface ListDisputesQuery {
  after?: string | null;
  limit?: number;
  matchId?: string | null;
  status?: DisputeStatus | null;
}

export interface ListDisputesResult {
  items: DisputeRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * `GET /disputes`. Keyset-paginated by `id` ascending (§6);
 * `matchId`/`status` are both the table's own real `IX` columns
 * (`§8.6`), the same "filter on what the table actually indexes, don't
 * invent a filter the index doesn't back" reasoning every prior
 * `§6.1` resource's own `list` function has already used.
 */
export function listDisputes(query: ListDisputesQuery, store: DisputeStore): ListDisputesResult {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let rows = store.list().slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (query.matchId !== undefined && query.matchId !== null) {
    rows = rows.filter((r) => r.matchId === query.matchId);
  }

  if (query.status !== undefined && query.status !== null) {
    rows = rows.filter((r) => r.status === query.status);
  }

  if (query.after) {
    const cursor = query.after;
    rows = rows.filter((r) => r.id > cursor);
  }

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return { items: page, nextCursor, hasMore };
}

/** An in-memory DisputeStore for tests -- not a production adapter. */
export class InMemoryDisputeStore implements DisputeStore {
  private readonly rows = new Map<string, DisputeRow>();

  get(id: string): DisputeRow | null {
    return this.rows.get(id) ?? null;
  }

  getOpenByMatchId(matchId: string): DisputeRow | null {
    for (const row of this.rows.values()) {
      if (row.matchId === matchId && row.status === "OPEN") return row;
    }
    return null;
  }

  insert(row: DisputeRow): void {
    this.rows.set(row.id, row);
  }

  update(row: DisputeRow): void {
    this.rows.set(row.id, row);
  }

  list(): DisputeRow[] {
    return Array.from(this.rows.values());
  }
}
