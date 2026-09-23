/**
 * TASK-0040: `ux-specification.md UX-04`'s own logic, kept as plain
 * TypeScript separate from the React component (`CreateMatchScreen.tsx`)
 * so it is directly, cheaply unit-testable without rendering anything --
 * the same "test the logic, not just the render" discipline this
 * session has applied throughout `shared/`.
 */

import type { IdPort } from "../../core/sharedCoreStub";

export type MatchFormat = "T20" | "ODI_LIST_A" | "T10" | "THE_HUNDRED" | "CUSTOM";

export type Ownership = "GUEST" | { organizationId: string };

export interface MatchTemplate {
  id: string;
  organizationId: string;
  label: string;
}

export interface CreateMatchFormState {
  matchLabel: string;
  ownership: Ownership;
  selectedTemplateId: string | null;
  format: MatchFormat | null;
}

export function initialFormState(suggestedLabel: string, ownership: Ownership): CreateMatchFormState {
  return { matchLabel: suggestedLabel, ownership, selectedTemplateId: null, format: null };
}

/** UX-04's own Validation rule: "A format must be chosen before Continue enables." */
export function canContinue(state: CreateMatchFormState): boolean {
  return state.format !== null;
}

/** UX-04's own Validation rule: "if a selected template belongs to a different organization than the current context, it's flagged before use." */
export function templateOrganizationMismatch(state: CreateMatchFormState, templates: readonly MatchTemplate[]): boolean {
  if (state.selectedTemplateId === null) return false;
  if (state.ownership === "GUEST") return false;
  const template = templates.find((t) => t.id === state.selectedTemplateId);
  if (!template) return false;
  return template.organizationId !== state.ownership.organizationId;
}

/**
 * `data-specification.md §5.1`'s `matches` table requires
 * `home_team_id`/`away_team_id`/`match_timezone` (all `NOT NULL`) --
 * none of which UX-04 itself collects (team selection is `UX-06`,
 * timezone is `UX-05`). "Continue" therefore CANNOT call `TASK-0039`'s
 * `createMatch()` yet -- doing so would mean fabricating values this
 * screen never had. It produces a `DraftMatch` instead, carrying
 * forward exactly what this screen collected, with a client-generated
 * id (matching `matches.id`'s own "Client-generated -- a match is
 * always created offline-first" contract), for whichever later
 * screen/task assembles the full create payload once team selection
 * and match setup are also complete. This is a genuine, flagged open
 * integration question between `UX-04`-`09`'s multi-screen flow and
 * the single-call generic-CRUD `createMatch()` `TASK-0039` built --
 * not silently resolved here by guessing.
 */
export interface DraftMatch {
  id: string;
  matchLabel: string;
  organizationId: string | null;
  format: MatchFormat;
  templateId: string | null;
}

export function continueFromCreateMatch(state: CreateMatchFormState, idPort: IdPort): DraftMatch | null {
  if (!canContinue(state)) return null;
  return {
    id: idPort.newId(),
    matchLabel: state.matchLabel,
    organizationId: state.ownership === "GUEST" ? null : state.ownership.organizationId,
    format: state.format as MatchFormat,
    templateId: state.selectedTemplateId,
  };
}

export type TemplateListState =
  | { status: "loading" }
  | { status: "populated"; templates: readonly MatchTemplate[]; isFromCache: boolean }
  | { status: "empty" }
  | { status: "fetch-failed-fallback-to-cache"; templates: readonly MatchTemplate[] }
  | { status: "fetch-failed-no-cache" };

/**
 * UX-04's own Error handling + Empty states, unified into one pure
 * function: "Template list fetch failure falls back to the
 * last-synced local cache silently if any exist, otherwise offers
 * 'Continue with custom setup' so the flow is never blocked."
 */
export function resolveTemplateListState(
  fetchSucceeded: boolean,
  fetchedTemplates: readonly MatchTemplate[] | null,
  cachedTemplates: readonly MatchTemplate[],
): TemplateListState {
  if (fetchSucceeded && fetchedTemplates !== null) {
    return fetchedTemplates.length === 0
      ? { status: "empty" }
      : { status: "populated", templates: fetchedTemplates, isFromCache: false };
  }
  if (cachedTemplates.length > 0) {
    return { status: "fetch-failed-fallback-to-cache", templates: cachedTemplates };
  }
  return { status: "fetch-failed-no-cache" };
}
