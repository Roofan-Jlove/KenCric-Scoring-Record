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
const ERROR_BASE_URI = "https://kencric.example/errors";

export function authForbidden(detail: string, instance: string): ProblemDetails {
  return {
    type: `${ERROR_BASE_URI}/auth/forbidden`,
    title: "Forbidden",
    status: 403,
    detail,
    instance,
  };
}
