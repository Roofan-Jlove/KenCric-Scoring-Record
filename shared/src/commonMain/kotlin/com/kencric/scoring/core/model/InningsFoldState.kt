package com.kencric.scoring.core.model

import com.kencric.scoring.core.config.PlayingConditionsProfile

/**
 * live-scoring.md §18.1 step 3's own list of "every projection"
 * (`InningsState`, `OverState`, both `BatterCardLine`s, `BowlerCardLine`,
 * `freeHitPending`, `strikerBatterId`/`nonStrikerBatterId`), bundled
 * into one foldable state for the first time in this backlog -- every
 * earlier task deliberately deferred assembling the full aggregate
 * (see e.g. `TASK-0026`'s own "full InningsState shape... does not
 * exist as a single assembled type" note); this is that assembly,
 * scoped to exactly what folding an innings needs.
 *
 * `batterCardLines`/`bowlerCardLines` are keyed by `playerId`.
 */
data class InningsFoldState(
    val batterCardLines: Map<String, BatterCardLine>,
    val bowlerCardLines: Map<String, BowlerCardLine>,
    val score: InningsScoreState,
    val over: OverState,
    val strikerBatterId: String,
    val nonStrikerBatterId: String,
    val freeHitPending: Boolean,
    val inningsEndReason: InningsEndReason?,
)

/**
 * The match-level configuration a fold needs but that isn't itself part
 * of the per-delivery event stream -- kept separate from
 * [InningsFoldState] since none of it changes delivery-to-delivery.
 */
data class FoldConfig(
    val profile: PlayingConditionsProfile,
    val bowlingTeamId: String,
    val maxWicketsPerInnings: Int,
    val oversAllotted: Int,
    val target: Int?,
)
