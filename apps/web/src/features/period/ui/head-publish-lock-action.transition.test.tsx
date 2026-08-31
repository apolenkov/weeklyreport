// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { invalidatePeriodLifecycle } from "../../../shared/lib/query/cache-keys";
import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { HeadPublishLockAction } from "./head-publish-lock-action";

vi.mock("../../../shared/lib/query/cache-keys", () => ({
  invalidatePeriodLifecycle: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../report-sections", () => ({
  mapWeeklyReport: (data: { reportId: string }) => ({
    submissionCount: 1,
    totalLeads: 1,
    products: [{}],
    period: {
      reportId: data.reportId,
      periodStatus: "open",
    },
  }),
  reportHasContent: () => false,
}));

vi.mock("./publish-lock-button", () => ({
  PublishLockButton: ({ canPublish }: { readonly canPublish: boolean }) => (
    <button type="button" disabled={!canPublish}>
      {canPublish ? "Publish & Lock" : "Nothing to publish"}
    </button>
  ),
}));

const pending = new Promise<never>(() => undefined);

function makeBadRequestError(): TRPCClientError<never> {
  const error = new TRPCClientError<never>("load failed");
  Object.defineProperty(error, "data", {
    configurable: true,
    value: { code: "BAD_REQUEST", httpStatus: 400 },
  });
  return error;
}

function reportQueryFixture(input: unknown) {
  const reportId = (input as { reportId: string }).reportId;
  if (reportId === "report-a") {
    return { status: "active", reportId: "report-a" };
  }
  if (reportId === "report-error") {
    return Promise.reject(makeBadRequestError());
  }
  return pending;
}

function makeHarness() {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["weeklyReport", "get"],
      queryByInput: reportQueryFixture,
    },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
  ]);
  const client = makeQueryClient();

  function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: "head-user",
              name: "Test Head",
              email: "head@example.com",
              role: "head",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Providers, captured };
}

async function removesStalePublishTrigger(): Promise<void> {
  const { Providers } = makeHarness();
  const rendered = render(<HeadPublishLockAction reportId="report-a" />, {
    wrapper: Providers,
  });
  expect(
    await screen.findByRole("button", { name: /publish & lock/i }),
  ).toBeEnabled();
  rendered.rerender(<HeadPublishLockAction reportId="report-b" />);
  await waitFor(() => {
    expect(
      screen.queryByRole("button", { name: /publish|reopen/i }),
    ).not.toBeInTheDocument();
  });
}

async function invalidatesAfterPublishSuccess(): Promise<void> {
  const { Providers, captured } = makeHarness();
  render(<HeadPublishLockAction reportId="report-a" />, {
    wrapper: Providers,
  });
  await screen.findByRole("button", { name: /publish & lock/i });
  const onSuccess = expectDefined(captured["period.publish"]).lastOptions
    .onSuccess as (() => void) | undefined;
  act(() => {
    expectDefined(onSuccess)();
  });
  expect(invalidatePeriodLifecycle).toHaveBeenCalledTimes(1);
}

async function preservesProjectionOnPublishFailure(): Promise<void> {
  const { Providers, captured } = makeHarness();
  render(<HeadPublishLockAction reportId="report-a" />, {
    wrapper: Providers,
  });
  await screen.findByRole("button", { name: /publish & lock/i });
  const onError = expectDefined(captured["period.publish"]).lastOptions
    .onError as ((error: Error) => void) | undefined;
  act(() => {
    expectDefined(onError)(new Error("publish failed"));
  });
  expect(invalidatePeriodLifecycle).not.toHaveBeenCalled();
}

async function mapsTransportFailure(): Promise<void> {
  const { Providers, captured } = makeHarness();
  render(<HeadPublishLockAction reportId="report-a" />, {
    wrapper: Providers,
  });
  await screen.findByRole("button", { name: /publish & lock/i });
  const onError = expectDefined(captured["period.publish"]).lastOptions
    .onError as ((error: Error) => void) | undefined;
  act(() => {
    expectDefined(onError)(new TypeError("Failed to fetch"));
  });
  expect(toast.error).toHaveBeenCalledWith("Failed to publish period");
}

async function exposesQueryRecovery(): Promise<void> {
  const { Providers } = makeHarness();
  render(<HeadPublishLockAction reportId="report-error" />, {
    wrapper: Providers,
  });

  const retry = await screen.findByRole("button", {
    name: "Retry loading publish controls",
  });
  expect(retry).toHaveTextContent("Retry publish");
  expect(retry).toHaveAttribute(
    "title",
    "Publish controls could not be loaded",
  );
}

describe("HeadPublishLockAction report-key transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "removes the report A publish trigger while report B is pending",
    removesStalePublishTrigger,
  );
  it(
    "invalidates all report projections after publish success",
    invalidatesAfterPublishSuccess,
  );
  it(
    "does not invalidate report projections after publish failure",
    preservesProjectionOnPublishFailure,
  );
  it(
    "maps a transport failure to the publish-specific message",
    mapsTransportFailure,
  );
  it(
    "keeps a visible recovery action after the report query fails",
    exposesQueryRecovery,
  );
});
