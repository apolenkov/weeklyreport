// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { PeriodListItem } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { PeriodsActiveSection } from "../periods-active-section";
import { PeriodsArchiveSection } from "../periods-archive-section";

const row: PeriodListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  periodStart: new Date("2026-05-04T00:00:00Z"),
  periodEnd: new Date("2026-05-10T23:59:59Z"),
  deadline: new Date("2026-05-09T18:00:00Z"),
  publishedAt: null,
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  submittedCount: 3,
  totalCount: 6,
  canReopen: false,
  canArchive: false,
};

const rowActions = {
  onPublish: () => undefined,
  onReopen: () => undefined,
  onArchive: () => undefined,
  onUnarchive: () => undefined,
  onDelete: () => undefined,
  onEdit: () => undefined,
};

describe("PeriodsActiveSection loading semantics", () => {
  it("exposes a busy loading status only while the active query loads", () => {
    render(
      <PeriodsActiveSection
        isLoading={true}
        isError={false}
        rows={[]}
        {...rowActions}
      />,
    );

    const status = screen.getByRole("status", {
      name: "Loading active periods",
    });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("data-testid", "periods-active-loading");
  });

  it.each([
    ["error", true, []],
    ["empty", false, []],
    ["ready", false, [row]],
  ] as const)(
    "keeps the active %s surface eligible for readiness",
    (_state, isError, rows) => {
      render(
        <PeriodsActiveSection
          isLoading={false}
          isError={isError}
          rows={rows}
          {...rowActions}
        />,
      );

      expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    },
  );
});

describe("PeriodsArchiveSection loading semantics", () => {
  it("exposes a busy loading status only while the expanded archive loads", () => {
    render(
      <PeriodsArchiveSection
        expanded={true}
        onToggle={() => undefined}
        isLoading={true}
        isError={false}
        rows={[]}
        {...rowActions}
      />,
    );

    const status = screen.getByRole("status", {
      name: "Loading archived periods",
    });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("data-testid", "periods-archive-loading");
  });

  it.each([
    ["error", true, []],
    ["empty", false, []],
    ["ready", false, [row]],
  ] as const)(
    "keeps the expanded archive %s surface eligible for readiness",
    (_state, isError, rows) => {
      render(
        <PeriodsArchiveSection
          expanded={true}
          onToggle={() => undefined}
          isLoading={false}
          isError={isError}
          rows={rows}
          {...rowActions}
        />,
      );

      expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    },
  );

  it("shows the next-page banner only when the next page fetch failed", () => {
    render(
      <PeriodsArchiveSection
        expanded={true}
        onToggle={() => undefined}
        isLoading={false}
        isError={true}
        rows={[row]}
        paging={{
          hasLoadedRows: true,
          hasNextPage: true,
          isFetchingNextPage: false,
          isFetchNextPageError: true,
          onLoadMore: () => undefined,
        }}
        {...rowActions}
      />,
    );

    expect(
      screen.getByText("Failed to load more archived periods."),
    ).toBeInTheDocument();
  });

  it("keeps a loaded archive quiet when a background refetch fails", () => {
    render(
      <PeriodsArchiveSection
        expanded={true}
        onToggle={() => undefined}
        isLoading={false}
        isError={true}
        rows={[row]}
        paging={{
          hasLoadedRows: true,
          hasNextPage: false,
          isFetchingNextPage: false,
          isFetchNextPageError: false,
          onLoadMore: () => undefined,
        }}
        {...rowActions}
      />,
    );

    expect(
      screen.queryByText("Failed to load more archived periods."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Archive could not be loaded."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(`periods-archive-row-${row.id}`)).toBeVisible();
  });
});
