import { vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => navigation.searchParams(),
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement, type PropsWithChildren, StrictMode } from "react";
import { describe, expect, it } from "vitest";

import { useReportShellUrlState } from "./use-report-shell-url-state";
import { navigation } from "./use-report-shell-url-state.test-support";

describe("useReportShellUrlState — 1", () => {
  it.each(["query", "path", "popstate"])(
    "external %s navigation supersedes queued selections",
    (change) => {
      const { result, rerender } = renderHook(() =>
        useReportShellUrlState({ stripParams: [] }),
      );
      act(() => {
        result.current.setIncludeArchive(true);
        result.current.setScope("lead");
      });
      expect(navigation.replace).toHaveBeenCalledTimes(1);
      expect(result.current.includeArchive).toBe(true);
      expect(result.current.scope).toBe("lead");

      if (change === "popstate") {
        // Back can land on the first replacement's URL; it is not an acknowledgement.
        act(() => {
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        expect(result.current.includeArchive).toBe(false);
        expect(result.current.scope).toBe("product");
        navigation.searchParams.mockReturnValue(
          new URLSearchParams("archive=1"),
        );
      } else if (change === "path") {
        navigation.pathname = "/reports/report-2";
      } else {
        navigation.searchParams.mockReturnValue(
          new URLSearchParams("tag=external"),
        );
      }
      rerender();
      expect(navigation.replace).toHaveBeenCalledTimes(1);
      expect(result.current.includeArchive).toBe(change === "popstate");
      expect(result.current.scope).toBe("product");

      act(() => result.current.setScope("lead"));
      expect(navigation.replace).toHaveBeenLastCalledWith(
        change === "popstate"
          ? "/reports/report-1?archive=1&scope=lead"
          : change === "path"
            ? "/reports/report-2?scope=lead"
            : "/reports/report-1?tag=external&scope=lead",
        { scroll: false },
      );
    },
  );
});
describe("useReportShellUrlState — 2", () => {
  it("acknowledges a queued selection only once in StrictMode", () => {
    const { result, rerender } = renderHook(
      () => useReportShellUrlState({ stripParams: [] }),
      {
        wrapper: ({ children }: PropsWithChildren) =>
          createElement(StrictMode, null, children),
      },
    );
    act(() => {
      result.current.setIncludeArchive(true);
      result.current.setScope("lead");
    });
    navigation.searchParams.mockReturnValue(new URLSearchParams("archive=1"));
    rerender();
    rerender();
    expect(navigation.replace).toHaveBeenCalledTimes(2);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?archive=1&scope=lead",
      { scroll: false },
    );
  });
});

it("pushes deliberate Review and Read changes, including a queued toggle", () => {
  const { result, rerender } = renderHook(() =>
    useReportShellUrlState({ stripParams: [] }),
  );
  act(() => result.current.setReviewIntent(true));
  expect(navigation.push).toHaveBeenLastCalledWith(
    "/reports/report-1?review=1",
    { scroll: false },
  );
  act(() => result.current.setReviewIntent(false));
  navigation.searchParams.mockReturnValue(new URLSearchParams("review=1"));
  rerender();
  expect(navigation.push).toHaveBeenLastCalledWith("/reports/report-1", {
    scroll: false,
  });
  expect(navigation.push).toHaveBeenCalledTimes(2);
});
