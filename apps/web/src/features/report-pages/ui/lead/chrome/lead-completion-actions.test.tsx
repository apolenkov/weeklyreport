import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AutosaveSnapshot } from "../../../../report-sections/client";
import { LeadCompletionActions } from "./lead-completion-actions";
import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";
import { focusCompletionIssue } from "./overview-completion-focus";

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
          onReviewPending={vi.fn()}
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
          onReviewPending={() => focusCompletionIssue()}
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
        onReviewPending={vi.fn()}
        submitDisabled={false}
        label="Completion"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Retry saving draft" }),
    );
    expect(autosave.forceSave).toHaveBeenCalledOnce();
  });

  it.each(["saving", "pending", "error"] as const)(
    "retains focused Retry through in-flight %s and Saved, then focuses Submit",
    async (state) => {
      try {
        const user = userEvent.setup();
        const forceSave = vi.fn().mockResolvedValue(undefined);
        const props = {
          onSubmit: vi.fn(),
          onReviewPending: vi.fn(),
          submitDisabled: false,
          label: "Completion",
        };
        const { rerender } = render(
          <LeadCompletionActions
            {...props}
            autosave={{ ...autosave, state: "error", forceSave }}
          />,
        );
        const retry = screen.getByRole("button", {
          name: "Retry saving draft",
        });
        await user.tab();
        expect(retry).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(forceSave).toHaveBeenCalledOnce();
        vi.useFakeTimers();

        rerender(
          <LeadCompletionActions
            {...props}
            autosave={{ ...autosave, state, isInFlight: true, forceSave }}
          />,
        );
        const saving = screen.getByRole("button", { name: "Saving draft" });
        expect(saving).toBe(retry);
        expect(saving).toHaveFocus();
        expect(saving).toBeDisabled();
        expect(saving).toHaveAttribute("aria-busy", "true");
        expect(screen.getByTestId("save-now-spinner")).toBeVisible();
        saving.click();
        expect(forceSave).toHaveBeenCalledOnce();

        rerender(
          <LeadCompletionActions
            {...props}
            autosave={{ ...autosave, state: "saved", dirty: false, forceSave }}
          />,
        );
        expect(screen.getByRole("button", { name: "Draft saved" })).toBe(retry);
        expect(retry).toHaveFocus();
        expect(retry).toHaveAttribute("aria-busy", "false");
        expect(screen.getByTestId("save-now-check")).toBeVisible();
        await act(() => vi.advanceTimersByTimeAsync(1499));
        expect(screen.getByRole("button", { name: "Draft saved" })).toBe(retry);
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(screen.queryByRole("button", { name: /sav/i })).toBeNull();
        expect(screen.getByRole("button", { name: "Submit" })).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("keeps keyboard focus in completion actions when Submit is blocked after Retry", async () => {
    vi.useFakeTimers();
    try {
      const props = {
        onSubmit: vi.fn(),
        onReviewPending: vi.fn(),
        submitDisabled: true,
        submitDisabledReason: "Review carried work.",
        label: "Completion",
      };
      const { rerender } = render(
        <LeadCompletionActions
          {...props}
          autosave={{ ...autosave, state: "error" }}
        />,
      );
      screen.getByRole("button", { name: "Retry saving draft" }).focus();
      rerender(
        <LeadCompletionActions
          {...props}
          autosave={{ ...autosave, state: "saved" }}
        />,
      );
      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(screen.getByRole("group", { name: "Completion" })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not steal focus when the user leaves Retry before its Saved flash ends", async () => {
    vi.useFakeTimers();
    try {
      const props = {
        onSubmit: vi.fn(),
        onReviewPending: vi.fn(),
        submitDisabled: false,
        label: "Completion",
      };
      const { rerender } = render(
        <>
          <input aria-label="Report note" />
          <LeadCompletionActions
            {...props}
            autosave={{ ...autosave, state: "error" }}
          />
        </>,
      );
      screen.getByRole("button", { name: "Retry saving draft" }).focus();
      rerender(
        <>
          <input aria-label="Report note" />
          <LeadCompletionActions
            {...props}
            autosave={{ ...autosave, state: "saved" }}
          />
        </>,
      );
      const note = screen.getByRole("textbox", { name: "Report note" });
      note.focus();
      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(screen.queryByRole("button", { name: /sav/i })).toBeNull();
      expect(note).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps Retry available and focused when the retry fails again", () => {
    const props = {
      onSubmit: vi.fn(),
      onReviewPending: vi.fn(),
      submitDisabled: false,
      label: "Completion",
    };
    const { rerender } = render(
      <LeadCompletionActions
        {...props}
        autosave={{ ...autosave, state: "error" }}
      />,
    );
    const retry = screen.getByRole("button", { name: "Retry saving draft" });
    retry.focus();
    rerender(
      <LeadCompletionActions
        {...props}
        autosave={{ ...autosave, state: "saving", isInFlight: true }}
      />,
    );
    rerender(
      <LeadCompletionActions
        {...props}
        autosave={{ ...autosave, state: "error" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry saving draft" })).toBe(
      retry,
    );
    expect(retry).toHaveFocus();
    expect(retry).toBeEnabled();
    expect(retry).toHaveAttribute("aria-busy", "false");
  });

  it("shows the disabled reason next to Submit without relying on hover", () => {
    render(
      <LeadCompletionActions
        autosave={autosave}
        onSubmit={vi.fn()}
        onReviewPending={vi.fn()}
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
      onReviewPending: vi.fn(),
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
          onReviewPending: vi.fn(),
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
          onReviewPending: vi.fn(),
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

  it("counts pending review in the header presentation and blocks Submit", async () => {
    const onReviewPending = vi.fn();
    // The header cluster renders the same contract without the rail wrapper;
    // the counter and blocker must not depend on the rail presentation.
    const props = {
      autosave,
      onSubmit: vi.fn(),
      submitDisabled: true,
      submitDisabledReason: "Review the carried work.",
      onReviewPending,
    };
    const { rerender } = render(
      <LeadCompletionActions
        {...props}
        pendingReviewCount={2}
        label="Header completion actions"
      />,
    );
    const header = screen.getByRole("group", {
      name: "Header completion actions",
    });
    await userEvent.click(
      within(header).getByRole("button", { name: "2 to review" }),
    );
    expect(onReviewPending).toHaveBeenCalledOnce();
    expect(
      within(header).getByRole("button", { name: "Submit" }),
    ).toBeDisabled();
    expect(
      within(header).getByRole("button", { name: "Submit" }),
    ).toHaveAccessibleDescription("Review the carried work.");

    rerender(
      <LeadCompletionActions
        {...props}
        pendingReviewCount={0}
        label="Header completion actions"
      />,
    );
    expect(screen.queryByText(/to review/)).toBeNull();
  });

  it("keeps Submit the resting forward primary while Retry is busy", () => {
    const props = {
      onSubmit: vi.fn(),
      onReviewPending: vi.fn(),
      submitDisabled: false,
      label: "Completion",
    };
    const { rerender } = render(
      <LeadCompletionActions
        {...props}
        autosave={{ ...autosave, state: "error" }}
      />,
    );
    const submit = screen.getByRole("button", { name: "Submit" });
    const retry = screen.getByRole("button", { name: "Retry saving draft" });
    expect(submit.className).toContain("bg-[var(--color-starbucks-accent)]");
    // The resting Retry is a neutral outline control, never a second primary.
    expect(retry.className).not.toContain("bg-[var(--color-starbucks-accent)]");

    rerender(
      <LeadCompletionActions
        {...props}
        autosave={{ ...autosave, state: "saving", isInFlight: true }}
      />,
    );
    const busy = screen.getByRole("button", { name: "Saving draft" });
    expect(busy).toBe(retry);
    // Accent while in flight is the one transient exemption; Submit keeps the
    // single resting accent fill beside it.
    expect(busy.className).toContain("bg-[var(--color-starbucks-accent)]");
    expect(submit.className).toContain("bg-[var(--color-starbucks-accent)]");
  });
});
