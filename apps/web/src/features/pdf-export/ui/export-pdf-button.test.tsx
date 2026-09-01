// @vitest-environment jsdom
//
// ExportPdfButton: current-page PDF delivery and retryable error recovery.

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const ARTIFACT_URL = `/pdfs/${JOB_ID}.pdf`;
const DISABLED_REASON = "Publish or re-publish the report to export PDF.";
const STATUS_POLL_INTERVAL_MS = 2000;

const COMPLETED_STATUS = {
  jobId: JOB_ID,
  reportId: REPORT_ID,
  status: "completed" as const,
  artifactUrl: ARTIFACT_URL,
  requestedAt: new Date("2026-04-14T00:00:00Z"),
  completedAt: new Date("2026-04-14T00:00:02Z"),
  checksum: null,
  templateVersion: "1",
};

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

  return { captured, ...rendered };
}

describe("pdfExportRefetchInterval", () => {
  it.each([
    [undefined, STATUS_POLL_INTERVAL_MS],
    ["queued", STATUS_POLL_INTERVAL_MS],
    ["processing", STATUS_POLL_INTERVAL_MS],
    ["completed", false],
    ["failed", false],
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

  it("stays disabled while the report is reopened", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "reopened" });

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled();
    expect(screen.getByText(DISABLED_REASON)).toHaveClass("sr-only");
  });

  it("reveals the exact prerequisite on pointer hover without enabling export", async () => {
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
    expect(button).toBeDisabled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await userEvent.hover(trigger);

    expect(
      await screen.findByRole("tooltip", { name: DISABLED_REASON }),
    ).toBeVisible();
    expect(button).toBeDisabled();
    expect(
      expectDefined(captured["pdfExport.request"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("reveals the exact prerequisite on keyboard focus without activation", async () => {
    const user = userEvent.setup();
    const { captured } = renderButton({
      statusQuery: COMPLETED_STATUS,
      periodStatus: "reopened",
    });
    const trigger = screen.getByTestId("export-pdf-disabled-trigger");
    const button = screen.getByRole("button", { name: "Export PDF" });

    await user.tab();

    expect(trigger).toHaveFocus();
    expect(
      await screen.findByRole("tooltip", { name: DISABLED_REASON }),
    ).toBeVisible();
    expect(button).toBeDisabled();

    await user.keyboard("{Enter}");

    expect(button).toBeDisabled();
    expect(
      expectDefined(captured["pdfExport.request"]).mutationFn,
    ).not.toHaveBeenCalled();
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

  it("on status poll error: error toast fires and the button returns to idle", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({
      statusQuery: () => {
        throw new Error("poll failed");
      },
    });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    const button = screen.getByRole("button", { name: "Export PDF" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastError.mock.calls[0]?.[0]).toMatch(/status check failed/i);
    expect(openMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).not.toBeDisabled();
    });
  });

  it("on failed job status: error toast fires and the button returns to idle without a tab", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({
      statusQuery: {
        jobId: JOB_ID,
        reportId: REPORT_ID,
        status: "failed" as const,
        artifactUrl: null,
        requestedAt: new Date("2026-04-14T00:00:00Z"),
        completedAt: new Date("2026-04-14T00:00:02Z"),
        checksum: null,
        templateVersion: "1",
      },
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
