package com.kencric.scoring.api.players

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0109`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/players.test.ts` (`TASK-0096`) input-for-input.
 */
class PlayersTest {

    private fun validPayload(
        id: String = "player-1",
        organizationId: String? = "org-1",
        name: String = "Alex Rivera",
        dob: String? = null,
        photoRef: String? = null,
    ): CreatePlayerPayload = CreatePlayerPayload(id = id, organizationId = organizationId, name = name, dob = dob, photoRef = photoRef)

    private fun seedPlayer(
        store: InMemoryPlayerStore,
        id: String = "player-1",
        organizationId: String? = "org-1",
        name: String = "Alex Rivera",
        photoRef: String? = null,
    ): PlayerRow {
        val result = createPlayer(validPayload(id, organizationId, name, photoRef = photoRef), store, "user-1", "2026-10-03T00:00:00Z", "req-seed")
        check(result is CreatePlayerResult.Created) { "seed failed" }
        return result.row
    }

    // createPlayer
    @Test fun createPlayer_valid_payload_creates_row_always_ACTIVE_and_unmerged() {
        val store = InMemoryPlayerStore()
        val result = createPlayer(validPayload(), store, "user-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is CreatePlayerResult.Created)
        assertEquals(PlayerStatus.ACTIVE, result.row.status)
        assertNull(result.row.mergedIntoPlayerId)
        assertNull(result.row.dob)
        assertEquals(1, result.row.rowVersion)
        assertEquals("user-1", result.row.createdBy)
    }

    @Test fun createPlayer_null_organizationId_creates_local_ad_hoc_player() {
        val store = InMemoryPlayerStore()
        val result = createPlayer(validPayload(organizationId = null), store, "user-1", "now", "req-1")
        check(result is CreatePlayerResult.Created)
        assertNull(result.row.organizationId)
    }

    @Test fun createPlayer_accepts_optional_dob_and_photoRef() {
        val store = InMemoryPlayerStore()
        val result = createPlayer(validPayload(dob = "2010-05-01", photoRef = "photo-1"), store, "user-1", "now", "req-1")
        check(result is CreatePlayerResult.Created)
        assertEquals("2010-05-01", result.row.dob)
        assertEquals("photo-1", result.row.photoRef)
    }

    @Test fun createPlayer_missing_name_is_schema_failure_400() {
        val store = InMemoryPlayerStore()
        val result = createPlayer(CreatePlayerPayload(id = "player-1", name = ""), store, "user-1", "now", "req-1")
        check(result is CreatePlayerResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createPlayer_id_already_exists_is_rejected() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        val result = createPlayer(validPayload(), store, "user-1", "now", "req-1")
        assertTrue(result is CreatePlayerResult.Rejected)
    }

    @Test fun createPlayer_has_no_way_to_set_status_or_mergedIntoPlayerId() {
        // CreatePlayerPayload structurally has no status/mergedIntoPlayerId fields at all.
        val store = InMemoryPlayerStore()
        val result = createPlayer(validPayload(), store, "user-1", "now", "req-1")
        check(result is CreatePlayerResult.Created)
        assertEquals(PlayerStatus.ACTIVE, result.row.status)
        assertNull(result.row.mergedIntoPlayerId)
    }

    // updatePlayer
    @Test fun updatePlayer_valid_update_succeeds_and_increments_row_version_by_exactly_1() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        val result = updatePlayer("player-1", UpdatePlayerPayload(rowVersion = 1, name = "Alexandra Rivera"), store, "user-2", "later", "req-1")
        check(result is UpdatePlayerResult.Updated)
        assertEquals("Alexandra Rivera", result.row.name)
        assertEquals(2, result.row.rowVersion)
    }

    @Test fun updatePlayer_only_fields_present_in_payload_change() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, photoRef = "old-photo")
        val result = updatePlayer("player-1", UpdatePlayerPayload(rowVersion = 1, name = "New Name"), store, "user-1", "later", "req-1")
        check(result is UpdatePlayerResult.Updated)
        assertEquals("New Name", result.row.name)
        assertEquals("old-photo", result.row.photoRef)
    }

    @Test fun updatePlayer_non_existent_id_is_404() {
        val store = InMemoryPlayerStore()
        val result = updatePlayer("no-such-player", UpdatePlayerPayload(rowVersion = 1), store, "user-1", "now", "req-1")
        check(result is UpdatePlayerResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun updatePlayer_missing_row_version_is_schema_failure_400() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        val result = updatePlayer("player-1", UpdatePlayerPayload(), store, "user-1", "now", "req-1")
        check(result is UpdatePlayerResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun updatePlayer_stale_row_version_rejected_409_stored_row_unchanged() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        val result = updatePlayer("player-1", UpdatePlayerPayload(rowVersion = 999, name = "Should not apply"), store, "user-1", "now", "req-1")
        check(result is UpdatePlayerResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals("Alex Rivera", store.get("player-1")?.name)
    }

    @Test fun updatePlayer_empty_name_in_payload_is_rejected() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        val result = updatePlayer("player-1", UpdatePlayerPayload(rowVersion = 1, name = ""), store, "user-1", "now", "req-1")
        check(result is UpdatePlayerResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun updatePlayer_has_no_way_to_set_status_or_mergedIntoPlayerId() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        val result = updatePlayer("player-1", UpdatePlayerPayload(rowVersion = 1), store, "user-1", "now", "req-1")
        check(result is UpdatePlayerResult.Updated)
        assertEquals(PlayerStatus.ACTIVE, result.row.status)
        assertNull(result.row.mergedIntoPlayerId)
    }

    // getPlayer
    @Test fun getPlayer_returns_row_when_it_exists() {
        val store = InMemoryPlayerStore()
        seedPlayer(store)
        assertTrue(getPlayer("player-1", store, "req-1") is GetPlayerResult.Found)
    }

    @Test fun getPlayer_404s_when_id_does_not_exist() {
        val store = InMemoryPlayerStore()
        val result = getPlayer("no-such-player", store, "req-1")
        check(result is GetPlayerResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    // listPlayers
    @Test fun listPlayers_returns_items_ordered_by_id_ascending() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, id = "player-b", name = "Beta")
        seedPlayer(store, id = "player-a", name = "Alpha")
        val result = listPlayers(ListPlayersQuery(), store)
        assertEquals(listOf("player-a", "player-b"), result.items.map { it.id })
    }

    @Test fun listPlayers_filters_by_organizationId() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, id = "player-a", organizationId = "org-1")
        seedPlayer(store, id = "player-b", organizationId = "org-2")
        val result = listPlayers(ListPlayersQuery(organizationId = "org-1"), store)
        assertEquals(listOf("player-a"), result.items.map { it.id })
    }

    @Test fun listPlayers_filters_by_nameSearch_case_insensitively() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, id = "player-a", name = "Alex Rivera")
        seedPlayer(store, id = "player-b", name = "Harbour Smith")
        val result = listPlayers(ListPlayersQuery(nameSearch = "rivera"), store)
        assertEquals(listOf("player-a"), result.items.map { it.id })
    }

    @Test fun listPlayers_respects_limit_and_reports_hasMore_nextCursor() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, id = "player-a")
        seedPlayer(store, id = "player-b")
        seedPlayer(store, id = "player-c")
        val result = listPlayers(ListPlayersQuery(limit = 2), store)
        assertEquals(listOf("player-a", "player-b"), result.items.map { it.id })
        assertTrue(result.hasMore)
        assertEquals("player-b", result.nextCursor)
    }
}
