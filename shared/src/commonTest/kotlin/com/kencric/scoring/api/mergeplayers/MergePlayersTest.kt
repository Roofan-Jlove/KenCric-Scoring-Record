package com.kencric.scoring.api.mergeplayers

import com.kencric.scoring.api.players.InMemoryPlayerStore
import com.kencric.scoring.api.players.PlayerRow
import com.kencric.scoring.api.players.PlayerStatus
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0127`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/mergePlayers.test.ts` (`TASK-0121`) input-for-input.
 */
class MergePlayersTest {

    private fun seedPlayer(
        store: InMemoryPlayerStore,
        id: String,
        status: PlayerStatus = PlayerStatus.ACTIVE,
        mergedIntoPlayerId: String? = null,
    ): PlayerRow {
        val row = PlayerRow(
            id = id,
            organizationId = "org-1",
            name = id,
            dob = null,
            photoRef = null,
            status = status,
            mergedIntoPlayerId = mergedIntoPlayerId,
            rowVersion = 1,
            createdAt = "2026-10-01T00:00:00Z",
            createdBy = "admin-1",
            updatedAt = "2026-10-01T00:00:00Z",
            updatedBy = "admin-1",
        )
        store.insert(row)
        return row
    }

    @Test fun mergePlayers_merges_a_duplicate_with_no_conflicting_appearances() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        seedPlayer(store, "player-loser")
        val lookup = InMemoryPlayerAppearanceLookup()
        lookup.seed("player-survivor", listOf("2026-09-01"))
        lookup.seed("player-loser", listOf("2026-08-01"))

        val result = mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate registration"), store, lookup, "admin-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is MergePlayersResult.Merged)
        assertEquals("player-survivor", result.row.id)
        assertEquals(PlayerStatus.ACTIVE, result.row.status)
    }

    @Test fun mergePlayers_marks_the_losing_player_MERGED_with_mergedIntoPlayerId_set() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        seedPlayer(store, "player-loser")
        val lookup = InMemoryPlayerAppearanceLookup()

        mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, lookup, "admin-1", "2026-10-03T00:00:00Z", "req-1")

        val loser = store.get("player-loser")
        assertEquals(PlayerStatus.MERGED, loser?.status)
        assertEquals("player-survivor", loser?.mergedIntoPlayerId)
        assertEquals(2, loser?.rowVersion)
    }

    @Test fun mergePlayers_does_not_modify_the_surviving_players_own_row() {
        val store = InMemoryPlayerStore()
        val survivor = seedPlayer(store, "player-survivor")
        seedPlayer(store, "player-loser")
        val lookup = InMemoryPlayerAppearanceLookup()

        mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, lookup, "admin-1", "2026-10-03T00:00:00Z", "req-1")

        assertEquals(survivor, store.get("player-survivor"))
    }

    @Test fun mergePlayers_missing_losingPlayerId_is_schema_failure_400() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        val result = mergePlayers("player-survivor", MergePlayersPayload(reason = "duplicate"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun mergePlayers_missing_reason_is_schema_failure_400() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        seedPlayer(store, "player-loser")
        val result = mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun mergePlayers_merging_a_player_into_itself_is_business_rule_failure_422() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-1")
        val result = mergePlayers("player-1", MergePlayersPayload(losingPlayerId = "player-1", reason = "oops"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun mergePlayers_404s_on_an_unknown_surviving_player_id() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-loser")
        val result = mergePlayers("no-such-player", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun mergePlayers_404s_on_an_unknown_losing_player_id() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        val result = mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "no-such-player", reason = "duplicate"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun mergePlayers_rejects_merging_into_an_already_merged_surviving_player_409() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor", status = PlayerStatus.MERGED, mergedIntoPlayerId = "player-ultimate")
        seedPlayer(store, "player-loser")
        val result = mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun mergePlayers_rejects_merging_an_already_merged_losing_player_again_409() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        seedPlayer(store, "player-loser", status = PlayerStatus.MERGED, mergedIntoPlayerId = "player-other")
        val result = mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun mergePlayers_rejects_a_merge_with_overlapping_appearance_dates_naming_conflicting_dates_422() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        seedPlayer(store, "player-loser")
        val lookup = InMemoryPlayerAppearanceLookup()
        lookup.seed("player-survivor", listOf("2026-09-01", "2026-09-15"))
        lookup.seed("player-loser", listOf("2026-09-15", "2026-09-20"))

        val result = mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, lookup, "admin-1", "now", "req-1")
        check(result is MergePlayersResult.Rejected)
        assertEquals(422, result.problem.status)
        assertEquals(true, result.problem.detail.contains("2026-09-15"))
    }

    @Test fun mergePlayers_does_not_mutate_the_losing_players_row_when_rejected_for_a_date_conflict() {
        val store = InMemoryPlayerStore()
        seedPlayer(store, "player-survivor")
        val loser = seedPlayer(store, "player-loser")
        val lookup = InMemoryPlayerAppearanceLookup()
        lookup.seed("player-survivor", listOf("2026-09-15"))
        lookup.seed("player-loser", listOf("2026-09-15"))

        mergePlayers("player-survivor", MergePlayersPayload(losingPlayerId = "player-loser", reason = "duplicate"), store, lookup, "admin-1", "now", "req-1")

        assertEquals(loser, store.get("player-loser"))
    }
}
