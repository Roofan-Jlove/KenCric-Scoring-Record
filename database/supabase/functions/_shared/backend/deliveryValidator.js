/**
 * TASK-0144: a deliberate, flagged TypeScript PORT (not a real FFI) of
 * `shared/src/commonMain/kotlin/com/kencric/scoring/core/pipeline/
 * DeliveryValidator.kt`'s own `validateDelivery` function and its
 * direct model dependencies (`DeliveryInput`/`WicketDetail`/`RunEvent`/
 * `Legality`/`DismissalMode`/`ValidationFailure`).
 *
 * **Why a port, not a real cross-language call:** this backlog has no
 * Kotlin/Gradle/Java toolchain anywhere in this session, and until
 * `TASK-0144`'s own sibling Gradle scaffold (`settings.gradle.kts`/
 * `shared/build.gradle.kts`) is actually run by a real toolchain, no
 * compiled JS artifact of `shared/` exists for this module to import.
 * This is therefore a genuinely SEPARATE implementation of the same
 * rules, the same "duplicate the pattern, not literal code, across
 * packages" shape `exportJobs.ts`/`divergenceResolution.ts` already
 * used elsewhere in this backlog -- flagged explicitly as a real
 * maintenance risk (the two implementations can drift), not silently
 * presented as equivalent to a true FFI.
 *
 * **A real, hand-traced field-for-field transcription**, not a fresh
 * design: every `V1`-`V11` rule below mirrors `DeliveryValidator.kt`'s
 * own comments and logic line-for-line, including its own already-
 * documented scope boundaries (V1 is a structural no-op; V10 is not
 * checkable without the guardrail-precondition stage; the free-hit
 * mankad-resumption exception is deferred).
 *
 * **A real, additional scope boundary found while wiring this into
 * `pushEvents.ts`:** `validateDelivery`'s own second parameter,
 * `BattingContext`, needs live match state (the current XI, who has
 * already batted, who is out) that no layer in `backend/` has any
 * visibility into -- the real match-state fold lives entirely in
 * `shared/`'s own `InningsFolder.kt`, itself unported for the same
 * toolchain reason above. `pushEvents.ts` calls this validator with an
 * explicitly EMPTY `BattingContext` -- which means `V8`
 * (`incomingBatterId` must be a valid, not-yet-out XI member) will
 * reject ANY wicket that names a specific incoming batter, since an
 * empty context can never satisfy it. Flagged here and at that call
 * site, not silently accepted as correct.
 */
