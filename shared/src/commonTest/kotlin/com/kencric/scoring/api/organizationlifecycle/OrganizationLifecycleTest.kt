package com.kencric.scoring.api.organizationlifecycle

import com.kencric.scoring.api.organizations.InMemoryOrganizationStore
import com.kencric.scoring.api.organizations.OrganizationRow
import com.kencric.scoring.api.organizations.OrganizationStatus
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0134`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/organizationLifecycle.test.ts` (`TASK-0133`)
 * input-for-input.
 */
class OrganizationLifecycleTest {

    private fun seedOrg(store: InMemoryOrganizationStore, id: String, status: OrganizationStatus = OrganizationStatus.ACTIVE): OrganizationRow {
        val row = OrganizationRow(
            id = id,
            name = id,
            branding = null,
            status = status,
            rowVersion = 1,
            createdAt = "2026-10-01T00:00:00Z",
            createdBy = "admin-1",
            updatedAt = "2026-10-01T00:00:00Z",
            updatedBy = "admin-1",
        )
        store.insert(row)
        return row
    }

    @Test fun suspendOrganization_suspends_an_ACTIVE_organization() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1")

        val result = suspendOrganization("org-1", "policy violation", "admin-1", store, "2026-10-04T00:00:00Z", "req-1")

        check(result is SuspendOrganizationResult.Suspended)
        assertEquals(OrganizationStatus.SUSPENDED, result.row.status)
        assertEquals(2, result.row.rowVersion)
    }

    @Test fun suspendOrganization_missing_reason_is_schema_failure_400() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1")
        val result = suspendOrganization("org-1", null, "admin-1", store, "now", "req-1")
        check(result is SuspendOrganizationResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun suspendOrganization_404s_on_an_unknown_organization_id() {
        val store = InMemoryOrganizationStore()
        val result = suspendOrganization("no-such-org", "reason", "admin-1", store, "now", "req-1")
        check(result is SuspendOrganizationResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun suspendOrganization_rejects_suspending_an_already_SUSPENDED_organization_409() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.SUSPENDED)
        val result = suspendOrganization("org-1", "reason", "admin-1", store, "now", "req-1")
        check(result is SuspendOrganizationResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun suspendOrganization_rejects_suspending_an_already_DELETED_organization_409() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.DELETED)
        val result = suspendOrganization("org-1", "reason", "admin-1", store, "now", "req-1")
        check(result is SuspendOrganizationResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun reactivateOrganization_reactivates_a_SUSPENDED_organization() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.SUSPENDED)

        val result = reactivateOrganization("org-1", "admin-1", store, "2026-10-04T00:00:00Z", "req-1")

        check(result is ReactivateOrganizationResult.Reactivated)
        assertEquals(OrganizationStatus.ACTIVE, result.row.status)
    }

    @Test fun reactivateOrganization_404s_on_an_unknown_organization_id() {
        val store = InMemoryOrganizationStore()
        val result = reactivateOrganization("no-such-org", "admin-1", store, "now", "req-1")
        check(result is ReactivateOrganizationResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun reactivateOrganization_rejects_reactivating_an_already_ACTIVE_organization_409() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.ACTIVE)
        val result = reactivateOrganization("org-1", "admin-1", store, "now", "req-1")
        check(result is ReactivateOrganizationResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun reactivateOrganization_rejects_reactivating_a_DELETED_organization_409() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.DELETED)
        val result = reactivateOrganization("org-1", "admin-1", store, "now", "req-1")
        check(result is ReactivateOrganizationResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun deleteOrganization_deletes_an_ACTIVE_organization() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1")

        val result = deleteOrganization("org-1", "org closure", "admin-1", store, "2026-10-04T00:00:00Z", "req-1")

        check(result is DeleteOrganizationResult.Deleted)
        assertEquals(OrganizationStatus.DELETED, result.row.status)
    }

    @Test fun deleteOrganization_deletes_a_SUSPENDED_organization_too() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.SUSPENDED)

        val result = deleteOrganization("org-1", "org closure", "admin-1", store, "now", "req-1")
        check(result is DeleteOrganizationResult.Deleted)
    }

    @Test fun deleteOrganization_missing_reason_is_schema_failure_400() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1")
        val result = deleteOrganization("org-1", null, "admin-1", store, "now", "req-1")
        check(result is DeleteOrganizationResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun deleteOrganization_404s_on_an_unknown_organization_id() {
        val store = InMemoryOrganizationStore()
        val result = deleteOrganization("no-such-org", "reason", "admin-1", store, "now", "req-1")
        check(result is DeleteOrganizationResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun deleteOrganization_rejects_deleting_an_already_DELETED_organization_again_409() {
        val store = InMemoryOrganizationStore()
        seedOrg(store, "org-1", OrganizationStatus.DELETED)
        val result = deleteOrganization("org-1", "reason", "admin-1", store, "now", "req-1")
        check(result is DeleteOrganizationResult.Rejected)
        assertEquals(409, result.problem.status)
    }
}
