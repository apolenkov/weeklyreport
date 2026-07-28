/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts (as HTMLInputElement / HTMLSelectElement) are flagged redundant by ESLint's type-aware program, but the app tsconfig requires them for .value/.checked/.options access (TS2339) */
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

    const updatePeriodManualEntry = expectDefined(
      captured["admin.updatePeriodManual"],
    );
    await waitFor(() => {
      expect(updatePeriodManualEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const payload = updatePeriodManualEntry.mutationFn.mock.calls[0]?.[0] as {
      reportId: string;
      weekLabel?: string | null;
    };
    expect(payload.reportId).toBe(publishedFresh.id);
    expect(payload.weekLabel).toBe("Q2 close");
  });

  it("clearing the end date in edit mode is a loud error, never a silent keep-old", async () => {
    // Unlike the deadline (ruling F16), a period must end: an emptied
    // periodEnd blocks submit instead of silently omitting the field.
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(await screen.findByTestId(`action-edit-${openRow.id}`));
    await user.clear(screen.getByTestId("periods-create-end"));

    expect(screen.getByTestId("periods-end-error")).toHaveTextContent(
      "End date is required when editing a period.",
    );
    expect(screen.getByTestId("periods-create-submit")).toBeDisabled();
    expect(
      expectDefined(captured["admin.updatePeriodManual"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("clearing the deadline in edit mode is an explicit clear: hint shown, payload carries null", async () => {
    // Ruling F16 (allow-deadline-explicit-clear): an emptied deadline field
    // is a legal deletion, not a validation error.
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(await screen.findByTestId(`action-edit-${openRow.id}`));
    await user.clear(screen.getByTestId("periods-create-deadline"));

    expect(screen.getByTestId("periods-deadline-hint")).toHaveTextContent(
      "No deadline: reminders and auto-publish will not run for this period.",
    );
    expect(screen.queryByTestId("periods-deadline-error")).toBeNull();
    const submit = screen.getByTestId("periods-create-submit");
    expect(submit).toBeEnabled();

    await user.click(submit);

    const updatePeriodManualEntry = expectDefined(
      captured["admin.updatePeriodManual"],
    );
    await waitFor(() => {
      expect(updatePeriodManualEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const payload = updatePeriodManualEntry.mutationFn.mock.calls[0]?.[0] as {
      reportId: string;
      deadline?: Date | null;
    };
    expect(payload.reportId).toBe(openRow.id);
    expect(payload.deadline).toBeNull();
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

// A11y dialog behavioral regressions for periods-tab.tsx:
//   - delete dialog: Escape key, backdrop click, Cancel button, inner-click
//     stop-propagation
//   - create/edit dialog: Escape key, backdrop click, inner-click
//     stop-propagation

describe("PeriodsTab — a11y dialog behavioral regressions", () => {
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

    // DialogSurface dismisses only when target and currentTarget are the
    // backdrop, so a click on the panel is ignored.
    await user.click(screen.getByRole("alertdialog"));

    // The dialog must STILL be in the DOM.
    expect(screen.getByTestId("periods-delete-dialog")).toBeInTheDocument();
  });

  it("keeps the delete dialog open and disables its actions while pending", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    expectDefined(
      captured["admin.deleteReport"],
    ).mutationFn.mockReturnValueOnce(new Promise(() => undefined));

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

    // DialogSurface dismisses only direct backdrop clicks, so clicking the
    // panel does not call onCancel.
    await user.click(screen.getByRole("dialog"));

    // The dialog must STILL be in the DOM.
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();
  });
});

describe("PeriodsTab — focus management", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
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

  it("renders a near-midnight UTC deadline on its UTC calendar day", async () => {
    const nearMidnight = makeRow({
      id: "11111111-1111-4111-8111-111111111166",
      deadline: new Date("2026-05-09T23:30:00.000Z"),
    });
    renderTab({ active: [nearMidnight] });

    expect(
      await screen.findByTestId(`periods-active-row-${nearMidnight.id}`),
    ).toHaveTextContent("May 9, 2026");
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

    const updatePeriodManualEntry = expectDefined(
      captured["admin.updatePeriodManual"],
    );
    await waitFor(() => {
      expect(updatePeriodManualEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const payload = updatePeriodManualEntry.mutationFn.mock.calls[0]?.[0] as {
      deadline?: Date;
    };
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

    const updatePeriodManualEntry = expectDefined(
      captured["admin.updatePeriodManual"],
    );
    await waitFor(() => {
      expect(updatePeriodManualEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const payload = updatePeriodManualEntry.mutationFn.mock.calls[0]?.[0] as {
      deadline?: Date;
    };
    expect(payload.deadline?.toISOString()).toBe("2026-05-04T01:00:00.000Z");
  });
});
