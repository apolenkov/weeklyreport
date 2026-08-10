import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SlideGridModel } from "../model/slide-grid-model";
import { SlideGridHeader } from "./slide-article-header";

const offTrackGrid: SlideGridModel = {
  authors: [],
  showOwnerMarks: true,
  worstStatus: "red",
  counters: { current: 1, risks: 1, priorities: 0 },
  onTrack: { on: 0, total: 1 },
  priorityStrip: [],
  products: [],
};

describe("SlideGridHeader", () => {
  it("uses the accessible blocked status background when products are off track", () => {
    render(<SlideGridHeader ownerName="Owner" grid={offTrackGrid} />);

    expect(screen.getByTestId("slide-on-track-chip")).toHaveClass(
      "bg-[var(--color-status-blocked-bg)]",
    );
  });
});
