package com.kencric.scoring.api.organizationlifecycle

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.organizations.OrganizationRow
import com.kencric.scoring.api.organizations.OrganizationStatus
import com.kencric.scoring.api.organizations.OrganizationStore

/**
 * TASK-0134: a field-for-field Kotlin port of `backend/src/commands/
 * organizationLifecycle.ts` (`TASK-0133`), the 18th Android backend-
 * command port, and the first for a module built against a
 * synthesized (not written) API contract. No new research -- see that
 * module's own doc comment for the full grounding (resolves
 * `data-specification.md §13`'s own `DSQ-2`; the twelfth discovery-
 * vs-SRS citation collision, `BR-025`→`BR-023`). Reuses
 * `com.kencric.scoring.api.organizations`'s own `OrganizationRow`/
 * `OrganizationStatus`/`OrganizationStore` directly via cross-module
 * import -- that module was widened by this same task (`TASK-0134`)
 * to add `OrganizationStatus`/`OrganizationRow.status`, mirroring the
 * TS side's own `TASK-0133` RCR.
 */

sealed class SuspendOrganizationResult {
    data class Suspended(val row: OrganizationRow) : SuspendOrganizationResult()
    data class Rejected(val problem: ApiProblem) : SuspendOrganizationResult()
}

/** Only an `ACTIVE` org may be suspended. */
fun suspendOrganization(orgId: String, reason: String?, actorRef: String, store: OrganizationStore, nowIso: String, instance: String): SuspendOrganizationResult {
    if (reason.isNullOrEmpty()) {
        return SuspendOrganizationResult.Rejected(schemaValidationError("Missing required field: reason", instance))
    }

    val existing = store.get(orgId)
        ?: return SuspendOrganizationResult.Rejected(notFoundError("No organization visible with id $orgId", instance))

    if (existing.status != OrganizationStatus.ACTIVE) {
        return SuspendOrganizationResult.Rejected(invalidTransitionError("Organization $orgId is ${existing.status}, not ACTIVE -- cannot suspend", instance))
    }

    val updated = existing.copy(status = OrganizationStatus.SUSPENDED, rowVersion = existing.rowVersion + 1, updatedAt = nowIso, updatedBy = actorRef)
    store.update(updated)
    return SuspendOrganizationResult.Suspended(updated)
}

sealed class ReactivateOrganizationResult {
    data class Reactivated(val row: OrganizationRow) : ReactivateOrganizationResult()
    data class Rejected(val problem: ApiProblem) : ReactivateOrganizationResult()
}

/** Only a `SUSPENDED` org may be reactivated -- `DELETED` is terminal. */
fun reactivateOrganization(orgId: String, actorRef: String, store: OrganizationStore, nowIso: String, instance: String): ReactivateOrganizationResult {
    val existing = store.get(orgId)
        ?: return ReactivateOrganizationResult.Rejected(notFoundError("No organization visible with id $orgId", instance))

    if (existing.status != OrganizationStatus.SUSPENDED) {
        return ReactivateOrganizationResult.Rejected(invalidTransitionError("Organization $orgId is ${existing.status}, not SUSPENDED -- cannot reactivate", instance))
    }

    val updated = existing.copy(status = OrganizationStatus.ACTIVE, rowVersion = existing.rowVersion + 1, updatedAt = nowIso, updatedBy = actorRef)
    store.update(updated)
    return ReactivateOrganizationResult.Reactivated(updated)
}

sealed class DeleteOrganizationResult {
    data class Deleted(val row: OrganizationRow) : DeleteOrganizationResult()
    data class Rejected(val problem: ApiProblem) : DeleteOrganizationResult()
}

/** Terminal -- from `ACTIVE` or `SUSPENDED`, never reversible. */
fun deleteOrganization(orgId: String, reason: String?, actorRef: String, store: OrganizationStore, nowIso: String, instance: String): DeleteOrganizationResult {
    if (reason.isNullOrEmpty()) {
        return DeleteOrganizationResult.Rejected(schemaValidationError("Missing required field: reason", instance))
    }

    val existing = store.get(orgId)
        ?: return DeleteOrganizationResult.Rejected(notFoundError("No organization visible with id $orgId", instance))

    if (existing.status == OrganizationStatus.DELETED) {
        return DeleteOrganizationResult.Rejected(invalidTransitionError("Organization $orgId is already deleted", instance))
    }

    val updated = existing.copy(status = OrganizationStatus.DELETED, rowVersion = existing.rowVersion + 1, updatedAt = nowIso, updatedBy = actorRef)
    store.update(updated)
    return DeleteOrganizationResult.Deleted(updated)
}
