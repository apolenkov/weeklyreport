// @vitest-environment jsdom

import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type PropsWithChildren, StrictMode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import { ArchiveToggle } from "./archive-toggle";
import { ScopeToggle } from "./scope-toggle";
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

beforeEach(() => {
  navigation.pathname = "/reports/report-1";
});

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
      const { result, rerender } = renderHook(() =>
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
      expect(navigation.replace).toHaveBeenCalledTimes(1);
      navigation.searchParams.mockReturnValue(scope);
      rerender();
      const archiveCall = navigation.replace.mock.lastCall;
      expect(archiveCall).toBeDefined();
      const archive = expectMarkersAndTags(String(archiveCall?.[0]));
      expect(archive.has("archive")).toBe(false);
      expect(archive.has("scope")).toBe(false);
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
    const { result, rerender } = renderHook(() =>
      useReportShellUrlState({ stripParams: [] }),
    );

    act(() => result.current.setScope("lead"));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?archive=1&scope=lead",
      { scroll: false },
    );

    navigation.searchParams.mockReturnValue(
      new URLSearchParams("archive=1&scope=lead"),
    );
    rerender();

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

  it("actual repeated Archive clicks preserve the latest selections through URL acknowledgements", async () => {
    navigation.searchParams.mockReturnValue(new URLSearchParams("tag=a&tag=b"));
    function Controls() {
      const state = useReportShellUrlState({ stripParams: [] });
      return createElement(
        "div",
        null,
        createElement(ArchiveToggle, {
          checked: state.includeArchive,
          onChange: state.setIncludeArchive,
        }),
        createElement(ScopeToggle<ReportShellScopeValue>, {
          value: state.scope,
          onChange: state.setScope,
          allowedScopes: ["product", "lead"],
        }),
        createElement(
          "a",
          { href: state.buildQuery({ mode: "slides" }) },
          "Slides",
        ),
      );
    }
    const user = userEvent.setup();
    const { rerender } = render(createElement(Controls));
    const archive = screen.getByRole("switch");
    const leads = screen.getByRole("radio", { name: "Leads" });

    await user.click(archive);
    await user.click(leads);
    await user.click(archive);
    expect(archive).toHaveAttribute("aria-checked", "false");
    expect(leads).toHaveAttribute("aria-checked", "true");
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?tag=a&tag=b&archive=1",
      { scroll: false },
    );
    // Link construction continues to describe the committed URL.
    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "href",
      "?tag=a&tag=b&mode=slides",
    );

    navigation.searchParams.mockReturnValue(
      new URLSearchParams("tag=a&tag=b&archive=1"),
    );
    rerender(createElement(Controls));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?tag=a&tag=b&scope=lead",
      { scroll: false },
    );
    expect(archive).toHaveAttribute("aria-checked", "false");
    expect(leads).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "href",
      "?tag=a&tag=b&archive=1&mode=slides",
    );
    expect(navigation.replace).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("radio", { name: "Product" }));
    expect(leads).toHaveAttribute("aria-checked", "false");
    navigation.searchParams.mockReturnValue(
      new URLSearchParams("tag=a&tag=b&scope=lead"),
    );
    rerender(createElement(Controls));
    expect(navigation.replace).toHaveBeenCalledTimes(3);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?tag=a&tag=b",
      { scroll: false },
    );
    expect(archive).toHaveAttribute("aria-checked", "false");
    expect(leads).toHaveAttribute("aria-checked", "false");
    navigation.searchParams.mockReturnValue(new URLSearchParams("tag=a&tag=b"));
    rerender(createElement(Controls));
    expect(navigation.replace).toHaveBeenCalledTimes(3);
    expect(archive).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Product" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

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
