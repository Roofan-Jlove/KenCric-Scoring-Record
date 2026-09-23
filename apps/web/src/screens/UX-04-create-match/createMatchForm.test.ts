import { describe, expect, it } from "vitest";
import {
  canContinue,
  continueFromCreateMatch,
  initialFormState,
  resolveTemplateListState,
  templateOrganizationMismatch,
  type MatchTemplate,
} from "./createMatchForm";

describe("canContinue (UX-04 Validation)", () => {
  it("is disabled until a format is chosen", () => {
    const state = initialFormState("My Match", "GUEST");
    expect(canContinue(state)).toBe(false);
  });

  it("enables once a format is chosen", () => {
    const state = { ...initialFormState("My Match", "GUEST"), format: "T20" as const };
    expect(canContinue(state)).toBe(true);
  });
});

describe("templateOrganizationMismatch (UX-04 Validation)", () => {
  const templates: MatchTemplate[] = [{ id: "tpl-1", organizationId: "org-A", label: "Weekend T20" }];

  it("no mismatch when no template is selected", () => {
    const state = initialFormState("My Match", { organizationId: "org-A" });
    expect(templateOrganizationMismatch(state, templates)).toBe(false);
  });

  it("no mismatch for a guest match -- there is no organization context to mismatch against", () => {
    const state = { ...initialFormState("My Match", "GUEST"), selectedTemplateId: "tpl-1" };
    expect(templateOrganizationMismatch(state, templates)).toBe(false);
  });

  it("flags a template belonging to a different organization", () => {
    const state = { ...initialFormState("My Match", { organizationId: "org-B" }), selectedTemplateId: "tpl-1" };
    expect(templateOrganizationMismatch(state, templates)).toBe(true);
  });

  it("no mismatch when the template belongs to the current organization", () => {
    const state = { ...initialFormState("My Match", { organizationId: "org-A" }), selectedTemplateId: "tpl-1" };
    expect(templateOrganizationMismatch(state, templates)).toBe(false);
  });
});

describe("continueFromCreateMatch", () => {
  const fakeIdPort = { newId: () => "generated-id-1" };

  it("returns null when no format has been chosen -- Continue is disabled, so this must be unreachable via the UI, but the guard stands on its own", () => {
    const state = initialFormState("My Match", "GUEST");
    expect(continueFromCreateMatch(state, fakeIdPort)).toBeNull();
  });

  it("produces a DraftMatch with a client-generated id once a format is chosen", () => {
    const state = { ...initialFormState("My Match", "GUEST"), format: "T20" as const };
    const draft = continueFromCreateMatch(state, fakeIdPort);
    expect(draft).toEqual({
      id: "generated-id-1",
      matchLabel: "My Match",
      organizationId: null,
      format: "T20",
      templateId: null,
    });
  });

  it("resolves organizationId from ownership when not a guest match", () => {
    const state = { ...initialFormState("My Match", { organizationId: "org-A" }), format: "ODI_LIST_A" as const };
    const draft = continueFromCreateMatch(state, fakeIdPort);
    expect(draft?.organizationId).toBe("org-A");
  });
});

describe("resolveTemplateListState (UX-04 States/Error handling/Empty states)", () => {
  const templates: MatchTemplate[] = [{ id: "tpl-1", organizationId: "org-A", label: "Weekend T20" }];

  it("a successful fetch with results is populated, not from cache", () => {
    expect(resolveTemplateListState(true, templates, [])).toEqual({ status: "populated", templates, isFromCache: false });
  });

  it("a successful fetch with zero templates is the empty state", () => {
    expect(resolveTemplateListState(true, [], [])).toEqual({ status: "empty" });
  });

  // Error handling: "falls back to the last-synced local cache silently if any exist"
  it("a failed fetch falls back silently to the cache when one exists", () => {
    expect(resolveTemplateListState(false, null, templates)).toEqual({ status: "fetch-failed-fallback-to-cache", templates });
  });

  // Error handling: "otherwise offers 'Continue with custom setup' so the flow is never blocked"
  it("a failed fetch with no cache offers custom setup, never blocking the flow", () => {
    expect(resolveTemplateListState(false, null, [])).toEqual({ status: "fetch-failed-no-cache" });
  });
});
