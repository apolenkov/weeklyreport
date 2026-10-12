import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";

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

import {
  makeRow,
  openRow,
  publishedFresh,
  publishedStale,
  renderTab,
} from "./periods-tab.test-harness";

// ----- tests ---------------------------------------------------------

// ---------------------------------------------------------------------
// «Edit period» dialog (mode='edit') + inline-icon Edit action
// ---------------------------------------------------------------------

describe("PeriodsTab — «Edit period» dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks period end as required in edit mode in label, native, and ARIA semantics", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId(`action-edit-${openRow.id}`));

    const endInput = screen.getByTestId<HTMLInputElement>("periods-create-end");
    const endLabel = document.querySelector('label[for="period-end"]');
    expect(endLabel).toHaveTextContent(/Period end\s*\*/);
    expect(endLabel).not.toHaveTextContent("(optional)");
    expect(endInput).toBeRequired();
    expect(endInput).toHaveAttribute("aria-required", "true");
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
    const startInput = screen.getByTestId<HTMLInputElement>(
      "periods-create-start",
    );
    expect(startInput.value).toBe("2026-05-04");
    // End input prefilled from the row's periodEnd (2026-05-10 UTC).
    const endInput = screen.getByTestId<HTMLInputElement>("periods-create-end");
    expect(endInput.value).toBe("2026-05-10");
  });

  it("submitting the edit dialog calls updatePeriodManual with reportId + changed fields", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    // Change the label only and keep the edited row identity in the payload.
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

describe("PeriodsTab — «New period» dialog period-end semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps period end optional in create mode in label, native, and ARIA semantics", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId("periods-new-button"));

    const endInput = screen.getByTestId<HTMLInputElement>("periods-create-end");
    const endLabel = document.querySelector('label[for="period-end"]');
    expect(endLabel).toHaveTextContent(/Period end\s*\(optional\)/);
    expect(endInput).not.toBeRequired();
    expect(endInput).toHaveAttribute("aria-required", "false");
  });
});

describe.each([
  {
    mode: "create",
    mutation: "admin.createPeriodManual",
    triggerTestId: "periods-new-button",
    pendingLabel: "Creating…",
  },
  {
    mode: "edit",
    mutation: "admin.updatePeriodManual",
    triggerTestId: `action-edit-${openRow.id}`,
    pendingLabel: "Saving…",
  },
] as const)("PeriodsTab — $mode pending draft", (scenario) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks a reversed range and submits an ordered same-day range after correction", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const mutation = expectDefined(captured[scenario.mutation]);
    await user.click(await screen.findByTestId(scenario.triggerTestId));
    const start = screen.getByTestId<HTMLInputElement>("periods-create-start");
    const end = screen.getByTestId<HTMLInputElement>("periods-create-end");
    const submit = screen.getByTestId("periods-create-submit");

    fireEvent.change(start, { target: { value: "2026-05-12" } });
    fireEvent.change(end, { target: { value: "2026-05-11" } });
    await user.clear(screen.getByTestId("periods-create-deadline"));

    expect(start.value).toBe("2026-05-12");
    expect(end.value).toBe("2026-05-11");
    expect(submit).toBeDisabled();
    expect(screen.getByTestId("periods-end-error")).toHaveTextContent(
      "End date cannot be before period start.",
    );
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAttribute("aria-describedby", "period-end-error");
    await user.click(submit);
    expect(mutation.mutationFn).not.toHaveBeenCalled();

    fireEvent.change(end, { target: { value: "2026-05-12" } });
    expect(screen.queryByTestId("periods-end-error")).not.toBeInTheDocument();
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(mutation.mutationFn).toHaveBeenCalledOnce());
    expect(mutation.mutationFn.mock.calls[0]?.[0]).toMatchObject({
      periodStart: new Date("2026-05-12T00:00:00.000Z"),
      periodEnd: new Date("2026-05-12T23:59:59.999Z"),
      ...(scenario.mode === "edit" ? { deadline: null } : {}),
    });
  });

  it.each(["success", "failure"] as const)(
    "locks the submitted draft until %s settles",
    async (outcome) => {
      const user = userEvent.setup();
      const { captured } = renderTab();
      const mutation = expectDefined(captured[scenario.mutation]);
      const pending = Promise.withResolvers<unknown>();
      mutation.mutationFn.mockReturnValueOnce(pending.promise);

      await user.click(await screen.findByTestId(scenario.triggerTestId));
      const labelInput = screen.getByTestId("periods-create-label");
      await user.type(labelInput, "Submitted label");
      await user.click(screen.getByTestId("periods-create-submit"));

      await waitFor(() => {
        expect(mutation.mutationFn).toHaveBeenCalledTimes(1);
      });
      expect(mutation.mutationFn.mock.calls[0]?.[0]).toMatchObject({
        weekLabel: "Submitted label",
      });

      for (const testId of [
        "periods-create-start",
        "periods-create-end",
        "periods-create-deadline",
        "periods-create-label",
      ]) {
        expect(screen.getByTestId(testId)).toBeDisabled();
      }
      expect(screen.getByTestId("periods-create-cancel")).toBeDisabled();
      expect(
        screen.getByRole("button", { name: scenario.pendingLabel }),
      ).toBeDisabled();

      await user.type(labelInput, " ignored");
      await user.click(
        screen.getByRole("button", { name: scenario.pendingLabel }),
      );
      expect(labelInput).toHaveValue("Submitted label");
      expect(mutation.mutationFn).toHaveBeenCalledTimes(1);

      await act(async () => {
        if (outcome === "success") pending.resolve(undefined);
        else pending.reject(new Error("Save failed"));
        await pending.promise.catch(() => undefined);
      });

      if (outcome === "success") {
        await waitFor(() => {
          expect(
            screen.queryByTestId("periods-create-dialog"),
          ).not.toBeInTheDocument();
        });
        return;
      }

      await waitFor(() => {
        expect(labelInput).toBeEnabled();
      });
      expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();
      expect(labelInput).toHaveValue("Submitted label");
      await user.type(labelInput, " retry");
      expect(labelInput).toHaveValue("Submitted label retry");
    },
  );
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

  it("keeps the create dialog open and blocks dismissal while pending", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    expectDefined(
      captured["admin.createPeriodManual"],
    ).mutationFn.mockReturnValueOnce(new Promise(() => undefined));

    await user.click(await screen.findByTestId("periods-new-button"));
    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("periods-create-submit"));
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();

    // Escape and backdrop dismissal are suppressed while the mutation is in
    // flight — the dialog must not be abandoned mid-submit.
    fireEvent.keyDown(document, { key: "Escape" });
    await user.click(screen.getByTestId("periods-create-dialog"));

    expect(screen.getByTestId("periods-create-dialog")).toBeInTheDocument();
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

