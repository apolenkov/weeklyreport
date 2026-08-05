import type { PeriodListItem } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { PeriodsTab } from "./periods-tab";

// ----- mocks ---------------------------------------------------------

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]): void => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]): void => {
      toastError(...args);
    },
    info: () => undefined,
  },
}));

// ----- fixtures ------------------------------------------------------

function makeRow(overrides: Partial<PeriodListItem>): PeriodListItem {
  return {
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
    ...overrides,
  };
}

const openRow = makeRow({
  id: "11111111-1111-4111-8111-111111111101",
  periodState: "open",
  periodStatus: "open",
});
const publishedFresh = makeRow({
  id: "11111111-1111-4111-8111-111111111102",
  periodState: "published",
  periodStatus: "published",
  publishedAt: new Date(Date.now() - 2 * 3_600_000),
  submittedCount: 6,
  totalCount: 6,
  canReopen: true,
  canArchive: true,
});
const publishedStale = makeRow({
  id: "11111111-1111-4111-8111-111111111103",
  periodState: "published",
  periodStatus: "published",
  publishedAt: new Date(Date.now() - 200 * 3_600_000),
  canReopen: false,
  canArchive: true,
});
const archivedRow = makeRow({
  id: "11111111-1111-4111-8111-111111111104",
  periodState: "archived",
  periodStatus: "published",
  archived: true,
});

// ----- tRPC test double ----------------------------------------------

function renderTab(args?: {
  active?: PeriodListItem[];
  archive?: PeriodListItem[];
  activeError?: boolean;
}) {
  const activeRows = args?.active ?? [openRow, publishedFresh, publishedStale];
  const archiveRows = args?.archive ?? [archivedRow];

  const { proxy, captured } = createMockTRPC([
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
    { path: ["admin", "getOrganization"] },
    {
      path: ["admin", "listPeriodsByState"],
      // Input-parameterized: active vs archive caches stay independent.
      queryByInput: (input: unknown) => {
        const { bucket } = input as { bucket: string };
        if (bucket === "active" && args?.activeError) {
          throw new Error("boom");
        }
        return bucket === "archive" ? archiveRows : activeRows;
      },
    },
    { path: ["admin", "archivePeriod"], mutation: true },
    { path: ["admin", "unarchivePeriod"], mutation: true },
    // admin.createPeriodManual mutation surface.
    { path: ["admin", "createPeriodManual"], mutation: true },
    // Edit-period mutation surface used by the row-level Edit icon.
    { path: ["admin", "updatePeriodManual"], mutation: true },
    // Delete period (draft/scheduled only).
    { path: ["admin", "deleteReport"], mutation: true },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    { path: ["org", "getPublic"] },
    { path: ["auth", "me"] },
    { path: ["weeklyReport", "get"] },
  ]);

  // Seed default mock resolved values for mutation fns.
  expectDefined(captured["admin.archivePeriod"]).mutationFn.mockResolvedValue({
    success: true,
  });
  expectDefined(captured["admin.unarchivePeriod"]).mutationFn.mockResolvedValue(
    {
      success: true,
    },
  );
  expectDefined(captured["admin.deleteReport"]).mutationFn.mockResolvedValue({
    success: true,
  });
  // createPeriodManual server returns the new row's shape.
  expectDefined(
    captured["admin.createPeriodManual"],
  ).mutationFn.mockResolvedValue({
    periodId: "11111111-1111-4111-8111-111111111199",
    periodStart: new Date("2026-05-18T00:00:00Z"),
    periodEnd: new Date("2026-05-24T23:59:59Z"),
    deadline: new Date("2026-05-22T15:00:00Z"),
    periodState: "scheduled",
  });
  // updatePeriodManual server returns the updated row.
  expectDefined(
    captured["admin.updatePeriodManual"],
  ).mutationFn.mockResolvedValue({
    periodId: "11111111-1111-4111-8111-111111111102",
    periodStart: new Date("2026-05-04T00:00:00Z"),
    periodEnd: new Date("2026-05-10T23:59:59Z"),
    deadline: new Date("2026-05-09T18:00:00Z"),
    periodState: "published",
    weekLabel: null,
  });
  expectDefined(captured["period.publish"]).mutationFn.mockResolvedValue({
    success: true,
  });
  expectDefined(captured["period.reopen"]).mutationFn.mockResolvedValue({
    success: true,
  });

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(<PeriodsTab />, { wrapper: Wrapper });
  return { ...result, captured };
}

