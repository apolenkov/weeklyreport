import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { FillFromButton } from "./fill-from-button";
import type { ReportPeriod } from "./mock-data";

const pastPeriod: ReportPeriod = {
  id: "2026-W16",
  sourceSectionId: "sec-W16",
  weekLabel: "Week 16",
  dateRange: "Apr 14–20, 2026",
  isCurrent: false,
  isSubmitted: true,
};

describe("FillFromButton", () => {
  it("renders period list when past submitted periods exist", () => {
    const periods: ReportPeriod[] = [
      {
        id: "2026-W17",
        sourceSectionId: "sec-W17",
        weekLabel: "Week 17",
        dateRange: "Apr 21–27, 2026",
        isCurrent: true,
        isSubmitted: false,
      },
      {
        id: "2026-W16",
        sourceSectionId: "sec-W16",
        weekLabel: "Week 16",
        dateRange: "Apr 14–20, 2026",
        isCurrent: false,
        isSubmitted: true,
      },
    ];

    render(<FillFromButton periods={periods} />);
    const chevron = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    fireEvent.click(chevron);

    expect(screen.getByText(/Week 16/)).toBeInTheDocument();
    expect(screen.queryByText(/Week 17/)).not.toBeInTheDocument();
  });

  it("shows empty-state when no submitted past periods", () => {
    const periods: ReportPeriod[] = [
      {
        id: "2026-W17",
        sourceSectionId: "sec-W17",
        weekLabel: "Week 17",
        dateRange: "Apr 21–27, 2026",
        isCurrent: true,
        isSubmitted: false,
      },
    ];

    render(<FillFromButton periods={periods} />);
    const chevron = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    fireEvent.click(chevron);

    expect(
      screen.getByText("No submitted past reports found."),
    ).toBeInTheDocument();

    // Primary fill trigger is disabled because !previousPeriod
    const fillButton = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    expect(fillButton).toBeDisabled();
  });

  it("renders an Archived badge on archived rows and not on non-archived rows", () => {
    const periods: ReportPeriod[] = [
      {
        id: "2026-W16",
        sourceSectionId: "sec-W16",
        weekLabel: "Week 16",
        dateRange: "Apr 14–20, 2026",
        isCurrent: false,
        isSubmitted: true,
        archived: true,
      },
      {
        id: "2026-W15",
        sourceSectionId: "sec-W15",
        weekLabel: "Week 15",
        dateRange: "Apr 7–13, 2026",
        isCurrent: false,
        isSubmitted: true,
      },
    ];

    render(<FillFromButton periods={periods} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Choose past report to fill from" }),
    );

    // Archived row: badge present and colocated with the week label
    const archivedBadge = screen.getByText("Archived");
    expect(archivedBadge).toBeInTheDocument();
    const week16Label = screen.getByText(/Week 16/);
    expect(archivedBadge.closest("div")).toContainElement(week16Label);

    // Non-archived row: no Archived badge rendered at all
    expect(screen.getByText(/Week 15/).closest("div")).not.toContainElement(
      archivedBadge,
    );
  });

  it("shows no-match message when search yields no results", () => {
    const periods: ReportPeriod[] = [
      {
        id: "2026-W05",
        sourceSectionId: "sec-W05",
        weekLabel: "Week 5",
        dateRange: "May 4–10",
        isCurrent: false,
        isSubmitted: true,
      },
    ];

    render(<FillFromButton periods={periods} />);
    const chevron = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    fireEvent.click(chevron);

    const searchInput = screen.getByPlaceholderText("Search reports…");
    fireEvent.change(searchInput, { target: { value: "zzz" } });

    expect(
      screen.getByText("No reports match your search."),
    ).toBeInTheDocument();
  });
});

describe("FillFromButton — a11y regression (VA-0a): aria-hidden decorative SVGs", () => {
  // head-toolbar-parity D5: both triggers are icon-only ToolbarIconButtons;
  // the accessible names moved from visible text to aria-labels.
  it("CopyIcon svg has aria-hidden='true'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const fillButton = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    const svg = fillButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("primary fill trigger is a 32px icon button with aria-label and matching tooltip", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const fillButton = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    expect(fillButton).toBeInTheDocument();
    expect(fillButton).toHaveAttribute(
      "title",
      "Fill from most recent submitted period",
    );
    expect(fillButton.className).toContain("h-8");
    expect(fillButton.className).toContain("w-8");
    const svg = fillButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("ChevronDown svg has aria-hidden='true'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const triggerButton = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    const svg = triggerButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("dropdown trigger button contains svg with aria-hidden='true' and accessible name is 'Choose past report to fill from'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const triggerButton = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton).toHaveAttribute(
      "title",
      "Choose past report to fill from",
    );
    expect(triggerButton.className).toContain("h-8");
    expect(triggerButton.className).toContain("w-8");
    const svg = triggerButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FillFromButton — icon triggers keep the fill flow (head-toolbar-parity D5)", () => {
  it("copy trigger opens the confirm dialog and confirming fires onFillFrom with the section id", () => {
    const onFillFrom = vi.fn();
    render(<FillFromButton periods={[pastPeriod]} onFillFrom={onFillFrom} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Fill from most recent submitted period",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Confirm fill from previous" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Replace & Fill/ }));
    expect(onFillFrom).toHaveBeenCalledWith("sec-W16");
  });
});
