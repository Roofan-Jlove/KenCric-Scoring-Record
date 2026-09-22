package com.kencric.scoring.core.conformance

import com.kencric.scoring.core.config.PlayingConditionsProfile
import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.BowlerCardLine
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.InningsScoreState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * testing-strategy.md §4's Verification procedure for `TASK-0031`: "a
 * trivial fixture (one case) runs and passes on at least two targets."
 *
 * HONEST ENVIRONMENT NOTE: no Java/Kotlin/Gradle toolchain exists
 * anywhere in this session (confirmed before `TASK-0016`, unchanged
 * since) -- this cannot actually be *executed* on any target here, let
 * alone two. What can be verified instead: this file and
 * `ConformanceCase.kt` use only `commonTest`/`commonMain` declarations
 * -- no `expect`/`actual`, no platform-specific import, nothing that
 * could behave differently per target -- so cross-platform parity for
 * this runner is satisfied *by construction*, the same way every prior
 * `shared/` task's tests have been, not verified by an actual run.
 *
 * This IS live-scoring.md §22's EX-01 (dot ball), already independently
 * verified in `TASK-0023`/`0024`/`0025`/`0029`'s own test suites --
 * reused here specifically as the "trivial fixture," not as new
 * coverage, so this file's job stays scoped to proving the *runner*
 * works, not re-proving EX-01 itself.
 */
class ConformanceRunnerSmokeTest {

    @Test fun ex01_dot_ball_passes_through_the_runner() {
        val profile = PlayingConditionsProfile(ballsPerOver = 6)
        val config = FoldConfig(profile = profile, bowlingTeamId = "fielding", maxWicketsPerInnings = 10, oversAllotted = 20, target = null)
        val genesis = InningsFoldState(
            batterCardLines = emptyMap(), bowlerCardLines = emptyMap(),
            score = InningsScoreState(totalRuns = 61, wicketsLost = 2),
            over = OverState(overNumber = 8, bowlerId = "X", legalBallCount = 3),
            strikerBatterId = "A", nonStrikerBatterId = "B",
            freeHitPending = false, inningsEndReason = null,
        )
        val delivery = DeliveryInput(Legality.LEGAL, "A", "B", "X", isFreeHit = false)

        val case = ConformanceCase(
            id = "EX-01",
            description = "Plain dot ball (the baseline) -- live-scoring.md §22.1",
            genesis = genesis, config = config, delivery = delivery,
            expected = genesis.copy(
                batterCardLines = mapOf("A" to BatterCardLine("A", ballsFaced = 1)),
                bowlerCardLines = mapOf("X" to BowlerCardLine("X", legalBallsBowled = 1)),
                score = genesis.score.copy(legalBallsBowled = 1),
                over = genesis.over.copy(legalBallCount = 4),
            ),
        )

        val result = runConformanceCase(case)
        assertTrue(result.passed, "EX-01 fixture: expected ${case.expected} but got ${result.actual}")

        val suiteResults = runConformanceSuite(listOf(case))
        assertEquals(1, suiteResults.size)
        assertTrue(suiteResults.all { it.passed }, "conformance suite must report 100% pass -- testing-strategy.md §4.3's hard release gate")
    }
}
