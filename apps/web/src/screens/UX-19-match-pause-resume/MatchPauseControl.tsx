import { useState } from "react";
import {
  confirmPause,
  confirmResume,
  initialMatchPauseState,
  pauseAnnouncement,
  type MatchPauseState,
  type PauseReason,
  type PauseReasonPreset,
  type PauseRecord,
} from "./matchPauseForm";

/**
 * TASK-0073: `ux-specification.md UX-19` -- Match Pause/Resume. Styling
 * not applied, same scope boundary as every earlier screen this
 * session. Start/end timestamps use `Date.now()` directly -- a UI-layer
 * concern, not part of the tested pure state machine.
 */

const PRESETS: PauseReasonPreset[] = ["DRINKS", "RAIN", "BAD_LIGHT", "INJURY"];

function presetLabel(preset: PauseReasonPreset): string {
  switch (preset) {
    case "DRINKS":
      return "Drinks";
    case "RAIN":
      return "Rain";
    case "BAD_LIGHT":
      return "Bad light";
    case "INJURY":
      return "Injury";
  }
}

export interface MatchPauseControlProps {
  onPaused: () => void;
  onResumed: (record: PauseRecord) => void;
}

export function MatchPauseControl({ onPaused, onResumed }: MatchPauseControlProps) {
  const [state, setState] = useState<MatchPauseState>(initialMatchPauseState);
  const [selectedPreset, setSelectedPreset] = useState<PauseReasonPreset | "OTHER" | null>(null);
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choosingReason, setChoosingReason] = useState(false);

  function handlePauseClick() {
    setChoosingReason(true);
    setError(null);
  }

  function handleConfirmPause() {
    if (selectedPreset === null) {
      setError("A reason is required to pause");
      return;
    }
    const reason: PauseReason = selectedPreset === "OTHER" ? { type: "OTHER", text: otherText } : { type: "PRESET", preset: selectedPreset };
    const result = confirmPause(state, reason, Date.now());
    if (result.outcome === "rejected") {
      setError(result.reason);
      return;
    }
    setError(null);
    setState(result.state);
    setChoosingReason(false);
    onPaused();
  }

  function handleResume() {
    const result = confirmResume(state, Date.now());
    if (result.outcome === "rejected") {
      setError(result.reason);
      return;
    }
    setError(null);
    setState(result.state);
    onResumed(result.record);
  }

  if (state.status === "PAUSED" && state.activePause) {
    return (
      <div>
        <p role="status" aria-live="assertive">
          {pauseAnnouncement(state.activePause.reason)}
        </p>
        <button type="button" autoFocus onClick={handleResume}>
          Resume
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  if (choosingReason) {
    return (
      <div>
        <fieldset>
          <legend>Reason for pause</legend>
          {PRESETS.map((preset) => (
            <label key={preset}>
              <input
                type="radio"
                name="pause-reason"
                checked={selectedPreset === preset}
                onChange={() => setSelectedPreset(preset)}
              />
              {presetLabel(preset)}
            </label>
          ))}
          <label>
            <input type="radio" name="pause-reason" checked={selectedPreset === "OTHER"} onChange={() => setSelectedPreset("OTHER")} />
            Other
          </label>
          {selectedPreset === "OTHER" && (
            <input aria-label="Other reason" value={otherText} onChange={(event) => setOtherText(event.target.value)} />
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={handleConfirmPause}>
          Confirm pause
        </button>
        <button type="button" onClick={() => setChoosingReason(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={handlePauseClick}>
      Pause
    </button>
  );
}
