import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { PublishLockButton } from "./publish-lock-button";

describe("PublishLockButton", () => {
  it('renders "Publish & lock" when periodStatus is open', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /publish & lock/i }),
    ).toBeInTheDocument();
  });

  it('renders "Publish & lock" when periodStatus is reopened', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="reopened"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /publish & lock/i }),
    ).toBeInTheDocument();
  });

  it('renders "Reopen period" when periodStatus is published', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="published"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /reopen period/i }),
    ).toBeInTheDocument();
  });

  it("opens a confirmation dialog before invoking onPublish", async () => {
    const onPublish = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={onPublish}
        onReopen={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );
    // Dialog opens — only the dialog confirm button calls onPublish
    expect(onPublish).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: /publish & lock report/i }),
    ).toBeInTheDocument();

    // Cancel does NOT call onPublish
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("requires a fresh opener after publish eligibility is lost and restored", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    const onReopen = vi.fn();
    const control = (canPublish: boolean) => (
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={onPublish}
        onReopen={onReopen}
        canPublish={canPublish}
      />
    );
    const { rerender } = render(control(true));
    await user.click(screen.getByRole("button", { name: /publish & lock/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    rerender(control(false));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nothing to publish/i }),
    ).toBeDisabled();
    expect(onPublish).not.toHaveBeenCalled();
    rerender(control(true));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /publish & lock/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("confirming the dialog calls onPublish exactly once", async () => {
    const onPublish = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={onPublish}
        onReopen={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );
    // Pick the dialog's confirm action — the only button labeled exactly "Publish & lock"
    // inside the dialog (when pendingCount === 0).
    const dialog = screen.getByRole("alertdialog", {
      name: /publish & lock report/i,
    });
    const confirmBtn = dialog.querySelectorAll("button");
    // Last button in dialog footer is the confirm one (label varies on pendingCount)
    await userEvent.click(expectDefined(confirmBtn[confirmBtn.length - 1]));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("shows pending-leads warning copy when pendingCount > 0", async () => {
    render(
      <PublishLockButton
        pendingCount={2}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );
    expect(screen.getByText(/2 of 6 leads/i)).toBeInTheDocument();
  });

  it('clicking "Reopen period" opens a confirmation dialog and only fires onReopen on confirm', async () => {
    const onReopen = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="published"
        onPublish={vi.fn()}
        onReopen={onReopen}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /reopen period/i }),
    );
    // The first click only opens the modal — onReopen must not fire yet.
    expect(onReopen).not.toHaveBeenCalled();
    expect(screen.getByText(/reopen this period\?/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^reopen$/i }));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it("cancelling the reopen dialog does not fire onReopen", async () => {
    const onReopen = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="published"
        onPublish={vi.fn()}
        onReopen={onReopen}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /reopen period/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onReopen).not.toHaveBeenCalled();
  });

  it("disables the trigger button while isPending=true", () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
        isPending
      />,
    );
    expect(
      screen.getByRole("button", { name: /publish & lock/i }),
    ).toBeDisabled();
  });

  it("disables publishing when there is no report content", async () => {
    const onPublish = vi.fn();
    render(
      <PublishLockButton
        pendingCount={6}
        totalLeads={6}
        periodStatus="open"
        onPublish={onPublish}
        onReopen={vi.fn()}
        canPublish={false}
      />,
    );

    const button = screen.getByRole("button", { name: /nothing to publish/i });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(
      screen.queryByRole("alertdialog", { name: /publish & lock report/i }),
    ).not.toBeInTheDocument();
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("makes no reversibility claim the client cannot back (reopen may be disabled or expired)", async () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).not.toHaveTextContent("cannot be undone");
    expect(dialog).not.toHaveTextContent("can be reversed");
    expect(dialog).toHaveTextContent("Leads can no longer edit this period.");
  });

  it("tells the head that reopening returns submitted sections to draft", async () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="published"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /reopen period/i }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Sections they already submitted return to draft and must be submitted again.",
    );
  });

  describe("focus after publishing", () => {
    const succeeds = (onSuccess: () => void) => onSuccess();
    const fails = () => undefined;
    const renderStatus = (
      periodStatus: "open" | "published",
      onPublish: (onSuccess: () => void) => void = succeeds,
    ) => (
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus={periodStatus}
        onPublish={onPublish}
        onReopen={vi.fn()}
      />
    );

    async function confirmPublish() {
      await userEvent.click(
        screen.getByRole("button", { name: /publish & lock/i }),
      );
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(
        expectDefined([...dialog.querySelectorAll("button")].at(-1)),
      );
    }

    it("moves focus to Reopen period once the Publish button is replaced", async () => {
      const { rerender } = render(renderStatus("open"));
      await confirmPublish();

      rerender(renderStatus("published"));

      expect(
        screen.getByRole("button", { name: /reopen period/i }),
      ).toHaveFocus();
    });

    it("does not steal focus when a failed publish is followed by someone else's publish", async () => {
      const { rerender } = render(renderStatus("open", fails));
      await confirmPublish();

      rerender(renderStatus("published", fails));

      expect(document.body).toHaveFocus();
    });

    it("does not steal focus when a published period is simply displayed", () => {
      render(renderStatus("published"));
      expect(document.body).toHaveFocus();
    });
  });

  describe("focus after reopening", () => {
    const succeeds = (onSuccess: () => void) => onSuccess();
    const renderStatus = (
      periodStatus: "open" | "published",
      canPublish: boolean,
      onReopen: (onSuccess: () => void) => void = succeeds,
    ) => (
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus={periodStatus}
        onPublish={vi.fn()}
        onReopen={onReopen}
        canPublish={canPublish}
      />
    );

    async function confirmReopen() {
      await userEvent.click(
        screen.getByRole("button", { name: /reopen period/i }),
      );
      await userEvent.click(screen.getByRole("button", { name: /^reopen$/i }));
    }

    it("moves focus to Publish & lock once it replaces Reopen period", async () => {
      const { rerender } = render(renderStatus("published", true));
      await confirmReopen();

      rerender(renderStatus("open", true));

      expect(
        screen.getByRole("button", { name: /publish & lock/i }),
      ).toHaveFocus();
    });

    it("falls back to the page when Publish is disabled for lack of submissions", async () => {
      const main = document.createElement("main");
      main.id = "main-content";
      main.tabIndex = -1;
      document.body.append(main);
      onTestFinished(() => main.remove());
      const { rerender } = render(renderStatus("published", true));
      await confirmReopen();

      rerender(renderStatus("open", false));

      expect(main).toHaveFocus();
    });

    it("does not steal focus when a failed reopen is followed by someone else's reopen", async () => {
      const fails = () => undefined;
      const { rerender } = render(renderStatus("published", true, fails));
      await confirmReopen();

      rerender(renderStatus("open", true, fails));

      expect(document.body).toHaveFocus();
    });

    it("does not move focus when the period is reopened by someone else", () => {
      const { rerender } = render(renderStatus("published", true));

      rerender(renderStatus("open", true));

      expect(document.body).toHaveFocus();
    });
  });

  describe("a11y: Reopen period button SVG", () => {
    it("SVG inside Reopen period button has aria-hidden='true'", () => {
      render(
        <PublishLockButton
          pendingCount={0}
          totalLeads={6}
          periodStatus="published"
          onPublish={vi.fn()}
          onReopen={vi.fn()}
        />,
      );
      const reopenBtn = screen.getByRole("button", { name: /reopen period/i });
      const svg = expectDefined(reopenBtn.querySelector("svg"));
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("reopen dialog: backdrop / inside-click polarity", () => {
    it("clicking the backdrop (overlay) closes the reopen dialog without firing onReopen", async () => {
      const onReopen = vi.fn();
      render(
        <PublishLockButton
          pendingCount={0}
          totalLeads={6}
          periodStatus="published"
          onPublish={vi.fn()}
          onReopen={onReopen}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: /reopen period/i }),
      );
      // Dialog is open.
      expect(screen.getByText(/reopen this period\?/i)).toBeInTheDocument();

      const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
      if (!backdrop) throw new Error("dialog overlay not found");
      await userEvent.click(backdrop);

      // Dialog must be gone and onReopen must NOT have been called.
      expect(
        screen.queryByText(/reopen this period\?/i),
      ).not.toBeInTheDocument();
      expect(onReopen).not.toHaveBeenCalled();
    });

    it("clicking inside the reopen dialog does NOT close it", async () => {
      const onReopen = vi.fn();
      render(
        <PublishLockButton
          pendingCount={0}
          totalLeads={6}
          periodStatus="published"
          onPublish={vi.fn()}
          onReopen={onReopen}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: /reopen period/i }),
      );
      expect(screen.getByText(/reopen this period\?/i)).toBeInTheDocument();

      // Click the dialog container itself (stopPropagation prevents backdrop close).
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(dialog);

      // Dialog must still be visible and onReopen must NOT have fired.
      expect(screen.getByText(/reopen this period\?/i)).toBeInTheDocument();
      expect(onReopen).not.toHaveBeenCalled();
    });
  });

  describe("a11y: publish confirmation dialog keyboard behavior", () => {
    it("pressing Escape on the focused dialog container closes the publish dialog", async () => {
      render(
        <PublishLockButton
          pendingCount={0}
          totalLeads={6}
          periodStatus="open"
          onPublish={vi.fn()}
          onReopen={vi.fn()}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /publish & lock/i }),
      );
      const dialog = screen.getByRole("alertdialog", {
        name: /publish & lock report/i,
      });
      expect(dialog).toBeInTheDocument();

      fireEvent.keyDown(dialog, { key: "Escape" });

      expect(
        screen.queryByRole("alertdialog", { name: /publish & lock report/i }),
      ).not.toBeInTheDocument();
    });

    it("focuses the non-destructive Cancel action when the publish dialog opens", async () => {
      render(
        <PublishLockButton
          pendingCount={0}
          totalLeads={6}
          periodStatus="open"
          onPublish={vi.fn()}
          onReopen={vi.fn()}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /publish & lock/i }),
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("clicking the publish backdrop dismisses without publishing", async () => {
      const onPublish = vi.fn();
      render(
        <PublishLockButton
          pendingCount={0}
          totalLeads={6}
          periodStatus="open"
          onPublish={onPublish}
          onReopen={vi.fn()}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /publish & lock/i }),
      );
      screen.getByRole("alertdialog", {
        name: /publish & lock report/i,
      });
      const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
      if (!backdrop) throw new Error("dialog overlay not found");
      await userEvent.click(backdrop);

      expect(
        screen.queryByRole("alertdialog", { name: /publish & lock report/i }),
      ).not.toBeInTheDocument();
      expect(onPublish).not.toHaveBeenCalled();
    });
  });
});
