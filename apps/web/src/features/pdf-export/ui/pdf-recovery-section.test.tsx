// @vitest-environment jsdom
//
// PdfRecoverySection: DB-backed quarantined-export list + generation-bound retry.

import "@testing-library/jest-dom/vitest";

import type { PdfRecoveryJob } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logClientError } from "../../../shared/lib/errors/client-error-reporting";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  createMockTRPC,
  type ProcedureDescriptor,
} from "../../../test-utils/mock-trpc";

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

vi.mock("../../../shared/lib/errors/client-error-reporting", () => ({
  logClientError: vi.fn(),
  formatClientErrorMessage: vi.fn(),
}));

import { PdfRecoverySection } from "./pdf-recovery-section";

const RECOVERY_JOB: PdfRecoveryJob = {
  jobId: "de305d54-75b4-431b-adb2-eb6b9e546014",
  reportId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  generation: 2,
  requestedBy: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  status: "recovery_required",
  createdAt: new Date("2026-05-01T09:00:00.000Z"),
};

// A terminally failed durable row whose queue job may already be pruned.
const FAILED_JOB: PdfRecoveryJob = {
  jobId: "de305d54-75b4-431b-adb2-eb6b9e546015",
  reportId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  generation: 3,
  requestedBy: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  status: "failed",
  createdAt: new Date("2026-05-02T09:00:00.000Z"),
};

function makeRecoveryMockTRPC(recoveryQuery: ProcedureDescriptor["query"]) {
  return createMockTRPC([
    { path: ["admin", "jobs", "listPdfRecovery"], query: recoveryQuery },
    { path: ["admin", "jobs", "retryPdfRecovery"], mutation: true as const },
  ]);
}

function renderSection(recoveryQuery: ProcedureDescriptor["query"]) {
  const { proxy, captured } = makeRecoveryMockTRPC(recoveryQuery);
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
  render(<PdfRecoverySection />, { wrapper: Wrapper });
  return { captured };
}

