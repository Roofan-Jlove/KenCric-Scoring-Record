package com.kencric.scoring.api.organizations

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.errors.staleVersionError

/**
 * TASK-0106: a field-for-field Kotlin port of `backend/src/commands/
 * organizations.ts` (`TASK-0093`). No new research here -- every
 * citation/business-rule/scope decision was already resolved when
 * that module was first built; see its own doc comment for the full
 * grounding (the `DELETE`-never-built `DSQ-2` gap, the `name_search`
 * filterable-fields finding).
 */

data class CreateOrganizationPayload(
    val id: String,
    val name: String,
    val branding: Any? = null,
)

/** `data-specification.md §3.2` -- added by `TASK-0134`, mirroring the TS side's own `TASK-0133` RCR resolving `DSQ-2`. */
enum class OrganizationStatus { ACTIVE, SUSPENDED, DELETED }

data class OrganizationRow(
    val id: String,
    val name: String,
    val branding: Any?,
    val status: OrganizationStatus = OrganizationStatus.ACTIVE,
    val rowVersion: Int,
    val createdAt: String,
    val createdBy: String,
    val updatedAt: String,
    val updatedBy: String,
)

interface OrganizationStore {
    fun get(id: String): OrganizationRow?
    fun insert(row: OrganizationRow)
    fun update(row: OrganizationRow)
    fun list(): List<OrganizationRow>
}

fun validateOrganizationSchema(id: String?, name: String?, instance: String): ApiProblem? {
    if (id.isNullOrEmpty()) return schemaValidationError("Missing required field: id", instance)
    if (name.isNullOrEmpty()) return schemaValidationError("Missing required field: name", instance)
    return null
}

sealed class CreateOrganizationResult {
    data class Created(val row: OrganizationRow) : CreateOrganizationResult()
    data class Rejected(val problem: ApiProblem) : CreateOrganizationResult()
}

fun createOrganization(
    payload: CreateOrganizationPayload,
    store: OrganizationStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): CreateOrganizationResult {
    val schemaProblem = validateOrganizationSchema(payload.id, payload.name, instance)
    if (schemaProblem != null) return CreateOrganizationResult.Rejected(schemaProblem)

    if (store.get(payload.id) != null) {
        return CreateOrganizationResult.Rejected(
            schemaValidationError("An organization with id ${payload.id} already exists -- use the update path, not create", instance),
        )
    }

    val row = OrganizationRow(
        id = payload.id,
        name = payload.name,
        branding = payload.branding,
        status = OrganizationStatus.ACTIVE,
        rowVersion = 1,
        createdAt = nowIso,
        createdBy = actorRef,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.insert(row)
    return CreateOrganizationResult.Created(row)
}

/**
 * `rowVersion` is nullable here -- unlike the TS payload's own
 * required-but-bypassable type (its own test reaches "missing
 * rowVersion" via `{} as UpdateOrganizationPayload`, a cast Kotlin has
 * no equivalent unsafe escape hatch for), a genuinely missing
 * `rowVersion` must be representable at the type level to port that
 * same test case honestly.
 */
data class UpdateOrganizationPayload(
    val rowVersion: Int? = null,
    val name: String? = null,
    val branding: Any? = null,
    val brandingSet: Boolean = false,
)

sealed class UpdateOrganizationResult {
    data class Updated(val row: OrganizationRow) : UpdateOrganizationResult()
    data class Rejected(val problem: ApiProblem) : UpdateOrganizationResult()
}

fun updateOrganization(
    id: String,
    payload: UpdateOrganizationPayload,
    store: OrganizationStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): UpdateOrganizationResult {
    val existing = store.get(id)
        ?: return UpdateOrganizationResult.Rejected(notFoundError("No organization visible with id $id", instance))

    if (payload.rowVersion == null) {
        return UpdateOrganizationResult.Rejected(schemaValidationError("Missing required field: rowVersion", instance))
    }

    if (payload.rowVersion != existing.rowVersion) {
        return UpdateOrganizationResult.Rejected(
            staleVersionError("expected row_version ${existing.rowVersion}, got ${payload.rowVersion}", instance),
        )
    }

    if (payload.name != null && payload.name.isEmpty()) {
        return UpdateOrganizationResult.Rejected(schemaValidationError("name must not be empty", instance))
    }

    val updatedRow = existing.copy(
        name = payload.name ?: existing.name,
        branding = if (payload.brandingSet) payload.branding else existing.branding,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.update(updatedRow)
    return UpdateOrganizationResult.Updated(updatedRow)
}

sealed class GetOrganizationResult {
    data class Found(val row: OrganizationRow) : GetOrganizationResult()
    data class Rejected(val problem: ApiProblem) : GetOrganizationResult()
}

fun getOrganization(id: String, store: OrganizationStore, instance: String): GetOrganizationResult {
    val row = store.get(id) ?: return GetOrganizationResult.Rejected(notFoundError("No organization visible with id $id", instance))
    return GetOrganizationResult.Found(row)
}

data class ListOrganizationsQuery(
    val after: String? = null,
    val limit: Int? = null,
    val nameSearch: String? = null,
)

data class ListOrganizationsResult(
    val items: List<OrganizationRow>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200

fun listOrganizations(query: ListOrganizationsQuery, store: OrganizationStore): ListOrganizationsResult {
    val limit = minOf(query.limit ?: DEFAULT_LIMIT, MAX_LIMIT)

    var rows = store.list().sortedBy { it.id }

    if (!query.nameSearch.isNullOrEmpty()) {
        val needle = query.nameSearch.lowercase()
        rows = rows.filter { it.name.lowercase().contains(needle) }
    }

    if (!query.after.isNullOrEmpty()) {
        val cursor = query.after
        rows = rows.filter { it.id > cursor }
    }

    val page = rows.take(limit)
    val hasMore = rows.size > limit
    val nextCursor = if (hasMore) page.last().id else null

    return ListOrganizationsResult(items = page, nextCursor = nextCursor, hasMore = hasMore)
}

/** An in-memory OrganizationStore for tests -- not a production adapter. */
class InMemoryOrganizationStore : OrganizationStore {
    private val rows = mutableMapOf<String, OrganizationRow>()

    override fun get(id: String): OrganizationRow? = rows[id]
    override fun insert(row: OrganizationRow) { rows[row.id] = row }
    override fun update(row: OrganizationRow) { rows[row.id] = row }
    override fun list(): List<OrganizationRow> = rows.values.toList()
}