// ----- tests ---------------------------------------------------------

describe("PeriodsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Active rows with state badges and progress", async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-active-row-${openRow.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`periods-active-row-${publishedFresh.id}`),
    ).toBeInTheDocument();

    // Progress badge on a fully-submitted row shows 6/6 with success tone.
    const progress = screen.getByTestId(
      `periods-row-${publishedFresh.id}-progress`,
    );
    expect(progress).toHaveTextContent("6/6");
    expect(progress).toHaveAttribute("data-progress-tone", "success");

    // The state badges are scoped per row — assert the published row's
    // state cell carries the 'published' badge.
    const publishedRow = screen.getByTestId(
      `periods-active-row-${publishedFresh.id}`,
    );
    expect(publishedRow).toHaveAttribute("data-period-state", "published");
  });

  it("archive section is collapsed by default and does not render archive rows", async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-active-row-${openRow.id}`),
      ).toBeInTheDocument();
    });

    // Body hidden + no archive row rendered. The TanStack Query
    // `enabled: false` flag prevents the queryFn from running even
    // though the queryOptions object is constructed during render.
    expect(
      screen.queryByTestId("periods-archive-body"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`periods-archive-row-${archivedRow.id}`),
    ).not.toBeInTheDocument();
  });

  it("expands the archive section on toggle click and fires the archive query", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId("periods-archive-toggle"));
    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-archive-row-${archivedRow.id}`),
      ).toBeInTheDocument();
    });
  });

  it("filters archive rows by the search query", async () => {
    const user = userEvent.setup();
    const archiveOnly = makeRow({
      id: "11111111-1111-4111-8111-111111111188",
      periodStart: new Date("2026-01-05T00:00:00Z"),
      periodEnd: new Date("2026-01-11T23:59:59Z"),
      periodState: "archived",
      periodStatus: "published",
      archived: true,
      weekLabel: "Q1 kickoff",
    });
    renderTab({ archive: [archivedRow, archiveOnly] });

    await user.click(screen.getByTestId("periods-archive-toggle"));
    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-archive-row-${archiveOnly.id}`),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("periods-search"), "Q1 kickoff");

    await waitFor(() => {
      expect(
        screen.queryByTestId(`periods-archive-row-${archivedRow.id}`),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`periods-archive-row-${archiveOnly.id}`),
    ).toBeInTheDocument();
  });

  it("surfaces an active-periods query failure instead of rendering an empty list", async () => {
    renderTab({ activeError: true });

    await waitFor(() => {
      expect(screen.getByTestId("periods-active-error")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("periods-active-empty"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`periods-active-row-${openRow.id}`),
    ).not.toBeInTheDocument();
  });

  // Row actions render as inline icons, not a kebab dropdown. Tests assert
  // the icon visibility directly without opening a menu.

  it("inline icons: published-fresh row shows Edit + Reopen + Archive", async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${publishedFresh.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`action-reopen-${publishedFresh.id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`action-archive-${publishedFresh.id}`),
    ).toBeInTheDocument();
  });

  it("inline icons: published-stale (canReopen=false) hides Reopen, keeps Edit + Archive", async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${publishedStale.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId(`action-reopen-${publishedStale.id}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`action-archive-${publishedStale.id}`),
    ).toBeInTheDocument();
  });

  it("inline icons: open row exposes Edit + Publish (no Archive when canArchive=false)", async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${openRow.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`action-publish-${openRow.id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`action-archive-${openRow.id}`),
    ).not.toBeInTheDocument();
  });

  it("inline icons: archived row exposes Edit + Unarchive only", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId("periods-archive-toggle"));
    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${archivedRow.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`action-unarchive-${archivedRow.id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`action-archive-${archivedRow.id}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`action-reopen-${archivedRow.id}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`action-delete-${archivedRow.id}`),
    ).toBeDisabled();
  });

  it("reopened rows keep delete disabled despite periodState=open", async () => {
    const reopenedRow = makeRow({
      id: "11111111-1111-4111-8111-111111111177",
      periodState: "open",
      periodStatus: "reopened",
    });
    renderTab({ active: [reopenedRow] });

    expect(
      await screen.findByTestId(`action-delete-${reopenedRow.id}`),
    ).toBeDisabled();
  });

  it("clicking Archive icon fires the archive mutation with the periodId", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-archive-${publishedFresh.id}`),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`action-archive-${publishedFresh.id}`));

    const archivePeriodEntry = expectDefined(captured["admin.archivePeriod"]);
    await waitFor(() => {
      expect(archivePeriodEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(archivePeriodEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      periodId: publishedFresh.id,
    });
  });

  it("clicking Reopen icon fires the period.reopen mutation with the reportId", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-reopen-${publishedFresh.id}`),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`action-reopen-${publishedFresh.id}`));

    const reopenEntry = expectDefined(captured["period.reopen"]);
    await waitFor(() => {
      expect(reopenEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(reopenEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: publishedFresh.id,
    });
  });

  it("kebab dropdown is gone — no action-menu-trigger-* in DOM", async () => {
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${openRow.id}`),
      ).toBeInTheDocument();
    });
    // The previous kebab dropdown trigger no longer exists in the DOM.
    // We assert across every active row.
    for (const id of [openRow.id, publishedFresh.id, publishedStale.id]) {
      expect(
        screen.queryByTestId(`action-menu-trigger-${id}`),
      ).not.toBeInTheDocument();
    }
  });

  it('reopened-status published rows render the "(reopened)" badge', async () => {
    renderTab({
      active: [
        makeRow({
          id: "11111111-1111-4111-8111-111111111199",
          periodState: "open",
          periodStatus: "reopened",
        }),
      ],
    });
    await waitFor(() => {
      expect(
        screen.getByTestId(
          "periods-row-11111111-1111-4111-8111-111111111199-reopened-badge",
        ),
      ).toBeInTheDocument();
    });
  });

  it("progress badge shows em-dash when totalCount=0 (new period, no sections yet)", async () => {
    renderTab({
      active: [
        makeRow({
          id: "11111111-1111-4111-8111-111111111188",
          totalCount: 0,
          submittedCount: 0,
        }),
      ],
    });
    await waitFor(() => {
      expect(
        screen.getByTestId(
          "periods-row-11111111-1111-4111-8111-111111111188-progress",
        ),
      ).toHaveTextContent("—");
    });
  });
});

