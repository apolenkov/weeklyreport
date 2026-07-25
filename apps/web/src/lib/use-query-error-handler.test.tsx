// Pins toastPrefix / log-only split (openspec/specs/client-error-policy).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import * as React from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatClientErrorMessage,
  logClientError,
} from "./client-error-reporting";
import { useQueryErrorHandler } from "./use-query-error-handler";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./client-error-reporting", () => ({
  logClientError: vi.fn(),
  // Returns "<prefix>." so tests can assert the exact forwarded string.
  formatClientErrorMessage: vi.fn(
    (prefix: string, _error: unknown): string => `${prefix}.`,
  ),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return { client, Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useQueryErrorHandler", () => {
  it("on isError flip: logClientError fires exactly once with event/component/procedure + context", () => {
    const { Wrapper } = makeWrapper();
    const error = new Error("load failed");

    const { rerender } = renderHook(
      ({ isError }: { isError: boolean }) =>
        useQueryErrorHandler(
          { isError, error: isError ? error : null },
          {
            event: "leadForm.byPeriod.load_failed",
            component: "LeadForm",
            procedure: "leadForm.byPeriod",
            context: { reportId: "rep-1", role: "lead" },
          },
        ),
      { wrapper: Wrapper, initialProps: { isError: false } },
    );

    expect(logClientError).not.toHaveBeenCalled();

    rerender({ isError: true });

    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(logClientError).toHaveBeenCalledWith(
      "leadForm.byPeriod.load_failed",
      error,
      {
        component: "LeadForm",
        procedure: "leadForm.byPeriod",
        reportId: "rep-1",
        role: "lead",
      },
    );
  });

  it("toastPrefix set → toast.error called with formatClientErrorMessage output", () => {
    const { Wrapper } = makeWrapper();
    const error = new Error("load failed");

    renderHook(
      () =>
        useQueryErrorHandler(
          { isError: true, error },
          {
            event: "leadForm.byPeriod.load_failed",
            component: "LeadForm",
            procedure: "leadForm.byPeriod",
            toastPrefix: "Failed to load form",
          },
        ),
      { wrapper: Wrapper },
    );

    expect(formatClientErrorMessage).toHaveBeenCalledWith(
      "Failed to load form",
      error,
    );
    // The hook passes formatClientErrorMessage's return value directly to
    // toast.error. The mock returns "<prefix>." so we assert that string.
    expect(toast.error).toHaveBeenCalledWith("Failed to load form.");
  });

  it("toastPrefix absent → toast never called (pins the slides silent policy)", () => {
    const { Wrapper } = makeWrapper();
    const error = new Error("load failed");

    renderHook(
      () =>
        useQueryErrorHandler(
          { isError: true, error },
          {
            event: "leadSlides.getActive.load_failed",
            component: "LeadSlidesClient",
            procedure: "reports.getActive",
            // no toastPrefix
          },
        ),
      { wrapper: Wrapper },
    );

    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rerender with the same error object → no second log/toast", () => {
    const { Wrapper } = makeWrapper();
    const error = new Error("load failed");

    const { rerender } = renderHook(
      ({ isError }: { isError: boolean }) =>
        useQueryErrorHandler(
          { isError, error: isError ? error : null },
          {
            event: "leadForm.byPeriod.load_failed",
            component: "LeadForm",
            procedure: "leadForm.byPeriod",
            toastPrefix: "Failed to load form",
          },
        ),
      { wrapper: Wrapper, initialProps: { isError: false } },
    );

    rerender({ isError: true });
    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    // Rerender with the same error — effect deps unchanged, no re-fire.
    rerender({ isError: true });
    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("context prop change during persistent error → no re-fire (ref semantics)", () => {
    const { Wrapper } = makeWrapper();
    const error = new Error("load failed");

    const { rerender } = renderHook(
      ({ ctx }: { ctx: Record<string, unknown> }) =>
        useQueryErrorHandler(
          { isError: true, error },
          {
            event: "leadForm.byPeriod.load_failed",
            component: "LeadForm",
            procedure: "leadForm.byPeriod",
            context: ctx,
            toastPrefix: "Failed to load form",
          },
        ),
      {
        wrapper: Wrapper,
        initialProps: { ctx: { reportId: "rep-1" } },
      },
    );

    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    // Change context while error persists — opts are read through a ref,
    // so changing context does not re-fire.
    rerender({ ctx: { reportId: "rep-2" } });
    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