export var Legality;
(function (Legality) {
    Legality["LEGAL"] = "LEGAL";
    Legality["WIDE"] = "WIDE";
    Legality["NO_BALL"] = "NO_BALL";
    Legality["DEAD_BALL"] = "DEAD_BALL";
})(Legality || (Legality = {}));
export var RunEventOrigin;
(function (RunEventOrigin) {
    RunEventOrigin["OFF_BAT"] = "OFF_BAT";
    RunEventOrigin["BYE"] = "BYE";
    RunEventOrigin["LEG_BYE"] = "LEG_BYE";
    RunEventOrigin["WIDE"] = "WIDE";
    RunEventOrigin["NO_BALL_PENALTY"] = "NO_BALL_PENALTY";
    RunEventOrigin["NO_BALL_BAT"] = "NO_BALL_BAT";
    RunEventOrigin["NO_BALL_BYE"] = "NO_BALL_BYE";
    RunEventOrigin["NO_BALL_LEG_BYE"] = "NO_BALL_LEG_BYE";
    RunEventOrigin["PENALTY"] = "PENALTY";
})(RunEventOrigin || (RunEventOrigin = {}));
export var RunEventMethod;
(function (RunEventMethod) {
    RunEventMethod["RUN"] = "RUN";
    RunEventMethod["BOUNDARY"] = "BOUNDARY";
    RunEventMethod["OVERTHROW"] = "OVERTHROW";
    RunEventMethod["AUTOMATIC"] = "AUTOMATIC";
})(RunEventMethod || (RunEventMethod = {}));
/** `live-scoring.md §7.3`'s valid `(origin, method)` table -- transcribed from `RunEvent.kt`'s own `isValidOriginMethodPair`. */
export function isValidOriginMethodPair(origin, method) {
    if (origin === RunEventOrigin.NO_BALL_PENALTY || origin === RunEventOrigin.PENALTY) {
        return method === RunEventMethod.AUTOMATIC;
    }
    return method === RunEventMethod.RUN || method === RunEventMethod.BOUNDARY || method === RunEventMethod.OVERTHROW;
}
export var DismissalMode;
(function (DismissalMode) {
    DismissalMode["BOWLED"] = "BOWLED";
    DismissalMode["CAUGHT"] = "CAUGHT";
    DismissalMode["LBW"] = "LBW";
    DismissalMode["RUN_OUT"] = "RUN_OUT";
    DismissalMode["STUMPED"] = "STUMPED";
    DismissalMode["HIT_WICKET"] = "HIT_WICKET";
    DismissalMode["OBSTRUCTING_THE_FIELD"] = "OBSTRUCTING_THE_FIELD";
    DismissalMode["HIT_BALL_TWICE"] = "HIT_BALL_TWICE";
    DismissalMode["TIMED_OUT"] = "TIMED_OUT";
    DismissalMode["RETIRED_OUT"] = "RETIRED_OUT";
})(DismissalMode || (DismissalMode = {}));
export const ALWAYS_ZERO_RUNS_MODES = new Set([
    DismissalMode.BOWLED, DismissalMode.CAUGHT, DismissalMode.LBW, DismissalMode.STUMPED, DismissalMode.HIT_BALL_TWICE,
]);
export const FIELDER_REQUIRED_MODES = new Set([DismissalMode.CAUGHT]);
/** Transcribed from `DismissalMode.kt`'s own `validDismissalModesFor`. */
export function validDismissalModesFor(legality, isFreeHit) {
    if (legality === Legality.LEGAL && isFreeHit) {
        return new Set([DismissalMode.RUN_OUT, DismissalMode.OBSTRUCTING_THE_FIELD, DismissalMode.HIT_BALL_TWICE]);
    }
    if (legality === Legality.LEGAL) {
        return new Set([
            DismissalMode.BOWLED, DismissalMode.CAUGHT, DismissalMode.LBW, DismissalMode.RUN_OUT,
            DismissalMode.STUMPED, DismissalMode.HIT_WICKET, DismissalMode.OBSTRUCTING_THE_FIELD, DismissalMode.HIT_BALL_TWICE,
        ]);
    }
    if (legality === Legality.NO_BALL) {
        return new Set([DismissalMode.RUN_OUT, DismissalMode.OBSTRUCTING_THE_FIELD, DismissalMode.HIT_BALL_TWICE]);
    }
    if (legality === Legality.WIDE) {
        // HIT_WICKET off a wide is [OPEN] in §9.1 -- not offered, matching the Kotlin side's own stated default.
        return new Set([DismissalMode.RUN_OUT, DismissalMode.STUMPED, DismissalMode.OBSTRUCTING_THE_FIELD, DismissalMode.HIT_BALL_TWICE]);
    }
    return new Set();
}
export var CreaseEnd;
(function (CreaseEnd) {
    CreaseEnd["STRIKER"] = "STRIKER";
    CreaseEnd["NON_STRIKER"] = "NON_STRIKER";
})(CreaseEnd || (CreaseEnd = {}));
export const EMPTY_BATTING_CONTEXT = {
    battingXiPlayerIds: new Set(),
    alreadyBattedPlayerIds: new Set(),
    notOutPlayerIds: new Set(),
};
export var ValidationRule;
(function (ValidationRule) {
    ValidationRule["V1"] = "V1";
    ValidationRule["V2"] = "V2";
    ValidationRule["V3"] = "V3";
    ValidationRule["V4"] = "V4";
    ValidationRule["V5"] = "V5";
    ValidationRule["V6"] = "V6";
    ValidationRule["V7"] = "V7";
    ValidationRule["V8"] = "V8";
    ValidationRule["V9"] = "V9";
    ValidationRule["V10"] = "V10";
    ValidationRule["V11"] = "V11";
})(ValidationRule || (ValidationRule = {}));
/**
 * `live-scoring.md §5`, Step 1 -- field-level and cross-field checks
 * that run after guardrails pass (§4, out of scope here, same as the
 * Kotlin source) and before any state mutation. All eleven must pass;
 * every failure is collected and returned together, never just the
 * first.
 */
