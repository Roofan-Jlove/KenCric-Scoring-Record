/**
 * TASK-0073: `ux-specification.md UX-19` -- Match Pause/Resume.
 *
 * Confirmed genuinely unbuilt logic, not a reuse case: no pause/
 * stoppage domain model exists anywhere in `shared/` (only `UX-10`'s
 * own caller-supplied `isPaused` display flag references "pause" at
 * all, a boolean passed in for display, not real state-machine logic).
 *
 * CITATION NOTE: `UX-19`'s Trace `FR-064/078` resolves to two distinct,
 * correctly-relevant rules bundled across namespaces -- SRS `FR-064`
 * ("Drinks and stoppage capture") and discovery `FR-078` ("Record match
 * interruptions with start/end time and reason," an exact match to this
 * screen's own Purpose) -- NOT SRS's own separately-numbered `FR-078`
 * ("Target computation," unrelated) or discovery's own separately-
 * numbered `FR-064` ("Attach free-text commentary/notes to any
 * delivery," unrelated -- that's `UX-11`'s feature).
 */

export type PauseReasonPreset = "DRINKS" | "RAIN" | "BAD_LIGHT" | "INJURY";

export type PauseReason = { type: "PRESET"; preset: PauseReasonPreset } | { type: "OTHER"; text: string };

export interface PauseRecord {
  reason: PauseReason;
  startTime: number;
  endTime: number | null;
}

export type MatchPauseStatus = "ACTIVE" | "PAUSED" | "RESUMING";

export interface MatchPauseState {
  status: MatchPauseStatus;
  activePause: PauseRecord | null;
}

export function initialMatchPauseState(): MatchPauseState {
  return { status: "ACTIVE", activePause: null };
}

export type PauseResult = { outcome: "paused"; state: MatchPauseState } | { outcome: "rejected"; reason: string };

/** UX-19's own Validation: "A reason is required to pause." */
export function confirmPause(state: MatchPauseState, reason: PauseReason, startTime: number): PauseResult {
  if (state.status !== "ACTIVE") {
    return { outcome: "rejected", reason: "Cannot pause -- the match is not active" };
  }
  if (reason.type === "OTHER" && reason.text.trim() === "") {
    return { outcome: "rejected", reason: "A reason is required to pause" };
  }
  return { outcome: "paused", state: { status: "PAUSED", activePause: { reason, startTime, endTime: null } } };
}

export type ResumeResult =
  | { outcome: "resumed"; state: MatchPauseState; record: PauseRecord }
  | { outcome: "rejected"; reason: string };

/**
 * UX-19's own Validation: "Resume requires an active pause." An
 * accidental pause has an immediate, no-penalty Resume -- satisfied
 * structurally, since nothing here imposes a cooldown or minimum
 * elapsed time before Resume succeeds.
 */
export function confirmResume(state: MatchPauseState, endTime: number): ResumeResult {
  if (state.status !== "PAUSED" || state.activePause === null) {
    return { outcome: "rejected", reason: "Resume requires an active pause" };
  }
  const record: PauseRecord = { ...state.activePause, endTime };
  return { outcome: "resumed", state: { status: "ACTIVE", activePause: null }, record };
}

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

/** UX-19's own Accessibility text: "an explicit 'Match paused: Rain' announcement." */
export function pauseAnnouncement(reason: PauseReason): string {
  const label = reason.type === "PRESET" ? presetLabel(reason.preset) : reason.text;
  return `Match paused: ${label}`;
}
