package com.kencric.scoring.api.squadmembers

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0110`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/squadMembers.test.ts` (`TASK-0097`) input-for-input.
 */
class SquadMembersTest {

    @Test fun addSquadMember_valid_add_creates_row_with_server_assigned_provenance() {
        val store = InMemorySquadMemberStore()
        val result = addSquadMember("team-1", "player-1", "wicketkeeper-batter", store, "user-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is AddSquadMemberResult.Added)
        assertEquals("wicketkeeper-batter", result.row.roleHint)
        assertEquals("user-1", result.row.createdBy)
        assertEquals("2026-10-03T00:00:00Z", result.row.createdAt)
    }

    @Test fun addSquadMember_roleHint_is_optional_and_defaults_to_null() {
        val store = InMemorySquadMemberStore()
        val result = addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1")
        check(result is AddSquadMemberResult.Added)
        assertNull(result.row.roleHint)
    }

    @Test fun addSquadMember_missing_teamId_is_schema_failure_400() {
        val store = InMemorySquadMemberStore()
        val result = addSquadMember("", "player-1", null, store, "user-1", "now", "req-1")
        check(result is AddSquadMemberResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun addSquadMember_missing_playerId_is_schema_failure_400() {
        val store = InMemorySquadMemberStore()
        val result = addSquadMember("team-1", "", null, store, "user-1", "now", "req-1")
        check(result is AddSquadMemberResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun addSquadMember_is_idempotent_never_409s_preserves_original_provenance() {
        val store = InMemorySquadMemberStore()
        addSquadMember("team-1", "player-1", "opener", store, "user-1", "2026-10-03T00:00:00Z", "req-1")
        val result = addSquadMember("team-1", "player-1", "middle-order", store, "user-2", "2026-10-03T05:00:00Z", "req-2")

        check(result is AddSquadMemberResult.Added)
        assertEquals("middle-order", result.row.roleHint)
        assertEquals("user-1", result.row.createdBy)
        assertEquals("2026-10-03T00:00:00Z", result.row.createdAt)
    }

    @Test fun addSquadMember_same_player_may_belong_to_different_teams_squads_independently() {
        val store = InMemorySquadMemberStore()
        addSquadMember("team-1", "player-1", "opener", store, "user-1", "now", "req-1")
        val result = addSquadMember("team-2", "player-1", "bowler", store, "user-1", "now", "req-2")
        assertTrue(result is AddSquadMemberResult.Added)
        assertEquals("opener", store.get("team-1", "player-1")?.roleHint)
    }

    @Test fun getSquadMember_returns_row_when_it_exists() {
        val store = InMemorySquadMemberStore()
        addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1")
        assertTrue(getSquadMember("team-1", "player-1", store, "req-1") is GetSquadMemberResult.Found)
    }

    @Test fun getSquadMember_404s_when_pair_does_not_exist() {
        val store = InMemorySquadMemberStore()
        val result = getSquadMember("team-1", "no-such-player", store, "req-1")
        check(result is GetSquadMemberResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun listSquadMembers_lists_only_the_given_teams_squad() {
        val store = InMemorySquadMemberStore()
        addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1")
        addSquadMember("team-1", "player-2", null, store, "user-1", "now", "req-1")
        addSquadMember("team-2", "player-3", null, store, "user-1", "now", "req-1")

        val result = listSquadMembers("team-1", store)
        assertEquals(listOf("player-1", "player-2"), result.map { it.playerId }.sorted())
    }

    @Test fun listSquadMembers_an_empty_squad_returns_an_empty_list_not_an_error() {
        val store = InMemorySquadMemberStore()
        assertEquals(emptyList(), listSquadMembers("team-1", store))
    }

    @Test fun removeSquadMember_removes_the_pair_outright_no_gate() {
        val store = InMemorySquadMemberStore()
        addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1")
        val result = removeSquadMember("team-1", "player-1", store, "req-1")
        assertTrue(result is RemoveSquadMemberResult.Removed)
        assertNull(store.get("team-1", "player-1"))
    }

    @Test fun removeSquadMember_404s_when_pair_does_not_exist() {
        val store = InMemorySquadMemberStore()
        val result = removeSquadMember("team-1", "no-such-player", store, "req-1")
        check(result is RemoveSquadMemberResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun removeSquadMember_removing_one_teams_entry_never_affects_another_team() {
        val store = InMemorySquadMemberStore()
        addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1")
        addSquadMember("team-2", "player-1", null, store, "user-1", "now", "req-1")
        removeSquadMember("team-1", "player-1", store, "req-1")
        assertNotNull(store.get("team-2", "player-1"))
    }
}
