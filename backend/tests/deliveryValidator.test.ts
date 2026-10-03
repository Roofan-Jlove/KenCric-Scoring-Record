import { describe, expect, it } from "vitest";
import {
  CreaseEnd, DismissalMode, EMPTY_BATTING_CONTEXT, Legality, RunEventMethod, RunEventOrigin,
  validateDelivery, type BattingContext, type DeliveryInput, ValidationRule,
} from "../src/validation/deliveryValidator.js";

/**
 * TASK-0144, cross-platform parity (`C-7`): mirrors `shared/.../core/
 * pipeline/DeliveryValidatorTest.kt`'s own 12 cases input-for-input.
 * This is a PORT's own parity test, not a shared/Kotlin test -- see
 * deliveryValidator.ts's own doc comment for why this duplicate
 * implementation exists at all.
 */
describe("validateDelivery (TASK-0144)", () => {
  function baseInput(legality: Legality = Legality.LEGAL): DeliveryInput {
    return {
      legality,
      strikerBatterId: "striker-1",
      nonStrikerBatterId: "non-striker-1",
      bowlerId: "bowler-1",
      isFreeHit: false,
    };
  }

  function hasFailure(result: ReturnType<typeof validateDelivery>, rule: ValidationRule): boolean {
    return result.outcome === "invalid" && result.failures.some((f) => f.rule === rule);
  }

  // C50: wicket.mode = STUMPED on a NO_BALL delivery -> V5.
  it("c50_stumped_on_no_ball_rejected_by_v5", () => {
    const input: DeliveryInput = { ...baseInput(Legality.NO_BALL), wicket: { mode: DismissalMode.STUMPED, outBatterId: "striker-1", endVacated: CreaseEnd.STRIKER } };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V5)).toBe(true);
  });

  // C51: wicket.mode = CAUGHT with runEvents = [OB:2:R] -> V6.
  it("c51_caught_with_runs_rejected_by_v6", () => {
    const input: DeliveryInput = {
      ...baseInput(),
      wicket: { mode: DismissalMode.CAUGHT, outBatterId: "striker-1", fielderIds: ["fielder-1"], endVacated: CreaseEnd.STRIKER },
      runEvents: [{ origin: RunEventOrigin.OFF_BAT, value: 2, method: RunEventMethod.RUN }],
    };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V6)).toBe(true);
  });

  // C52: RunEvents = [OB:4:B, OB:2:O] on one delivery -> V4.
  it("c52_boundary_and_overthrow_rejected_by_v4", () => {
    const input: DeliveryInput = {
      ...baseInput(),
      runEvents: [
        { origin: RunEventOrigin.OFF_BAT, value: 4, method: RunEventMethod.BOUNDARY },
        { origin: RunEventOrigin.OFF_BAT, value: 2, method: RunEventMethod.OVERTHROW },
      ],
    };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V4)).toBe(true);
  });

  // C53: legality = DEAD_BALL with a non-empty runEvents -> V11.
  it("c53_dead_ball_with_runs_rejected_by_v11", () => {
    const input: DeliveryInput = {
      ...baseInput(Legality.DEAD_BALL),
      runEvents: [{ origin: RunEventOrigin.OFF_BAT, value: 1, method: RunEventMethod.RUN }],
      deadBallReason: "ball fell out of hand",
    };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V11)).toBe(true);
  });

  // C54: isFreeHit = true together with legality = NO_BALL -> V9.
  it("c54_free_hit_on_no_ball_rejected_by_v9", () => {
    const input: DeliveryInput = { ...baseInput(Legality.NO_BALL), isFreeHit: true };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V9)).toBe(true);
  });

  // C55: shortRuns = 2 when the only RUN-method value is 1 -> V3.
  it("c55_excess_short_runs_rejected_by_v3", () => {
    const input: DeliveryInput = {
      ...baseInput(),
      runEvents: [{ origin: RunEventOrigin.OFF_BAT, value: 1, method: RunEventMethod.RUN }],
      shortRuns: 2,
    };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V3)).toBe(true);
  });

  it("valid_legal_delivery_with_no_wicket_passes", () => {
    const input: DeliveryInput = { ...baseInput(), runEvents: [{ origin: RunEventOrigin.OFF_BAT, value: 4, method: RunEventMethod.BOUNDARY }] };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("valid");
  });

  // V2: an invalid (origin, method) pair.
  it("invalid_origin_method_pair_rejected_by_v2", () => {
    const input: DeliveryInput = { ...baseInput(), runEvents: [{ origin: RunEventOrigin.PENALTY, value: 5, method: RunEventMethod.RUN }] };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V2)).toBe(true);
  });

  // V7: CAUGHT with no fielderIds.
  it("caught_with_no_fielder_rejected_by_v7", () => {
    const input: DeliveryInput = { ...baseInput(), wicket: { mode: DismissalMode.CAUGHT, outBatterId: "striker-1", fielderIds: [], endVacated: CreaseEnd.STRIKER } };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V7)).toBe(true);
  });

  // V8: an incoming batter who isn't in the XI at all.
  it("incoming_batter_not_in_xi_rejected_by_v8", () => {
    const input: DeliveryInput = {
      ...baseInput(),
      wicket: { mode: DismissalMode.BOWLED, outBatterId: "striker-1", endVacated: CreaseEnd.STRIKER, incomingBatterId: "not-in-xi" },
    };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V8)).toBe(true);
  });

  it("incoming_batter_valid_in_xi_passes_v8", () => {
    const context: BattingContext = {
      battingXiPlayerIds: new Set(["next-batter"]),
      alreadyBattedPlayerIds: new Set(),
      notOutPlayerIds: new Set(["next-batter"]),
    };
    const input: DeliveryInput = {
      ...baseInput(),
      wicket: { mode: DismissalMode.BOWLED, outBatterId: "striker-1", endVacated: CreaseEnd.STRIKER, incomingBatterId: "next-batter" },
    };
    const result = validateDelivery(input, context);
    expect(result.outcome).toBe("valid");
  });

  // A free hit's restricted dismissal-mode set (V5).
  it("bowled_on_free_hit_rejected_by_v5", () => {
    const input: DeliveryInput = {
      ...baseInput(),
      isFreeHit: true,
      wicket: { mode: DismissalMode.BOWLED, outBatterId: "striker-1", endVacated: CreaseEnd.STRIKER },
    };
    const result = validateDelivery(input, EMPTY_BATTING_CONTEXT);
    expect(result.outcome).toBe("invalid");
    expect(hasFailure(result, ValidationRule.V5)).toBe(true);
  });
});