describe("PdfRecoverySection — DB-backed recovery list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists a quarantined export row even though its queue job is gone", async () => {
    const recoveryQuery = vi.fn(() =>
      Promise.resolve({ jobs: [RECOVERY_JOB] }),
    );
    renderSection(recoveryQuery);

    const row = await screen.findByTestId(
      `pdf-recovery-row-${RECOVERY_JOB.jobId}`,
    );
    expect(within(row).getByText(RECOVERY_JOB.jobId)).toBeInTheDocument();
    expect(
      within(row).getByText(String(RECOVERY_JOB.generation)),
    ).toBeInTheDocument();
    expect(recoveryQuery).toHaveBeenCalledTimes(1);
  });

  it("lists a terminally failed export with its status and retries its listed generation", async () => {
    const { captured } = renderSection(() =>
      Promise.resolve({ jobs: [RECOVERY_JOB, FAILED_JOB] }),
    );
    const retryFn = expectDefined(
      captured["admin.jobs.retryPdfRecovery"],
    ).mutationFn;
    retryFn.mockResolvedValue({
      jobId: FAILED_JOB.jobId,
      outcome: "retried",
    });

    const quarantinedRow = await screen.findByTestId(
      `pdf-recovery-row-${RECOVERY_JOB.jobId}`,
    );
    const failedRow = await screen.findByTestId(
      `pdf-recovery-row-${FAILED_JOB.jobId}`,
    );
    expect(within(failedRow).getByText("Failed")).toBeInTheDocument();
    expect(
      within(quarantinedRow).getByText("Recovery required"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: `Retry PDF export ${FAILED_JOB.jobId}`,
      }),
    );

    await waitFor(() => expect(retryFn).toHaveBeenCalledTimes(1));
    expect(retryFn.mock.calls[0]?.[0]).toEqual({
      jobId: FAILED_JOB.jobId,
      expectedGeneration: FAILED_JOB.generation,
    });
  });

  it("renders the empty state when nothing awaits recovery", async () => {
    renderSection(() => Promise.resolve({ jobs: [] }));

    expect(
      await screen.findByText(
        "No failed exports. Every PDF export has finished.",
      ),
    ).toBeInTheDocument();
  });

  it("points to a report as the place where exports start", async () => {
    renderSection(() => Promise.resolve({ jobs: [] }));

    expect(
      await screen.findByRole("link", {
        name: "Exports are generated from a report",
      }),
    ).toHaveAttribute("href", "/reports");
  });

  it("posts {jobId, expectedGeneration} taken from the listed row on retry", async () => {
    const { captured } = renderSection(() =>
      Promise.resolve({ jobs: [RECOVERY_JOB] }),
    );
    const retryFn = expectDefined(
      captured["admin.jobs.retryPdfRecovery"],
    ).mutationFn;
    retryFn.mockResolvedValue({
      jobId: RECOVERY_JOB.jobId,
      outcome: "retried",
    });

    await screen.findByTestId(`pdf-recovery-row-${RECOVERY_JOB.jobId}`);
    await userEvent.click(
      screen.getByRole("button", {
        name: `Retry PDF export ${RECOVERY_JOB.jobId}`,
      }),
    );

    await waitFor(() => expect(retryFn).toHaveBeenCalledTimes(1));
    expect(retryFn.mock.calls[0]?.[0]).toEqual({
      jobId: RECOVERY_JOB.jobId,
      expectedGeneration: RECOVERY_JOB.generation,
    });
  });

  it("refreshes the recovery list once the retry settles", async () => {
    let listed = true;
    const recoveryQuery = vi.fn(() =>
      Promise.resolve({ jobs: listed ? [RECOVERY_JOB] : [] }),
    );
    const { captured } = renderSection(recoveryQuery);
    expectDefined(
      captured["admin.jobs.retryPdfRecovery"],
    ).mutationFn.mockResolvedValue({
      jobId: RECOVERY_JOB.jobId,
      outcome: "retried",
    });

    await screen.findByTestId(`pdf-recovery-row-${RECOVERY_JOB.jobId}`);
    listed = false;
    await userEvent.click(
      screen.getByRole("button", {
        name: `Retry PDF export ${RECOVERY_JOB.jobId}`,
      }),
    );

    await waitFor(() => expect(recoveryQuery).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByTestId(`pdf-recovery-row-${RECOVERY_JOB.jobId}`),
      ).toBeNull(),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      `Export ${RECOVERY_JOB.jobId} advanced to a fresh generation.`,
    );
  });

  it.each(["already-advanced", "ineligible"] as const)(
    "reports the %s outcome as info, not success",
    async (outcome) => {
      const { captured } = renderSection(() =>
        Promise.resolve({ jobs: [RECOVERY_JOB] }),
      );
      expectDefined(
        captured["admin.jobs.retryPdfRecovery"],
      ).mutationFn.mockResolvedValue({
        jobId: RECOVERY_JOB.jobId,
        outcome,
      });

      await screen.findByTestId(`pdf-recovery-row-${RECOVERY_JOB.jobId}`);
      await userEvent.click(
        screen.getByRole("button", {
          name: `Retry PDF export ${RECOVERY_JOB.jobId}`,
        }),
      );

      await waitFor(() => expect(toastInfo).toHaveBeenCalled());
      expect(toastSuccess).not.toHaveBeenCalled();
    },
  );

  it("surfaces an accessible loading state while the recovery list loads", async () => {
    renderSection("pending");

    const status = await screen.findByTestId("pdf-recovery-loading");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute(
      "aria-label",
      "Loading PDF export recovery list",
    );
  });

  it("shows an alert and reports once when the recovery list fails", async () => {
    renderSection(() => Promise.reject(new Error("DB down")));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load recovery list: DB down",
    );
    await waitFor(() =>
      expect(logClientError).toHaveBeenCalledWith(
        "admin.jobs.list_pdf_recovery",
        expect.objectContaining({ message: "DB down" }),
        expect.objectContaining({ procedure: "admin.jobs.listPdfRecovery" }),
      ),
    );
  });
});
