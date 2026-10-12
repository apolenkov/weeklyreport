// @vitest-environment jsdom
//
// ExportPdfButton: current-page PDF delivery and retryable error recovery.

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import { type PdfExportJob, pdfExportJobSchema } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();
const anchorClick = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { ExportPdfButton } from "./export-pdf-button";
import { pdfExportRefetchInterval } from "./use-pdf-export-job";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_REPORT_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const ARTIFACT_URL = `/pdfs/${JOB_ID}.pdf`;
const ACTIVE_JOB_STORAGE_KEY = `weeklyreport:pdf-export:active:${REPORT_ID}`;
const DISABLED_REASON = "Publish or re-publish the report to export PDF.";
const STATUS_POLL_INTERVAL_MS = 2000;

const COMPLETED_STATUS_INPUT: PdfExportJob = {
  jobId: JOB_ID,
  reportId: REPORT_ID,
  status: "completed" as const,
  generation: 1,
  artifactUrl: ARTIFACT_URL,
  requestedAt: new Date("2026-04-14T00:00:00Z"),
  completedAt: new Date("2026-04-14T00:00:02Z"),
  checksum: null,
  templateVersion: "1",
};
const COMPLETED_STATUS = pdfExportJobSchema.parse(COMPLETED_STATUS_INPUT);

const RECOVERY_STATUS_INPUT: PdfExportJob = {
  jobId: JOB_ID,
  reportId: REPORT_ID,
  status: "recovery_required" as const,
  generation: 1,
  artifactUrl: null,
  requestedAt: new Date("2026-04-14T00:00:00Z"),
  completedAt: null,
  checksum: null,
  templateVersion: "1",
};
const RECOVERY_STATUS = pdfExportJobSchema.parse(RECOVERY_STATUS_INPUT);

const FAILED_STATUS_INPUT: PdfExportJob = {
  jobId: JOB_ID,
  reportId: REPORT_ID,
  status: "failed",
  generation: 1,
  artifactUrl: null,
  requestedAt: new Date("2026-04-14T00:00:00Z"),
  completedAt: new Date("2026-04-14T00:00:02Z"),
  checksum: null,
  templateVersion: "1",
};
const FAILED_STATUS = pdfExportJobSchema.parse(FAILED_STATUS_INPUT);

const RECOVERY_MESSAGE = "Recovery required — export outcome unknown";

