/**
 * @vitest-environment jsdom
 *
 * The lead deck holds `selectedIndex` in local state. When the slide list
 * shrinks below the viewed index (a period rollover or a background refetch
 * dropping own-section pages), the index must clamp back to 0 instead of
 * resolving to `undefined` and rendering the empty state while valid slides
 * still exist. This suite drives the data layer directly so the slide count
 * can shrink under a non-zero index.
 */

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({
  slides: [] as { readonly id: string }[],
}));

vi.mock("./use-lead-slides-data", () => ({
  useLeadSlidesData: () => ({
    inReportMode: false,
    targetReportId: "report-1",
    isLoading: false,
    isError: false,
    slides: holder.slides,
    section: null,
    formData: null,
    canInlineEdit: false,
    refetchSection: () => undefined,
  }),
}));

vi.mock("./use-slide-inline-editor", () => ({
  useSlideInlineEditor: () => ({ onRowActivate: undefined, dialogs: null }),
}));

vi.mock("../../../hooks/use-fullscreen", () => ({
  useFullscreen: () => ({ isFullscreen: false, toggle: () => undefined }),
}));

vi.mock("./report-slides", () => ({
  ReportSlides: ({
    slides,
    selectedIndex,
    onSelect,
  }: {
    slides: readonly { id: string }[];
    selectedIndex: number;
    onSelect: (index: number) => void;
  }) => (
    <div
      data-testid="deck"
      data-selected-id={slides[selectedIndex]?.id ?? "none"}
    >
      <button type="button" data-testid="select-1" onClick={() => onSelect(1)}>
        select second
      </button>
      <button
        type="button"
        data-testid="select-negative"
        onClick={() => onSelect(-1)}
      >
        select negative
      </button>
    </div>
  ),
}));

import { LeadSlidesClient } from "./lead-slides-client";

afterEach(() => {
  holder.slides = [];
  vi.clearAllMocks();
});

describe("LeadSlidesClient selected-index clamp", () => {
  it("resets to slide 0 when the slide list shrinks below the viewed index", async () => {
    holder.slides = [{ id: "s0" }, { id: "s1" }];
    const { rerender } = render(<LeadSlidesClient />);

    fireEvent.click(screen.getByTestId("select-1"));
    expect(screen.getByTestId("deck")).toHaveAttribute(
      "data-selected-id",
      "s1",
    );

    // A refresh drops the second page: index 1 no longer exists.
    holder.slides = [{ id: "s0" }];
    rerender(<LeadSlidesClient />);

    await waitFor(() =>
      expect(screen.getByTestId("deck")).toHaveAttribute(
        "data-selected-id",
        "s0",
      ),
    );
  });

  it("recovers from a negative index stored by an empty-deck arrow press once slides arrive", async () => {
    // status-slide-deck stores Math.min(length - 1, next) — on an empty deck
    // an ArrowRight lands at -1, which an upper-bound-only clamp accepts.
    holder.slides = [];
    const { rerender } = render(<LeadSlidesClient />);

    fireEvent.click(screen.getByTestId("select-negative"));

    holder.slides = [{ id: "s0" }];
    rerender(<LeadSlidesClient />);

    await waitFor(() =>
      expect(screen.getByTestId("deck")).toHaveAttribute(
        "data-selected-id",
        "s0",
      ),
    );
  });

  it("leaves the selected index unchanged when the refresh stays in range", async () => {
    holder.slides = [{ id: "s0" }, { id: "s1" }, { id: "s2" }];
    const { rerender } = render(<LeadSlidesClient />);

    fireEvent.click(screen.getByTestId("select-1"));
    expect(screen.getByTestId("deck")).toHaveAttribute(
      "data-selected-id",
      "s1",
    );

    // A refresh that still contains index 1 must not move the selection.
    holder.slides = [{ id: "s0" }, { id: "s1" }, { id: "s2" }];
    rerender(<LeadSlidesClient />);

    await waitFor(() =>
      expect(screen.getByTestId("deck")).toHaveAttribute(
        "data-selected-id",
        "s1",
      ),
    );
  });
});
