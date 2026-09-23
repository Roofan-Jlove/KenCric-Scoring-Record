package com.kencric.scoring.ui.screens.ux04creatematch

import com.kencric.scoring.core.ports.IdPort

/**
 * TASK-0041: `ux-specification.md UX-04`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-04-create-match/createMatchForm.ts`
 * (`TASK-0040`) -- cross-platform parity (`C-7`) means this Kotlin
 * version and that TypeScript version must produce identical outputs
 * for identical inputs, verified here by mirroring `TASK-0040`'s own
 * test cases exactly, input for input, expected output for expected
 * output.
 *
 * HONEST SCOPE NOTE, confirmed with the user before writing this file:
 * no Android SDK, Gradle, or Kotlin toolchain exists anywhere in this
 * session (confirmed since `TASK-0016`, unchanged) -- there is no
 * `apps/android/` Gradle project to place this in, and nothing here
 * can be compiled, run, or verified beyond hand-tracing. Placed in
 * `shared/src/commonMain`, not a fabricated `apps/android/` path,
 * because this logic is genuinely platform-independent (no Android API
 * surface touched at all -- pure form state/validation) and this is
 * exactly what Kotlin Multiplatform exists for: one implementation a
 * real Android screen would eventually consume directly. Unlike the
 * web side (which needed its own separate TypeScript port because no
 * compiled Kotlin/JS bundle exists), a real `apps/android/` project
 * could import this file completely unchanged once one exists --
 * substitution, not a rewrite.
 */

enum class MatchFormat { T20, ODI_LIST_A, T10, THE_HUNDRED, CUSTOM }

sealed class Ownership {
    object Guest : Ownership()
    data class Organization(val organizationId: String) : Ownership()
}

data class MatchTemplate(val id: String, val organizationId: String, val label: String)

data class CreateMatchFormState(
    val matchLabel: String,
    val ownership: Ownership,
    val selectedTemplateId: String? = null,
    val format: MatchFormat? = null,
)

fun initialFormState(suggestedLabel: String, ownership: Ownership): CreateMatchFormState =
    CreateMatchFormState(matchLabel = suggestedLabel, ownership = ownership)

/** UX-04's own Validation rule: "A format must be chosen before Continue enables." */
fun canContinue(state: CreateMatchFormState): Boolean = state.format != null

/**
 * UX-04's own Validation rule: "if a selected template belongs to a
 * different organization than the current context, it's flagged
 * before use." Uses an exhaustive `when` over the sealed [Ownership]
 * rather than an early-return `is` check followed by relying on smart-
 * cast narrowing to the only other subtype -- deliberately, since
 * there is no compiler here to confirm that narrowing actually holds;
 * the explicit `when` is unambiguous either way.
 */
fun templateOrganizationMismatch(state: CreateMatchFormState, templates: List<MatchTemplate>): Boolean {
    val templateId = state.selectedTemplateId ?: return false
    return when (val ownership = state.ownership) {
        is Ownership.Guest -> false
        is Ownership.Organization -> {
            val template = templates.find { it.id == templateId }
            template != null && template.organizationId != ownership.organizationId
        }
    }
}

/**
 * `data-specification.md §5.1`'s `matches` table requires
 * `home_team_id`/`away_team_id`/`match_timezone` (all `NOT NULL`),
 * none of which UX-04 itself collects (`TASK-0040`'s own flagged
 * finding, carried over here identically) -- "Continue" produces a
 * local draft, not a call to `TASK-0039`'s `createMatch()`.
 */
data class DraftMatch(
    val id: String,
    val matchLabel: String,
    val organizationId: String?,
    val format: MatchFormat,
    val templateId: String?,
)

fun continueFromCreateMatch(state: CreateMatchFormState, idPort: IdPort): DraftMatch? {
    if (!canContinue(state)) return null
    val format = state.format ?: return null // canContinue already guarantees non-null; re-checked here only to satisfy the compiler's null-flow analysis, matching the TS version's `as MatchFormat` cast after its own equivalent guard.
    val organizationId = when (val ownership = state.ownership) {
        is Ownership.Guest -> null
        is Ownership.Organization -> ownership.organizationId
    }
    return DraftMatch(
        id = idPort.newId(),
        matchLabel = state.matchLabel,
        organizationId = organizationId,
        format = format,
        templateId = state.selectedTemplateId,
    )
}

sealed class TemplateListState {
    object Loading : TemplateListState()
    data class Populated(val templates: List<MatchTemplate>, val isFromCache: Boolean) : TemplateListState()
    object Empty : TemplateListState()
    data class FetchFailedFallbackToCache(val templates: List<MatchTemplate>) : TemplateListState()
    object FetchFailedNoCache : TemplateListState()
}

/** UX-04's own Error handling + Empty states, unified: "Template list fetch failure falls back to the last-synced local cache silently if any exist, otherwise offers 'Continue with custom setup' so the flow is never blocked." */
fun resolveTemplateListState(
    fetchSucceeded: Boolean,
    fetchedTemplates: List<MatchTemplate>?,
    cachedTemplates: List<MatchTemplate>,
): TemplateListState {
    if (fetchSucceeded && fetchedTemplates != null) {
        return if (fetchedTemplates.isEmpty()) {
            TemplateListState.Empty
        } else {
            TemplateListState.Populated(fetchedTemplates, isFromCache = false)
        }
    }
    if (cachedTemplates.isNotEmpty()) return TemplateListState.FetchFailedFallbackToCache(cachedTemplates)
    return TemplateListState.FetchFailedNoCache
}
