import { onlineManager } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../report-sections/client";
import { LeadFormHeaderActions } from "./lead-form-header-actions";

vi.mock("../../../../period", () => ({
  FillFromButton: () =>
    createElement("button", { type: "button" }, "Fill from previous"),
}));

const autosave: AutosaveSnapshot = {
  state: "saved",
  lastSavedAt: null,
  dirty: false,
  currentPayloadMatchesSavedBaseline: true,
  isInFlight: false,
  forceSave: vi.fn(() => Promise.resolve()),
};

const viewModel = {
  currentUser: { authorRole: "lead" },
  canRequestReopen: true,
  fillFromLocked: false,
  isReadOnly: true,
  visiblePeriods: [],
} as unknown as LeadFormLoadedViewModel;

describe("LeadFormHeaderActions", () => {
  it("hides every mutation affordance on a foreign slides deck", () => {
    const { rerender } = render(
      <LeadFormHeaderActions
        viewModel={viewModel}
        writeActions={{
          fillFromPending: false,
          handleFillFrom: vi.fn(),
          reopenPending: false,
          openReopenDialog: vi.fn(),
          revokePending: false,
          handleRevoke: vi.fn(),
        }}
        completionActions={{
          autosave,
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
        completionSentinelRef={{ current: null }}
        showCompletionActions
        isSlidesMode
        isSubmitted
        isForeignSlidesDeck
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Fill from previous" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Request reopen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save draft now" })).toBeNull();

    rerender(
      <LeadFormHeaderActions
        viewModel={viewModel}
        writeActions={{
          fillFromPending: false,
          handleFillFrom: vi.fn(),
          reopenPending: false,
          openReopenDialog: vi.fn(),
          revokePending: false,
          handleRevoke: vi.fn(),
        }}
        completionActions={{
          autosave,
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
        completionSentinelRef={{ current: null }}
        showCompletionActions
        isSlidesMode
        isSubmitted
        isForeignSlidesDeck={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Request reopen" }),
    ).toBeInTheDocument();
  });

  it("announces every autosave state, including failures, through one status region", () => {
    const props = {
      viewModel: { ...viewModel, isReadOnly: false } as LeadFormLoadedViewModel,
      writeActions: {
        fillFromPending: false,
        handleFillFrom: vi.fn(),
        reopenPending: false,
        openReopenDialog: vi.fn(),
        revokePending: false,
        handleRevoke: vi.fn(),
      },
      completionSentinelRef: { current: null },
      showCompletionActions: true,
      isSlidesMode: false,
      isSubmitted: false,
      isForeignSlidesDeck: false,
    };
    const { rerender } = render(
      <LeadFormHeaderActions
        {...props}
        completionActions={{
          autosave,
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
      />,
    );
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Autosaved",
    );

    rerender(
      <LeadFormHeaderActions
        {...props}
        completionActions={{
          autosave: { ...autosave, state: "error" },
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
      />,
    );
    // One stable live region: the same node updates, no second announcer.
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Save failed");
    expect(screen.getByRole("status").querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    // The Overview owns the only save indicator, so the header hides its badge.
    rerender(
      <LeadFormHeaderActions
        {...props}
        announceAutosave={false}
        completionActions={{
          autosave: { ...autosave, state: "error" },
          onSubmit: vi.fn(),
          submitDisabled: false,
        }}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Save failed")).toBeNull();
  });

  describe("submitted lead reopen state", () => {
    const writeActions = {
      fillFromPending: false,
      handleFillFrom: vi.fn(),
      reopenPending: false,
      openReopenDialog: vi.fn(),
      revokePending: false,
      handleRevoke: vi.fn(),
    };
    const renderSubmitted = (overrides: Partial<LeadFormLoadedViewModel>) =>
      render(
        <LeadFormHeaderActions
          viewModel={{ ...viewModel, ...overrides }}
          writeActions={writeActions}
          completionActions={{
            autosave,
            onSubmit: vi.fn(),
            submitDisabled: false,
          }}
          completionSentinelRef={{ current: null }}
          showCompletionActions
          isSlidesMode
          isSubmitted
          isForeignSlidesDeck={false}
        />,
      );

    it("shows a Reopen requested status instead of the action while a request is pending", () => {
      renderSubmitted({ canRequestReopen: false, hasPendingReopen: true });

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Reopen requested");
      // The icon keeps the pill from reading as a disabled action (R30).
      expect(status.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(
        screen.queryByRole("button", { name: "Request reopen" }),
      ).toBeNull();
    });

    it("offers Request reopen when no request is pending", () => {
      renderSubmitted({ canRequestReopen: true, hasPendingReopen: false });

      expect(
        screen.getByRole("button", { name: "Request reopen" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("offline save notice", () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    const renderSaving = (isInFlight: boolean, announceAutosave = true) =>
      render(
        <LeadFormHeaderActions
          viewModel={{ ...viewModel, isReadOnly: false }}
          writeActions={{
            fillFromPending: false,
            handleFillFrom: vi.fn(),
            reopenPending: false,
            openReopenDialog: vi.fn(),
            revokePending: false,
            handleRevoke: vi.fn(),
          }}
          completionActions={{
            autosave: { ...autosave, state: "saving", isInFlight },
            onSubmit: vi.fn(),
            submitDisabled: false,
          }}
          completionSentinelRef={{ current: null }}
          showCompletionActions
          isSlidesMode={false}
          isSubmitted={false}
          isForeignSlidesDeck={false}
          announceAutosave={announceAutosave}
        />,
      );

    it("announces why a paused save is stuck and clears once back online", () => {
      onlineManager.setOnline(false);
      renderSaving(true);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "You’re offline — changes will save when the connection returns",
      );

      act(() => {
        onlineManager.setOnline(true);
      });
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("leaves the announcement to pages with their own autosave live region", () => {
      onlineManager.setOnline(false);
      renderSaving(true, false);

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("stays silent while offline without a save in flight, and while online", () => {
      onlineManager.setOnline(false);
      const idle = renderSaving(false);
      expect(screen.queryByRole("alert")).toBeNull();
      idle.unmount();

      onlineManager.setOnline(true);
      renderSaving(true);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
