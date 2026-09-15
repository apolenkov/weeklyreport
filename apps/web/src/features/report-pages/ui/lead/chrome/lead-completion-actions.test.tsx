import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AutosaveSnapshot } from "../../../../report-sections/client";
import { LeadCompletionActions } from "./lead-completion-actions";
import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";

const autosave: AutosaveSnapshot = {
  state: "pending",
  lastSavedAt: null,
  dirty: true,
  currentPayloadMatchesSavedBaseline: false,
  isInFlight: false,
  forceSave: vi.fn(() => Promise.resolve()),
};

describe("LeadCompletionActions", () => {
  it("keeps global completion actions limited to save and submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const props = {
      autosave,
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

    expect(within(header).queryByRole("button", { name: "+ Add" })).toBeNull();
    await user.click(within(header).getByRole("button", { name: "Submit" }));
    await user.click(
      within(header).getByRole("button", { name: "Save draft now" }),
    );
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
    expect(within(sticky).queryByRole("button", { name: "+ Add" })).toBeNull();
    await user.click(within(sticky).getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("renders safe-area clearance and non-color save status in the sticky bar", () => {
    render(
      <LeadStickyCompletionActions
        actions={{
          autosave: { ...autosave, state: "error" },
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

  it("floors every sticky action at the mobile touch target without changing desktop density", () => {
    render(
      <LeadStickyCompletionActions
        actions={{
          autosave,
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
      />,
    );

    const group = screen.getByRole("group", {
      name: "Sticky completion actions",
    });
    expect(group.className).toContain(
      "max-md:[&_button]:min-h-[var(--touch-target-min)]",
    );
    expect(group.className).toContain(
      "max-md:[&_button]:min-w-[var(--touch-target-min)]",
    );
    expect(group.className).toContain("[&_button]:min-h-10");
  });
});
