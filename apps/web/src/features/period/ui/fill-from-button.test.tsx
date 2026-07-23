import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ReportPeriod } from "../../report-sections";
import { FillFromButton } from "./fill-from-button";

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

  it("uses the most recent submitted period when input order is unsorted", () => {
    const older = {
      ...pastPeriod,
      id: "older",
      sourceSectionId: "sec-older",
      weekLabel: "Week 15",
      dateRange: "Apr 7–13, 2026",
    };
    const newer = {
      ...pastPeriod,
      id: "newer",
      sourceSectionId: "sec-newer",
      weekLabel: "Week 16",
      dateRange: "Apr 14–20, 2026",
    };

    render(<FillFromButton periods={[older, newer]} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Fill from most recent submitted period",
      }),
    );

    expect(
      screen.getByRole("alertdialog", { name: "Fill from Week 16?" }),
    ).toBeInTheDocument();
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

describe("FillFromButton — a11y regression: aria-hidden decorative SVGs", () => {
  // Both triggers are icon-only ToolbarIconButtons; their accessible names
  // come from aria-labels, not visible text.
  it("CopyIcon svg has aria-hidden='true'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const fillButton = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    const svg = fillButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("main fill segment of the split-button has aria-label and matching tooltip", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const fillButton = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    expect(fillButton).toBeInTheDocument();
    expect(fillButton).toHaveAttribute(
      "title",
      "Fill from most recent submitted period",
    );
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

  it("chevron segment contains svg with aria-hidden='true' and accessible name is 'Choose past report to fill from'", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const triggerButton = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton).toHaveAttribute(
      "title",
      "Choose past report to fill from",
    );
    const svg = triggerButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the two segments as ONE joined split-button (shared container)", () => {
    render(<FillFromButton periods={[pastPeriod]} />);

    const main = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    const chevron = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    expect(main.parentElement).toBe(chevron.parentElement);
  });
});

describe("FillFromButton — locked on a reopened period", () => {
  // On a reopened period the section carries published-lineage records, so the
  // server's fillFrom guard rejects every source. Disable both segments and
  // surface the reason as the tooltip instead of offering a doomed action.
  const lockedReason =
    "Fill from previous cannot replace records that are part of the published report.";

  it("disables both segments and surfaces the reason as the tooltip", () => {
    render(
      <FillFromButton periods={[pastPeriod]} lockedReason={lockedReason} />,
    );

    const main = screen.getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    const chevron = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });

    expect(main).toBeDisabled();
    expect(chevron).toBeDisabled();
    expect(main).toHaveAttribute("title", lockedReason);
    expect(chevron).toHaveAttribute("title", lockedReason);
  });

  it("does not open the confirm dialog when the locked main segment is clicked", () => {
    const onFillFrom = vi.fn();
    render(
      <FillFromButton
        periods={[pastPeriod]}
        lockedReason={lockedReason}
        onFillFrom={onFillFrom}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Fill from most recent submitted period",
      }),
    );

    expect(
      screen.queryByRole("alertdialog", { name: "Fill from Week 16?" }),
    ).not.toBeInTheDocument();
    expect(onFillFrom).not.toHaveBeenCalled();
  });
});

describe("FillFromButton — icon triggers keep the fill flow", () => {
  it("copy trigger opens the confirm dialog and confirming fires onFillFrom with the section id", () => {
    const onFillFrom = vi.fn();
    render(<FillFromButton periods={[pastPeriod]} onFillFrom={onFillFrom} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Fill from most recent submitted period",
      }),
    );

    expect(
      screen.getByRole("alertdialog", { name: "Fill from Week 16?" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "This will overwrite your current draft with data from Week 16 (Apr 14–20, 2026). Current Week items, Risks, and Decisions will be replaced. Priorities will NOT be filled.",
    );

    fireEvent.click(screen.getByRole("button", { name: /Replace & Fill/ }));
    expect(onFillFrom).toHaveBeenCalledOnce();
    expect(onFillFrom).toHaveBeenCalledWith("sec-W16");
  });
});

