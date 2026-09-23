package com.kencric.scoring.core.conformance

import com.kencric.scoring.core.model.BattingContext
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.ValidationResult
import com.kencric.scoring.core.model.ValidationRule
import com.kencric.scoring.core.model.WicketDetail
import com.kencric.scoring.core.model.creditsBowler
import com.kencric.scoring.core.pipeline.ExtrasCategory
import com.kencric.scoring.core.pipeline.aggregateRuns
import com.kencric.scoring.core.pipeline.applyDelivery
import com.kencric.scoring.core.pipeline.classifyLegality
import com.kencric.scoring.core.pipeline.resolvesStrikeRotation
import com.kencric.scoring.core.pipeline.validateDelivery

/**
 * `specs/conformance/*.json`'s three fixture kinds, mirrored as Kotlin
 * types (see that directory's own `README.md` for the full schema
 * rationale) -- `TASK-0032`.
 *
 * DESIGNED, NOT WIRED: no JSON deserialization library (e.g.
 * `kotlinx-serialization-json`) has been added to this project, because
 * no Gradle build exists for `shared/` at all yet (flagged since
 * `TASK-0016`, unchanged). These types describe the shape a real loader
 * would parse a `.json` fixture file into; actually reading a file and
 * deserializing it is future work once a toolchain exists.
 *
 * The `check*` functions below, by contrast, ARE real, complete logic --
 * they take an already-constructed fixture object (not a raw JSON
 * string) and compose the existing `TASK-0018`-`0025` pure functions to
 * check it, sidestepping the missing-parser gap for everything except
 * the literal file-read-and-deserialize step. Once a loader exists to
 * produce these objects from the `.json` files, these functions need no
 * changes at all.
 */
enum class FixtureKind { WORKED_EXAMPLE, DELIVERY_OUTCOME, REJECTION }

data class WorkedExampleFixture(
    val id: String,
    val genesis: InningsFoldState,
    val config: FoldConfig,
    val delivery: DeliveryInput,
    val expected: InningsFoldState,
)

/**
 * Every field nullable and independently optional -- `null` means "this
 * row's own source table doesn't specify this dimension," never
 * "expected to be zero/false." Checking only asserts fields that are
 * actually set, per `README.md`'s design principle (never fabricate
 * context the case catalogue itself doesn't give).
 */
data class DeliveryOutcomeExpectation(
    val total: Int? = null,
    val batterRuns: Int? = null,
    val bowlerRunsCharged: Int? = null,
    val ranRuns: Int? = null,
    val extras: Map<ExtrasCategory, Int>? = null,
    val rotates: Boolean? = null,
    val consumesLegalBallSlot: Boolean? = null,
    val incrementsBallsFaced: Boolean? = null,
    val bowlerCredited: Boolean? = null,
)

data class DeliveryOutcomeFixture(
    val id: String,
    val legality: Legality,
    val runEvents: List<RunEvent>,
    val isOverFinalLegalBall: Boolean = false,
    val wicket: WicketDetail? = null,
    val expected: DeliveryOutcomeExpectation,
)

data class RejectionFixture(
    val id: String,
    val input: DeliveryInput,
    val expectedRule: ValidationRule,
)

/** Composes `TASK-0018`(`classifyLegality`)/`0019`(`aggregateRuns`)/`0021`(`creditsBowler`)/`0025`(`resolvesStrikeRotation`) -- no new pipeline logic. */
fun checkDeliveryOutcome(fixture: DeliveryOutcomeFixture): List<String> {
    val failures = mutableListOf<String>()
    val classification = classifyLegality(fixture.legality)
    val aggregate = aggregateRuns(fixture.runEvents)
    val exp = fixture.expected

    exp.total?.let { if (aggregate.total != it) failures.add("${fixture.id}: total expected $it, got ${aggregate.total}") }
    exp.batterRuns?.let { if (aggregate.batterRuns != it) failures.add("${fixture.id}: batterRuns expected $it, got ${aggregate.batterRuns}") }
    exp.bowlerRunsCharged?.let { if (aggregate.bowlerRunsCharged != it) failures.add("${fixture.id}: bowlerRunsCharged expected $it, got ${aggregate.bowlerRunsCharged}") }
    exp.ranRuns?.let { if (aggregate.ranRuns != it) failures.add("${fixture.id}: ranRuns expected $it, got ${aggregate.ranRuns}") }
    exp.extras?.let { expectedExtras -> if (aggregate.extras != expectedExtras) failures.add("${fixture.id}: extras expected $expectedExtras, got ${aggregate.extras}") }
    exp.consumesLegalBallSlot?.let { if (classification.consumesLegalBallSlot != it) failures.add("${fixture.id}: consumesLegalBallSlot expected $it, got ${classification.consumesLegalBallSlot}") }
    exp.incrementsBallsFaced?.let { if (classification.incrementsStrikerBallsFaced != it) failures.add("${fixture.id}: incrementsBallsFaced expected $it, got ${classification.incrementsStrikerBallsFaced}") }
    exp.rotates?.let {
        val actual = resolvesStrikeRotation(aggregate.ranRuns, fixture.isOverFinalLegalBall)
        if (actual != it) failures.add("${fixture.id}: rotates expected $it, got $actual")
    }
    fixture.wicket?.let { wicket ->
        exp.bowlerCredited?.let {
            val actual = creditsBowler(wicket.mode)
            if (actual != it) failures.add("${fixture.id}: bowlerCredited expected $it, got $actual")
        }
    }
    return failures
}

/** Composes `TASK-0017`'s `validateDelivery()` -- asserts the rejection carries the expected `ValidationRule`, not just that it was rejected at all. */
fun checkRejection(fixture: RejectionFixture, battingContext: BattingContext): List<String> {
    val result = validateDelivery(fixture.input, battingContext)
    return when (result) {
        is ValidationResult.Valid -> listOf("${fixture.id}: expected rejection under ${fixture.expectedRule}, but validation passed")
        is ValidationResult.Invalid -> if (result.failures.none { it.rule == fixture.expectedRule }) {
            listOf("${fixture.id}: expected a ${fixture.expectedRule} failure, got ${result.failures.map { it.rule }}")
        } else {
            emptyList()
        }
    }
}

/** Composes `TASK-0029`'s `applyDelivery()`. Equivalent to `ConformanceCase`/`runConformanceCase` (`TASK-0031`), kept as its own function here for symmetry with the other two `check*` functions. */
fun checkWorkedExample(fixture: WorkedExampleFixture): List<String> {
    val actual = applyDelivery(fixture.genesis, fixture.delivery, fixture.config)
    return if (actual == fixture.expected) emptyList() else listOf("${fixture.id}: expected ${fixture.expected}, got $actual")
}
