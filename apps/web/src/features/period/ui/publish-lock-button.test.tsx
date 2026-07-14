import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { PublishLockButton } from "./publish-lock-button";

describe("PublishLockButton", () => {
  it('renders "Publish & Lock" when periodStatus is open', () => {
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

  it('renders "Publish & Lock" when periodStatus is reopened', () => {
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

  it('renders "Reopen Period" when periodStatus is published', () => {
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
      screen.getByRole("dialog", { name: /confirm publish/i }),
    ).toBeInTheDocument();

    // Cancel does NOT call onPublish
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
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
    // Pick the dialog's confirm action — the only button labeled exactly "Publish & Lock"
    // inside the dialog (when pendingCount === 0).
    const dialog = screen.getByRole("dialog", { name: /confirm publish/i });
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

  it('clicking "Reopen Period" opens a confirmation dialog and only fires onReopen on confirm', async () => {
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
      screen.queryByRole("dialog", { name: /confirm publish/i }),
    ).not.toBeInTheDocument();
    expect(onPublish).not.toHaveBeenCalled();
  });

  // VA-0a — verify-a11y-recommended-flip regression tests
  describe("a11y: Reopen Period button SVG (VA-0a)", () => {
    it("SVG inside Reopen Period button has aria-hidden='true'", () => {
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

      // The backdrop is the role="presentation" div wrapping the dialog (rendered
      // by ConfirmDeleteDialog into a portal). Click it to trigger onCancel.
      const backdrop = document.querySelector("[role='presentation']");
      if (!backdrop) throw new Error("backdrop [role=presentation] not found");
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

  describe("a11y: publish confirmation dialog keyboard behavior (VA-0a)", () => {
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
      const dialog = screen.getByRole("dialog", { name: /confirm publish/i });
      expect(dialog).toBeInTheDocument();

      // Escape is handled via onKeyDown on the dialog div itself — fire on
      // the element, not document (catalog prose says "press Escape"; source
      // uses a div-local onKeyDown, not document.addEventListener).
      fireEvent.keyDown(dialog, { key: "Escape" });

      expect(
        screen.queryByRole("dialog", { name: /confirm publish/i }),
      ).not.toBeInTheDocument();
    });

    it("publish dialog container is programmatically focusable via tabIndex=-1 (structural proxy for autoFocus)", async () => {
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
      const dialog = screen.getByRole("dialog", { name: /confirm publish/i });

      // The dialog div carries tabIndex={-1} and autoFocus. React calls
      // .focus() on mount (does not set the HTML `autofocus` attribute).
      // jsdom does not honour autoFocus for conditionally-rendered elements
      // whose parent button just received userEvent.click focus — asserted as
      // structural proxy per task step 6 (jsdom environment limitation).
      expect(dialog).toHaveAttribute("tabindex", "-1");

      // Verify the element can be programmatically focused (the capability
      // autoFocus relies on): call .focus() and check activeElement.
      dialog.focus();
      expect(document.activeElement).toBe(dialog);
    });
  });
});