describe("FillFromButton — 'Previous' badge keyed by identity, not filtered index", () => {
  const week16: ReportPeriod = {
    id: "2026-W16",
    sourceSectionId: "sec-W16",
    weekLabel: "Week 16",
    dateRange: "Apr 14–20, 2026",
    isCurrent: false,
    isSubmitted: true,
  };
  const week15: ReportPeriod = {
    id: "2026-W15",
    sourceSectionId: "sec-W15",
    weekLabel: "Week 15",
    dateRange: "Apr 7–13, 2026",
    isCurrent: false,
    isSubmitted: true,
  };

  function openDropdown() {
    fireEvent.click(
      screen.getByRole("button", { name: "Choose past report to fill from" }),
    );
  }

  it("badges the real previous period (Week 16) when unfiltered", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    openDropdown();

    const badge = screen.getByText("Previous");
    expect(badge.closest("div")).toContainElement(screen.getByText(/Week 16/));
  });

  it("does not mislabel Week 15 as Previous when a search excludes Week 16", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    openDropdown();

    fireEvent.change(screen.getByPlaceholderText("Search reports…"), {
      target: { value: "Week 15" },
    });

    // The true previous period (Week 16) is filtered out entirely, so no
    // period in the remaining list — including filtered-index-0 Week 15 —
    // may carry the "Previous" badge.
    expect(screen.getByText(/Week 15/)).toBeInTheDocument();
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
  });

  it("keeps badging Week 16 as Previous while a search still matches it", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    openDropdown();

    // A query matching both rows must not disturb which row is badged.
    fireEvent.change(screen.getByPlaceholderText("Search reports…"), {
      target: { value: "Week 1" },
    });

    expect(screen.getByText(/Week 15/)).toBeInTheDocument();
    const badge = screen.getByText("Previous");
    expect(badge.closest("div")).toContainElement(screen.getByText(/Week 16/));
  });
});

describe("FillFromButton — dropdown search resets on every close path", () => {
  const week16: ReportPeriod = {
    id: "2026-W16",
    sourceSectionId: "sec-W16",
    weekLabel: "Week 16",
    dateRange: "Apr 14–20, 2026",
    isCurrent: false,
    isSubmitted: true,
  };
  const week15: ReportPeriod = {
    id: "2026-W15",
    sourceSectionId: "sec-W15",
    weekLabel: "Week 15",
    dateRange: "Apr 7–13, 2026",
    isCurrent: false,
    isSubmitted: true,
  };

  function openDropdown() {
    fireEvent.click(
      screen.getByRole("button", { name: "Choose past report to fill from" }),
    );
  }

  function reopenAndReadSearch() {
    openDropdown();
    return screen.getByPlaceholderText<HTMLInputElement>("Search reports…")
      .value;
  }

  it("clears the search on Escape", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    openDropdown();
    fireEvent.change(screen.getByPlaceholderText("Search reports…"), {
      target: { value: "Week 15" },
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(reopenAndReadSearch()).toBe("");
  });

  it("clears the search on period selection", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    openDropdown();
    fireEvent.change(screen.getByPlaceholderText("Search reports…"), {
      target: { value: "Week 15" },
    });

    fireEvent.click(screen.getByText(/Week 15/));

    expect(reopenAndReadSearch()).toBe("");
  });

  it("clears the search on an outside click", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    openDropdown();
    fireEvent.change(screen.getByPlaceholderText("Search reports…"), {
      target: { value: "Week 15" },
    });

    fireEvent.mouseDown(document.body);

    expect(reopenAndReadSearch()).toBe("");
  });

  it("clears the search when the trigger toggles the dropdown closed", () => {
    render(<FillFromButton periods={[week16, week15]} />);
    const trigger = screen.getByRole("button", {
      name: "Choose past report to fill from",
    });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText("Search reports…"), {
      target: { value: "Week 15" },
    });

    fireEvent.click(trigger);

    expect(reopenAndReadSearch()).toBe("");
  });
});

describe("sortMostRecentFirst — total order with unparseable ranges", () => {
  const period = (id: string, dateRange: string): ReportPeriod =>
    ({ id, dateRange }) as ReportPeriod;

  it("keeps newest first when a no-end-date period sits between parseable ones", async () => {
    const { sortMostRecentFirst } = await import("./fill-from-button-helpers");
    const older = period("older", "Apr 7 – Apr 13, 2026");
    const noEnd = period("no-end", "—");
    const newer = period("newer", "Apr 14 – Apr 20, 2026");

    // A null-vs-date comparison returning 0 would be non-transitive and let
    // insertion order win; unparseable ranges must sort last instead.
    expect(sortMostRecentFirst([older, noEnd, newer]).map((p) => p.id)).toEqual(
      ["newer", "older", "no-end"],
    );
  });
});
