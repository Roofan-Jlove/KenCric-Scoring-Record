import { useState } from "react";
import {
  canContinue,
  initialMatchSetupState,
  mustHaveChecklist,
  validateAll,
  type MatchSetupFormState,
  type TieBreakerRule,
} from "./matchSetupForm";

/**
 * TASK-0045: `ux-specification.md UX-05` -- Match Setup. Styling not
 * applied, same scope boundary as `TASK-0040`'s `CreateMatchScreen`.
 */

const TIE_BREAKER_OPTIONS: { value: TieBreakerRule; label: string }[] = [
  { value: "SUPER_OVER", label: "Super Over" },
  { value: "REPEAT", label: "Repeat" },
  { value: "BOUNDARY_COUNTBACK", label: "Boundary count-back" },
  { value: "NONE", label: "None" },
];

export interface MatchSetupScreenProps {
  isLocked: boolean;
  onContinue: (state: MatchSetupFormState) => void;
}

function fieldErrorMessage(errors: ReturnType<typeof validateAll>, field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function MatchSetupScreen({ isLocked, onContinue }: MatchSetupScreenProps) {
  const [state, setState] = useState<MatchSetupFormState>(initialMatchSetupState);

  if (isLocked) {
    return (
      <p role="status">
        This match&apos;s setup is locked -- the first ball has already been recorded. Use the amendment path to make changes.
      </p>
    );
  }

  const errors = validateAll(state);
  const checklist = mustHaveChecklist(state);
  const continueEnabled = canContinue(state);

  return (
    <form
      aria-label="Match setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (continueEnabled) onContinue(state);
      }}
    >
      <fieldset>
        <legend>Format</legend>
        <label htmlFor="overs-allotted">Overs per innings</label>
        <input
          id="overs-allotted"
          type="number"
          value={state.oversAllotted ?? ""}
          aria-invalid={fieldErrorMessage(errors, "oversAllotted") !== undefined}
          aria-describedby={fieldErrorMessage(errors, "oversAllotted") ? "overs-allotted-error" : undefined}
          onChange={(event) =>
            setState((s) => ({ ...s, oversAllotted: event.target.value === "" ? null : Number(event.target.value) }))
          }
        />
        {fieldErrorMessage(errors, "oversAllotted") && (
          <span id="overs-allotted-error" role="alert">
            {fieldErrorMessage(errors, "oversAllotted")}
          </span>
        )}

        <label htmlFor="powerplay-overs">Powerplay overs</label>
        <input
          id="powerplay-overs"
          type="number"
          value={state.powerplayOvers ?? ""}
          aria-invalid={fieldErrorMessage(errors, "powerplayOvers") !== undefined}
          aria-describedby={fieldErrorMessage(errors, "powerplayOvers") ? "powerplay-overs-error" : undefined}
          onChange={(event) =>
            setState((s) => ({ ...s, powerplayOvers: event.target.value === "" ? null : Number(event.target.value) }))
          }
        />
        {fieldErrorMessage(errors, "powerplayOvers") && (
          <span id="powerplay-overs-error" role="alert">
            {fieldErrorMessage(errors, "powerplayOvers")}
          </span>
        )}

        <label htmlFor="bowler-over-cap">Per-bowler over cap</label>
        <input
          id="bowler-over-cap"
          type="number"
          value={state.bowlerOverCap ?? ""}
          onChange={(event) =>
            setState((s) => ({ ...s, bowlerOverCap: event.target.value === "" ? null : Number(event.target.value) }))
          }
        />

        <fieldset>
          <legend>Tie-breaker rule</legend>
          {TIE_BREAKER_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="tie-breaker"
                value={option.value}
                checked={state.tieBreakerRule === option.value}
                onChange={() => setState((s) => ({ ...s, tieBreakerRule: option.value }))}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>Timing</legend>
        <label htmlFor="venue">Venue</label>
        <input id="venue" value={state.venue ?? ""} onChange={(event) => setState((s) => ({ ...s, venue: event.target.value || null }))} />

        <label htmlFor="match-timezone">Match time zone</label>
        <input
          id="match-timezone"
          value={state.matchTimezone ?? ""}
          aria-invalid={fieldErrorMessage(errors, "matchTimezone") !== undefined}
          aria-describedby={fieldErrorMessage(errors, "matchTimezone") ? "match-timezone-error" : undefined}
          onChange={(event) => setState((s) => ({ ...s, matchTimezone: event.target.value || null }))}
        />
        {fieldErrorMessage(errors, "matchTimezone") && (
          <span id="match-timezone-error" role="alert">
            {fieldErrorMessage(errors, "matchTimezone")}
          </span>
        )}
      </fieldset>

      <fieldset>
        <legend>Result rules</legend>
        <label htmlFor="min-overs-for-result">Minimum overs for a valid result</label>
        <input
          id="min-overs-for-result"
          type="number"
          value={state.minOversForResult ?? ""}
          onChange={(event) =>
            setState((s) => ({ ...s, minOversForResult: event.target.value === "" ? null : Number(event.target.value) }))
          }
        />
      </fieldset>

      {/* UX-05's own States text: "a live checklist showing exactly what's missing." */}
      <ul aria-label="Setup completeness checklist">
        {checklist.map((item) => (
          <li key={item.field}>
            <span aria-hidden="true">{item.complete ? "✅" : "❌"}</span>
            {item.label}: {item.complete ? "complete" : "missing"}
          </li>
        ))}
      </ul>

      <div role="status" aria-live="polite">
        {errors.length > 0 && `${errors.length} issue${errors.length === 1 ? "" : "s"} to resolve`}
      </div>

      <button type="submit" disabled={!continueEnabled} aria-describedby={!continueEnabled ? "continue-disabled-reason" : undefined}>
        Continue
      </button>
      {!continueEnabled && <span id="continue-disabled-reason">Complete every Must-have field and resolve all issues to continue</span>}
    </form>
  );
}