// A stored job whose status query is rejected with a deterministic client
// error (e.g. the durable row is gone or belongs to another user) can never
// resolve — unlike a transient transport failure.
function makeNotFoundStatusError(): TRPCClientError<never> {
  const error = new TRPCClientError<never>("PDF export job was not found.");
  Object.defineProperty(error, "data", {
    value: { httpStatus: 404, code: "NOT_FOUND" },
    configurable: true,
  });
  return error;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderButton(options: {
  readonly statusQuery: unknown;
  readonly periodStatus?: "open" | "published" | "reopened";
}) {
  const { proxy, captured } = createMockTRPC([
    { path: ["pdfExport", "request"], mutation: true },
    { path: ["pdfExport", "status"], query: options.statusQuery },
  ]);

  const statusProcedure = proxy.pdfExport.status;
  const baseQueryOptions = statusProcedure.queryOptions;
  Object.defineProperty(statusProcedure, "queryOptions", {
    configurable: true,
    value: (
      input: Parameters<typeof baseQueryOptions>[0],
      queryOptions?: Parameters<typeof baseQueryOptions>[1],
    ) => ({
      ...baseQueryOptions(input),
      ...queryOptions,
    }),
  });

  const qc = makeQueryClient();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const rendered = render(
    <ExportPdfButton
      reportId={REPORT_ID}
      periodStatus={options.periodStatus ?? "published"}
    />,
    { wrapper: Wrapper },
  );

  return { captured, queryClient: qc, ...rendered };
}

describe("pdfExportRefetchInterval", () => {
  it.each([
    [undefined, STATUS_POLL_INTERVAL_MS],
    ["queued", STATUS_POLL_INTERVAL_MS],
    ["processing", STATUS_POLL_INTERVAL_MS],
    ["completed", false],
    ["failed", false],
    ["recovery_required", false],
  ] as const)("maps %s to %s", (status, expected) => {
    expect(pdfExportRefetchInterval(status)).toBe(expected);
  });
});

describe("ExportPdfButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    anchorClick.mockClear();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      anchorClick,
    );
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("stays disabled while the report is open", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "open" });

    const button = screen.getByRole("button", { name: "Export PDF" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "aria-describedby",
      `${REPORT_ID}-export-pdf-disabled-reason`,
    );
    expect(button).toHaveAccessibleDescription(DISABLED_REASON);
    expect(screen.getByText(DISABLED_REASON)).toHaveClass("sr-only");
  });

  it("shows a visible label and the short reason while export is unavailable", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "open" });

    const button = screen.getByRole("button", { name: "Export PDF" });
    expect(button).toHaveTextContent("Export PDF");
    expect(within(button).getByText("Export PDF")).toHaveClass("lg:sr-only");
    const caption = screen.getByTestId("export-pdf-disabled-caption");
    expect(caption).toHaveTextContent("Available after publish");
    expect(caption).toHaveClass("lg:hidden");
  });

  it("drops the reason caption once the report is published", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "published" });

    expect(
      screen.getByRole("button", { name: "Export PDF" }),
    ).toHaveTextContent("Export PDF");
    expect(
      screen.queryByTestId("export-pdf-disabled-caption"),
    ).not.toBeInTheDocument();
  });

  it("stays disabled while the report is reopened", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "reopened" });

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled();
    expect(screen.getByText(DISABLED_REASON)).toHaveClass("sr-only");
  });

  it("reveals the exact prerequisite on pointer hover without enabling export", async () => {
    const user = userEvent.setup();
    const { captured } = renderButton({
      statusQuery: COMPLETED_STATUS,
      periodStatus: "open",
    });
    const trigger = screen.getByTestId("export-pdf-disabled-trigger");
    const button = screen.getByRole("button", { name: "Export PDF" });

    expect(trigger).toHaveAttribute("tabindex", "0");
    expect(trigger).toHaveAttribute("role", "group");
    expect(trigger).not.toHaveAttribute("role", "button");
    expect(trigger).toHaveAccessibleName("Export PDF unavailable");
    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    const reason = screen.getByText(DISABLED_REASON);
    expect(trigger).toHaveAttribute("aria-describedby", reason.id);
    expect(button).toBeDisabled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.hover(trigger);

    const tooltip = await screen.findByRole("tooltip", {
      name: DISABLED_REASON,
    });
    expect(tooltip).toBeVisible();
    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(button).toBeDisabled();
    expect(
      expectDefined(captured["pdfExport.request"]).mutationFn,
    ).not.toHaveBeenCalled();

    await user.unhover(trigger);
    // Leave both surfaces and the area that permits travel into the tooltip.
    await user.pointer({
      target: document.body,
      coords: { clientX: 1000, clientY: 1000 },
    });
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    expect(trigger).toHaveAttribute("aria-describedby", reason.id);
  });

  it("reveals the exact prerequisite on keyboard focus without activation", async () => {
    const user = userEvent.setup();
    const { captured } = renderButton({
      statusQuery: COMPLETED_STATUS,
      periodStatus: "reopened",
    });
    const trigger = screen.getByTestId("export-pdf-disabled-trigger");
    const button = screen.getByRole("button", { name: "Export PDF" });
    const reason = screen.getByText(DISABLED_REASON);

    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    expect(trigger).toHaveAttribute("aria-describedby", reason.id);

    await user.tab();

    expect(trigger).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip", {
      name: DISABLED_REASON,
    });
    expect(tooltip).toBeVisible();
    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(button).toBeDisabled();

    await user.keyboard("{Enter}");

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    expect(button).toBeDisabled();
    expect(
      expectDefined(captured["pdfExport.request"]).mutationFn,
    ).not.toHaveBeenCalled();

    act(() => trigger.blur());
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAccessibleDescription(DISABLED_REASON);
    expect(trigger).toHaveAttribute("aria-describedby", reason.id);
  });

  it("keeps the disabled tooltip trigger geometry neutral and non-button", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "open" });

    const trigger = screen.getByTestId("export-pdf-disabled-trigger");
    expect(trigger).toHaveClass("inline-flex", "shrink-0");
    expect(trigger).not.toHaveClass("h-[var(--toolbar-control-h)]");
    expect(trigger).not.toHaveClass("w-[var(--toolbar-control-h)]");
    expect(trigger).not.toHaveAttribute("role", "button");
    expect(trigger).not.toHaveAttribute("aria-disabled");
  });

  it("does not open a browser tab when starting an export", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    const mutationFn = expectDefined(captured["pdfExport.request"]).mutationFn;
    mutationFn.mockResolvedValue({ jobId: JOB_ID });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    expect(openMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps a request error retryable without opening a tab", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    const mutationFn = expectDefined(captured["pdfExport.request"]).mutationFn;
    mutationFn.mockRejectedValueOnce(new Error("request failed"));

    const button = screen.getByRole("button", { name: "Export PDF" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("request failed");
      expect(button).not.toBeDisabled();
    });
    expect(openMock).not.toHaveBeenCalled();
  });

  it("keeps the completed artifact fallback after a subsequent request fails", async () => {
    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    const requestMutation = expectDefined(
      captured["pdfExport.request"],
    ).mutationFn;
    requestMutation
      .mockResolvedValueOnce({ jobId: JOB_ID })
      .mockRejectedValueOnce(new Error("request failed"));

    const button = screen.getByRole("button", { name: "Export PDF" });
    await userEvent.click(button);
    expect(
      await screen.findByRole("link", { name: "Download PDF" }),
    ).toHaveAttribute("href", ARTIFACT_URL);
    await waitFor(() => expect(button).not.toBeDisabled());

    await userEvent.click(button);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("request failed");
      expect(button).not.toBeDisabled();
    });
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
      "href",
      ARTIFACT_URL,
    );
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("attempts one attachment download and keeps a fallback link with the same URL", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const link = await screen.findByRole("link", { name: "Download PDF" });
    expect(link).toHaveAttribute("href", ARTIFACT_URL);
    expect(link).toHaveAttribute("download");
    const fallbackHref = expectDefined(link.getAttribute("href"));
    const resolvedHref = new URL(fallbackHref, window.location.origin);
    expect(resolvedHref.origin).toBe(window.location.origin);
    expect(resolvedHref.pathname).toBe(`/pdfs/${JOB_ID}.pdf`);
    expect(link).toHaveClass(
      "max-md:min-h-[var(--touch-target-min)]",
      "focus-visible:ring-2",
    );
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("PDF ready");
  });

  it("resumes an active job after remount and clears its tab-scoped identity on completion", async () => {
    const first = renderButton({ statusQuery: "pending" });
    expectDefined(
      first.captured["pdfExport.request"],
    ).mutationFn.mockResolvedValue({ jobId: JOB_ID });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Export PDF" }),
      ).toHaveAttribute("aria-busy", "true");
    });
    expect(window.sessionStorage).toHaveLength(1);
    expect(window.sessionStorage.key(0)).toContain(REPORT_ID);
    expect(
      window.sessionStorage.getItem(
        expectDefined(window.sessionStorage.key(0)),
      ),
    ).toBe(JOB_ID);

    first.unmount();
    renderButton({ statusQuery: COMPLETED_STATUS });

    expect(
      await screen.findByRole("link", { name: "Download PDF" }),
    ).toHaveAttribute("href", ARTIFACT_URL);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it("clears the previous report's fallback link when the report id changes", async () => {
    const { captured, rerender } = renderButton({
      statusQuery: COMPLETED_STATUS,
    });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(
      await screen.findByRole("link", { name: "Download PDF" }),
    ).toHaveAttribute("href", ARTIFACT_URL);

    rerender(
      <ExportPdfButton reportId={SECOND_REPORT_ID} periodStatus="published" />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Download PDF" })).toBeNull();
    });
  });

  it.each([
    {
      name: "a deterministic status query error",
      expectedMessage:
        "PDF export status is no longer available. Please try again.",
      statusQuery: () => {
        throw makeNotFoundStatusError();
      },
    },
    {
      name: "a failed status",
      expectedMessage: "PDF export failed. Please try again.",
      statusQuery: () => FAILED_STATUS,
    },
  ])(
    "cleans up a restored job after $name without a fresh enqueue",
    async ({ expectedMessage, statusQuery }) => {
      // The query error-policy seam logs each terminal failure.
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      window.sessionStorage.setItem(ACTIVE_JOB_STORAGE_KEY, JOB_ID);

      const statusQueryFactory = vi.fn(statusQuery);
      const { captured, queryClient } = renderButton({
        statusQuery: statusQueryFactory,
      });
      const requestMutation = expectDefined(
        captured["pdfExport.request"],
      ).mutationFn;
      const button = screen.getByRole("button", { name: "Export PDF" });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(expectedMessage);
        expect(button).toHaveAttribute("aria-busy", "false");
        expect(button).toBeEnabled();
      });

      expect(requestMutation).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBeNull();

      const statusQueryCache = queryClient.getQueryCache().find({
        queryKey: [["pdfExport", "status"]],
      });
      expect(statusQueryCache).toBeDefined();
      const statusObserver = statusQueryCache?.observers[0];
      expect(statusObserver?.getCurrentResult().isEnabled).toBe(false);
      expect(statusObserver?.getCurrentResult().isFetching).toBe(false);

      const statusQueryCallsAfterCleanup = statusQueryFactory.mock.calls.length;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, STATUS_POLL_INTERVAL_MS + 50);
      });
      expect(statusQueryFactory.mock.calls).toHaveLength(
        statusQueryCallsAfterCleanup,
      );
    },
  );

  it("surfaces the persistent recovery message, stops polling, and stays retryable", async () => {
    window.sessionStorage.setItem(ACTIVE_JOB_STORAGE_KEY, JOB_ID);

    const statusQueryFactory = vi.fn(() => RECOVERY_STATUS);
    const { captured, queryClient } = renderButton({
      statusQuery: statusQueryFactory,
    });
    const requestMutation = expectDefined(
      captured["pdfExport.request"],
    ).mutationFn;
    requestMutation.mockResolvedValue({ jobId: JOB_ID });

    const button = screen.getByRole("button", { name: "Export PDF" });
    const message = await screen.findByText(RECOVERY_MESSAGE);
    expect(message).toBeVisible();
    expect(message).toHaveAttribute("role", "alert");

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).toBeEnabled();
    });
    expect(window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBeNull();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();

    const statusQueryCache = queryClient.getQueryCache().find({
      queryKey: [["pdfExport", "status"]],
    });
    const statusObserver = statusQueryCache?.observers[0];
    expect(statusObserver?.getCurrentResult().isEnabled).toBe(false);
    expect(statusObserver?.getCurrentResult().isFetching).toBe(false);

    const callsAfterCleanup = statusQueryFactory.mock.calls.length;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, STATUS_POLL_INTERVAL_MS + 50);
    });
    expect(statusQueryFactory.mock.calls).toHaveLength(callsAfterCleanup);
    expect(message).toBeInTheDocument();

    await userEvent.click(button);
    await waitFor(() => {
      expect(requestMutation).toHaveBeenCalledTimes(1);
    });
    expect(expectDefined(captured["pdfExport.request"]).calls).toEqual([
      { reportId: REPORT_ID },
    ]);
  });

  it("uses a reduced-motion-safe spinner while the export request is pending", async () => {
    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockImplementation(
      () => new Promise<never>(() => undefined),
    );

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const spinner = await screen.findByTestId("export-pdf-spinner");
    expect(spinner).toHaveClass("animate-spin", "motion-reduce:animate-none");
    expect(spinner).not.toHaveAttribute("style");
    expect(spinner.querySelector("style")).not.toBeInTheDocument();
  });

  it("keeps polling through a transient status error and delivers the same job's artifact once", async () => {
    // The query error-policy seam logs each transient failure.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    let statusCalls = 0;
    const statusQueryFactory = vi.fn(() => {
      statusCalls += 1;
      if (statusCalls === 1) {
        throw new Error("API restarting");
      }
      return COMPLETED_STATUS;
    });
    const { captured, queryClient } = renderButton({
      statusQuery: statusQueryFactory,
    });
    const requestMutation = expectDefined(
      captured["pdfExport.request"],
    ).mutationFn;
    requestMutation.mockResolvedValue({ jobId: JOB_ID });

    const button = screen.getByRole("button", { name: "Export PDF" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(requestMutation).toHaveBeenCalledTimes(1);
    });
    expect(window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBe(JOB_ID);

    // The first status check fails transiently: the stored job survives, the
    // control stays busy, and no failure toast fires — this is not an outcome.
    await waitFor(() => {
      const statusObserver = queryClient
        .getQueryCache()
        .find({ queryKey: [["pdfExport", "status"]] })?.observers[0];
      expect(statusObserver?.getCurrentResult().isError).toBe(true);
    });
    expect(window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBe(JOB_ID);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(toastError).not.toHaveBeenCalled();

    // The next check observes the SAME job completed: the artifact is
    // delivered exactly once with no fresh enqueue.
    const link = await screen.findByRole(
      "link",
      { name: "Download PDF" },
      { timeout: STATUS_POLL_INTERVAL_MS * 3 },
    );
    expect(link).toHaveAttribute("href", ARTIFACT_URL);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(requestMutation).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBeNull();

    const callsAfterDelivery = statusQueryFactory.mock.calls.length;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, STATUS_POLL_INTERVAL_MS + 50);
    });
    expect(statusQueryFactory.mock.calls).toHaveLength(callsAfterDelivery);
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("on a sustained status poll outage: keeps polling and stays busy without an error toast", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const statusQueryFactory = vi.fn(() => {
      throw new Error("poll failed");
    });
    const { captured, queryClient } = renderButton({
      statusQuery: statusQueryFactory,
    });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    const button = screen.getByRole("button", { name: "Export PDF" });
    await userEvent.click(button);

    await waitFor(() => {
      const statusObserver = queryClient
        .getQueryCache()
        .find({ queryKey: [["pdfExport", "status"]] })?.observers[0];
      expect(statusObserver?.getCurrentResult().isError).toBe(true);
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBe(JOB_ID);

    const callsAtError = statusQueryFactory.mock.calls.length;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, STATUS_POLL_INTERVAL_MS + 50);
    });
    expect(statusQueryFactory.mock.calls.length).toBeGreaterThan(callsAtError);
  });

  it("on failed job status: error toast fires and the button returns to idle without a tab", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({
      statusQuery: FAILED_STATUS,
    });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    const button = screen.getByRole("button", { name: "Export PDF" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastError.mock.calls[0]?.[0]).toMatch(/pdf export failed/i);
    expect(openMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).not.toBeDisabled();
    });
  });
});
