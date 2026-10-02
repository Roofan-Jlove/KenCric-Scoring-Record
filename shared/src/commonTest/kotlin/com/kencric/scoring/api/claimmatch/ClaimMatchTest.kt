package com.kencric.scoring.api.claimmatch

import com.kencric.scoring.api.matches.InMemoryMatchStore
import com.kencric.scoring.api.matches.MatchClaimStatus
import com.kencric.scoring.api.matches.MatchFormat
import com.kencric.scoring.api.matches.MatchRow
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * `TASK-0115`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/claimMatch.test.ts` (`TASK-0102`) input-for-input.
 * Seeds via directly constructing a `MatchRow` (no `createMatch` port
 * exists in this cluster -- see `matches.ts`'s own Kotlin doc comment)
 * rather than going through a ported create function, since the TS
 * test's own `seedGuestMatch` only cares about the resulting row
 * shape, not `createMatch`'s own validation path.
 */
class ClaimMatchTest {

    private fun seedGuestMatch(store: InMemoryMatchStore): MatchRow {
        val row = MatchRow(
            id = "match-1",
            organizationId = null,
            originDeviceId = "device-1",
            claimStatus = MatchClaimStatus.GUEST,
            homeTeamId = "team-A",
            awayTeamId = "team-B",
            format = MatchFormat.T20,
            matchTimezone = "Asia/Karachi",
            rowVersion = 1,
            createdAt = "2026-10-03T00:00:00Z",
            createdBy = "guest-user-1",
            updatedAt = "2026-10-03T00:00:00Z",
            updatedBy = "guest-user-1",
        )
        store.seed(row)
        return row
    }

    @Test fun claimMatch_claims_a_guest_match_binding_organizationId_without_touching_provenance() {
        val matchStore = InMemoryMatchStore()
        val idempotencyStore = InMemoryIdempotencyStore()
        seedGuestMatch(matchStore)

        val result = claimMatch("match-1", ClaimMatchPayload(organizationId = "org-1"), matchStore, idempotencyStore, "user-2", "later", "key-1", "req-1")

        check(result is ClaimMatchResult.Claimed)
        assertEquals(MatchClaimStatus.CLAIMED, result.row.claimStatus)
        assertEquals("org-1", result.row.organizationId)
        assertEquals(2, result.row.rowVersion)
        assertEquals("user-2", result.row.updatedBy)
        assertEquals("device-1", result.row.originDeviceId)
        assertEquals("guest-user-1", result.row.createdBy)
        assertEquals("2026-10-03T00:00:00Z", result.row.createdAt)
        assertEquals("match-1", result.row.id)
    }

    @Test fun claimMatch_null_organizationId_claims_personally_not_org_owned() {
        val matchStore = InMemoryMatchStore()
        seedGuestMatch(matchStore)

        val result = claimMatch("match-1", ClaimMatchPayload(organizationId = null), matchStore, InMemoryIdempotencyStore(), "user-2", "later", "key-1", "req-1")
        check(result is ClaimMatchResult.Claimed)
        assertEquals(MatchClaimStatus.CLAIMED, result.row.claimStatus)
        assertNull(result.row.organizationId)
    }

    @Test fun claimMatch_404s_on_a_missing_match() {
        val matchStore = InMemoryMatchStore()
        val result = claimMatch("no-such-match", ClaimMatchPayload(organizationId = "org-1"), matchStore, InMemoryIdempotencyStore(), "user-1", "now", "key-1", "req-1")
        check(result is ClaimMatchResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun claimMatch_replaying_same_key_returns_identical_prior_result() {
        val matchStore = InMemoryMatchStore()
        val idempotencyStore = InMemoryIdempotencyStore()
        seedGuestMatch(matchStore)

        val first = claimMatch("match-1", ClaimMatchPayload(organizationId = "org-1"), matchStore, idempotencyStore, "user-2", "2026-10-03T01:00:00Z", "key-1", "req-1")
        val second = claimMatch("match-1", ClaimMatchPayload(organizationId = "org-99"), matchStore, idempotencyStore, "user-3", "much-later", "key-1", "req-2")

        assertEquals(first, second)
        check(second is ClaimMatchResult.Claimed)
        assertEquals("org-1", second.row.organizationId)
        assertEquals("user-2", second.row.updatedBy)
    }

    @Test fun claimMatch_a_key_that_previously_failed_is_reprocessed_fresh_on_retry() {
        val matchStore = InMemoryMatchStore()
        val idempotencyStore = InMemoryIdempotencyStore()

        val first = claimMatch("match-1", ClaimMatchPayload(organizationId = "org-1"), matchStore, idempotencyStore, "user-1", "now", "key-1", "req-1")
        check(first is ClaimMatchResult.Rejected)

        seedGuestMatch(matchStore)
        val second = claimMatch("match-1", ClaimMatchPayload(organizationId = "org-1"), matchStore, idempotencyStore, "user-1", "later", "key-1", "req-2")
        check(second is ClaimMatchResult.Claimed)
    }

    @Test fun claimMatch_a_genuinely_new_claim_attempt_against_already_claimed_match_is_rejected() {
        val matchStore = InMemoryMatchStore()
        seedGuestMatch(matchStore)

        claimMatch("match-1", ClaimMatchPayload(organizationId = "org-1"), matchStore, InMemoryIdempotencyStore(), "user-2", "now", "key-1", "req-1")

        val result = claimMatch("match-1", ClaimMatchPayload(organizationId = "org-2"), matchStore, InMemoryIdempotencyStore(), "user-3", "later", "key-2", "req-2")
        check(result is ClaimMatchResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals("org-1", matchStore.get("match-1")?.organizationId)
    }
}
