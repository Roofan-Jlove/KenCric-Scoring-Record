import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateMatchScreen } from "./CreateMatchScreen";
import type { MatchTemplate } from "./createMatchForm";

describe("CreateMatchScreen (UX-04)", () => {
  it("Continue starts disabled -- no format chosen yet", () => {
    render(<CreateMatchScreen suggestedLabel="My Match" ownership="GUEST" templates={[]} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("choosing a format enables Continue and announces the selection", async () => {
    const user = userEvent.setup();
    render(<CreateMatchScreen suggestedLabel="My Match" ownership="GUEST" templates={[]} onContinue={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "T20" }));

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("T20 selected");
  });

  it("submitting after choosing a format calls onContinue with a DraftMatch", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<CreateMatchScreen suggestedLabel="My Match" ownership="GUEST" templates={[]} onContinue={onContinue} />);

    await user.click(screen.getByRole("radio", { name: "T20" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    const draft = onContinue.mock.calls[0][0];
    expect(draft.format).toBe("T20");
    expect(draft.matchLabel).toBe("My Match");
    expect(typeof draft.id).toBe("string");
    expect(draft.id.length).toBeGreaterThan(0);
  });

  it("a mismatched template shows the alert", async () => {
    const user = userEvent.setup();
    const templates: MatchTemplate[] = [{ id: "tpl-1", organizationId: "org-B", label: "Weekend T20" }];
    render(
      <CreateMatchScreen
        suggestedLabel="My Match"
        ownership={{ organizationId: "org-A" }}
        templates={templates}
        onContinue={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Weekend T20" }));

    expect(screen.getByRole("alert")).toHaveTextContent("different organization");
  });

  it("the disabled Continue button exposes its reason to assistive tech", () => {
    render(<CreateMatchScreen suggestedLabel="My Match" ownership="GUEST" templates={[]} onContinue={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveAttribute("aria-describedby", "continue-disabled-reason");
    expect(screen.getByText("Choose a format to continue")).toBeInTheDocument();
  });
});
