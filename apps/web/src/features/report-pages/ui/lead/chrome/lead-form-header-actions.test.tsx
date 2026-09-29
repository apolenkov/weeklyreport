import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

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

    // The Overview announces autosave in its own region, so the badge stays quiet.
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
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });
});
