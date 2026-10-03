package com.kencric.scoring.api.divergenceresolution

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0129`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/divergenceResolution.test.ts` (`TASK-0125`)
 * input-for-input.
 */
class DivergenceResolutionTest {

    private fun seedOpenDivergence(store: InMemoryDivergenceStore): DivergenceRecord {
        val record = DivergenceRecord(
            matchId = "match-1",
            overBall = "8.3",
            field = "runs",
            streamAId = "stream-A",
            streamBId = "stream-B",
            valueA = 1,
            valueB = 4,
            status = DivergenceStatus.OPEN,
        )
        return store.insertSeed(record)
    }

    @Test fun proposeDivergenceResolution_proposes_a_resolution_for_an_OPEN_divergence() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)

        val result = proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")

        check(result is ProposeDivergenceResolutionResult.Proposed)
        assertEquals(DivergenceStatus.PROPOSED, result.row.status)
        assertEquals(4, result.row.proposedValue)
        assertEquals("scorer-A", result.row.proposedBy)
    }

    @Test fun proposeDivergenceResolution_missing_proposedValue_is_schema_failure_400() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        val result = proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(), "scorer-A", store, "req-1")
        check(result is ProposeDivergenceResolutionResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun proposeDivergenceResolution_404s_on_an_unknown_divergence_id() {
        val store = InMemoryDivergenceStore()
        val result = proposeDivergenceResolution("no-such-divergence", ProposeDivergenceResolutionPayload(proposedValue = 1), "scorer-A", store, "req-1")
        check(result is ProposeDivergenceResolutionResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun proposeDivergenceResolution_rejects_proposing_on_an_already_PROPOSED_divergence_409() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")

        val result = proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 1), "scorer-B", store, "req-2")
        check(result is ProposeDivergenceResolutionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun proposeDivergenceResolution_rejects_proposing_on_an_already_RESOLVED_divergence_409() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")
        confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(resolvedEventId = "event-1"), "scorer-B", store, "req-2")

        val result = proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 1), "scorer-A", store, "req-3")
        check(result is ProposeDivergenceResolutionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun confirmDivergenceResolution_confirms_a_PROPOSED_divergence_with_a_distinct_scorer() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")

        val result = confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(resolvedEventId = "event-1"), "scorer-B", store, "req-2")

        check(result is ConfirmDivergenceResolutionResult.Confirmed)
        assertEquals(DivergenceStatus.RESOLVED, result.row.status)
        assertEquals("scorer-B", result.row.confirmedBy)
        assertEquals("event-1", result.row.resolvedEventId)
        assertEquals("scorer-A", result.row.proposedBy)
    }

    @Test fun confirmDivergenceResolution_missing_resolvedEventId_is_schema_failure_400() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")

        val result = confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(), "scorer-B", store, "req-2")
        check(result is ConfirmDivergenceResolutionResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun confirmDivergenceResolution_404s_on_an_unknown_divergence_id() {
        val store = InMemoryDivergenceStore()
        val result = confirmDivergenceResolution("no-such-divergence", ConfirmDivergenceResolutionPayload(resolvedEventId = "event-1"), "scorer-B", store, "req-1")
        check(result is ConfirmDivergenceResolutionResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun confirmDivergenceResolution_rejects_confirming_a_still_OPEN_divergence_409() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        val result = confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(resolvedEventId = "event-1"), "scorer-B", store, "req-1")
        check(result is ConfirmDivergenceResolutionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun confirmDivergenceResolution_rejects_confirming_an_already_RESOLVED_divergence_409() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")
        confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(resolvedEventId = "event-1"), "scorer-B", store, "req-2")

        val result = confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(resolvedEventId = "event-2"), "scorer-B", store, "req-3")
        check(result is ConfirmDivergenceResolutionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun confirmDivergenceResolution_rejects_when_confirmedBy_matches_proposedBy_422() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")

        val result = confirmDivergenceResolution(seeded.id!!, ConfirmDivergenceResolutionPayload(resolvedEventId = "event-1"), "scorer-A", store, "req-2")
        check(result is ConfirmDivergenceResolutionResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun neither_log_changes_while_only_proposed_not_yet_confirmed() {
        val store = InMemoryDivergenceStore()
        val seeded = seedOpenDivergence(store)
        proposeDivergenceResolution(seeded.id!!, ProposeDivergenceResolutionPayload(proposedValue = 4), "scorer-A", store, "req-1")

        val row = store.get(seeded.id!!)
        assertEquals(1, row?.valueA)
        assertEquals(4, row?.valueB)
        assertEquals(DivergenceStatus.PROPOSED, row?.status)
    }
}