describe("PeriodsTab — delete confirmation identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      row: makeRow({
        id: "11111111-1111-4111-8111-111111111171",
        weekLabel: "Week 38",
        periodStart: new Date("2026-09-14T00:00:00.000Z"),
        periodEnd: new Date("2026-09-20T23:59:59.000Z"),
      }),
      label: "Week 38",
      range: "Sep 14–20, 2026",
    },
    {
      row: makeRow({
        id: "11111111-1111-4111-8111-111111111172",
        weekLabel: "Quarter close",
        periodStart: new Date("2026-09-21T00:00:00.000Z"),
        periodEnd: new Date("2026-09-27T23:59:59.000Z"),
      }),
      label: "Quarter close",
      range: "Sep 21–27, 2026",
    },
  ])(
    "identifies $label and cancels without deleting",
    async ({ row, label, range }) => {
      const user = userEvent.setup();
      const { captured } = renderTab({ active: [row] });
      const deletePeriod = expectDefined(captured["admin.deleteReport"]);

      await user.click(await screen.findByTestId(`action-delete-${row.id}`));

      expect(screen.getByRole("alertdialog")).toHaveTextContent(label);
      expect(screen.getByRole("alertdialog")).toHaveTextContent(range);
      expect(deletePeriod.mutationFn).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(deletePeriod.mutationFn).not.toHaveBeenCalled();
    },
  );
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
  // identical instant regardless of the operator's local timezone.
  it("no-op edit submits the stored deadline unchanged (no -N-hour drift)", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(
      await screen.findByTestId(`action-edit-${publishedFresh.id}`),
    );

    // Confirm the field prefilled with the UTC wall-clock display.
    const deadlineInput = screen.getByTestId<HTMLInputElement>(
      "periods-create-deadline",
    );
    expect(deadlineInput).toHaveAccessibleName(/deadline.*utc/i);
    expect(deadlineInput).toHaveAccessibleDescription(
      "Enter the deadline date and time in UTC.",
    );
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
  // when parsed as UTC. The submitted value must remain inside the period
  // range and must not drift with the operator's local timezone. The form keeps
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