// ---------------------------------------------------------------------
// «New period» button + dialog
// ---------------------------------------------------------------------

describe("PeriodsTab — «New period» dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the «New period» button in the tab header and opens the dialog on click", async () => {
    const user = userEvent.setup();
    renderTab();

    const newBtn = await screen.findByTestId("periods-new-button");
    expect(newBtn).toBeInTheDocument();
    expect(newBtn).toHaveTextContent(/new period/i);

    await user.click(newBtn);
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();
    // Start input pre-fills with a YYYY-MM-DD value —
    // we don't pin the exact date to keep the test stable across runs;
    // just assert the format is what the server expects.
    const startInput = screen.getByTestId<HTMLInputElement>(
      "periods-create-start",
    );
    expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("submits createPeriodManual with a non-Monday periodStart value and dismisses on success", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(await screen.findByTestId("periods-new-button"));

    // Override the default start so the assertion is precise.
    const startInput = screen.getByTestId<HTMLInputElement>(
      "periods-create-start",
    );
    await user.clear(startInput);
    await user.type(startInput, "2026-05-20");

    const labelInput = screen.getByTestId("periods-create-label");
    await user.type(labelInput, "Sprint 12");

    await user.click(screen.getByTestId("periods-create-submit"));

    const createPeriodManualEntry = expectDefined(
      captured["admin.createPeriodManual"],
    );
    await waitFor(() => {
      expect(createPeriodManualEntry.mutationFn).toHaveBeenCalledTimes(1);
    });

    const payload = createPeriodManualEntry.mutationFn.mock.calls[0]?.[0] as {
      periodStart: Date;
      weekLabel?: string;
    };
    // Submitted as UTC midnight (matches the server's date frame).
    expect(payload.periodStart.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(payload.weekLabel).toBe("Sprint 12");
    // Dialog closes after success.
    await waitFor(() => {
      expect(
        screen.queryByTestId("periods-create-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  // Row actions are inline icons, not a dropdown, so there is nothing to
  // portal and no portal test here.
});
