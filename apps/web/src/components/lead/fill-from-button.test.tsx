import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

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

    // Primary "Fill" button is disabled because !previousPeriod
    const fillButton = screen.getByRole("button", { name: /Fill/ });
    expect(fillButton).toBeDisabled();
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
  it("CopyIcon svg has aria-hidden='true'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const fillButton = screen.getByRole("button", { name: /^Fill$/ });
    const svg = fillButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("primary Fill button contains svg with aria-hidden='true' and accessible name is 'Fill'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const fillButton = screen.getByRole("button", { name: /^Fill$/ });
    expect(fillButton).toBeInTheDocument();
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
    const svg = triggerButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
