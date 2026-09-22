package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.BatterStatus
import com.kencric.scoring.core.model.BowlerCardLine
import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import com.kencric.scoring.core.model.creditsBowler

/**
 * live-scoring.md §18.1: "Undo is defined once, uniformly... there is no
 * per-delivery-type reversal logic." Undo IS `foldInnings` applied to
 * one fewer active delivery -- this file is the actual Steps 5-11
 * orchestration every prior E-09..E-13 task's pure functions were built
 * to be composed into, deferred until this task by every one of them
 * (see each task's own "orchestration is out of scope" notes).
 *
 * HONEST SCOPE BOUNDARY: Step 1 (validation, `§5`/`TASK-0017`) is
 * deliberately NOT re-run during a fold -- §18.1's own step list names
 * "Steps 5-11" only, and the deliveries being folded are, by
 * construction, already-validated active events; re-validating them is
 * out of this function's scope. Steps 2-4 (legality classification, run
 * aggregation, short-run adjustment) ARE recomputed here, but only as
 * pure derivations feeding Steps 5-11's inputs -- they update no
 * projection of their own, so §18.1's text doesn't name them separately.
 */
fun updateFreeHitPending(current: Boolean, legality: Legality, freeHitOnNoBall: Boolean): Boolean = when (legality) {
    // §13.4: set true when a NO_BALL occurs under a profile that grants
    // it; an *existing* pending flag persists across a further NO_BALL
    // regardless of this delivery's own freeHitOnNoBall value -- the OR
    // captures both without double logic.
    Legality.NO_BALL -> current || freeHitOnNoBall
    // §13.4: "persists unchanged across any further WIDE."
    Legality.WIDE -> current
    // §13.4: "consumed... by the next LEGAL delivery, regardless of outcome."
    Legality.LEGAL -> false
    // Not explicitly addressed by §13.4's own text (§6.4: DEAD_BALL
    // short-circuits everything) -- treated as a no-op pass-through
    // rather than silently assumed to behave like LEGAL or WIDE.
    Legality.DEAD_BALL -> current
}

/**
 * Applies one delivery to a fold-in-progress. Returns [state] unchanged
 * if the innings has already ended -- §15's own text: "no further
 * `DeliveryInput` is accepted" once ended; a well-formed active event
 * stream should never contain a delivery after that point, but this is
 * a defensive no-op rather than an undefined result if it ever does.
 */
