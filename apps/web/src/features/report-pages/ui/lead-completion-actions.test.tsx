import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AutosaveSnapshot } from "../../report-sections/client";
import { LeadCompletionActions } from "./lead-completion-actions";
import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";

const autosave: AutosaveSnapshot = {
  state: "pending",
  lastSavedAt: null,
  dirty: true,
  isInFlight: false,
  forceSave: vi.fn(() => Promise.resolve()),
};

describe("LeadCompletionActions", () => {
  it("uses one keyboard-reachable action set and the same handlers in RTL", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onSubmit = vi.fn();
    const props = {
      autosave,
      onAdd,
      addDisabled: false,
      onSubmit,
      submitDisabled: false,
    };
    const { rerender } = render(
      <div dir="rtl">
        <LeadCompletionActions {...props} label="Header completion actions" />
      </div>,
    );
    const header = screen.getByRole("group", {
      name: "Header completion actions",
    });

    await user.click(within(header).getByRole("button", { name: "+ Add" }));
    await user.click(screen.getByRole("button", { name: "Current week item" }));
    await user.click(within(header).getByRole("button", { name: "Submit" }));
    await user.click(
      within(header).getByRole("button", { name: "Save draft now" }),
    );
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(autosave.forceSave).toHaveBeenCalledOnce();

    rerender(
      <div dir="rtl">
        <LeadCompletionActions
          {...props}
          label="Sticky completion actions"
          compact
        />
      </div>,
    );
    expect(
      screen.queryByRole("group", { name: "Header completion actions" }),
    ).toBeNull();
    const sticky = screen.getByRole("group", {
      name: "Sticky completion actions",
    });
    await user.click(within(sticky).getByRole("button", { name: "+ Add" }));
    await user.click(screen.getByRole("button", { name: "Current week item" }));
    await user.click(within(sticky).getByRole("button", { name: "Submit" }));
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("renders safe-area clearance and non-color save status in the sticky bar", () => {
    render(
      <LeadStickyCompletionActions
        actions={{
          autosave: { ...autosave, state: "error" },
          onAdd: vi.fn(),
          addDisabled: false,
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
      />,
    );

    const bar = screen.getByTestId("lead-sticky-completion-actions");
    expect(bar.className).toContain("safe-area-inset-bottom");
    expect(screen.getByRole("status")).toHaveTextContent("Draft save failed");
    expect(
      screen.getByRole("group", { name: "Sticky completion actions" })
        .className,
    ).toContain("[&_button]:min-h-10");
  });
});
