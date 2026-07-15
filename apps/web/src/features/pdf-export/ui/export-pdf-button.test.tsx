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
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
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
    vi.unstubAllGlobals();
  });

  it("calls window.open synchronously in the click handler before the mutation", async () => {
    const openMock = vi.fn(() => ({
      location: { href: "" },
      closed: false,
      close: vi.fn(),
    }));
    vi.stubGlobal("open", openMock);

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    const mutationFn = captured["pdfExport.request"].mutationFn;
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
    captured["pdfExport.request"].mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => {
      expect(fakeTab.location.href).toBe(ARTIFACT_URL);
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("PDF ready");
  });

  it("renders a download link and toasts success when window.open is blocked", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );

    const { captured } = renderButton({ statusQuery: COMPLETED_STATUS });
    captured["pdfExport.request"].mutationFn.mockResolvedValue({
      jobId: JOB_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const link = await screen.findByRole("link", { name: "Download PDF" });
    expect(link).toHaveAttribute("href", ARTIFACT_URL);
    expect(link).toHaveAttribute("download");
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("PDF ready");
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
    captured["pdfExport.request"].mutationFn.mockResolvedValue({
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
});