fun applyDelivery(state: InningsFoldState, delivery: DeliveryInput, config: FoldConfig): InningsFoldState {
    if (state.inningsEndReason != null) return state

    val classification = classifyLegality(delivery.legality)
    val adjustedRunEvents = applyShortRuns(delivery.runEvents, delivery.shortRuns)
    val aggregate = aggregateRuns(adjustedRunEvents)
    delivery.wicket?.let { assertWicketRunInvariant(it.mode, aggregate) }

    // Steps 6/7: batter/bowler state. A card line is created fresh the
    // first time a playerId is seen (§10/§11 don't require pre-seeding).
    val strikerLine = state.batterCardLines[state.strikerBatterId] ?: BatterCardLine(state.strikerBatterId)
    val updatedStrikerLine = updateBatterCardLine(strikerLine, aggregate, classification.incrementsStrikerBallsFaced, adjustedRunEvents)

    val bowlerLine = state.bowlerCardLines[delivery.bowlerId] ?: BowlerCardLine(delivery.bowlerId)
    val creditsWicket = delivery.wicket?.let { creditsBowler(it.mode) } ?: false
    val updatedBowlerLine = updateBowlerCardLine(bowlerLine, delivery.legality, aggregate, classification.consumesLegalBallSlot, creditsWicket)

    var batterCardLines = state.batterCardLines + (state.strikerBatterId to updatedStrikerLine)
    val bowlerCardLines = state.bowlerCardLines + (delivery.bowlerId to updatedBowlerLine)

    // Steps 8/9: team/over state. If the PREVIOUS delivery already
    // completed the over (legalBallCount reached ballsPerOver),
    // start a fresh OverState for this one first -- updateOverState()
    // deliberately never does this itself (OverState's own doc comment:
    // constructing the next over is the caller's job, once the next
    // bowler is known, which by this point it is: delivery.bowlerId).
    val newScore = updateInningsScoreState(
        state.score, adjustedRunEvents, aggregate, config.bowlingTeamId,
        classification.consumesLegalBallSlot, delivery.wicket?.mode,
    )
    val overBeforeThisDelivery = if (state.over.legalBallCount == config.profile.ballsPerOver) {
        OverState(overNumber = state.over.overNumber + 1, bowlerId = delivery.bowlerId)
    } else {
        state.over
    }
    val overResult = updateOverState(overBeforeThisDelivery, delivery.legality, classification.consumesLegalBallSlot, aggregate, config.profile)

    // Step 5/9.5: wicket resolution -- outgoing batter's status, and,
    // if a replacement exists, which end the incoming batter occupies.
    // §14.3: dismissedBatterOriginalEnd is this delivery's PRE-delivery
    // striker/non-striker assignment (TASK-0043's own documented
    // contract); crossedBeforeDismissal already captures the net
    // physical-crossing fact for the whole delivery up to the instant
    // of dismissal, so no separate pre-application of the run-rotation
    // formula is needed before calling resolveEndPositions.
    var strikerBatterId = state.strikerBatterId
    var nonStrikerBatterId = state.nonStrikerBatterId
    val wicket = delivery.wicket
    if (wicket != null) {
        val outgoingLine = batterCardLines[wicket.outBatterId] ?: BatterCardLine(wicket.outBatterId)
        batterCardLines = batterCardLines + (wicket.outBatterId to outgoingLine.copy(status = BatterStatus.OUT))

        val incomingId = wicket.incomingBatterId
        if (incomingId != null) {
            val dismissedOriginalEnd = if (wicket.outBatterId == strikerBatterId) CreaseEnd.STRIKER else CreaseEnd.NON_STRIKER
            val resolution = resolveEndPositions(wicket.mode, dismissedOriginalEnd, wicket.endVacated, wicket.crossedBeforeDismissal)
            val survivorId = if (wicket.outBatterId == strikerBatterId) nonStrikerBatterId else strikerBatterId
            batterCardLines = batterCardLines + (incomingId to BatterCardLine(incomingId))

            if (resolution.newBatterEnd == CreaseEnd.STRIKER) {
                strikerBatterId = incomingId
                nonStrikerBatterId = survivorId
            } else {
                strikerBatterId = survivorId
                nonStrikerBatterId = incomingId
            }
            // §14.3 step 3: the end-of-over swap still applies on top of
            // the wicket-resolved pairing, exactly as it would for a
            // non-wicket delivery. UNVERIFIED AGAINST A WORKED EXAMPLE:
            // no §22 case combines a wicket with the over's final ball --
            // this is this function's best-supported literal reading of
            // §14.3 step 3's text, flagged rather than silently assumed.
            if (overResult.isOverComplete) {
                val swapped = applyStrikeRotation(StrikePositions(strikerBatterId, nonStrikerBatterId), netRotates = true)
                strikerBatterId = swapped.strikerBatterId
                nonStrikerBatterId = swapped.nonStrikerBatterId
            }
        }
        // incomingId == null: the innings ends on this wicket (§9.2) --
        // strike positions become moot; evaluateInningsEnd below will
        // in practice already have wicketsLost reach the threshold.
    } else {
        // Step 10: normal (non-wicket) strike resolution.
        val netRotates = resolvesStrikeRotation(aggregate.ranRuns, overResult.isOverComplete)
        val positions = applyStrikeRotation(StrikePositions(strikerBatterId, nonStrikerBatterId), netRotates)
        strikerBatterId = positions.strikerBatterId
        nonStrikerBatterId = positions.nonStrikerBatterId
    }

    val newFreeHitPending = updateFreeHitPending(state.freeHitPending, delivery.legality, config.profile.freeHitOnNoBall)

    // Step 11: innings-end evaluation.
    val retiredOrAbsentCount = batterCardLines.values.count {
        it.status == BatterStatus.RETIRED_NOT_OUT || it.status == BatterStatus.ABSENT
    }
    val endReason = evaluateInningsEnd(
        newScore.wicketsLost, config.maxWicketsPerInnings, retiredOrAbsentCount,
        newScore.legalBallsBowled, config.oversAllotted, config.profile.ballsPerOver,
        newScore.totalRuns, config.target,
    )

    return InningsFoldState(
        batterCardLines = batterCardLines,
        bowlerCardLines = bowlerCardLines,
        score = newScore,
        over = overResult.overState,
        strikerBatterId = strikerBatterId,
        nonStrikerBatterId = nonStrikerBatterId,
        freeHitPending = newFreeHitPending,
        inningsEndReason = endReason,
    )
}

/** §18.1 step 3: recompute every projection by folding the active event set from the start of the innings. */
fun foldInnings(initialState: InningsFoldState, deliveries: List<DeliveryInput>, config: FoldConfig): InningsFoldState =
    deliveries.fold(initialState) { state, delivery -> applyDelivery(state, delivery, config) }

/**
 * §18.1: undo voids the most recent active event and refolds. Since
 * `deliveries` is already the *active* (non-voided) ordered list for
 * this innings, undoing the most recent one is exactly folding over
 * every delivery except the last -- no delivery-type-specific reversal.
 */
fun undoLastDelivery(initialState: InningsFoldState, deliveries: List<DeliveryInput>, config: FoldConfig): InningsFoldState =
    foldInnings(initialState, deliveries.dropLast(1), config)
