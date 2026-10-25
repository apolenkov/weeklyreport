import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  archivedRow,
  makeRow,
  openRow,
  publishedFresh,
  publishedStale,
  renderTab,
} from "./periods-tab.test-harness";

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

  it("loads the next archive page on request (C0455)", async () => {
    const user = userEvent.setup();
    const older = makeRow({
      id: "11111111-1111-4111-8111-1111111111a5",
      periodStart: new Date("2026-03-02T00:00:00Z"),
      periodEnd: new Date("2026-03-08T23:59:59Z"),
      periodState: "archived",
      periodStatus: "published",
      archived: true,
    });
    const cursor = { periodStart: archivedRow.periodStart, id: archivedRow.id };
    const archivePages = vi.fn((input: { cursor?: unknown }) =>
      input.cursor === undefined
        ? { periods: [archivedRow], nextCursor: cursor }
        : { periods: [older], nextCursor: null },
    );
    renderTab({ archivePages });

    await user.click(screen.getByTestId("periods-archive-toggle"));
    await screen.findByTestId(`periods-archive-row-${archivedRow.id}`);
    expect(
      screen.queryByTestId(`periods-archive-row-${older.id}`),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await screen.findByTestId(`periods-archive-row-${older.id}`);
    expect(archivePages).toHaveBeenLastCalledWith(
      expect.objectContaining({ bucket: "archive", cursor }),
    );
    expect(
      screen.getByTestId(`periods-archive-row-${archivedRow.id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("keeps loaded archive rows when the next page fails (C0455)", async () => {
    const user = userEvent.setup();
    const cursor = { periodStart: archivedRow.periodStart, id: archivedRow.id };
    renderTab({
      archivePages: (input) => {
        if (input.cursor === undefined) {
          return { periods: [archivedRow], nextCursor: cursor };
        }
        throw new Error("page unavailable");
      },
    });

    await user.click(screen.getByTestId("periods-archive-toggle"));
    await screen.findByTestId(`periods-archive-row-${archivedRow.id}`);
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load more archived periods.",
    );
    expect(
      screen.getByTestId(`periods-archive-row-${archivedRow.id}`),
    ).toBeInTheDocument();
  });

  it("does not show the next-page banner when a background refetch fails", async () => {
    const user = userEvent.setup();
    const archivePages = vi.fn(() => {
      if (archivePages.mock.calls.length > 1) {
        throw new Error("background refetch failed");
      }
      return { periods: [archivedRow], nextCursor: null };
    });
    const { qc, trpc } = renderTab({ archivePages });

    await user.click(screen.getByTestId("periods-archive-toggle"));
    await screen.findByTestId(`periods-archive-row-${archivedRow.id}`);

    // The archive mutation invalidates the period list; this follow-up refetch
    // fails in the background, but it is not a failed next-page load.
    await user.click(screen.getByTestId(`action-archive-${publishedFresh.id}`));
    await waitFor(() => {
      expect(
        qc.getQueryState(
          trpc.admin.listPeriodsByState.infiniteQueryKey({ bucket: "archive" }),
        )?.status,
      ).toBe("error");
    });
    // Let the error-driven rerender flush before asserting on the DOM.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      screen.queryByText("Failed to load more archived periods."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Archive could not be loaded."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`periods-archive-row-${archivedRow.id}`),
    ).toBeInTheDocument();
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

  // Row actions render as inline icons; tests assert their visibility directly.

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
      screen.queryByTestId(`action-reopen-${openRow.id}`),
    ).not.toBeInTheDocument();
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

  it("archived open-draft rows keep delete disabled", async () => {
    const user = userEvent.setup();
    // deleteReport rejects every archived row; the affordance must not
    // offer a delete the server will refuse.
    const archivedDraft = makeRow({
      id: "11111111-1111-4111-8111-111111111166",
      periodState: "archived",
      periodStatus: "open",
      archived: true,
    });
    renderTab({ archive: [archivedDraft] });

    await user.click(screen.getByTestId("periods-archive-toggle"));
    expect(
      await screen.findByTestId(`action-delete-${archivedDraft.id}`),
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

  it("requires confirmation and cancels publish without side effects", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const publishEntry = expectDefined(captured["period.publish"]);

    await user.click(await screen.findByTestId(`action-publish-${openRow.id}`));

    expect(
      screen.getByRole("alertdialog", { name: "Publish this period?" }),
    ).toBeInTheDocument();
    expect(publishEntry.mutationFn).not.toHaveBeenCalled();
    // Same neutral wording as the head publish dialog: no reversibility claim.
    const dialogText = screen.getByRole("alertdialog").textContent;
    expect(dialogText).toContain("Leads can no longer edit this period.");
    expect(dialogText).not.toContain("reopened");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(publishEntry.mutationFn).not.toHaveBeenCalled();
  });

  it("confirms publish exactly once and blocks duplicate confirmation while pending", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const publishEntry = expectDefined(captured["period.publish"]);
    const pending = Promise.withResolvers<{ success: true }>();
    publishEntry.mutationFn.mockReturnValueOnce(pending.promise);

    await user.click(await screen.findByTestId(`action-publish-${openRow.id}`));
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await user.click(screen.getByRole("button", { name: "Publishing…" }));
    expect(publishEntry.mutationFn).toHaveBeenCalledTimes(1);
    expect(publishEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: openRow.id,
    });
    pending.resolve({ success: true });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("requires confirmation and cancels reopen without side effects", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const trigger = await screen.findByTestId(
      `action-reopen-${publishedFresh.id}`,
    );
    const reopenEntry = expectDefined(captured["period.reopen"]);

    await user.click(trigger);

    const dialog = screen.getByRole("alertdialog", {
      name: "Reopen this period?",
    });
    expect(dialog).toHaveTextContent(
      "Sections they already submitted return to draft and must be submitted again.",
    );
    expect(reopenEntry.mutationFn).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(reopenEntry.mutationFn).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("confirms reopen exactly once with the selected report identity", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const reopenEntry = expectDefined(captured["period.reopen"]);

    await user.click(
      await screen.findByTestId(`action-reopen-${publishedFresh.id}`),
    );
    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await waitFor(() => {
      expect(reopenEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(reopenEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: publishedFresh.id,
    });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("guards a pending reopen from dismissal and duplicate confirmation", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const reopenEntry = expectDefined(captured["period.reopen"]);
    const pending = Promise.withResolvers<{ success: true }>();
    reopenEntry.mutationFn.mockReturnValueOnce(pending.promise);

    await user.click(
      await screen.findByTestId(`action-reopen-${publishedFresh.id}`),
    );
    await user.click(screen.getByRole("button", { name: "Reopen" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reopening…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reopening…" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(reopenEntry.mutationFn).toHaveBeenCalledTimes(1);
    pending.resolve({ success: true });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("keeps a failed reopen available for retry", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const reopenEntry = expectDefined(captured["period.reopen"]);
    reopenEntry.mutationFn
      .mockRejectedValueOnce(new Error("Reopen denied"))
      .mockResolvedValueOnce({ success: true });

    await user.click(
      await screen.findByTestId(`action-reopen-${publishedFresh.id}`),
    );
    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Reopen denied"),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await waitFor(() =>
      expect(reopenEntry.mutationFn).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("does not render action-menu triggers for active rows", async () => {
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByTestId(`action-edit-${openRow.id}`),
      ).toBeInTheDocument();
    });
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
