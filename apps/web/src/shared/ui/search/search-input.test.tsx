import type { QueryObserverResult } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../test-utils/query-state";

type QueryResult = QueryObserverResult;

// Mock tRPC + useQuery to drive search without a network; next/navigation so
// router.push does not need the app shell.

interface UseQueryOptions {
  queryKey?: readonly unknown[];
  enabled?: boolean;
}
const useQueryMock = vi.fn<(opts: UseQueryOptions) => QueryResult>();
const queryOptionsMock = vi.fn((args: unknown) => ({
  queryKey: ["search", "query", args],
}));
const pushMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey?: readonly unknown[]; enabled?: boolean }) =>
    useQueryMock(opts),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock("../../lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    search: {
      query: {
        queryOptions: (args: unknown) => queryOptionsMock(args),
      },
    },
  }),
}));

// Default to a non-viewer role so the lead/admin routing assertions hold;
// the viewer cases override it per test.
const useSessionMock = vi.fn(() => ({ user: { role: "head" } }));
vi.mock("../../lib/auth/session-provider", () => ({
  useSession: () => useSessionMock(),
}));

import { SearchInput } from "./search-input";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

function itemHit(id: string, title: string) {
  return {
    type: "item" as const,
    id,
    title,
    snippet: title,
    rank: 0.9,
    projectId: PROJECT_ID,
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    createdAt: "2026-05-06T08:00:00.000Z",
  };
}

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useQueryMock.mockReset();
    queryOptionsMock.mockClear();
    pushMock.mockClear();
    useSessionMock.mockReset();
    useSessionMock.mockReturnValue({ user: { role: "head" } });
    useQueryMock.mockReturnValue(makeQueryState({ data: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the input with the supplied placeholder", () => {
    render(<SearchInput scope="mine" placeholder="Найти в моих отчётах" />);
    expect(
      screen.getByPlaceholderText("Найти в моих отчётах"),
    ).toBeInTheDocument();
  });

  it("gives the search control a meaningful form name", () => {
    render(<SearchInput scope="mine" />);

    expect(screen.getByRole("combobox")).toHaveAttribute("name", "search");
  });

  it("names the all scope for reports and products", () => {
    render(<SearchInput scope="all" placeholder="Any product or report…" />);

    const input = screen.getByRole("combobox");
    expect(input).toHaveAccessibleName("Search reports and products");
    expect(input).toHaveAttribute("placeholder", "Any product or report…");
  });

  it.each(["mine", "published"] as const)(
    "names the %s scope for reports",
    (scope) => {
      render(<SearchInput scope={scope} />);

      expect(screen.getByRole("combobox")).toHaveAccessibleName(
        "Search reports",
      );
    },
  );

  it("references only a mounted popup across collapsed, expanded, and escaped states", () => {
    render(<SearchInput scope="all" />);
    const input = screen.getByRole("combobox");
    const relationships: { controls: string | null; mounted: boolean }[] = [];
    const recordRelationship = () => {
      const controls = input.getAttribute("aria-controls");
      relationships.push({
        controls,
        mounted:
          controls !== null && document.getElementById(controls) !== null,
      });
    };
    recordRelationship();
    fireEvent.change(input, { target: { value: "PR" } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input.getAttribute("aria-controls")).toBe(
      screen.getByRole("listbox").id,
    );
    recordRelationship();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    recordRelationship();
    expect(
      relationships.filter(
        ({ controls, mounted }) => controls !== null && !mounted,
      ),
    ).toEqual([]);
  });

  it("passes enabled:false to useQuery while q is below the 2-char floor", () => {
    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");

    act(() => {
      fireEvent.change(input, { target: { value: "a" } });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // `enabled` flag in useQuery options should be false until q.length >= 2.
    const lastCall = useQueryMock.mock.calls.at(-1);
    const opts = lastCall?.[0] as { enabled?: boolean } | undefined;
    expect(opts?.enabled).toBe(false);
  });

  it("fires the query when q has 2+ chars after the debounce window elapses", () => {
    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");

    act(() => {
      fireEvent.change(input, { target: { value: "PR" } });
    });
    // Before debounce fires, the queryOptions sees the previous (empty) value
    // for one render but `enabled` is still false because debouncedQ is ''.
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // After debounce, queryOptions is invoked with the new q AND enabled=true.
    const calls = queryOptionsMock.mock.calls;
    const lastQueryOptionsArg = calls.at(-1)?.[0] as
      { q?: string; scope?: string } | undefined;
    expect(lastQueryOptionsArg?.q).toBe("PR");
    expect(lastQueryOptionsArg?.scope).toBe("mine");

    const lastUseQueryArg = useQueryMock.mock.calls.at(-1);
    const useQueryOpts = lastUseQueryArg?.[0] as
      { enabled?: boolean } | undefined;
    expect(useQueryOpts?.enabled).toBe(true);
  });

  it("renders results returned by useQuery and converts <<…>> markers to <mark>", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Релиз заблокирован",
            snippet: "Релиз <<заблокирован>> security-сканером",
            rank: 0.5,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");

    act(() => {
      fireEvent.change(input, { target: { value: "релиз" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText("Релиз заблокирован")).toBeInTheDocument();
    const markEl = screen.getByText("заблокирован");
    expect(markEl.tagName).toBe("MARK");
  });

  it("renders the empty state when the data array is empty", () => {
    useQueryMock.mockReturnValue(makeQueryState({ data: [] }));
    render(<SearchInput scope="mine" />);

    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "unknown" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.getByText("Try a different search.")).toBeInTheDocument();
  });

  it("renders an error state when search fails", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({ data: undefined, error: new Error("search failed") }),
    );
    render(<SearchInput scope="all" />);

    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "platform" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText("Search failed")).toBeInTheDocument();
  });

  it("navigates via router.push on Enter when a hit is highlighted", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Test item",
            snippet: "Test <<item>>",
            rank: 0.9,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Lead form has no `id="section-<id>"` target — omit the dead fragment.
    expect(pushMock).toHaveBeenCalledWith(`/lead/report/${REPORT_ID}`);
    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("#section-"),
    );
  });

  it("prevents result mousedown from blurring search before navigation", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Release blocked",
            snippet: "Release",
            rank: 0.9,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );
    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "release" } });
      vi.advanceTimersByTime(350);
    });
    const option = screen.getByRole("option");
    expect(fireEvent.mouseDown(option)).toBe(false);
    fireEvent.click(option);
    expect(pushMock).toHaveBeenCalledWith(`/lead/report/${REPORT_ID}`);
  });

  it("clears the input and closes the dropdown on Escape", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Release blocked",
            snippet: "Release <<blocked>>",
            rank: 0.9,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole<HTMLInputElement>("combobox");

    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "release" } });
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Dropdown (listbox) must be visible before Escape.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(input.value).toBe("release");

    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(input.value).toBe("");
    // The listbox must be removed from the DOM after Escape.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("treats search as one Tab stop and closes the popup when focus leaves", async () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Release blocked",
            snippet: "Release <<blocked>>",
            rank: 0.9,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(
      <>
        <SearchInput scope="mine" />
        <button type="button">Next control</button>
      </>,
    );
    const input = screen.getByRole("combobox");
    act(() => {
      input.focus();
      fireEvent.change(input, { target: { value: "release" } });
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(input).toHaveFocus();

    // jsdom does not move focus on Tab, so user-event performs the real
    // traversal from the active element; switch off fake timers for that.
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.tab();

    expect(screen.getByRole("button", { name: "Next control" })).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("reveals the active result during arrow navigation without moving focus", () => {
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          itemHit(ITEM_ID, "Release blocked"),
          itemHit(REPORT_ID, "Release plan"),
        ],
      }),
    );

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");
    act(() => {
      input.focus();
      fireEvent.change(input, { target: { value: "release" } });
      vi.advanceTimersByTime(350);
    });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    const secondOption = options[1];
    if (!secondOption) throw new Error("second search option not rendered");
    scrollIntoView.mockClear();

    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-activedescendant", secondOption.id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(secondOption);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('forwards scope="all" through to queryOptions', () => {
    render(<SearchInput scope="all" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "platform" } });
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const lastQueryOptionsArg = queryOptionsMock.mock.calls.at(-1)?.[0] as
      { scope?: string } | undefined;
    expect(lastQueryOptionsArg?.scope).toBe("all");
  });

  it("routes a project hit to /admin?tab=products", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "project",
            id: PROJECT_ID,
            title: "E-Commerce Platform",
            snippet: "<<E-Commerce>> Platform",
            rank: 0.7,
            projectId: PROJECT_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="all" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "platform" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/admin?tab=products&filter=${PROJECT_ID}`,
    );
  });

  // Viewer item/risk/decision hits route to the read-only published report.
  it("routes a viewer's item hit to /reports/[reportId], not /lead/report", () => {
    useSessionMock.mockReturnValue({ user: { role: "viewer" } });
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Published task",
            snippet: "Published <<task>>",
            rank: 0.9,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="published" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "task" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(pushMock).toHaveBeenCalledWith(`/reports/${REPORT_ID}`);
    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/lead/report"),
    );
  });

  // Even if the server leaks a project hit, the viewer never sees it.
  it("suppresses a project hit for a viewer", () => {
    useSessionMock.mockReturnValue({ user: { role: "viewer" } });
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "project",
            id: PROJECT_ID,
            title: "E-Commerce Platform",
            snippet: "<<E-Commerce>> Platform",
            rank: 0.7,
            projectId: PROJECT_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="published" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "platform" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByText("E-Commerce Platform")).not.toBeInTheDocument();
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it('forwards scope="published" through to queryOptions', () => {
    useSessionMock.mockReturnValue({ user: { role: "viewer" } });
    render(<SearchInput scope="published" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "platform" } });
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const lastQueryOptionsArg = queryOptionsMock.mock.calls.at(-1)?.[0] as
      { scope?: string } | undefined;
    expect(lastQueryOptionsArg?.scope).toBe("published");
  });

  it("badge span has no aria-label attribute", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "item",
            id: ITEM_ID,
            title: "Test item",
            snippet: "Test <<item>>",
            rank: 0.9,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // The badge span has the `inline-flex` class; the snippet may also contain
    // the word "Task" inside a plain <span>, so we narrow by className.
    const allTaskSpans = screen.getAllByText("Task");
    const badgeSpan = allTaskSpans.find((el) =>
      el.className.includes("inline-flex"),
    );
    if (!badgeSpan) throw new Error("badge span not found");
    // Snapshot the badge span in isolation — avoids the locale-dependent date sibling.
    expect(badgeSpan.outerHTML).toMatchInlineSnapshot(
      `"<span class="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Task</span>"`,
    );
    // Confirm no aria-label is present on the span.
    expect(badgeSpan).not.toHaveAttribute("aria-label");
  });

  it("badge span has class inline-flex and renders badge.label text", () => {
    const hitTypes = [
      { type: "item", expectedLabel: "Task", id: ITEM_ID },
      { type: "project", expectedLabel: "Product", id: PROJECT_ID },
    ] as const;

    for (const { type, expectedLabel, id } of hitTypes) {
      useQueryMock.mockReturnValue(
        makeQueryState({
          data: [
            {
              type,
              id,
              title: `${expectedLabel} title`,
              snippet: `${expectedLabel} <<snippet>>`,
              rank: 0.8,
              projectId: PROJECT_ID,
              reportId: type !== "project" ? REPORT_ID : undefined,
              reportSectionId: type !== "project" ? SECTION_ID : undefined,
              createdAt: "2026-05-06T08:00:00.000Z",
            },
          ],
        }),
      );

      const { unmount } = render(<SearchInput scope="mine" />);
      const input = screen.getByRole("combobox");
      act(() => {
        fireEvent.change(input, { target: { value: "te" } });
        fireEvent.focus(input);
      });
      act(() => {
        vi.advanceTimersByTime(350);
      });

      const allSpans = screen.getAllByText(expectedLabel);
      const badgeSpan = allSpans.find((el) =>
        el.className.includes("inline-flex"),
      );
      if (!badgeSpan)
        throw new Error(`badge span not found for ${expectedLabel}`);
      expect(badgeSpan.tagName).toBe("SPAN");
      expect(badgeSpan.className).toContain("inline-flex");
      unmount();
    }
  });

  it("badge span is first child of its flex container", () => {
    useQueryMock.mockReturnValue(
      makeQueryState({
        data: [
          {
            type: "risk",
            id: ITEM_ID,
            title: "Risk title",
            snippet: "Risk <<snippet>>",
            rank: 0.8,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: "2026-05-06T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value: "ri" } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const allRiskSpans = screen.getAllByText("Risk");
    const badgeSpan = allRiskSpans.find((el) =>
      el.className.includes("inline-flex"),
    );
    if (!badgeSpan) throw new Error("badge span not found");
    const flexContainer = badgeSpan.parentElement;
    expect(flexContainer?.firstElementChild).toBe(badgeSpan);
    expect(flexContainer?.className).toContain("flex");
    expect(flexContainer?.className).toContain("items-center");
    expect(flexContainer?.className).toContain("justify-between");
  });
});
