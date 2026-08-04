// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardQueryRecovery } from "./use-dashboard-query-recovery";

const consoleError = vi.fn();

beforeEach(() => {
  consoleError.mockClear();
  vi.spyOn(console, "error").mockImplementation(consoleError);
  vi.spyOn(window, "addEventListener");
  vi.spyOn(window, "removeEventListener");
});

function renderRecovery(refetch: () => Promise<unknown>) {
  return renderHook(() =>
    useDashboardQueryRecovery({
      fetchStatus: "idle",
      hasData: false,
      isError: true,
      name: "weeklyReport",
      refetch,
      status: "error",
    }),
  );
}

describe("useDashboardQueryRecovery retry", () => {
  it("reports a rejected retry refetch instead of discarding it silently", async () => {
    const refetch = vi.fn().mockRejectedValue(new Error("network down"));
    const { result } = renderRecovery(refetch);

    act(() => {
      result.current.retry();
    });

    await vi.waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "[DashboardQueryRecovery] retry refetch failed",
        expect.any(Error),
      );
    });
  });

  it("does not report an unhandled rejection when the retry refetch rejects", async () => {
    const refetch = vi.fn().mockRejectedValue(new Error("network down"));
    const unhandled = vi.fn();
    window.addEventListener("unhandledrejection", unhandled);
    const { result } = renderRecovery(refetch);

    act(() => {
      result.current.retry();
    });
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    window.removeEventListener("unhandledrejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
