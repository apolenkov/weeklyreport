// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  type ReportShellScopeValue,
  useReportShellUrlState,
} from "./use-report-shell-url-state";

const navigation = vi.hoisted(() => ({
  pathname: "/reports/report-1",
  replace: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.searchParams(),
}));

afterEach(() => {
  navigation.replace.mockReset();
  navigation.searchParams.mockReturnValue(new URLSearchParams());
});

describe("useReportShellUrlState", () => {
  it.each([
    ["", "product"],
    ["scope=product", "product"],
    ["scope=lead", "lead"],
    ["scope=own", "product"],
  ] as const)("derives %s as the supported %s scope", (query, expected) => {
    navigation.searchParams.mockReturnValue(new URLSearchParams(query));
    const { result } = renderHook(() =>
      useReportShellUrlState({ stripParams: [] }),
    );

    expect(result.current.scope).toBe(expected);
    expectTypeOf(result.current.scope).toEqualTypeOf<ReportShellScopeValue>();
    expectTypeOf(result.current.setScope)
      .parameter(0)
      .toEqualTypeOf<ReportShellScopeValue>();
  });

  it("stores lead explicitly and represents product by omitting the scope param", () => {
    navigation.searchParams.mockReturnValue(
      new URLSearchParams("archive=1&scope=product"),
    );
    const { result } = renderHook(() =>
      useReportShellUrlState({ stripParams: [] }),
    );

    act(() => result.current.setScope("lead"));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?archive=1&scope=lead",
      { scroll: false },
    );

    act(() => result.current.setScope("product"));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?archive=1",
      { scroll: false },
    );
  });
});
