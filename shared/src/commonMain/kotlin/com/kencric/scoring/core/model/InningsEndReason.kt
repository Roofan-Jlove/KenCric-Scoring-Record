package com.kencric.scoring.core.model

/**
 * live-scoring.md §15's three delivery-triggered ending conditions.
 * Declaration/forfeiture (§15.4) is captain-initiated, not
 * delivery-triggered -- explicitly out of §15's own ball-processing
 * scope, so it has no member here.
 */
enum class InningsEndReason { ALL_OUT, OVERS_COMPLETE, TARGET_REACHED }
