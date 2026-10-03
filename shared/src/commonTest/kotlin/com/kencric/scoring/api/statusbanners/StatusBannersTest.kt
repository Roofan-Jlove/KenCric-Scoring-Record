package com.kencric.scoring.api.statusbanners

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * `TASK-0139`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/statusBanners.test.ts` (`TASK-0138`) input-for-input.
 */
class StatusBannersTest {

    @Test fun setStatusBanner_sets_a_new_banner() {
        val store = InMemoryStatusBannerStore()
        val result = setStatusBanner("banner-1", SetStatusBannerPayload(message = "Scheduled maintenance tonight", severity = "WARNING", active = true), "admin-1", store, "2026-10-04T00:00:00Z", "req-1")

        check(result is SetStatusBannerResult.Set)
        assertEquals("Scheduled maintenance tonight", result.row.message)
        assertEquals(true, result.row.active)
    }

    @Test fun setStatusBanner_upserts_a_repeat_call_replaces_the_row_not_a_second_one() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "first", active = true), "admin-1", store, "now", "req-1")
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "second", active = false), "admin-2", store, "later", "req-2")

        val all = listStatusBanners(store)
        assertEquals(1, all.size)
        assertEquals("second", all[0].message)
        assertEquals(false, all[0].active)
    }

    @Test fun setStatusBanner_missing_id_is_schema_failure_400() {
        val store = InMemoryStatusBannerStore()
        val result = setStatusBanner("", SetStatusBannerPayload(message = "x", active = true), "admin-1", store, "now", "req-1")
        check(result is SetStatusBannerResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setStatusBanner_missing_message_is_schema_failure_400() {
        val store = InMemoryStatusBannerStore()
        val result = setStatusBanner("banner-1", SetStatusBannerPayload(active = true), "admin-1", store, "now", "req-1")
        check(result is SetStatusBannerResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setStatusBanner_missing_active_is_schema_failure_400() {
        val store = InMemoryStatusBannerStore()
        val result = setStatusBanner("banner-1", SetStatusBannerPayload(message = "x"), "admin-1", store, "now", "req-1")
        check(result is SetStatusBannerResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setStatusBanner_severity_and_the_starts_ends_window_are_both_optional() {
        val store = InMemoryStatusBannerStore()
        val result = setStatusBanner("banner-1", SetStatusBannerPayload(message = "x", active = true), "admin-1", store, "now", "req-1")
        check(result is SetStatusBannerResult.Set)
        assertNull(result.row.severity)
        assertNull(result.row.startsAt)
        assertNull(result.row.endsAt)
    }

    @Test fun getStatusBanner_returns_the_banner_when_it_exists() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "x", active = true), "admin-1", store, "now", "req-1")
        val result = getStatusBanner("banner-1", store, "req-1")
        check(result is GetStatusBannerResult.Found)
    }

    @Test fun getStatusBanner_404s_on_an_unknown_banner_id() {
        val store = InMemoryStatusBannerStore()
        val result = getStatusBanner("no-such-banner", store, "req-1")
        check(result is GetStatusBannerResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun listStatusBanners_returns_every_banner_ever_created_including_inactive_ones() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "a", active = true), "admin-1", store, "now", "req-1")
        setStatusBanner("banner-2", SetStatusBannerPayload(message = "b", active = false), "admin-1", store, "now", "req-2")

        assertEquals(2, listStatusBanners(store).size)
    }

    @Test fun listActiveStatusBanners_excludes_an_inactive_banner() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "a", active = false), "admin-1", store, "now", "req-1")

        assertEquals(0, listActiveStatusBanners("2026-10-04T12:00:00Z", store).size)
    }

    @Test fun listActiveStatusBanners_includes_an_active_banner_with_no_start_end_window() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "a", active = true), "admin-1", store, "now", "req-1")

        assertEquals(1, listActiveStatusBanners("2026-10-04T12:00:00Z", store).size)
    }

    @Test fun listActiveStatusBanners_excludes_an_active_banner_before_its_own_startsAt() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "a", active = true, startsAt = "2026-10-05T00:00:00Z"), "admin-1", store, "now", "req-1")

        assertEquals(0, listActiveStatusBanners("2026-10-04T12:00:00Z", store).size)
    }

    @Test fun listActiveStatusBanners_excludes_an_active_banner_past_its_own_endsAt() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "a", active = true, endsAt = "2026-10-03T00:00:00Z"), "admin-1", store, "now", "req-1")

        assertEquals(0, listActiveStatusBanners("2026-10-04T12:00:00Z", store).size)
    }

    @Test fun listActiveStatusBanners_includes_an_active_banner_within_its_own_window() {
        val store = InMemoryStatusBannerStore()
        setStatusBanner("banner-1", SetStatusBannerPayload(message = "a", active = true, startsAt = "2026-10-01T00:00:00Z", endsAt = "2026-10-10T00:00:00Z"), "admin-1", store, "now", "req-1")

        assertEquals(1, listActiveStatusBanners("2026-10-04T12:00:00Z", store).size)
    }
}
