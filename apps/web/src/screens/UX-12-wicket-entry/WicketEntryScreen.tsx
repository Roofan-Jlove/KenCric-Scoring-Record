import { useState } from "react";
import {
  canConfirm,
  initialWicketFormState,
  missingFields,
  modeIsOffered,
  reasonModeNotOffered,
  requiredFieldsForMode,
  type CreaseEnd,
  type DismissalMode,
  type Legality,
  type WicketFormState,
} from "./wicketEntryForm";

/**
 * TASK-0059: `ux-specification.md UX-12` -- Wicket Entry. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * Modes the current legality/free-hit context excludes are genuinely
 * NOT rendered as buttons (`UX-12`'s own Error-handling text: "simply
 * not offered... rather than offered and then rejected"); the "one-line
 * reason available on request" is a toggleable disclosure, not shown by
 * default.
 */

const ALL_MODES: DismissalMode[] = [
  "BOWLED",
  "CAUGHT",
  "LBW",
  "RUN_OUT",
  "STUMPED",
  "HIT_WICKET",
  "OBSTRUCTING_THE_FIELD",
  "HIT_BALL_TWICE",
  "TIMED_OUT",
  "RETIRED_OUT",
];

function modeLabel(mode: DismissalMode): string {
  return mode
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export interface Player {
  id: string;
  name: string;
}

export interface WicketEntryScreenProps {
  legality: Legality;
  isFreeHit: boolean;
  strikerId: string;
  battingXiNotOut: readonly Player[];
  fieldingXi: readonly Player[];
  endsInnings: boolean;
  onConfirm: (detail: WicketFormState) => void;
  onCancel: () => void;
}

export function WicketEntryScreen({
  legality,
  isFreeHit,
  strikerId,
  battingXiNotOut,
  fieldingXi,
  endsInnings,
  onConfirm,
  onCancel,
}: WicketEntryScreenProps) {
  const [state, setState] = useState<WicketFormState>(() => ({ ...initialWicketFormState(), outBatterId: strikerId, endVacated: "STRIKER" }));
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [showExcludedReasons, setShowExcludedReasons] = useState(false);

  const offeredModes = ALL_MODES.filter((mode) => modeIsOffered(mode, legality, isFreeHit));
  const excludedModes = ALL_MODES.filter((mode) => !modeIsOffered(mode, legality, isFreeHit));

  function handleSelectMode(mode: DismissalMode) {
    setState((s) => ({ ...s, mode }));
    setConfirmAttempted(false);
  }

  function handleConfirm() {
    setConfirmAttempted(true);
    if (canConfirm(state, endsInnings)) {
      onConfirm(state);
    }
  }

  const issues = missingFields(state, endsInnings);
  const issueFor = (field: string) => (confirmAttempted ? issues.find((i) => i.field === field) : undefined);
  const required = state.mode ? requiredFieldsForMode(state.mode) : [];

  return (
    <div>
      <div role="group" aria-label="Dismissal mode">
        {offeredModes.map((mode) => (
          <button key={mode} type="button" aria-pressed={state.mode === mode} onClick={() => handleSelectMode(mode)}>
            {modeLabel(mode)}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => setShowExcludedReasons((v) => !v)}>
        Why are other modes unavailable?
      </button>
      {showExcludedReasons && (
        <ul aria-label="Unavailable modes">
          {excludedModes.map((mode) => (
            <li key={mode}>
              {modeLabel(mode)}: {reasonModeNotOffered(mode, legality, isFreeHit)}
            </li>
          ))}
        </ul>
      )}

      {issueFor("mode") && <p role="alert">{issueFor("mode")?.message}</p>}

      {state.mode && (
        <div aria-live="polite">
          <fieldset>
            <legend>Out batter</legend>
            {battingXiNotOut.map((p) => (
              <label key={p.id}>
                <input
                  type="radio"
                  name="out-batter"
                  checked={state.outBatterId === p.id}
                  onChange={() => setState((s) => ({ ...s, outBatterId: p.id }))}
                />
                {p.name}
              </label>
            ))}
            {issueFor("outBatterId") && <p role="alert">{issueFor("outBatterId")?.message}</p>}
          </fieldset>

          <fieldset>
            <legend>End vacated</legend>
            {(["STRIKER", "NON_STRIKER"] as CreaseEnd[]).map((end) => (
              <label key={end}>
                <input
                  type="radio"
                  name="end-vacated"
                  checked={state.endVacated === end}
                  onChange={() => setState((s) => ({ ...s, endVacated: end }))}
                />
                {end === "STRIKER" ? "Striker's end" : "Non-striker's end"}
              </label>
            ))}
            {issueFor("endVacated") && <p role="alert">{issueFor("endVacated")?.message}</p>}
          </fieldset>

          {required.includes("fielderIds") && (
            <fieldset>
              <legend>Fielder</legend>
              <select
                aria-label="Fielder"
                value={state.fielderIds[0] ?? ""}
                onChange={(event) => setState((s) => ({ ...s, fielderIds: event.target.value ? [event.target.value] : [] }))}
              >
                <option value="">Select</option>
                {fieldingXi.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {issueFor("fielderIds") && <p role="alert">{issueFor("fielderIds")?.message}</p>}
            </fieldset>
          )}

          {required.includes("crossedBeforeDismissal") && (
            <fieldset>
              <legend>Did the batters cross?</legend>
              <label>
                <input
                  type="radio"
                  name="crossed"
                  checked={state.crossedBeforeDismissal === true}
                  onChange={() => setState((s) => ({ ...s, crossedBeforeDismissal: true }))}
                />
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  name="crossed"
                  checked={state.crossedBeforeDismissal === false}
                  onChange={() => setState((s) => ({ ...s, crossedBeforeDismissal: false }))}
                />
                No
              </label>
              {issueFor("crossedBeforeDismissal") && <p role="alert">{issueFor("crossedBeforeDismissal")?.message}</p>}
            </fieldset>
          )}

          {!endsInnings && (
            <fieldset>
              <legend>Incoming batter</legend>
              <select
                aria-label="Incoming batter"
                value={state.incomingBatterId ?? ""}
                onChange={(event) => setState((s) => ({ ...s, incomingBatterId: event.target.value || null }))}
              >
                <option value="">Select</option>
                {battingXiNotOut
                  .filter((p) => p.id !== state.outBatterId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              {issueFor("incomingBatterId") && <p role="alert">{issueFor("incomingBatterId")?.message}</p>}
            </fieldset>
          )}
        </div>
      )}

      <button type="button" onClick={handleConfirm}>
        Confirm dismissal
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
