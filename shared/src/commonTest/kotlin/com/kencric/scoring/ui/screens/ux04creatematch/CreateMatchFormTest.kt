package com.kencric.scoring.ui.screens.ux04creatematch

import com.kencric.scoring.core.ports.IdPort
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0041`, cross-platform parity (`C-7`): every case here mirrors
 * `apps/web/src/screens/UX-04-create-match/createMatchForm.test.ts`
 * (`TASK-0040`) input-for-input, expected-output-for-expected-output --
 * the same fixtures, not independently re-derived, so a genuine parity
 * gap between the two implementations would show up as one side's test
 * failing while the other's passes, not as two different tests neither
 * of which checks the same thing.
 */
class CreateMatchFormTest {

    private val fakeIdPort = object : IdPort {
        override fun newId(): String = "generated-id-1"
    }

    @Test fun canContinue_is_disabled_until_a_format_is_chosen() {
        val state = initialFormState("My Match", Ownership.Guest)
        assertFalse(canContinue(state))
    }

    @Test fun canContinue_enables_once_a_format_is_chosen() {
        val state = initialFormState("My Match", Ownership.Guest).copy(format = MatchFormat.T20)
        assertTrue(canContinue(state))
    }

    private val templates = listOf(MatchTemplate(id = "tpl-1", organizationId = "org-A", label = "Weekend T20"))

    @Test fun templateOrganizationMismatch_none_when_no_template_selected() {
        val state = initialFormState("My Match", Ownership.Organization("org-A"))
        assertFalse(templateOrganizationMismatch(state, templates))
    }

    @Test fun templateOrganizationMismatch_none_for_a_guest_match() {
        val state = initialFormState("My Match", Ownership.Guest).copy(selectedTemplateId = "tpl-1")
        assertFalse(templateOrganizationMismatch(state, templates))
    }

    @Test fun templateOrganizationMismatch_flags_a_different_organization() {
        val state = initialFormState("My Match", Ownership.Organization("org-B")).copy(selectedTemplateId = "tpl-1")
        assertTrue(templateOrganizationMismatch(state, templates))
    }

    @Test fun templateOrganizationMismatch_none_when_organizations_match() {
        val state = initialFormState("My Match", Ownership.Organization("org-A")).copy(selectedTemplateId = "tpl-1")
        assertFalse(templateOrganizationMismatch(state, templates))
    }

    @Test fun continueFromCreateMatch_returns_null_when_no_format_chosen() {
        val state = initialFormState("My Match", Ownership.Guest)
        assertNull(continueFromCreateMatch(state, fakeIdPort))
    }

    @Test fun continueFromCreateMatch_produces_a_draft_with_a_client_generated_id() {
        val state = initialFormState("My Match", Ownership.Guest).copy(format = MatchFormat.T20)
        val draft = continueFromCreateMatch(state, fakeIdPort)
        assertEquals(
            DraftMatch(id = "generated-id-1", matchLabel = "My Match", organizationId = null, format = MatchFormat.T20, templateId = null),
            draft,
        )
    }

    @Test fun continueFromCreateMatch_resolves_organizationId_when_not_a_guest_match() {
        val state = initialFormState("My Match", Ownership.Organization("org-A")).copy(format = MatchFormat.ODI_LIST_A)
        val draft = continueFromCreateMatch(state, fakeIdPort)
        assertEquals("org-A", draft?.organizationId)
    }

    @Test fun resolveTemplateListState_successful_fetch_with_results_is_populated_not_from_cache() {
        assertEquals(
            TemplateListState.Populated(templates, isFromCache = false),
            resolveTemplateListState(fetchSucceeded = true, fetchedTemplates = templates, cachedTemplates = emptyList()),
        )
    }

    @Test fun resolveTemplateListState_successful_fetch_with_zero_templates_is_empty() {
        assertEquals(
            TemplateListState.Empty,
            resolveTemplateListState(fetchSucceeded = true, fetchedTemplates = emptyList(), cachedTemplates = emptyList()),
        )
    }

    // Error handling: "falls back to the last-synced local cache silently if any exist."
    @Test fun resolveTemplateListState_failed_fetch_falls_back_silently_to_cache() {
        assertEquals(
            TemplateListState.FetchFailedFallbackToCache(templates),
            resolveTemplateListState(fetchSucceeded = false, fetchedTemplates = null, cachedTemplates = templates),
        )
    }

    // Error handling: "otherwise offers 'Continue with custom setup' so the flow is never blocked."
    @Test fun resolveTemplateListState_failed_fetch_with_no_cache_never_blocks_the_flow() {
        assertEquals(
            TemplateListState.FetchFailedNoCache,
            resolveTemplateListState(fetchSucceeded = false, fetchedTemplates = null, cachedTemplates = emptyList()),
        )
    }
}
