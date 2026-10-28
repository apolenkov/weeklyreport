import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SlideGridModel } from "../model/slide-grid-model";
import {
  SlideGridHeader,
  SlideLegend,
  SlidePriorityStrip,
} from "./slide-article-header";

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
  it("lets the owner title wrap on mobile while retaining the desktop treatment", () => {
    const ownerName = "Customer Insights and Reporting Platform";
    render(<SlideGridHeader ownerName={ownerName} grid={offTrackGrid} />);

    const title = screen.getByRole("heading", { name: ownerName });
    expect(title).toHaveClass("break-words", "sm:truncate");
    expect(title).not.toHaveClass("truncate");
  });

  it("uses the accessible blocked status background when products are off track", () => {
    render(<SlideGridHeader ownerName="Owner" grid={offTrackGrid} />);

    expect(screen.getByTestId("slide-on-track-chip")).toHaveClass(
      "bg-[var(--color-status-blocked-bg)]",
    );
  });

  it.each([
    { count: 0, riskLabel: "0 risks", priorityLabel: "0 priorities" },
    { count: 1, riskLabel: "1 risk", priorityLabel: "1 priority" },
    { count: 2, riskLabel: "2 risks", priorityLabel: "2 priorities" },
  ])(
    "inflects risk and priority labels for count $count",
    ({ count, riskLabel, priorityLabel }) => {
      render(
        <SlideGridHeader
          ownerName="Owner"
          grid={{
            ...offTrackGrid,
            counters: { current: 1, risks: count, priorities: count },
          }}
        />,
      );

      expect(screen.getByTestId("slide-metric-risk")).toHaveTextContent(
        riskLabel,
      );
      expect(screen.getByTestId("slide-metric-priority")).toHaveTextContent(
        priorityLabel,
      );
    },
  );
});

describe("SlidePriorityStrip", () => {
  it("shows full mobile priority text while keeping desktop details reachable", () => {
    const text = "Long priority ".repeat(30).trim();
    const grid: SlideGridModel = {
      ...offTrackGrid,
      priorityStrip: [
        {
          id: "i1",
          rank: 1,
          text,
          productId: "p1",
          productName: "Product",
          authorId: "a1",
        },
      ],
    };
    render(<SlidePriorityStrip grid={grid} authorsById={new Map()} />);

    const body = screen.getByTitle(text);
    expect(body).toBeInTheDocument();
    expect(body).not.toHaveClass("line-clamp-3");
    expect(body).toHaveClass("sm:line-clamp-3");
  });
});

describe("SlideLegend", () => {
  it("hides initials from assistive technology and provides screen-reader full name", () => {
    const authors = [
      {
        id: "u1",
        name: "Ivan Ivanov",
        initials: "II",
        role: "Lead",
        colorIndex: 0,
        isOwner: false,
      },
    ];
    render(<SlideLegend authors={authors} />);

    const legend = screen.getByTestId("slide-legend");
    expect(legend).toBeInTheDocument();

    const initials = screen.getByText("II");
    expect(initials).toHaveAttribute("aria-hidden", "true");

    const srName = screen.getByText("Ivan Ivanov", { selector: ".sr-only" });
    expect(srName).toBeInTheDocument();
  });
});
