package com.kencric.scoring.api.errors

/**
 * TASK-0106: a field-for-field Kotlin mirror of `backend/src/authz/
 * errors.ts` as it stands after `TASK-0105` -- RFC 7807
 * application/problem+json shape, per `api-specification.md §5.1`.
 * Built once, in this new `com.kencric.scoring.api` namespace (the
 * third top-level Kotlin package alongside `core.*`/`ui.*`), reused by
 * every Android port of a `backend/src/commands/*.ts` module rather
 * than redefined per resource -- the same role `errors.ts` itself
 * plays on the TypeScript side.
 */
data class ApiProblem(
    val type: String,
    val title: String,
    val status: Int,
    val detail: String,
    val instance: String,
)

// Placeholder base URI -- ".example" per RFC 2606, matching errors.ts's own.
const val ERROR_BASE_URI = "https://kencric.example/errors"

fun authForbidden(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/auth/forbidden",
    title = "Forbidden",
    status = 403,
    detail = detail,
    instance = instance,
)

fun schemaValidationError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/validation/schema",
    title = "Bad Request",
    status = 400,
    detail = detail,
    instance = instance,
)

fun businessRuleValidationError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/validation/business-rule",
    title = "Unprocessable Entity",
    status = 422,
    detail = detail,
    instance = instance,
)

fun staleVersionError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/concurrency/stale-version",
    title = "Conflict",
    status = 409,
    detail = detail,
    instance = instance,
)

fun notFoundError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/not-found",
    title = "Not Found",
    status = 404,
    detail = detail,
    instance = instance,
)

fun invalidTransitionError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/state/invalid-transition",
    title = "Conflict",
    status = 409,
    detail = detail,
    instance = instance,
)

fun reconciliationBlockedError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/reconciliation/blocked",
    title = "Unprocessable Entity",
    status = 422,
    detail = detail,
    instance = instance,
)

/** TASK-0120 (Android, mirroring backend TASK-0120): `410 Gone` for an expired invitation. */
fun invitationExpiredError(detail: String, instance: String): ApiProblem = ApiProblem(
    type = "$ERROR_BASE_URI/invitation/expired",
    title = "Gone",
    status = 410,
    detail = detail,
    instance = instance,
)
