package com.kencric.scoring.api.matches

/**
 * TASK-0115: a MINIMAL Kotlin mirror of `backend/src/commands/
 * matches.ts`'s own `MatchRow`/`MatchStore` shape (`TASK-0039`/
 * `TASK-0044`) -- a real dependency `claimMatch.ts` needs (it imports
 * `MatchRow`/`MatchStore` from `matches.js` directly), but `matches.ts`
 * itself was never one of the 13 backend resources the user asked for
 * Android counterparts of (it predates that cluster, from the earlier
 * worked-vertical-slice task pair). Deliberately NOT ported here:
 * `createMatch`/`updateMatch`/`validateMatchSchema`/
 * `validateMatchBusinessRules` and their own frozen-field/business-
 * rule logic -- `claimMatch` never calls any of them, only `get`/
 * `update` on the store. Only the full `MatchRow` field shape is
 * ported (needed for `claimMatch`'s own test assertions that
 * provenance fields stay untouched), plus a minimal `MatchStore`
 * exposing just the two operations `claimMatch` actually uses.
 *
 * **`TASK-0128` adds `MatchState`/`MatchRow.state`**, mirroring the TS
 * side's own `TASK-0122` RCR, to support `disputeMatch.ts`'s own
 * Kotlin port -- additive, defaults to `SCHEDULED`.
 */

enum class MatchFormat { T20, ODI, T10, THE_HUNDRED, CUSTOM, FIRST_CLASS }
enum class RainMethod { DLS_STANDARD, NONE }
enum class MatchClaimStatus { GUEST, CLAIMED }

/**
 * `data-specification.md §5.1`. Added by `TASK-0128`, mirroring the TS
 * side's own `TASK-0122` RCR (`DISPUTED`) -- this minimal module never
 * carried `state` at all before now, since `claimMatch` never needed
 * it; `disputeMatch`'s own Kotlin port is the first consumer.
 */
enum class MatchState { SCHEDULED, READY, IN_PROGRESS, INNINGS_BREAK, PAUSED, COMPLETE, ABANDONED, DISPUTED }

data class MatchRow(
    val id: String,
    val organizationId: String?,
    val originDeviceId: String,
    val claimStatus: MatchClaimStatus,
    val homeTeamId: String,
    val awayTeamId: String,
    val homeXi: Any? = null,
    val awayXi: Any? = null,
    val format: MatchFormat,
    val oversAllotted: Int? = null,
    val conditionsProfile: Any? = null,
    val conditionsProfileVersion: Int? = null,
    val dlsTableVersion: Int? = null,
    val rainMethod: RainMethod = RainMethod.NONE,
    val tossWinnerTeamId: String? = null,
    val tossDecision: String? = null,
    val venue: String? = null,
    val scheduledStart: String? = null,
    val matchTimezone: String,
    val minOversForResult: Int? = null,
    /** Defaults to `SCHEDULED` -- additive, keeps every pre-existing `MatchRow(...)` construction (e.g. `ClaimMatchTest.kt`) compiling unchanged. */
    val state: MatchState = MatchState.SCHEDULED,
    val rowVersion: Int,
    val createdAt: String,
    val createdBy: String,
    val updatedAt: String,
    val updatedBy: String,
)

/** Only the two operations `claimMatch` actually uses -- `matches.ts`'s
 * own full `MatchStore` also has `insert`, not needed here. */
interface MatchStore {
    fun get(id: String): MatchRow?
    fun update(row: MatchRow)
}

/** An in-memory MatchStore for tests -- seeded by directly constructing
 * `MatchRow` instances (no `createMatch` port exists here), not a
 * production adapter. */
class InMemoryMatchStore : MatchStore {
    private val rows = mutableMapOf<String, MatchRow>()

    override fun get(id: String): MatchRow? = rows[id]
    override fun update(row: MatchRow) { rows[row.id] = row }

    /** Test-only seeding helper -- bypasses any create-side validation
     * entirely, since that logic isn't ported here. */
    fun seed(row: MatchRow) { rows[row.id] = row }
}
