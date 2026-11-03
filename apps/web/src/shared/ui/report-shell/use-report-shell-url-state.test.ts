import { vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => navigation.searchParams(),
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";

import { ArchiveToggle } from "./archive-toggle";
import { ScopeToggle } from "./scope-toggle";
import {
  type ReportShellScopeValue,
  useReportShellUrlState,
} from "./use-report-shell-url-state";
import { navigation } from "./use-report-shell-url-state.test-support";

describe("useReportShellUrlState — 1", () => {
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
});
describe("useReportShellUrlState — 2", () => {
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
});
describe("useReportShellUrlState — 3", () => {
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
});
describe("useReportShellUrlState — 4", () => {
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
describe("useReportShellUrlState — 5", () => {
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
    // Links preserve the latest deliberate controls, including queued Read intent.
    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "href",
      "?tag=a&tag=b&scope=lead&mode=slides",
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
      "?tag=a&tag=b&scope=lead&mode=slides",
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
});
describe("useReportShellUrlState — 6", () => {
  it("does not restore Review when Read overlaps scope and Slides navigation", () => {
    navigation.searchParams.mockReturnValue(
      new URLSearchParams("review=1&authorId=lead-1"),
    );
    const { result, rerender } = renderHook(() =>
      useReportShellUrlState({ stripParams: [] }),
    );
    expect(result.current.reviewIntent).toBe(true);
    act(() => result.current.setReviewIntent(false));
    act(() => result.current.setScope("lead"));
    expect(result.current.reviewIntent).toBe(false);
    expect(result.current.buildQuery({ mode: "slides" })).toBe(
      "?authorId=lead-1&scope=lead&mode=slides",
    );
    navigation.searchParams.mockReturnValue(
      new URLSearchParams("authorId=lead-1"),
    );
    rerender();
    expect(result.current.reviewIntent).toBe(false);
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/reports/report-1?authorId=lead-1&scope=lead",
      { scroll: false },
    );
  });
});