export function validateDelivery(input, battingContext) {
    const failures = [];
    const runEvents = input.runEvents ?? [];
    const shortRuns = input.shortRuns ?? 0;
    // V1: legality in the four allowed values -- structurally guaranteed
    // by the Legality enum/TypeScript's own type system; a no-op, same
    // as the Kotlin source's own V1 comment.
    // V2: every RunEvent.value >= 0; every (origin, method) pair valid.
    runEvents.forEach((runEvent, index) => {
        if (runEvent.value < 0) {
            failures.push({ rule: ValidationRule.V2, message: `runEvents[${index}].value must be >= 0` });
        }
        if (!isValidOriginMethodPair(runEvent.origin, runEvent.method)) {
            failures.push({ rule: ValidationRule.V2, message: `runEvents[${index}]: (${runEvent.origin}, ${runEvent.method}) is not a valid pair (§7.3)` });
        }
    });
    // V3: shortRuns <= sum of RUN-method values.
    const runMethodTotal = runEvents.filter((e) => e.method === RunEventMethod.RUN).reduce((sum, e) => sum + e.value, 0);
    if (shortRuns > runMethodTotal) {
        failures.push({ rule: ValidationRule.V3, message: `shortRuns (${shortRuns}) exceeds the RUN-method total (${runMethodTotal})` });
    }
    // V4: BOUNDARY and OVERTHROW cannot coexist on the same delivery.
    const hasBoundary = runEvents.some((e) => e.method === RunEventMethod.BOUNDARY);
    const hasOverthrow = runEvents.some((e) => e.method === RunEventMethod.OVERTHROW);
    if (hasBoundary && hasOverthrow) {
        failures.push({ rule: ValidationRule.V4, message: "BOUNDARY and OVERTHROW cannot coexist on one delivery (§7.4)" });
    }
    const wicket = input.wicket;
    if (wicket) {
        // V5: wicket.mode valid for this delivery's legality/isFreeHit.
        const validModes = validDismissalModesFor(input.legality, input.isFreeHit);
        if (!validModes.has(wicket.mode)) {
            failures.push({ rule: ValidationRule.V5, message: `${wicket.mode} is not a valid dismissal mode for legality=${input.legality}, isFreeHit=${input.isFreeHit} (§9.1)` });
        }
        // V6: always-zero-runs modes must have zero total runs.
        if (ALWAYS_ZERO_RUNS_MODES.has(wicket.mode)) {
            const total = runEvents.reduce((sum, e) => sum + e.value, 0);
            if (total !== 0) {
                failures.push({ rule: ValidationRule.V6, message: `${wicket.mode} must total zero runs (§9.3), got ${total}` });
            }
        }
        // V7: fielder-required modes need non-empty fielderIds -- scoped to CAUGHT only, same as the Kotlin source.
        const fielderIds = wicket.fielderIds ?? [];
        if (FIELDER_REQUIRED_MODES.has(wicket.mode) && fielderIds.length === 0) {
            failures.push({ rule: ValidationRule.V7, message: `${wicket.mode} requires at least one fielderId` });
        }
        // V8: incomingBatterId, when present, must be a NOT_OUT, not-yet-batted XI member.
        const incoming = wicket.incomingBatterId;
        if (incoming) {
            const validIncoming = battingContext.battingXiPlayerIds.has(incoming) &&
                battingContext.notOutPlayerIds.has(incoming) &&
                !battingContext.alreadyBattedPlayerIds.has(incoming);
            if (!validIncoming) {
                failures.push({ rule: ValidationRule.V8, message: `incomingBatterId ${incoming} is not a valid NOT_OUT, not-yet-batted XI member` });
            }
        }
    }
    // V9: isFreeHit=true and legality=NO_BALL cannot both be set.
    if (input.legality === Legality.NO_BALL && input.isFreeHit) {
        failures.push({ rule: ValidationRule.V9, message: "isFreeHit cannot be set on a NO_BALL input (§13.4)" });
    }
    // V10: not meaningfully checkable here -- same honest gap the Kotlin source already names (depends on §4's guardrail-precondition stage, out of scope).
    // V11: DEAD_BALL cross-field constraints.
    if (input.legality === Legality.DEAD_BALL) {
        if (runEvents.length > 0) {
            failures.push({ rule: ValidationRule.V11, message: "DEAD_BALL must have empty runEvents (§6.4)" });
        }
        if (input.wicket) {
            failures.push({ rule: ValidationRule.V11, message: "DEAD_BALL must have wicket = null (§6.4)" });
        }
        if (!input.deadBallReason || input.deadBallReason.trim() === "") {
            failures.push({ rule: ValidationRule.V11, message: "DEAD_BALL requires a non-empty deadBallReason" });
        }
    }
    return failures.length === 0 ? { outcome: "valid", input } : { outcome: "invalid", failures };
}
//# sourceMappingURL=deliveryValidator.js.map