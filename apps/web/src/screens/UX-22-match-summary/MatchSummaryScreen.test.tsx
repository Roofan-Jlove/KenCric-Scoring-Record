import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MatchSummaryScreen } from "./MatchSummaryScreen";
import type { ReconciliationCheck } from "./signOffForm";

const passingChecks: ReconciliationCheck[] = [{ invariantId: "INV-001", status: "PASS", detail: null }];
const failingChecksList: ReconciliationCheck[] = [{ invariantId: "INV-003", status: "FAIL", detail: "Total mismatch" }];

const baseProps = {
  resultHeadline: "Team A won by 5 wickets",
  checks: passingChecks,
  actorRole: "HEAD_SCORER" as const,
  previousVersion: 0,
  isSignedFinal: false,
  onSignedOff: vi.fn(),
};

describe("MatchSummaryScreen (UX-22)", () => {
  it("the result headline is the primary heading", () => {
    render(<MatchSummaryScreen {...baseProps} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Team A won by 5 wickets");
  });

  it("the reconciliation checklist uses list semantics with pass/fail conveyed by icon and text", () => {
    render(<MatchSummaryScreen {...baseProps} checks={failingChecksList} />);
    const list = screen.getByLabelText("Reconciliation report");
    expect(list.tagName).toBe("UL");
    expect(list).toHaveTextContent("INV-003: FAIL — Total mismatch");
  });

  it("a Head Scorer signs off successfully with a passing report", async () => {
    const user = userEvent.setup();
    const onSignedOff = vi.fn();
    render(<MatchSummaryScreen {...baseProps} onSignedOff={onSignedOff} />);
    await user.click(screen.getByRole("button", { name: "Sign Off (consequential action)" }));
    expect(onSignedOff).toHaveBeenCalledWith(1, false);
  });

  it("a reconciliation FAIL blocks Sign Off with an itemised list of failing checks", async () => {
    const user = userEvent.setup();
    const onSignedOff = vi.fn();
    render(<MatchSummaryScreen {...baseProps} checks={failingChecksList} onSignedOff={onSignedOff} />);
    await user.click(screen.getByRole("button", { name: "Sign Off (consequential action)" }));

    expect(onSignedOff).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("INV-003");
  });

  it("supplying an override reason allows sign-off despite a reconciliation FAIL", async () => {
    const user = userEvent.setup();
    const onSignedOff = vi.fn();
    render(<MatchSummaryScreen {...baseProps} checks={failingChecksList} onSignedOff={onSignedOff} />);
    await user.type(screen.getByLabelText("Reason for override"), "Confirmed with umpires");
    await user.click(screen.getByRole("button", { name: "Sign Off (consequential action)" }));

    expect(onSignedOff).toHaveBeenCalledWith(1, true);
    expect(screen.getByText("Signed off with a reconciliation override")).toBeInTheDocument();
  });

  it("a non-Head-Scorer attempt is blocked with a stated role requirement", async () => {
    const user = userEvent.setup();
    const onSignedOff = vi.fn();
    render(<MatchSummaryScreen {...baseProps} actorRole="ASSISTANT_SCORER" onSignedOff={onSignedOff} />);
    await user.click(screen.getByRole("button", { name: "Sign Off (consequential action)" }));

    expect(onSignedOff).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Head Scorer");
  });

  it("Sign Off is visually and semantically distinct from Share/Export -- a separate, explicit accessible name", () => {
    render(<MatchSummaryScreen {...baseProps} />);
    expect(screen.getByRole("button", { name: "Sign Off (consequential action)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("shows the Official badge once signed Final, and hides the Sign Off control", () => {
    render(<MatchSummaryScreen {...baseProps} isSignedFinal={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Official");
    expect(screen.queryByRole("button", { name: "Sign Off (consequential action)" })).not.toBeInTheDocument();
  });
});
