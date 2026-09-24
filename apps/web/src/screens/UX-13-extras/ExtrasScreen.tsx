import { useState } from "react";
import { initialExtrasFormState, validateSubmission, type ExtraType, type ExtrasFormState, type PenaltyRecipientSide } from "./extrasForm";

/**
 * TASK-0061: `ux-specification.md UX-13` -- Extras. Styling not applied,
 * same scope boundary as every earlier screen this session.
 *
 * A disabled type stays visible but greyed, with its reason shown on
 * tap (`UX-13`'s own Error-handling text) -- genuinely distinct from
 * `UX-12`'s not-rendered-at-all pattern for invalid dismissal modes.
 * `aria-disabled` (not native `disabled`) keeps the button reachable so
 * tapping it can reveal the reason, the same resolution `UX-07` used for
 * an analogous tension. `disabledReasons` is caller-supplied text -- the
 * domain model doesn't specify WHY a type would be config-disabled.
 */

const ALL_TYPES: ExtraType[] = ["WIDE", "NO_BALL", "BYE", "LEG_BYE", "PENALTY"];

function typeLabel(type: ExtraType): string {
  switch (type) {
    case "NO_BALL":
      return "No-ball";
    case "LEG_BYE":
      return "Leg-bye";
    default:
      return type[0] + type.slice(1).toLowerCase();
  }
}

export interface ExtrasScreenProps {
  enabledTypes: ReadonlySet<ExtraType>;
  disabledReasons?: Partial<Record<ExtraType, string>>;
  onConfirm: (state: ExtrasFormState) => void;
  onCancel: () => void;
}

export function ExtrasScreen({ enabledTypes, disabledReasons = {}, onConfirm, onCancel }: ExtrasScreenProps) {
  const [state, setState] = useState<ExtrasFormState>(initialExtrasFormState);
  const [tappedDisabledReason, setTappedDisabledReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelectType(type: ExtraType) {
    if (!enabledTypes.has(type)) {
      setTappedDisabledReason(disabledReasons[type] ?? "This extra type is not available in the current playing conditions");
      return;
    }
    setTappedDisabledReason(null);
    setError(null);
    setState((s) => ({ ...s, type }));
  }

  function handleConfirm() {
    const result = validateSubmission(state);
    if (result.outcome === "invalid") {
      setError(result.reason);
      return;
    }
    setError(null);
    onConfirm(result.state);
  }

  return (
    <div>
      <div role="group" aria-label="Extra type">
        {ALL_TYPES.map((type) => {
          const enabled = enabledTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={state.type === type}
              aria-disabled={!enabled}
              onClick={() => handleSelectType(type)}
            >
              {typeLabel(type)}
            </button>
          );
        })}
      </div>

      {tappedDisabledReason && <p role="alert">{tappedDisabledReason}</p>}
      {error && <p role="alert">{error}</p>}

      {state.type && (
        <div>
          <label htmlFor="additional-runs">Additional runs</label>
          <input
            id="additional-runs"
            type="number"
            value={state.additionalRuns}
            onChange={(event) => setState((s) => ({ ...s, additionalRuns: Number(event.target.value) }))}
          />
          <p aria-live="polite">Additional runs: {state.additionalRuns}</p>

          {state.type === "PENALTY" && (
            <>
              <label htmlFor="penalty-reason">Penalty reason</label>
              <input
                id="penalty-reason"
                value={state.penaltyReason}
                onChange={(event) => setState((s) => ({ ...s, penaltyReason: event.target.value }))}
              />
              <fieldset>
                <legend>Recipient side</legend>
                {(["BATTING", "BOWLING"] as PenaltyRecipientSide[]).map((side) => (
                  <label key={side}>
                    <input
                      type="radio"
                      name="penalty-recipient"
                      checked={state.penaltyRecipientSide === side}
                      onChange={() => setState((s) => ({ ...s, penaltyRecipientSide: side }))}
                    />
                    {side === "BATTING" ? "Batting side" : "Bowling side"}
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </div>
      )}

      <button type="button" onClick={handleConfirm}>
        Confirm
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
