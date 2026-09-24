import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScoreCorrectionScreen } from "./ScoreCorrectionScreen";
import type { CascadeSummary } from "./scoreCorrectionForm";

const noCascade: CascadeSummary = { orphanedDeliveryCount: null, requiresContinuation: false, firstStrikeContinuityBreakIndex: null };

describe("ScoreCorrectionScreen (UX-17)", () => {
  it("renders the cascade summary as structured, readable text", () => {
    render(
      <ScoreCorrectionScreen
        cascadeSummary={{ ...noCascade, orphanedDeliveryCount: 2 }}
        isFinal={false}
        hasElevatedRole={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Cascade summary")).toHaveTextContent("2 later deliveries are now outside the innings");
  });

  it("Save is blocked with a specific message when the reason is blank", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ScoreCorrectionScreen cascadeSummary={noCascade} isFinal={false} hasElevatedRole={false} onSave={onSave} onCancel={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A reason is required for every correction");
  });

  it("a Final match shows the elevated-role notice and Save is blocked without one", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ScoreCorrectionScreen cascadeSummary={noCascade} isFinal={true} hasElevatedRole={false} onSave={onSave} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Final");
    await user.type(screen.getByLabelText("Reason for correction"), "Fixed a mis-scored boundary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("elevated role");
  });

  it("a Final match with an elevated role and a reason saves successfully", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ScoreCorrectionScreen cascadeSummary={noCascade} isFinal={true} hasElevatedRole={true} onSave={onSave} onCancel={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Reason for correction"), "Fixed a mis-scored boundary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("Fixed a mis-scored boundary");
  });

  it("Cancel calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ScoreCorrectionScreen cascadeSummary={noCascade} isFinal={false} hasElevatedRole={false} onSave={vi.fn()} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
