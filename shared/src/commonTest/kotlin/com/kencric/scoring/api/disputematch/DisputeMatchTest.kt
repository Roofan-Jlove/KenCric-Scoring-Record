package com.kencric.scoring.api.disputematch

import com.kencric.scoring.api.matches.InMemoryMatchStore
import com.kencric.scoring.api.matches.MatchClaimStatus
import com.kencric.scoring.api.matches.MatchFormat
import com.kencric.scoring.api.matches.MatchRow
import com.kencric.scoring.api.matches.MatchState
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0128`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/disputeMatch.test.ts` (`TASK-0123`/`0124`)
 * input-for-input.
 */
class DisputeMatchTest {

    private fun seedMatch(store: InMemoryMatchStore, id: String, state: MatchState): MatchRow {
        val row = MatchRow(
            id = id,
            organizationId = "org-1",
            originDeviceId = "device-1",
            claimStatus = MatchClaimStatus.CLAIMED,
            homeTeamId = "team-A",
            awayTeamId = "team-B",
            format = MatchFormat.T20,
            oversAllotted = 20,
            matchTimezone = "Asia/Karachi",
            state = state,
            rowVersion = 1,
            createdAt = "2026-10-01T00:00:00Z",
            createdBy = "user-1",
            updatedAt = "2026-10-01T00:00:00Z",
            updatedBy = "user-1",
        )
        store.seed(row)
        return row
    }

