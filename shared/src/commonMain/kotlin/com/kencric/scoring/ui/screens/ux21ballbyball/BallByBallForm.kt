package com.kencric.scoring.ui.screens.ux21ballbyball

/**
 * TASK-0078: `ux-specification.md UX-21`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-21-ball-by-ball/
 * ballByBallForm.ts` (`TASK-0077`) -- same contract-only scope note as
 * every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * See `TASK-0077`'s own file for the full scope note (phrasing/
 * filtering only, not re-deriving facts from raw event data).
 */

data class DeliverySummaryInput(
    val overNumber: Int,
    val ballInOver: Int,
    val bowlerName: String,
    val strikerName: String,
    val runs: Int,
    val isBoundary: Boolean,
    val wicketDescription: String?,
    val extraDescription: String?,
)

/** Same `O.B` display notation `TASK-0055`/`0065`/`0067`/`0075` already established. */
fun formatDeliveryOverBall(overNumber: Int, ballInOver: Int): String = "$overNumber.$ballInOver"

/**
 * `UX-21`'s own Accessibility text: "Over 12.4: Smith to Jones, four
 * runs, boundary." Flagged simplification: numerals rather than the
 * example's spelled-out "four," consistent with every earlier screen's
 * numeral convention.
 */
fun summarizeDelivery(input: DeliverySummaryInput): String {
    val overBall = formatDeliveryOverBall(input.overNumber, input.ballInOver)
    val parts = mutableListOf("Over $overBall: ${input.bowlerName} to ${input.strikerName}")
    when {
        input.wicketDescription != null -> parts.add(input.wicketDescription)
        input.extraDescription != null -> parts.add(input.extraDescription)
        input.runs == 0 -> parts.add("dot ball")
        else -> {
            parts.add("${input.runs} run${if (input.runs == 1) "" else "s"}")
            if (input.isBoundary) parts.add("boundary")
        }
    }
    return parts.joinToString(", ")
}

data class DeliveryFilter(
    val overRange: Pair<Int, Int>? = null,
    val bowlerId: String? = null,
    val batterId: String? = null,
    val phase: String? = null,
)

fun initialDeliveryFilter(): DeliveryFilter = DeliveryFilter()

data class FilterableDelivery(
    val overNumber: Int,
    val bowlerId: String,
    val strikerId: String,
    val phase: String?,
)

/** UX-21's own Inputs: "Filters (over range, bowler, batter, phase)." */
fun matchesFilter(delivery: FilterableDelivery, filter: DeliveryFilter): Boolean {
    val overRange = filter.overRange
    if (overRange != null && (delivery.overNumber < overRange.first || delivery.overNumber > overRange.second)) {
        return false
    }
    if (filter.bowlerId != null && delivery.bowlerId != filter.bowlerId) return false
    if (filter.batterId != null && delivery.strikerId != filter.batterId) return false
    if (filter.phase != null && delivery.phase != filter.phase) return false
    return true
}

/** UX-21's own States: "Filtered (active-filter chips shown)." */
fun hasActiveFilter(filter: DeliveryFilter): Boolean =
    filter.overRange != null || filter.bowlerId != null || filter.batterId != null || filter.phase != null

data class OverBallQuery(val overNumber: Int, val ballInOver: Int)

private val OVER_BALL_PATTERN = Regex("""^(\d+)\.(\d+)$""")

/** UX-21's own Inputs: "a search/jump-to-over.ball field," accepting exactly the `O.B` notation this backlog has used since `TASK-0055`. */
fun parseOverBallQuery(query: String): OverBallQuery? {
    val match = OVER_BALL_PATTERN.matchEntire(query.trim()) ?: return null
    val (overNumber, ballInOver) = match.destructured
    return OverBallQuery(overNumber.toInt(), ballInOver.toInt())
}

/** UX-21's own States: "auto-scrolls to the newest ball unless the user has scrolled up, in which case a 'new ball ↓' affordance appears instead." */
fun shouldAutoScrollToNewest(hasUserScrolledUp: Boolean): Boolean = !hasUserScrolledUp
