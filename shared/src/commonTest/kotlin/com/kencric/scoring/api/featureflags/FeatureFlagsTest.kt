package com.kencric.scoring.api.featureflags

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0137`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/featureFlags.test.ts` (`TASK-0132`) input-for-input.
 */
class FeatureFlagsTest {

    @Test fun setFeatureFlag_sets_a_new_flag() {
        val store = InMemoryFeatureFlagStore()
        val result = setFeatureFlag("NEW_SCORING_UI", true, "admin-1", store, "2026-10-04T00:00:00Z", "req-1")

        check(result is SetFeatureFlagResult.Set)
        assertEquals(true, result.row.enabled)
        assertEquals("admin-1", result.row.updatedBy)
    }

    @Test fun setFeatureFlag_upserts_toggling_an_existing_flag_replaces_the_row_not_a_second_one() {
        val store = InMemoryFeatureFlagStore()
        setFeatureFlag("NEW_SCORING_UI", true, "admin-1", store, "now", "req-1")
        setFeatureFlag("NEW_SCORING_UI", false, "admin-2", store, "later", "req-2")

        val flag = getFeatureFlag("NEW_SCORING_UI", store)
        assertEquals(false, flag.enabled)
        assertEquals("admin-2", flag.updatedBy)
        assertEquals(1, listFeatureFlags(store).size)
    }

    @Test fun setFeatureFlag_missing_key_is_schema_failure_400() {
        val store = InMemoryFeatureFlagStore()
        val result = setFeatureFlag("", true, "admin-1", store, "now", "req-1")
        check(result is SetFeatureFlagResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setFeatureFlag_missing_enabled_is_schema_failure_400() {
        val store = InMemoryFeatureFlagStore()
        val result = setFeatureFlag("NEW_SCORING_UI", null, "admin-1", store, "now", "req-1")
        check(result is SetFeatureFlagResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setFeatureFlag_accepts_any_non_empty_key() {
        val store = InMemoryFeatureFlagStore()
        val result = setFeatureFlag("SOME_NOVEL_EXPERIMENT", true, "admin-1", store, "now", "req-1")
        check(result is SetFeatureFlagResult.Set)
    }

    @Test fun getFeatureFlag_returns_the_stored_flag_when_one_exists() {
        val store = InMemoryFeatureFlagStore()
        setFeatureFlag("NEW_SCORING_UI", true, "admin-1", store, "now", "req-1")
        assertEquals(true, getFeatureFlag("NEW_SCORING_UI", store).enabled)
    }

    @Test fun getFeatureFlag_defaults_to_disabled_when_never_explicitly_created() {
        val store = InMemoryFeatureFlagStore()
        assertEquals(false, getFeatureFlag("NEVER_SET", store).enabled)
    }

    @Test fun listFeatureFlags_returns_every_flag_that_has_ever_been_set() {
        val store = InMemoryFeatureFlagStore()
        setFeatureFlag("FLAG_A", true, "admin-1", store, "now", "req-1")
        setFeatureFlag("FLAG_B", false, "admin-1", store, "now", "req-2")

        assertEquals(2, listFeatureFlags(store).size)
    }

    @Test fun listFeatureFlags_returns_an_empty_array_when_no_flag_has_ever_been_set() {
        val store = InMemoryFeatureFlagStore()
        assertEquals(emptyList(), listFeatureFlags(store))
    }
}
