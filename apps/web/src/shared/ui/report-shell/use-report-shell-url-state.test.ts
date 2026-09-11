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
    { shell: "viewer", stripParams: ["source", "recovery"] },
    { shell: "head", stripParams: [] },
  ])(
    "preserves the $shell marker policy on every navigation",
    ({ stripParams }) => {
      const original = new URLSearchParams(
        "source=status&recovery=1&archive=1&scope=lead&mode=slides&tag=a&tag=b",
      );
      navigation.searchParams.mockReturnValue(original);
      const { result } = renderHook(() =>
        useReportShellUrlState({ stripParams }),
      );
      const expectMarkersAndTags = (url: string) => {
        const params = new URL(url, "https://reports.example.test")
          .searchParams;
        expect(params.get("source")).toBe(
          stripParams.length > 0 ? null : "status",
        );
        expect(params.get("recovery")).toBe(
          stripParams.length > 0 ? null : "1",
        );
        expect(params.getAll("tag")).toEqual(["a", "b"]);
        return params;
      };

      // The period navigator and view-mode links use the same query builder.
      const period = expectMarkersAndTags(
        `/reports/report-2${result.current.buildQuery({})}`,
      );
      expect(period.get("scope")).toBe("lead");
      expect(period.get("archive")).toBe("1");
      expect(period.get("mode")).toBe("slides");
      const edit = expectMarkersAndTags(
        `/reports/report-1${result.current.buildQuery({ mode: null })}`,
      );
      expect(edit.has("mode")).toBe(false);
      const slides = expectMarkersAndTags(
        `/reports/report-1${result.current.buildQuery({ mode: "slides" })}`,
      );
      expect(slides.get("mode")).toBe("slides");

      act(() => result.current.setScope("product"));
      const scopeCall = navigation.replace.mock.lastCall;
      expect(scopeCall).toBeDefined();
      const scope = expectMarkersAndTags(String(scopeCall?.[0]));
      expect(scope.has("scope")).toBe(false);
      expect(scope.get("archive")).toBe("1");
      expect(scopeCall?.[1]).toEqual({ scroll: false });

      act(() => result.current.setIncludeArchive(false));
      const archiveCall = navigation.replace.mock.lastCall;
      expect(archiveCall).toBeDefined();
      const archive = expectMarkersAndTags(String(archiveCall?.[0]));
      expect(archive.has("archive")).toBe(false);
      expect(archive.get("scope")).toBe("lead");
      expect(archiveCall?.[1]).toEqual({ scroll: false });
      expect(original.get("source")).toBe("status");
      expect(original.get("recovery")).toBe("1");
    },
  );

  it.each([
    ["", "product"],
    ["scope=product", "product"],
    ["scope=lead", "lead"],
    ["scope=own", "product"],
    ["scope=lead&scope=product", "product"],
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

  it("drops repeated report controls on navigation without touching unrelated values", () => {
    navigation.searchParams.mockReturnValue(
      new URLSearchParams(
        "archive=1&archive=0&mode=slides&mode=edit&feedback=one&feedback=two&tag=a&tag=b",
      ),
    );
    const { result } = renderHook(() =>
      useReportShellUrlState({ stripParams: [] }),
    );
    expect(result.current.includeArchive).toBe(false);
    act(() => result.current.setScope("lead"));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?tag=a&tag=b&scope=lead",
      { scroll: false },
    );
  });
});