    @Test fun lockMatchForDispute_locks_an_in_progress_match_for_dispute() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)

        val result = lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "scoring disagreement"), matchStore, disputeStore, "dispute-1", "admin-1", "2026-10-04T00:00:00Z", "req-1")

        check(result is LockMatchForDisputeResult.Locked)
        assertEquals(DisputeStatus.OPEN, result.row.status)
        assertEquals(MatchState.IN_PROGRESS, result.row.lockedFromState)
    }

    @Test fun lockMatchForDispute_transitions_matches_state_to_DISPUTED() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)

        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "scoring disagreement"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")

        assertEquals(MatchState.DISPUTED, matchStore.get("match-1")?.state)
    }

    @Test fun lockMatchForDispute_missing_reason_is_schema_failure_400() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        val result = lockMatchForDispute("match-1", LockMatchForDisputePayload(), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")
        check(result is LockMatchForDisputeResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun lockMatchForDispute_404s_on_an_unknown_match_id() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        val result = lockMatchForDispute("no-such-match", LockMatchForDisputePayload(reason = "x"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")
        check(result is LockMatchForDisputeResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun lockMatchForDispute_rejects_locking_an_already_disputed_match_again_409() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "first"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")

        val result = lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "second"), matchStore, disputeStore, "dispute-2", "admin-1", "later", "req-2")
        check(result is LockMatchForDisputeResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun lockMatchForDispute_rejects_a_second_open_dispute_on_the_same_match_422() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        disputeStore.insert(
            DisputeRow(
                id = "dispute-existing", matchId = "match-1", status = DisputeStatus.OPEN, reason = "earlier",
                lockedFromState = MatchState.IN_PROGRESS, lockedBy = "admin-0", lockedAt = "earlier", rowVersion = 1,
            ),
        )

        val result = lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "second"), matchStore, disputeStore, "dispute-2", "admin-1", "now", "req-1")
        check(result is LockMatchForDisputeResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun adjudicateDispute_adjudicates_an_open_dispute_and_restores_the_matchs_pre_lock_state() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.INNINGS_BREAK)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "scoring disagreement"), matchStore, disputeStore, "dispute-1", "admin-1", "2026-10-04T00:00:00Z", "req-1")

        val result = adjudicateDispute("match-1", AdjudicateDisputePayload(ruling = "Upheld as scored"), matchStore, disputeStore, "admin-2", "2026-10-05T00:00:00Z", "req-2")

        check(result is AdjudicateDisputeResult.Adjudicated)
        assertEquals(DisputeStatus.ADJUDICATED, result.row.status)
        assertEquals("Upheld as scored", result.row.ruling)
        assertEquals(MatchState.INNINGS_BREAK, matchStore.get("match-1")?.state)
    }

    @Test fun adjudicateDispute_records_resultingCorrections_when_provided() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "disagreement"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")

        val result = adjudicateDispute("match-1", AdjudicateDisputePayload(ruling = "Amended", resultingCorrections = listOf("event-1", "event-2")), matchStore, disputeStore, "admin-2", "later", "req-2")
        check(result is AdjudicateDisputeResult.Adjudicated)
        assertEquals(listOf("event-1", "event-2"), result.row.resultingCorrections)
    }

    @Test fun adjudicateDispute_missing_ruling_is_schema_failure_400() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "x"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")

        val result = adjudicateDispute("match-1", AdjudicateDisputePayload(), matchStore, disputeStore, "admin-2", "later", "req-2")
        check(result is AdjudicateDisputeResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun adjudicateDispute_404s_when_no_open_dispute_exists_for_the_match() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)

        val result = adjudicateDispute("match-1", AdjudicateDisputePayload(ruling = "N/A"), matchStore, disputeStore, "admin-2", "later", "req-2")
        check(result is AdjudicateDisputeResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun adjudicateDispute_404s_when_the_dispute_is_already_ADJUDICATED() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "x"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")
        adjudicateDispute("match-1", AdjudicateDisputePayload(ruling = "Upheld"), matchStore, disputeStore, "admin-2", "later", "req-2")

        val result = adjudicateDispute("match-1", AdjudicateDisputePayload(ruling = "second attempt"), matchStore, disputeStore, "admin-3", "even-later", "req-3")
        check(result is AdjudicateDisputeResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun getDispute_returns_the_dispute_when_it_exists() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "x"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")

        val result = getDispute("dispute-1", disputeStore, "req-1")
        check(result is GetDisputeResult.Found)
        assertEquals("dispute-1", result.row.id)
    }

    @Test fun getDispute_404s_on_an_unknown_dispute_id() {
        val disputeStore = InMemoryDisputeStore()
        val result = getDispute("no-such-dispute", disputeStore, "req-1")
        check(result is GetDisputeResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    private fun seedTwoDisputes(matchStore: InMemoryMatchStore, disputeStore: InMemoryDisputeStore) {
        seedMatch(matchStore, "match-1", MatchState.IN_PROGRESS)
        seedMatch(matchStore, "match-2", MatchState.IN_PROGRESS)
        lockMatchForDispute("match-1", LockMatchForDisputePayload(reason = "a"), matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1")
        lockMatchForDispute("match-2", LockMatchForDisputePayload(reason = "b"), matchStore, disputeStore, "dispute-2", "admin-1", "now", "req-2")
    }

    @Test fun listDisputes_lists_every_dispute_with_no_filter() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedTwoDisputes(matchStore, disputeStore)

        val result = listDisputes(ListDisputesQuery(), disputeStore)
        assertEquals(2, result.items.size)
        assertEquals(false, result.hasMore)
    }

    @Test fun listDisputes_filters_by_matchId() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedTwoDisputes(matchStore, disputeStore)

        val result = listDisputes(ListDisputesQuery(matchId = "match-1"), disputeStore)
        assertEquals(1, result.items.size)
        assertEquals("match-1", result.items[0].matchId)
    }

    @Test fun listDisputes_filters_by_status() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedTwoDisputes(matchStore, disputeStore)
        adjudicateDispute("match-1", AdjudicateDisputePayload(ruling = "resolved"), matchStore, disputeStore, "admin-2", "later", "req-3")

        val open = listDisputes(ListDisputesQuery(status = DisputeStatus.OPEN), disputeStore)
        assertEquals(1, open.items.size)
        assertEquals("match-2", open.items[0].matchId)

        val adjudicated = listDisputes(ListDisputesQuery(status = DisputeStatus.ADJUDICATED), disputeStore)
        assertEquals(1, adjudicated.items.size)
        assertEquals("match-1", adjudicated.items[0].matchId)
    }

    @Test fun listDisputes_respects_limit_and_reports_hasMore_nextCursor() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedTwoDisputes(matchStore, disputeStore)

        val result = listDisputes(ListDisputesQuery(limit = 1), disputeStore)
        assertEquals(1, result.items.size)
        assertEquals(true, result.hasMore)
        assertEquals(result.items[0].id, result.nextCursor)
    }

    @Test fun listDisputes_paginates_past_a_cursor_via_after() {
        val matchStore = InMemoryMatchStore()
        val disputeStore = InMemoryDisputeStore()
        seedTwoDisputes(matchStore, disputeStore)

        val first = listDisputes(ListDisputesQuery(limit = 1), disputeStore)
        val second = listDisputes(ListDisputesQuery(limit = 1, after = first.nextCursor), disputeStore)
        assertEquals(1, second.items.size)
        assert(second.items[0].id != first.items[0].id)
        assertEquals(false, second.hasMore)
    }
}
