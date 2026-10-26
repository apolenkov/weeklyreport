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
  it.each(["idle", "pending", "saving", "saved"] as const)(
    "does not render a Save control for %s autosave",
    (state) => {
      render(
        <LeadCompletionActions
          autosave={{ ...autosave, state }}
          onSubmit={vi.fn()}
          submitDisabled={false}
          label="Completion"
        />,
      );
      expect(screen.getAllByRole("button")).toHaveLength(1);
    },
  );

  it("keeps the review jump usable when schema errors hide carried blockers", async () => {
    render(
      <>
        <button data-overview-focus="confirm:current:carried">
          Carried status
        </button>
        <LeadCompletionActions
          autosave={autosave}
          onSubmit={vi.fn()}
          submitDisabled
          pendingReviewCount={1}
          label="Completion"
        />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "1 to review" }));
    expect(
      screen.getByRole("button", { name: "Carried status" }),
    ).toHaveFocus();
  });

  it("offers Retry only after a save error", async () => {
    render(
      <LeadCompletionActions
        autosave={{ ...autosave, state: "error" }}
        onSubmit={vi.fn()}
        submitDisabled={false}
        label="Completion"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Retry saving draft" }),
    );
    expect(autosave.forceSave).toHaveBeenCalledOnce();
  });

  it("shows the disabled reason next to Submit without relying on hover", () => {
    render(
      <LeadCompletionActions
        autosave={autosave}
        onSubmit={vi.fn()}
        submitDisabled
        submitDisabledReason="Review the carried work."
        label="Completion"
      />,
    );
    const reason = screen.getByText("Review the carried work.");
    expect(reason).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Submit" }),
    ).toHaveAccessibleDescription("Review the carried work.");
  });
  it("keeps completion actions limited to Submit outside save failures", async () => {
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
    expect(within(header).queryByRole("button", { name: /sav/i })).toBeNull();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(autosave.forceSave).not.toHaveBeenCalled();

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
    expect(bar.className).not.toContain("fixed");
    // The header badge is the single autosave live region.
    expect(screen.queryByRole("status")).toBeNull();
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
  it("shows an actionable review counter beside Submit and hides it at zero", async () => {
    const onReviewPending = vi.fn();
    const props = {
      autosave,
      onSubmit: vi.fn(),
      submitDisabled: true,
      onReviewPending,
    };
    const { rerender } = render(
      <LeadStickyCompletionActions
        actions={{ ...props, pendingReviewCount: 2 }}
      />,
    );
    const sticky = screen.getByRole("group", {
      name: "Sticky completion actions",
    });
    const counter = within(sticky).getByRole("button", { name: "2 to review" });
    await userEvent.click(counter);
    expect(onReviewPending).toHaveBeenCalledOnce();
    expect(counter.nextElementSibling).toBe(
      within(sticky).getByRole("button", { name: "Submit" }),
    );
    expect(
      within(sticky).getByRole("button", { name: "Submit" }),
    ).toBeDisabled();

    rerender(
      <LeadStickyCompletionActions
        actions={{ ...props, pendingReviewCount: 0 }}
      />,
    );
    expect(screen.queryByText(/to review/)).toBeNull();
  });
});
