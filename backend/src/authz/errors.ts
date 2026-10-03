/**
 * RFC 7807 application/problem+json shape, per api-specification.md §5.1:
 * type (stable URI identifying the error kind), title (human-readable
 * summary), status (HTTP status, duplicated in the body), detail
 * (specific, request-scoped explanation -- never a raw stack trace or
 * internal identifier), instance (a correlation id for support/audit
 * lookup).
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

/**
 * The exact error this module returns on a denied authorization check --
 * api-specification.md §5.2's `auth/forbidden` (403), "Authenticated, but
 * not authorized for this action." Not retryable without a role/consent
 * change (§5.2's own registry).
 */
// Placeholder base URI -- ".example" per RFC 2606, deliberately not a
// real domain. Needs a real value once one is decided; not this task's
// scope to pick one.
export const ERROR_BASE_URI = "https://kencric.example/errors";

export function authForbidden(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/auth/forbidden`,
    title: "Forbidden",
    status: 403,
    detail,
    instance,
  };
}

/**
 * TASK-0039: api-specification.md §5.2's registry, the two generic-CRUD
 * error kinds every resource endpoint needs. `authForbidden` above is
 * kept resource-agnostic on purpose (TASK-0014); these follow the same
 * shape rather than each command module inventing its own.
 */
export function schemaValidationError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/validation/schema`,
    title: "Bad Request",
    status: 400,
    detail,
    instance,
  };
}

export function businessRuleValidationError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/validation/business-rule`,
    title: "Unprocessable Entity",
    status: 422,
    detail,
    instance,
  };
}

export function staleVersionError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/concurrency/stale-version`,
    title: "Conflict",
    status: 409,
    detail,
    instance,
  };
}

/**
 * TASK-0100: `api-specification.md §5.2`'s own registry entry,
 * `state/invalid-transition` (409) — "the requested action is illegal
 * in the resource's current state... only via the correct alternate
 * path, never a bare retry." Distinct from `staleVersionError`'s
 * `concurrency/stale-version`: that one is an optimistic-concurrency
 * race on a mutable row; this one is attempting an illegal state
 * change on a resource that forbids it outright (e.g. `reference_data`'s
 * own immutability, or a match already past a lifecycle gate).
 */
export function invalidTransitionError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/state/invalid-transition`,
    title: "Conflict",
    status: 409,
    detail,
    instance,
  };
}

/**
 * TASK-0105: `api-specification.md §11.1`'s own named error,
 * `reconciliation/blocked` (422) -- matches `apps/web/src/screens/
 * UX-22-match-summary/signOffForm.ts`'s own `code: "reconciliation/
 * blocked"` literal (`TASK-0079`). Distinct from
 * `businessRuleValidationError`'s generic `validation/business-rule`.
 */
export function reconciliationBlockedError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/reconciliation/blocked`,
    title: "Unprocessable Entity",
    status: 422,
    detail,
    instance,
  };
}

/**
 * TASK-0120: `api-specification.md §11.5`'s own named status, `410
 * Gone` for an expired invitation -- explicitly distinguished from
 * `404` ("the two cases warrant different user-facing copy"), but
 * absent from `§5.2`'s own canonical registry table entirely, the
 * same "registry had no constructor yet" gap `TASK-0100`'s
 * `invalidTransitionError` and `TASK-0105`'s `reconciliationBlockedError`
 * each already found and filled once.
 */
export function invitationExpiredError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/invitation/expired`,
    title: "Gone",
    status: 410,
    detail,
    instance,
  };
}

/**
 * TASK-0044: api-specification.md §5.2's `not-found` (404) --
 * "Resource doesn't exist, or exists but RLS makes it invisible to this
 * caller -- the response is identical in both cases, deliberately, to
 * avoid leaking existence across tenants." [detail] must therefore
 * never distinguish the two cases either.
 */
export function notFoundError(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/not-found`,
    title: "Not Found",
    status: 404,
    detail,
    instance,
  };
}
