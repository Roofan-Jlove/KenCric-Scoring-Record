package com.kencric.scoring.api.matchofficials

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0112`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/matchOfficials.test.ts` (`TASK-0099`) input-for-input.
 */
class MatchOfficialsTest {

    @Test fun addMatchOfficial_valid_add_creates_row_with_server_assigned_provenance() {
        val store = InMemoryMatchOfficialStore()
        val result = addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is AddMatchOfficialResult.Added)
        assertEquals(MatchOfficialRole.UMPIRE, result.row.role)
        assertEquals("user-1", result.row.createdBy)
    }

    @Test fun addMatchOfficial_missing_matchId_is_schema_failure_400() {
        val store = InMemoryMatchOfficialStore()
        val result = addMatchOfficial("", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        check(result is AddMatchOfficialResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun addMatchOfficial_invalid_role_is_schema_failure_400() {
        val store = InMemoryMatchOfficialStore()
        val result = addMatchOfficial("match-1", "official-1", "FOURTH_UMPIRE", store, "user-1", "now", "req-1")
        check(result is AddMatchOfficialResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun addMatchOfficial_is_idempotent_re_adding_exact_same_triple_is_a_no_op() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "2026-10-03T00:00:00Z", "req-1")
        val result = addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-2", "later", "req-2")
        check(result is AddMatchOfficialResult.Added)
        assertEquals("user-1", result.row.createdBy)
        assertEquals("2026-10-03T00:00:00Z", result.row.createdAt)
    }

    @Test fun addMatchOfficial_same_official_may_hold_two_different_roles_as_two_distinct_rows() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        val result = addMatchOfficial("match-1", "official-1", "REFEREE", store, "user-1", "now", "req-2")
        assertTrue(result is AddMatchOfficialResult.Added)
        assertEquals(2, listMatchOfficials("match-1", store).size)
    }

    @Test fun addMatchOfficial_rejects_a_second_HEAD_SCORER_on_the_same_match() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "now", "req-1")
        val result = addMatchOfficial("match-1", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-2")
        check(result is AddMatchOfficialResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun addMatchOfficial_a_second_HEAD_SCORER_is_allowed_on_a_different_match() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "now", "req-1")
        val result = addMatchOfficial("match-2", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-2")
        assertTrue(result is AddMatchOfficialResult.Added)
    }

    @Test fun addMatchOfficial_multiple_ASSISTANT_SCORER_or_UMPIRE_assignments_allowed() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        val result = addMatchOfficial("match-1", "official-2", "UMPIRE", store, "user-1", "now", "req-2")
        assertTrue(result is AddMatchOfficialResult.Added)
    }

    @Test fun getMatchOfficial_returns_row_when_exact_triple_exists() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        assertTrue(getMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1") is GetMatchOfficialResult.Found)
    }

    @Test fun getMatchOfficial_404s_when_role_does_not_match_even_if_matchId_officialId_do() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        val result = getMatchOfficial("match-1", "official-1", "REFEREE", store, "req-1")
        check(result is GetMatchOfficialResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun listMatchOfficials_lists_only_the_given_matchs_panel() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        addMatchOfficial("match-1", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-1")
        addMatchOfficial("match-2", "official-3", "UMPIRE", store, "user-1", "now", "req-1")

        val result = listMatchOfficials("match-1", store)
        assertEquals(listOf("official-1", "official-2"), result.map { it.officialId }.sorted())
    }

    @Test fun listMatchOfficials_an_empty_panel_returns_an_empty_list_not_an_error() {
        val store = InMemoryMatchOfficialStore()
        assertEquals(emptyList(), listMatchOfficials("match-1", store))
    }

    @Test fun removeMatchOfficial_removes_exact_triple_outright_no_gate() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        val result = removeMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1")
        assertTrue(result is RemoveMatchOfficialResult.Removed)
        assertTrue(getMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1") is GetMatchOfficialResult.Rejected)
    }

    @Test fun removeMatchOfficial_404s_when_exact_triple_does_not_exist() {
        val store = InMemoryMatchOfficialStore()
        val result = removeMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1")
        check(result is RemoveMatchOfficialResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun removeMatchOfficial_removing_one_role_leaves_other_role_intact() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "UMPIRE", store, "user-1", "now", "req-1")
        addMatchOfficial("match-1", "official-1", "REFEREE", store, "user-1", "now", "req-2")
        removeMatchOfficial("match-1", "official-1", "UMPIRE", store, "req-1")
        assertTrue(getMatchOfficial("match-1", "official-1", "REFEREE", store, "req-1") is GetMatchOfficialResult.Found)
    }

    @Test fun removeMatchOfficial_after_removing_sole_HEAD_SCORER_a_new_HEAD_SCORER_may_be_added() {
        val store = InMemoryMatchOfficialStore()
        addMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "user-1", "now", "req-1")
        removeMatchOfficial("match-1", "official-1", "HEAD_SCORER", store, "req-1")
        val result = addMatchOfficial("match-1", "official-2", "HEAD_SCORER", store, "user-1", "now", "req-2")
        assertTrue(result is AddMatchOfficialResult.Added)
    }
}
