/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts (as HTMLInputElement / HTMLSelectElement) are flagged redundant by ESLint's type-aware program, but the app tsconfig requires them for .value/.checked/.options access (TS2339); wave-6c-ii */
import type { PeriodListItem } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
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
  captured["admin.archivePeriod"].mutationFn.mockResolvedValue({
    success: true,
  });
  captured["admin.unarchivePeriod"].mutationFn.mockResolvedValue({
    success: true,
  });
  captured["admin.deleteReport"].mutationFn.mockResolvedValue({
    success: true,
  });
  // createPeriodManual server returns the new row's shape.
  captured["admin.createPeriodManual"].mutationFn.mockResolvedValue({
    periodId: "11111111-1111-4111-8111-111111111199",
    periodStart: new Date("2026-05-18T00:00:00Z"),
    periodEnd: new Date("2026-05-24T23:59:59Z"),
    deadline: new Date("2026-05-22T15:00:00Z"),
    periodState: "scheduled",
  });
  // updatePeriodManual server returns the updated row.
  captured["admin.updatePeriodManual"].mutationFn.mockResolvedValue({
    periodId: "11111111-1111-4111-8111-111111111102",
    periodStart: new Date("2026-05-04T00:00:00Z"),
    periodEnd: new Date("2026-05-10T23:59:59Z"),
    deadline: new Date("2026-05-09T18:00:00Z"),
    periodState: "published",
    weekLabel: null,
  });
  captured["period.publish"].mutationFn.mockResolvedValue({ success: true });
  captured["period.reopen"].mutationFn.mockResolvedValue({ success: true });

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
      expect(captured["admin.archivePeriod"].mutationFn).toHaveBeenCalledTimes(
        1,
      );
    });
    expect(
      captured["admin.archivePeriod"].mutationFn.mock.calls[0]?.[0],
    ).toEqual({
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
      expect(captured["period.reopen"].mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured["period.reopen"].mutationFn.mock.calls[0]?.[0]).toEqual({
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
      expect(
        captured["admin.createPeriodManual"].mutationFn,
      ).toHaveBeenCalledTimes(1);
    });

    const payload = captured["admin.createPeriodManual"].mutationFn.mock
      .calls[0]?.[0] as {
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

// ---------------------------------------------------------------------
// «Edit period» dialog (mode='edit') + inline-icon Edit action
// ---------------------------------------------------------------------

describe("PeriodsTab — «Edit period» dialog", () => {
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
      expect(
        captured["admin.updatePeriodManual"].mutationFn,
      ).toHaveBeenCalledTimes(1);
    });
    const payload = captured["admin.updatePeriodManual"].mutationFn.mock
      .calls[0]?.[0] as {
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

// ---------------------------------------------------------------------
// VA-0a: a11y behavioral regression tests (verify-a11y-recommended-flip)
// Covers the high-priority unit-rtl rows for periods-tab.tsx:
//   - delete dialog: Escape key, backdrop click, Cancel button, inner-click
//     stop-propagation
//   - create/edit dialog: Escape key, backdrop click, inner-click
//     stop-propagation
// ---------------------------------------------------------------------

describe("PeriodsTab — a11y dialog behavioral regressions (VA-0a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Open the delete dialog by clicking the delete icon on openRow
  // (openRow.periodStatus === "open" → delete button is ENABLED).
  // Published/archived rows have periodStatus === "published" → delete is
  // disabled there, so the dialog would never appear.

  it("Escape closes the delete-confirmation dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    // Wait for rows, then open the delete dialog via the delete icon.
    await user.click(await screen.findByTestId(`action-delete-${openRow.id}`));
    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();

    // Fire Escape on the document — the shared focus hook closes the dialog.
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByTestId("periods-delete-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("clicking the delete-dialog backdrop closes the dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId(`action-delete-${openRow.id}`));
    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();

    // The backdrop IS the element with data-testid="periods-delete-dialog"
    // and role="presentation". Clicking it directly calls onClick →
    // setDeleteConfirm(null).
    await user.click(screen.getByTestId("periods-delete-dialog"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("periods-delete-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("clicking the Cancel button in the delete-confirmation dialog closes it", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId(`action-delete-${openRow.id}`));
    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();

    // The Cancel button is inside the dialog; its onClick calls
    // setDeleteConfirm(null) directly.
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByTestId("periods-delete-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("clicking inside the delete-dialog panel (role=dialog) does NOT close it", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId(`action-delete-${openRow.id}`));
    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();

    // The inner div has role="dialog" and an onClick that calls
    // e.stopPropagation(), so the backdrop's onClick is NOT triggered.
    await user.click(screen.getByRole("alertdialog"));

    // The dialog must STILL be in the DOM.
    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();
  });

  it("keeps the delete dialog open and disables its actions while pending", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    captured["admin.deleteReport"].mutationFn.mockReturnValueOnce(
      new Promise(() => undefined),
    );

    await user.click(await screen.findByTestId(`action-delete-${openRow.id}`));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("Escape closes the create/edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    // Open the create dialog.
    await user.click(await screen.findByTestId("periods-new-button"));
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();

    // Escape fires the useEffect keydown handler → onCancel → setShowCreate(false).
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByTestId("periods-create-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("clicking the create-dialog backdrop closes the dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId("periods-new-button"));
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();

    // The backdrop IS the element with data-testid="periods-create-dialog"
    // and role="presentation". Its onClick calls onCancel.
    await user.click(screen.getByTestId("periods-create-dialog"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("periods-create-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("clicking inside the create-dialog panel (role=dialog) does NOT close it", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId("periods-new-button"));
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();

    // The inner div (role="dialog") has an onClick that calls
    // e.stopPropagation(), preventing the backdrop's onCancel from firing.
    await user.click(screen.getByRole("dialog"));

    // The dialog must STILL be in the DOM.
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();
  });
});

// admin-dialog-focus-management (autofocus-admin-dialogs)
describe("PeriodsTab — focus management (autofocus-admin-dialogs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("period-start input receives focus when the dialog opens (autoFocus)", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId("periods-new-button"));

    const input = screen.getByTestId("periods-create-start");
    // React honours autoFocus on conditionally-mounted elements in jsdom;
    // dropping the autoFocus wiring in production code fails this assert.
    expect(input).toHaveFocus();
  });

  it("focus returns to New-period button after create dialog closes via Cancel", async () => {
    const user = userEvent.setup();
    renderTab();

    const newBtn = await screen.findByTestId("periods-new-button");
    newBtn.focus();
    await user.click(newBtn);

    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("periods-create-cancel"));

    expect(
      screen.queryByTestId("periods-create-dialog"),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(newBtn);
  });

  it("focus returns to New-period button after create dialog closes via Escape", async () => {
    const user = userEvent.setup();
    renderTab();

    const newBtn = await screen.findByTestId("periods-new-button");
    newBtn.focus();
    await user.click(newBtn);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByTestId("periods-create-dialog"),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(newBtn);
  });
});

// ---------------------------------------------------------------------
// The deadline datetime-local field must round-trip as UTC wall-clock in
// every timezone. Under a non-UTC process timezone a `new Date(deadline)`
// local parse would drift the stored deadline by the offset on every
// re-save; these tests drive the REAL edit-submit path under Europe/Moscow
// (UTC+3) so reverting to the local parse fails them.
// ---------------------------------------------------------------------

describe("PeriodsTab — deadline UTC round-trip under a non-UTC timezone", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Europe/Moscow";
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Encodes the assumption the round-trip teeth rest on: if the non-UTC TZ
  // did not take effect in the worker, a bare `new Date(deadline)` local
  // parse would resolve to the same UTC instant as the fix, and the tests
  // below would pass even against the reverted bug. This fails loud instead.
  it("guard: the non-UTC process timezone is active in the worker", () => {
    expect(new Date("2026-05-09T18:00").toISOString()).toBe(
      "2026-05-09T15:00:00.000Z",
    );
  });

  // publishedFresh.deadline is 2026-05-09T18:00:00Z — a non-midnight UTC
  // instant. Editing the row without touching the deadline must submit the
  // identical instant. Under UTC+3 the old local parse would yield
  // 2026-05-09T15:00:00.000Z (-3h drift).
  it("no-op edit submits the stored deadline unchanged (no -N-hour drift)", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    // Confirm the field prefilled with the UTC wall-clock display.
    const deadlineInput = screen.getByTestId(
      "periods-create-deadline",
    ) as HTMLInputElement;
    expect(deadlineInput.value).toBe("2026-05-09T18:00");

    await user.click(screen.getByTestId("periods-create-submit"));

    await waitFor(() => {
      expect(
        captured["admin.updatePeriodManual"].mutationFn,
      ).toHaveBeenCalledTimes(1);
    });
    const payload = captured["admin.updatePeriodManual"].mutationFn.mock
      .calls[0]?.[0] as { deadline?: Date };
    expect(payload.deadline?.toISOString()).toBe("2026-05-09T18:00:00.000Z");
  });

  // An early-in-day deadline (01:00) is inside [periodStart, periodEnd] only
  // when parsed as UTC. The old UTC+3 local parse would resolve it to
  // 2026-05-03T22:00:00.000Z — before the 2026-05-04T00:00:00.000Z start —
  // tripping the range-validation error and blocking submit. The fix keeps
  // the validation and the submit on the same UTC instant, so no error
  // appears and the deadline reaches the payload as the UTC-parsed instant.
  it("range validation and submit agree on the UTC instant for an in-range early deadline", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    const deadlineInput = screen.getByTestId("periods-create-deadline");
    fireEvent.change(deadlineInput, { target: { value: "2026-05-04T01:00" } });

    // No "Deadline cannot be before period start" error under the UTC parse.
    expect(
      screen.queryByTestId("periods-deadline-error"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("periods-create-submit"));

    await waitFor(() => {
      expect(
        captured["admin.updatePeriodManual"].mutationFn,
      ).toHaveBeenCalledTimes(1);
    });
    const payload = captured["admin.updatePeriodManual"].mutationFn.mock
      .calls[0]?.[0] as { deadline?: Date };
    expect(payload.deadline?.toISOString()).toBe("2026-05-04T01:00:00.000Z");
  });
});
