/**
 * @vitest-environment jsdom
 *
 * ExportPdfButton: popup-safe open, truthful success toast, poll-error recovery.
 */

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();
const toastInfo = vi.fn<(...args: unknown[]) => void>();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

import { ExportPdfButton } from "./export-pdf-button";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const ARTIFACT_URL = "https://example.test/artifact.pdf";

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
  readonly statusQuery: unknown | (() => unknown);
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

  render(
    <ExportPdfButton
      reportId={REPORT_ID}
      periodStatus={options.periodStatus ?? "published"}
    />,
    { wrapper: Wrapper },
  );

  return { captured };
}

describe("ExportPdfButton", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    toastInfo.mockClear();
    vi.unstubAllGlobals();
  });

  it("stays disabled while the report is open", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "open" });

    const button = screen.getByRole("button", { name: "Export PDF" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "aria-describedby",
      `${REPORT_ID}-export-pdf-disabled-reason`,
    );
    expect(
      screen.getByText("Publish or re-publish the report to export PDF."),
    ).toHaveClass("sr-only");
  });

  it("stays disabled while the report is reopened", () => {
    renderButton({ statusQuery: COMPLETED_STATUS, periodStatus: "reopened" });

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled();
    expect(
      screen.getByText("Publish or re-publish the report to export PDF."),
    ).toHaveClass("sr-only");
  });

  it("calls window.open synchronously in the click handler before the mutation", async () => {
    const openMock = vi.fn(() => ({
      location: { href: "" },
      closed: false,
      close: vi.fn(),
    }));
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    const mutationFn = expectDefined(captured["pdfExport.request"]).mutationFn;
    mutationFn.mockResolvedValue({ jobId: JOB_ID });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith("", "_blank");
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(expectDefined(openMock.mock.invocationCallOrder[0])).toBeLessThan(
      expectDefined(mutationFn.mock.invocationCallOrder[0]),
    );
  });

  it("navigates the held tab to the artifact URL and toasts success once", async () => {
    const fakeTab = {
      location: { href: "" },
      closed: false,
      close: vi.fn(),
    };
    vi.stubGlobal(
      "open",
      vi.fn(() => fakeTab),
    );

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => {
      expect(fakeTab.location.href).toBe(ARTIFACT_URL);
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("PDF ready");
  });

  it("renders a download link and announces fallback delivery when window.open is blocked", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const link = await screen.findByRole("link", { name: "Download PDF" });
    expect(link).toHaveAttribute("href", ARTIFACT_URL);
    expect(link).toHaveAttribute("download");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledOnce();
    expect(toastInfo).toHaveBeenCalledWith(
      "PDF ready — use the download link.",
    );
  });

  it("renders a download link when the held tab was closed before completion", async () => {
    const fakeTab = {
      location: { href: "" },
      closed: true,
      close: vi.fn(),
    };
    vi.stubGlobal(
      "open",
      vi.fn(() => fakeTab),
    );

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    expectDefined(captured["pdfExport.request"]).mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const link = await screen.findByRole("link", { name: "Download PDF" });
    expect(link).toHaveAttribute("href", ARTIFACT_URL);
    expect(fakeTab.location.href).toBe("");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      "PDF ready — use the download link.",
    );
  });

  it("on status poll error: error toast fires and the button returns to idle", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => ({
        location: { href: "" },
        closed: false,
        close: vi.fn(),
      })),
    );

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

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).not.toBeDisabled();
    });
  });

  it("on failed job status: error toast fires, the held tab closes, and the button returns to idle", async () => {
    const fakeTab = {
      location: { href: "" },
      closed: false,
      close: vi.fn(),
    };
    vi.stubGlobal(
      "open",
      vi.fn(() => fakeTab),
    );

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
    expect(fakeTab.close).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).not.toBeDisabled();
    });
  });
});
