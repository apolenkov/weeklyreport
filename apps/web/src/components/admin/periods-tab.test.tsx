import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { PeriodListItem } from "@customreport/shared";

import { TRPCProxyContext } from "../../lib/trpc-context";

import { PeriodsTab } from "./periods-tab";

// ----- mocks ---------------------------------------------------------

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
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

type Captured = {
  publishMutationFn: ReturnType<typeof vi.fn>;
  reopenMutationFn: ReturnType<typeof vi.fn>;
  archiveMutationFn: ReturnType<typeof vi.fn>;
  unarchiveMutationFn: ReturnType<typeof vi.fn>;
  // UFB-063
  createMutationFn: ReturnType<typeof vi.fn>;
  // UFB-067: edit-period mutation surface used by the row-level Edit icon.
  updateMutationFn: ReturnType<typeof vi.fn>;
  // A27: delete period mutation.
  deleteMutationFn: ReturnType<typeof vi.fn>;
  listInputs: Array<{ bucket: string }>;
};

function makeMockTRPC(opts: {
  active: PeriodListItem[];
  archive: PeriodListItem[];
  captured: Captured;
}) {
  // Use unique query keys keyed on the `bucket` arg so the active vs.
  // archive caches stay independent (the real proxy does this via
  // queryKey derivation from the trpc path).
  return {
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ["admin", "snapshot"] }) },
      getSettings: {
        pathFilter: () => ({ queryKey: ["admin", "settings"] }),
      },
      getOrganization: {
        pathFilter: () => ({ queryKey: ["admin", "getOrganization"] }),
      },
      listPeriodsByState: {
        pathFilter: () => ({ queryKey: ["admin", "listPeriodsByState"] }),
        queryOptions: (input: { bucket: string }) => {
          opts.captured.listInputs.push(input);
          return {
            queryKey: ["admin", "listPeriodsByState", input.bucket],
            queryFn: async () =>
              input.bucket === "archive" ? opts.archive : opts.active,
          };
        },
      },
      archivePeriod: {
        pathFilter: () => ({ queryKey: ["admin", "archivePeriod"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.archiveMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
      unarchivePeriod: {
        pathFilter: () => ({ queryKey: ["admin", "unarchivePeriod"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.unarchiveMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
      // UFB-063: admin.createPeriodManual mutation surface. Captured
      // so the «New period» dialog test can assert the payload that
      // would be sent to the server.
      createPeriodManual: {
        pathFilter: () => ({ queryKey: ["admin", "createPeriodManual"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.createMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
      // UFB-067: admin.updatePeriodManual mutation surface used by the
      // row-level Edit icon. Tests assert the payload reaches the server
      // with the reportId + the changed fields.
      updatePeriodManual: {
        pathFilter: () => ({ queryKey: ["admin", "updatePeriodManual"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.updateMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
      // A27 (UAT-v7 2026-05-12): delete period (draft/scheduled only).
      deleteReport: {
        pathFilter: () => ({ queryKey: ["admin", "deleteReport"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.deleteMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
    },
    period: {
      publish: {
        pathFilter: () => ({ queryKey: ["period", "publish"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.publishMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
      reopen: {
        pathFilter: () => ({ queryKey: ["period", "reopen"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.reopenMutationFn,
          onSuccess: mopts["onSuccess"],
          onError: mopts["onError"],
        }),
      },
    },
    org: { getPublic: { pathFilter: () => ({ queryKey: ["org"] }) } },
    auth: { me: { pathFilter: () => ({ queryKey: ["auth"] }) } },
    weeklyReport: {
      get: { pathFilter: () => ({ queryKey: ["weeklyReport", "get"] }) },
    },
  } as never;
}

function renderTab(args?: {
  active?: PeriodListItem[];
  archive?: PeriodListItem[];
}) {
  const captured: Captured = {
    publishMutationFn: vi.fn().mockResolvedValue({ success: true }),
    reopenMutationFn: vi.fn().mockResolvedValue({ success: true }),
    archiveMutationFn: vi.fn().mockResolvedValue({ success: true }),
    unarchiveMutationFn: vi.fn().mockResolvedValue({ success: true }),
    deleteMutationFn: vi.fn().mockResolvedValue({ success: true }),
    // UFB-063: createPeriodManual server returns the new row's shape.
    createMutationFn: vi.fn().mockResolvedValue({
      periodId: "11111111-1111-4111-8111-111111111199",
      periodStart: new Date("2026-05-18T00:00:00Z"),
      periodEnd: new Date("2026-05-24T23:59:59Z"),
      deadline: new Date("2026-05-22T15:00:00Z"),
      periodState: "scheduled",
    }),
    // UFB-067: updatePeriodManual server returns the updated row.
    updateMutationFn: vi.fn().mockResolvedValue({
      periodId: "11111111-1111-4111-8111-111111111102",
      periodStart: new Date("2026-05-04T00:00:00Z"),
      periodEnd: new Date("2026-05-10T23:59:59Z"),
      deadline: new Date("2026-05-09T18:00:00Z"),
      periodState: "published",
      weekLabel: null,
    }),
    listInputs: [],
  };

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC({
    active: args?.active ?? [openRow, publishedFresh, publishedStale],
    archive: args?.archive ?? [archivedRow],
    captured,
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(<PeriodsTab />, { wrapper: Wrapper });
  return { ...result, captured };
}

// ----- tests ---------------------------------------------------------

describe("PeriodsTab (UFB-052 / Phase 51-B)", () => {
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

  // UFB-067: inline icons replaced the kebab dropdown. Tests assert the
  // icon visibility directly without opening a menu.

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

    await waitFor(() => {
      expect(captured.archiveMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.archiveMutationFn.mock.calls[0]?.[0]).toEqual({
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

    await waitFor(() => {
      expect(captured.reopenMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.reopenMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: publishedFresh.id,
    });
  });

  it("UFB-067: kebab dropdown is gone — no action-menu-trigger-* in DOM", async () => {
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
// UFB-063: «New period» button + dialog + portal-anchored kebab
// ---------------------------------------------------------------------

describe("PeriodsTab — «New period» dialog (UFB-063)", () => {
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
    const startInput = screen.getByTestId(
      "periods-create-start",
    ) as HTMLInputElement;
    expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("submits createPeriodManual with a non-Monday periodStart value and dismisses on success", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(await screen.findByTestId("periods-new-button"));

    // Override the default start so the assertion is precise.
    const startInput = screen.getByTestId(
      "periods-create-start",
    ) as HTMLInputElement;
    await user.clear(startInput);
    await user.type(startInput, "2026-05-20");

    const labelInput = screen.getByTestId("periods-create-label");
    await user.type(labelInput, "Sprint 12");

    await user.click(screen.getByTestId("periods-create-submit"));

    await waitFor(() => {
      expect(captured.createMutationFn).toHaveBeenCalledTimes(1);
    });

    const payload = captured.createMutationFn.mock.calls[0]?.[0] as {
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

  // UFB-067: portal test removed — the kebab dropdown is gone (icons are
  // inline now), and there is no dropdown to portal anywhere.
});

// ---------------------------------------------------------------------
// UFB-067: «Edit period» dialog (mode='edit') + inline-icon Edit action
// ---------------------------------------------------------------------

describe("PeriodsTab — «Edit period» dialog (UFB-067)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("every row state exposes an Edit icon (unconditional)", async () => {
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${openRow.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`action-edit-${publishedFresh.id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`action-edit-${publishedStale.id}`),
    ).toBeInTheDocument();
  });

  it("clicking Edit opens the dialog in edit-mode prefilled from the row", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    const dialog = screen.getByTestId("periods-create-dialog");
    expect(dialog).toHaveAttribute("data-dialog-mode", "edit");
    // Header should read «Edit period».
    expect(dialog).toHaveTextContent(/edit period/i);
    // Start input prefilled from the row's periodStart (2026-05-04 UTC).
    const startInput = screen.getByTestId(
      "periods-create-start",
    ) as HTMLInputElement;
    expect(startInput.value).toBe("2026-05-04");
    // End input prefilled from the row's periodEnd (2026-05-10 UTC).
    const endInput = screen.getByTestId(
      "periods-create-end",
    ) as HTMLInputElement;
    expect(endInput.value).toBe("2026-05-10");
  });

  it("submitting the edit dialog calls updatePeriodManual with reportId + changed fields", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    // Change the deadline only — submit and assert payload carries the
    // reportId from the edited row plus the new deadline.
    const labelInput = screen.getByTestId("periods-create-label");
    await user.type(labelInput, "Q2 close");

    await user.click(screen.getByTestId("periods-create-submit"));

    await waitFor(() => {
      expect(captured.updateMutationFn).toHaveBeenCalledTimes(1);
    });
    const payload = captured.updateMutationFn.mock.calls[0]?.[0] as {
      reportId: string;
      weekLabel?: string | null;
    };
    expect(payload.reportId).toBe(publishedFresh.id);
    expect(payload.weekLabel).toBe("Q2 close");
  });

  it("edit dialog submit button reads «Save» (not «Create») in edit-mode", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    expect(screen.getByTestId("periods-create-submit")).toHaveTextContent(
      /save/i,
    );
    expect(screen.getByTestId("periods-create-submit")).not.toHaveTextContent(
      /create/i,
    );
  });
});
