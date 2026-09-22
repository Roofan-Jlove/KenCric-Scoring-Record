package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.*

/**
 * live-scoring.md §5, Step 1: field-level and cross-field checks that run
 * after guardrails pass (§4, NOT this task's scope -- see the V10 note
 * below) and before any state mutation. All eleven must pass for the
 * delivery to be accepted; ALL failures are collected and returned
 * together (not just the first), so a rejected input's every problem is
 * visible at once, not discovered one submission at a time.
 */
fun validateDelivery(input: DeliveryInput, battingContext: BattingContext): ValidationResult {
    val failures = mutableListOf<ValidationFailure>()

    // V1: legality in the four allowed values. Structurally guaranteed by
    // the Legality enum -- Kotlin cannot construct a DeliveryInput with
    // any other value. Included as a no-op for completeness of "each of
    // V1-V11 is independently testable," per this task's Expected
    // behavior -- not because it can ever actually fail.

    // V2: every RunEvent.value >= 0; every (origin, method) pair valid.
    for ((index, runEvent) in input.runEvents.withIndex()) {
        if (runEvent.value < 0) {
            failures.add(ValidationFailure(ValidationRule.V2, "runEvents[$index].value must be >= 0"))
        }
        if (!isValidOriginMethodPair(runEvent.origin, runEvent.method)) {
            failures.add(
                ValidationFailure(
                    ValidationRule.V2,
                    "runEvents[$index]: (${runEvent.origin}, ${runEvent.method}) is not a valid pair (§7.3)",
                ),
            )
        }
    }

    // V3: shortRuns <= sum of RUN-method values.
    val runMethodTotal = input.runEvents
        .filter { it.method == RunEventMethod.RUN }
        .sumOf { it.value }
    if (input.shortRuns > runMethodTotal) {
        failures.add(
            ValidationFailure(
                ValidationRule.V3,
                "shortRuns (${input.shortRuns}) exceeds the RUN-method total ($runMethodTotal)",
            ),
        )
    }

    // V4: BOUNDARY and OVERTHROW cannot coexist on the same delivery.
    val hasBoundary = input.runEvents.any { it.method == RunEventMethod.BOUNDARY }
    val hasOverthrow = input.runEvents.any { it.method == RunEventMethod.OVERTHROW }
    if (hasBoundary && hasOverthrow) {
        failures.add(ValidationFailure(ValidationRule.V4, "BOUNDARY and OVERTHROW cannot coexist on one delivery (§7.4)"))
    }

    val wicket = input.wicket
    if (wicket != null) {
        // V5: wicket.mode valid for this delivery's legality/isFreeHit.
        val validModes = validDismissalModesFor(input.legality, input.isFreeHit)
        if (wicket.mode !in validModes) {
            failures.add(
                ValidationFailure(
                    ValidationRule.V5,
                    "${wicket.mode} is not a valid dismissal mode for legality=${input.legality}, isFreeHit=${input.isFreeHit} (§9.1)",
                ),
            )
        }

        // V6: always-zero-runs modes must have zero total runs.
        if (wicket.mode in ALWAYS_ZERO_RUNS_MODES) {
            val total = input.runEvents.sumOf { it.value }
            if (total != 0) {
                failures.add(
                    ValidationFailure(
                        ValidationRule.V6,
                        "${wicket.mode} must total zero runs (§9.3), got $total",
                    ),
                )
            }
        }

        // V7: fielder-required modes need non-empty fielderIds. Scoped to
        // CAUGHT only -- see FIELDER_REQUIRED_MODES's own comment for why
        // RUN_OUT/STUMPED/OBSTRUCTING_THE_FIELD's conditional requirement
        // ("when a fielder is involved") isn't enforced here.
        if (wicket.mode in FIELDER_REQUIRED_MODES && wicket.fielderIds.isEmpty()) {
            failures.add(ValidationFailure(ValidationRule.V7, "${wicket.mode} requires at least one fielderId"))
        }

        // V8: incomingBatterId, when present, must be a NOT_OUT batter in
        // the XI who hasn't already batted. A null incomingBatterId
        // always passes here -- whether it SHOULD have been non-null
        // depends on innings-end evaluation, a later pipeline stage this
        // task doesn't have access to. The legitimate-resumption
        // exception (§9.6) is also not handled here -- deferred.
        val incoming = wicket.incomingBatterId
        if (incoming != null) {
            val validIncoming =
                incoming in battingContext.battingXiPlayerIds &&
                    incoming in battingContext.notOutPlayerIds &&
                    incoming !in battingContext.alreadyBattedPlayerIds
            if (!validIncoming) {
                failures.add(
                    ValidationFailure(
                        ValidationRule.V8,
                        "incomingBatterId $incoming is not a valid NOT_OUT, not-yet-batted XI member",
                    ),
                )
            }
        }
    }

    // V9: isFreeHit=true and legality=NO_BALL cannot both be set on input.
    if (input.legality == Legality.NO_BALL && input.isFreeHit) {
        failures.add(ValidationFailure(ValidationRule.V9, "isFreeHit cannot be set on a NO_BALL input (§13.4)"))
    }

    // V10: overrideReason required whenever a guardrail override is in
    // effect. NOT MEANINGFULLY CHECKABLE by this task: whether an
    // override is "in effect" is determined by §4's guardrail-precondition
    // stage (not this task's scope, see TASK-0017's own scope note), not
    // by anything on DeliveryInput itself. Deliberately not implemented
    // as a real check -- a stub that could never actually verify the
    // condition it names would be worse than an honest gap.

    // V11: DEAD_BALL cross-field constraints.
    if (input.legality == Legality.DEAD_BALL) {
        if (input.runEvents.isNotEmpty()) {
            failures.add(ValidationFailure(ValidationRule.V11, "DEAD_BALL must have empty runEvents (§6.4)"))
        }
        if (input.wicket != null) {
            failures.add(ValidationFailure(ValidationRule.V11, "DEAD_BALL must have wicket = null (§6.4)"))
        }
        if (input.deadBallReason.isNullOrBlank()) {
            failures.add(ValidationFailure(ValidationRule.V11, "DEAD_BALL requires a non-empty deadBallReason"))
        }
    }

    return if (failures.isEmpty()) ValidationResult.Valid(input) else ValidationResult.Invalid(failures)
}
