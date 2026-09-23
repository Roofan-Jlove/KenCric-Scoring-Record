import { useState } from "react";
import { browserIdPort } from "../../core/sharedCoreStub";
import {
  canContinue,
  continueFromCreateMatch,
  initialFormState,
  templateOrganizationMismatch,
  type CreateMatchFormState,
  type DraftMatch,
  type MatchFormat,
  type MatchTemplate,
  type Ownership,
} from "./createMatchForm";

/**
 * TASK-0040: `ux-specification.md UX-04` -- Create Match. Styling
 * (Radix + Tailwind, per `technology-stack.md` ADR-T02) is deliberately
 * NOT applied here -- this component is scoped to correct structure/
 * semantics/behavior, matching every dependency this bootstrap
 * genuinely installed; a design pass is separate work for whichever
 * task actually wires up the design system.
 */

const FORMAT_OPTIONS: { value: MatchFormat; label: string }[] = [
  { value: "T20", label: "T20" },
  { value: "ODI_LIST_A", label: "ODI / List A" },
  { value: "T10", label: "T10" },
  { value: "THE_HUNDRED", label: "The Hundred" },
  { value: "CUSTOM", label: "Custom" },
];

export interface CreateMatchScreenProps {
  suggestedLabel: string;
  ownership: Ownership;
  templates: readonly MatchTemplate[];
  onContinue: (draft: DraftMatch) => void;
}

export function CreateMatchScreen({ suggestedLabel, ownership, templates, onContinue }: CreateMatchScreenProps) {
  const [state, setState] = useState<CreateMatchFormState>(() => initialFormState(suggestedLabel, ownership));

  const continueEnabled = canContinue(state);
  const mismatch = templateOrganizationMismatch(state, templates);
  const selectedFormatLabel = FORMAT_OPTIONS.find((o) => o.value === state.format)?.label ?? "";

  return (
    <form
      aria-label="Create match"
      onSubmit={(event) => {
        event.preventDefault();
        const draft = continueFromCreateMatch(state, browserIdPort);
        if (draft) onContinue(draft);
      }}
    >
      <label htmlFor="match-label">Match label</label>
      <input
        id="match-label"
        value={state.matchLabel}
        onChange={(event) => setState((s) => ({ ...s, matchLabel: event.target.value }))}
      />

      {/* Accessibility: "grouped radio semantics with a visible legend." */}
      <fieldset>
        <legend>Format</legend>
        {FORMAT_OPTIONS.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="format"
              value={option.value}
              checked={state.format === option.value}
              onChange={() => setState((s) => ({ ...s, format: option.value }))}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {/* Accessibility: "the chosen format is announced on selection." */}
      <div role="status" aria-live="polite">
        {selectedFormatLabel && `${selectedFormatLabel} selected`}
      </div>

      {templates.length > 0 && (
        <fieldset>
          <legend>Template</legend>
          {templates.map((template) => (
            <label key={template.id}>
              <input
                type="radio"
                name="template"
                value={template.id}
                checked={state.selectedTemplateId === template.id}
                onChange={() => setState((s) => ({ ...s, selectedTemplateId: template.id }))}
              />
              {template.label}
            </label>
          ))}
        </fieldset>
      )}

      {mismatch && (
        <p role="alert">This template belongs to a different organization and can&apos;t be used here.</p>
      )}

      {/* Accessibility: "Continue's disabled state and the reason are exposed to assistive tech." */}
      <button
        type="submit"
        disabled={!continueEnabled}
        aria-describedby={!continueEnabled ? "continue-disabled-reason" : undefined}
      >
        Continue
      </button>
      {!continueEnabled && <span id="continue-disabled-reason">Choose a format to continue</span>}
    </form>
  );
}
