// PeriodNavigator tests pin shareable path-segment URLs and custom addressed
// paths; the listbox keeps archived options compatible with neutral badges.
import "@testing-library/jest-dom/vitest";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
const navigationState: { searchParams: URLSearchParams; pathname: string } = {
  searchParams: new URLSearchParams(),
  pathname: "/lead/report",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => navigationState.searchParams,
  usePathname: () => navigationState.pathname,
}));

import type { ReportPeriod } from "../../report-sections";
import { PeriodNavigator } from "./period-navigator";

const CURRENT_PERIOD: ReportPeriod = {
  id: "2026-W17",
  periodStart: new Date("2026-04-21T00:00:00.000Z"),
  sourceSectionId: "sec-W17",
  weekLabel: "Week 17",
  dateRange: "Apr 21–27, 2026",
  isCurrent: true,
  isSubmitted: false,
};

const PERIODS: ReportPeriod[] = [
  CURRENT_PERIOD,
  {
    id: "2026-W16",
    periodStart: new Date("2026-04-14T00:00:00.000Z"),
    sourceSectionId: "sec-W16",
    weekLabel: "Week 16",
    dateRange: "Apr 14–20, 2026",
    isCurrent: false,
    isSubmitted: true,
  },
  {
    id: "2026-W15",
    periodStart: new Date("2026-04-07T00:00:00.000Z"),
    sourceSectionId: "sec-W15",
    weekLabel: "Week 15",
    dateRange: "Apr 7–13, 2026",
    isCurrent: false,
    isSubmitted: true,
    archived: true,
  },
];

const SCHEDULED_PERIODS: ReportPeriod[] = [
  CURRENT_PERIOD,
  {
    id: "2026-W18",
    periodStart: new Date("2026-04-28T00:00:00.000Z"),
    weekLabel: "Week 18",
    dateRange: "Apr 28–May 4, 2026",
    isCurrent: false,
    periodState: "scheduled",
  },
  ...PERIODS.slice(1),
];

function getTrigger() {
  return screen.getByRole("combobox", { name: "Select reporting period" });
}

describe("PeriodNavigator (lead)", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    navigationState.searchParams = new URLSearchParams();
    navigationState.pathname = "/lead/report";
  });

  describe("a11y — decorative SVG aria-hidden", () => {
    it("ChevronLeft SVG in Previous button has aria-hidden='true'", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const prevButton = screen.getByRole("button", {
        name: "Previous period",
      });
      expect(prevButton.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it("ChevronRight SVG in Next button has aria-hidden='true'", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const nextButton = screen.getByRole("button", { name: "Next period" });
      expect(nextButton.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it("ChevronRight SVG in trigger decorator span has aria-hidden='true'", () => {
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      const decoratorSpan = container.querySelector(".pointer-events-none svg");
      expect(decoratorSpan).toHaveAttribute("aria-hidden", "true");
    });

    it("trigger decorator is a combobox caret, not a next-period chevron", () => {
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      const decorator = container.querySelector(".pointer-events-none");
      // Right-pointing chevron (M9 18l6-6-6-6) belongs to the Next button;
      // inside the pill it reads as "already at the end" next to Next.
      expect(decorator?.querySelector('path[d="M9 18l6-6-6-6"]')).toBeNull();
      expect(decorator?.querySelector('path[d="M6 9l6 6 6-6"]')).not.toBeNull();
    });

    it("all three navigator SVGs have aria-hidden='true' (closed listbox)", () => {
      // prev-button + next-button + trigger-chevron decorator = 3. The listbox
      // panel is portaled to document.body, so it is outside `container`.
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs).toHaveLength(3);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  it("container div has role='group' with the period navigation aria-label", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    expect(
      screen.getByRole("group", {
        name: "Period navigation (swipe left/right or use arrows)",
      }),
    ).toBeInTheDocument();
  });

  it("uses a full compact row without growing across the desktop toolbar", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const navigation = screen.getByRole("group", {
      name: "Period navigation (swipe left/right or use arrows)",
    });
    const triggerContainer = getTrigger().parentElement;

    expect(navigation.className).toContain("max-w-full");
    expect(navigation.className).not.toContain("flex-1");
    expect(navigation.className).toContain("basis-full");
    expect(navigation.className).toContain("md:basis-auto");
    expect(triggerContainer?.className).toContain("min-w-0");
    expect(triggerContainer?.className).toContain("flex-1");
    expect(triggerContainer?.className).toContain("md:w-[24ch]");
    expect(getTrigger().className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
    expect(getTrigger().className).toContain(
      "max-md:min-w-[var(--touch-target-min)]",
    );
    for (const arrow of screen.getAllByRole("button", {
      name: /period$/i,
    })) {
      expect(arrow.className).toContain(
        "max-md:min-h-[var(--touch-target-min)]",
      );
      expect(arrow.className).toContain(
        "max-md:min-w-[var(--touch-target-min)]",
      );
      expect(arrow.querySelector("span")?.className).toContain("md:inline");
      // R46: labels must not drop again at xl — wide screens have room for text.
      expect(arrow.querySelector("span")?.className).not.toContain("xl:hidden");
    }
  });

  describe("custom listbox", () => {
    it.each(["Enter", " "])(
      "clamps the active descendant after options shrink and selects it with %j",
      (key) => {
        const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
        const { rerender } = render(<PeriodNavigator periods={PERIODS} />);
        const trigger = getTrigger();
        trigger.focus();
        fireEvent.click(trigger);
        fireEvent.keyDown(trigger, { key: "End" });
        const removedOption = screen.getByRole("option", {
          name: /Apr 7–13, 2026/,
        });
        expect(trigger).toHaveAttribute(
          "aria-activedescendant",
          removedOption.id,
        );
        scrollIntoView.mockClear();

        rerender(<PeriodNavigator periods={PERIODS.slice(0, 2)} />);

        const remainingOption = screen.getByRole("option", {
          name: /Apr 14–20, 2026/,
        });
        expect(trigger).toHaveAttribute(
          "aria-activedescendant",
          remainingOption.id,
        );
        expect(scrollIntoView.mock.contexts).toContain(remainingOption);
        expect(trigger).toHaveFocus();
        fireEvent.keyDown(trigger, { key });
        expect(push).toHaveBeenCalledExactlyOnceWith("/lead/report/2026-W16");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      },
    );

    it.each([
      { periods: PERIODS, shrink: "3 to 2", key: "Enter" },
      { periods: PERIODS, shrink: "3 to 2", key: " " },
      { periods: SCHEDULED_PERIODS, shrink: "4 to 2", key: "Enter" },
      { periods: SCHEDULED_PERIODS, shrink: "4 to 2", key: " " },
    ])(
      "moves up once after options shrink $shrink and selects with $key",
      ({ periods, key }) => {
        navigationState.pathname = "/lead/report/2026-W16";
        const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
        const { rerender } = render(<PeriodNavigator periods={periods} />);
        const trigger = getTrigger();
        trigger.focus();
        fireEvent.click(trigger);
        fireEvent.keyDown(trigger, { key: "End" });
        expect(trigger).toHaveAttribute(
          "aria-activedescendant",
          screen.getByRole("option", { name: /Apr 7–13, 2026/ }).id,
        );

        rerender(<PeriodNavigator periods={PERIODS.slice(0, 2)} />);
        expect(trigger).toHaveAttribute(
          "aria-activedescendant",
          screen.getByRole("option", { name: /Apr 14–20, 2026/ }).id,
        );
        scrollIntoView.mockClear();

        fireEvent.keyDown(trigger, { key: "ArrowUp" });

        const firstOption = screen.getByRole("option", {
          name: /Apr 21–27, 2026/,
        });
        expect(trigger).toHaveAttribute(
          "aria-activedescendant",
          firstOption.id,
        );
        expect(scrollIntoView.mock.contexts).toContain(firstOption);
        expect(trigger).toHaveFocus();
        fireEvent.keyDown(trigger, { key });
        expect(push).toHaveBeenCalledExactlyOnceWith("/lead/report/2026-W17");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      },
    );

    it("removes the active descendant when an open list becomes empty", () => {
      const { rerender } = render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: "End" });

      rerender(<PeriodNavigator periods={[]} />);

      expect(screen.queryByRole("option")).not.toBeInTheDocument();
      expect(trigger).not.toHaveAttribute("aria-activedescendant");
      for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "]) {
        fireEvent.keyDown(trigger, { key });
      }
      expect(trigger).not.toHaveAttribute("aria-activedescendant");
      expect(push).not.toHaveBeenCalled();
    });

    it("bounds the portaled panel at the right gutter on open and resize", async () => {
      const viewport = vi.spyOn(window, "innerWidth", "get");
      viewport.mockReturnValue(320);
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
        new DOMRect(250, 20, 60, 40),
      );

      fireEvent.click(trigger);

      const panel = screen.getByRole("listbox");
      expect(panel).toHaveStyle({
        left: "244px",
        top: "64px",
        "min-width": "60px",
      });
      expect(panel.style.maxWidth).toBe("calc(100vw - 32px)");
      expect(panel.parentElement).toBe(document.body);

      viewport.mockReturnValue(280);
      fireEvent(window, new Event("resize"));

      await waitFor(() => expect(panel).toHaveStyle({ left: "204px" }));
    });

    it("trigger exposes the combobox a11y contract and starts closed", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("opens the listbox on trigger click and renders an option per period", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(PERIODS.length);
      // Each option row floors at the touch target below `md`; jsdom cannot
      // evaluate media queries, so the class assertion is the teeth.
      for (const option of options) {
        expect(option.className).toContain(
          "max-md:min-h-[var(--touch-target-min)]",
        );
      }
    });

    it("opens on ArrowDown from the keyboard", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.keyDown(getTrigger(), { key: "ArrowDown" });
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("the current period is marked aria-selected", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      const selected = screen.getByRole("option", {
        name: /Apr 21–27, 2026 \(Current\)/,
      });
      expect(selected).toHaveAttribute("aria-selected", "true");
    });

    it("archived options carry the neutral Archived badge (no text prefix)", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      const archivedOption = screen.getByRole("option", {
        name: /Apr 7–13, 2026/,
      });
      expect(within(archivedOption).getByText("Archived")).toBeInTheDocument();
      // The current label never carries an "[Archived]" bracketed prefix.
      expect(archivedOption.textContent).not.toContain("[Archived]");
    });

    it("selecting an option via click pushes the addressed URL and closes", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      fireEvent.mouseDown(
        screen.getByRole("option", { name: /Apr 14–20, 2026/ }),
      );
      expect(push).toHaveBeenCalledWith("/lead/report/2026-W16");
      expect(replace).not.toHaveBeenCalled();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("ArrowDown then Enter selects the next option", () => {
      // Open anchored on the current period (index 0); ArrowDown → index 1.
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(trigger, { key: "Enter" });
      expect(push).toHaveBeenCalledWith("/lead/report/2026-W16");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("re-selecting the already-selected period does not navigate (inert, matches native select)", () => {
      // A single-option fallback navigator (viewer /reports/[reportId], lead
      // preview) must be inert: re-picking the current period is a no-op, the
      // same as a native <select> re-selecting its current option. Otherwise
      // the head urlBuilder would jump viewer/lead surfaces to /head/report.
      render(<PeriodNavigator periods={PERIODS.slice(0, 1)} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      fireEvent.mouseDown(
        screen.getByRole("option", { name: /Apr 21–27, 2026/ }),
      );
      expect(push).not.toHaveBeenCalled();
      // The listbox still closes.
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("Escape closes the listbox without navigating", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("Escape closes the listbox and restores focus to the trigger", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      trigger.focus();
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      fireEvent.keyDown(trigger, { key: "Escape" });

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
    });

    it.each([
      { shift: false, neighbor: "Next period" },
      { shift: true, neighbor: "Previous period" },
    ])(
      "lets focus leave the open trigger with Tab (shift=$shift)",
      async ({ shift, neighbor }) => {
        const user = userEvent.setup();
        navigationState.pathname = "/lead/report/2026-W16";
        render(<PeriodNavigator periods={PERIODS} />);
        const trigger = getTrigger();
        await user.click(trigger);
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        await user.tab({ shift });

        expect(screen.getByRole("button", { name: neighbor })).toHaveFocus();
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      },
    );

    it("scrolls the active option into view on ArrowDown", () => {
      // scrollIntoView is a global no-op stub (jsdom omits it); spy on it so
      // the hook's keep-active-option-visible effect is observable.
      const scrollIntoView = vi
        .spyOn(Element.prototype, "scrollIntoView")
        .mockImplementation(() => undefined);
      try {
        render(<PeriodNavigator periods={PERIODS} />);
        const trigger = getTrigger();
        fireEvent.click(trigger);
        scrollIntoView.mockClear();

        fireEvent.keyDown(trigger, { key: "ArrowDown" });

        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      } finally {
        scrollIntoView.mockRestore();
      }
    });
  });

  describe("swipe navigation", () => {
    it.each([
      { deltaX: -50, deltaY: 0, target: "/lead/report/2026-W17" },
      { deltaX: 50, deltaY: 10, target: "/lead/report/2026-W15" },
      { deltaX: -49, deltaY: 0, target: null },
      { deltaX: 49, deltaY: 0, target: null },
      { deltaX: -80, deltaY: 100, target: null },
      { deltaX: 80, deltaY: -100, target: null },
      { deltaX: -60, deltaY: 60, target: null },
      { deltaX: 60, deltaY: -60, target: null },
    ])(
      "handles displacement ($deltaX, $deltaY) without treating vertical scroll as navigation",
      ({ deltaX, deltaY, target }) => {
        navigationState.pathname = "/lead/report/2026-W16";
        render(<PeriodNavigator periods={PERIODS} />);
        const navigation = screen.getByRole("group", {
          name: "Period navigation (swipe left/right or use arrows)",
        });

        fireEvent.touchStart(navigation, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchEnd(navigation, {
          changedTouches: [{ clientX: 100 + deltaX, clientY: 100 + deltaY }],
        });

        if (target === null) expect(push).not.toHaveBeenCalled();
        else expect(push).toHaveBeenCalledExactlyOnceWith(target);
      },
    );

    it("consumes the touch start once and ignores incomplete gestures", () => {
      navigationState.pathname = "/lead/report/2026-W16";
      render(<PeriodNavigator periods={PERIODS} />);
      const navigation = screen.getByRole("group", {
        name: "Period navigation (swipe left/right or use arrows)",
      });
      const end = { changedTouches: [{ clientX: 0, clientY: 100 }] };
      fireEvent.touchEnd(navigation, end);
      fireEvent.touchStart(navigation, { touches: [] });
      fireEvent.touchEnd(navigation, end);
      fireEvent.touchStart(navigation, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(navigation, { changedTouches: [] });
      fireEvent.touchEnd(navigation, end);
      expect(push).not.toHaveBeenCalled();

      fireEvent.touchStart(navigation, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(navigation, end);
      fireEvent.touchEnd(navigation, end);
      expect(push).toHaveBeenCalledExactlyOnceWith("/lead/report/2026-W17");
    });
  });

  it("trigger shows the (Current) suffix for the current period; no week/period numbering", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const trigger = getTrigger();
    expect(trigger).toHaveTextContent("Apr 21–27, 2026 (Current)");
    expect(trigger.textContent).not.toContain("Period");
    expect(trigger.textContent).not.toContain("Week");
  });

  it("trigger shows the bare date range for a past period (no suffix)", () => {
    navigationState.pathname = "/lead/report/2026-W16";
    render(<PeriodNavigator periods={PERIODS} />);
    expect(getTrigger()).toHaveTextContent("Apr 14–20, 2026");
  });

  it("labels an addressed scheduled period without moving the Current marker", () => {
    navigationState.pathname = "/head/report/2026-W18";
    render(
      <PeriodNavigator
        periods={SCHEDULED_PERIODS}
        urlBuilder={(periodId) => `/head/report/${periodId}`}
      />,
    );

    expect(getTrigger()).toHaveTextContent("Apr 28–May 4, 2026 (Scheduled)");
    expect(getTrigger()).not.toHaveTextContent("(Current)");

    fireEvent.click(getTrigger());
    expect(
      screen.getByRole("option", {
        name: /Apr 21–27, 2026 \(Current\)/,
      }),
    ).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("option", {
        name: /Apr 28–May 4, 2026 \(Scheduled\)/,
      }),
    ).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(push).toHaveBeenNthCalledWith(1, "/head/report/2026-W16");
    expect(push).toHaveBeenNthCalledWith(2, "/head/report/2026-W17");
  });

  it("keeps the full period label as a tooltip without a Submitted badge (R01/R30)", () => {
    render(
      <PeriodNavigator
        periods={PERIODS}
        showLeadSubmissionMarkers
        leadSubmittedAt="2026-04-20T10:00:00.000Z"
      />,
    );
    const trigger = getTrigger();
    expect(within(trigger).queryByText("Submitted")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute(
      "title",
      expect.stringContaining("(Current)"),
    );
  });

  it("trigger shows the Archived badge when the selected period is archived", () => {
    navigationState.pathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    const trigger = getTrigger();
    expect(within(trigger).getByText("Archived")).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Apr 7–13, 2026");
  });

  it("initial render reflects the path-segment reportId", () => {
    navigationState.pathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    expect(getTrigger()).toHaveTextContent("Apr 7–13, 2026");
  });

  it("uses currentPeriodId on a viewer pathname for selection and adjacent navigation", () => {
    navigationState.pathname = "/reports/2026-W16";
    render(
      <PeriodNavigator
        periods={PERIODS}
        currentPeriodId="2026-W16"
        urlBuilder={(periodId) => `/reports/${periodId}`}
      />,
    );

    const trigger = getTrigger();
    expect(trigger).toHaveTextContent("Apr 14–20, 2026");
    expect(trigger).not.toHaveTextContent("Apr 21–27, 2026 (Current)");

    fireEvent.click(trigger);
    const addressedOption = screen.getByRole("option", {
      name: /Apr 14–20, 2026/,
    });
    const newestOption = screen.getByRole("option", {
      name: /Apr 21–27, 2026 \(Current\)/,
    });
    expect(addressedOption).toHaveAttribute("aria-selected", "true");
    expect(newestOption).toHaveAttribute("aria-selected", "false");

    fireEvent.mouseDown(newestOption);
    expect(push).toHaveBeenCalledWith("/reports/2026-W17");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Keep the adjacent-navigation assertions independent from the direct pick.
    push.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(push).toHaveBeenNthCalledWith(1, "/reports/2026-W15");
    expect(push).toHaveBeenNthCalledWith(2, "/reports/2026-W17");
  });

  it("resolves the same period when currentPeriodId agrees with the pathname", () => {
    navigationState.pathname = "/lead/report/2026-W16";
    render(<PeriodNavigator periods={PERIODS} currentPeriodId="2026-W16" />);

    expect(getTrigger()).toHaveTextContent("Apr 14–20, 2026");
    expect(getTrigger()).not.toHaveTextContent("Apr 21–27, 2026 (Current)");
    fireEvent.click(getTrigger());
    expect(
      screen.getByRole("option", { name: /Apr 14–20, 2026/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a stale ?period= query (retired) and defaults to the current period", () => {
    navigationState.pathname = "/lead/report";
    navigationState.searchParams = new URLSearchParams("period=2026-W15");
    render(<PeriodNavigator periods={PERIODS} />);
    // No path-segment id → defaults to PERIODS[0] (2026-W17, the current week).
    expect(getTrigger()).toHaveTextContent("Apr 21–27, 2026 (Current)");
  });

  it("does not carry repeated report scalars into another period", () => {
    navigationState.searchParams = new URLSearchParams(
      "mode=slides&mode=edit&feedback=a&feedback=b&archive=1&tag=a&tag=b",
    );
    render(<PeriodNavigator periods={PERIODS} />);
    fireEvent.click(screen.getByRole("button", { name: /previous period/i }));
    expect(push).toHaveBeenCalledWith(
      "/lead/report/2026-W16?archive=1&tag=a&tag=b",
    );
  });

  // Two navigators can coexist on one page. Module-level constant ids would
  // collide, breaking aria-controls / aria-activedescendant. useId scopes per instance.
  describe("scoped instance ids (no duplicate ids across two navigators)", () => {
    it("two navigators on one page expose distinct listbox + option ids", () => {
      render(
        <>
          <PeriodNavigator periods={PERIODS} />
          <PeriodNavigator periods={PERIODS} />
        </>,
      );
      const triggers = screen.getAllByRole("combobox", {
        name: "Select reporting period",
      });
      expect(triggers).toHaveLength(2);
      const firstListboxId = triggers[0]?.getAttribute("aria-controls");
      const secondListboxId = triggers[1]?.getAttribute("aria-controls");
      expect(firstListboxId).toBeTruthy();
      expect(secondListboxId).toBeTruthy();
      expect(firstListboxId).not.toBe(secondListboxId);
    });

    it("aria-activedescendant resolves to an option inside the trigger's own listbox", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      const listbox = screen.getByRole("listbox");
      const activeId = trigger.getAttribute("aria-activedescendant") ?? "";
      expect(activeId).not.toBe("");
      // The active option id must live inside THIS trigger's listbox, and the
      // listbox id must be the one the trigger controls.
      expect(listbox.id).toBe(trigger.getAttribute("aria-controls"));
      const activeOption = within(listbox)
        .getAllByRole("option")
        .find((opt) => opt.id === activeId);
      expect(activeOption).toBeDefined();
    });

    it("Home and End move the active option to the first and last period", () => {
      navigationState.pathname = "/lead/report/2026-W16";
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      const initialActiveId =
        trigger.getAttribute("aria-activedescendant") ?? "";
      const optionPrefix = initialActiveId.slice(
        0,
        initialActiveId.lastIndexOf("-") + 1,
      );
      expect(optionPrefix).not.toBe("");
      fireEvent.keyDown(trigger, { key: "End" });
      expect(trigger.getAttribute("aria-activedescendant")).toBe(
        `${optionPrefix}${PERIODS.length - 1}`,
      );
      fireEvent.keyDown(trigger, { key: "Home" });
      expect(trigger.getAttribute("aria-activedescendant")).toBe(
        `${optionPrefix}0`,
      );
    });

    it("emits no active-descendant and keeps a valid anchor when there are no periods", () => {
      render(<PeriodNavigator periods={[]} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);

      expect(trigger.getAttribute("aria-activedescendant")).toBeNull();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(trigger, { key: "End" });
      expect(trigger.getAttribute("aria-activedescendant")).toBeNull();
    });
  });

  // Submitted marker is opt-in via showLeadSubmissionMarkers + leadSubmittedAt,
  // sourced ONLY from the current lead's section submittedAt.
  describe("lead submission markers", () => {
    const SUBMITTED_AT = new Date("2026-04-22T17:42:00.000Z");

    // R30: the marker moved out of the trigger (it duplicated the header badge
    // for the same displayed period); it still marks the period in the listbox.
    it("marks the selected period inside the open listbox, not the trigger", () => {
      render(
        <PeriodNavigator
          periods={PERIODS}
          showLeadSubmissionMarkers
          leadSubmittedAt={SUBMITTED_AT}
        />,
      );
      expect(
        within(getTrigger()).queryByText("Submitted"),
      ).not.toBeInTheDocument();

      fireEvent.click(getTrigger());
      expect(
        within(
          screen.getByRole("option", { name: /Apr 21–27, 2026/ }),
        ).getByText("Submitted"),
      ).toBeInTheDocument();
    });

    it("keeps the compact trigger width with submission markers enabled", () => {
      render(
        <PeriodNavigator
          periods={PERIODS}
          showLeadSubmissionMarkers
          leadSubmittedAt={SUBMITTED_AT}
        />,
      );

      const navigation = screen.getByRole("group", {
        name: "Period navigation (swipe left/right or use arrows)",
      });
      const triggerContainer = getTrigger().parentElement;

      expect(triggerContainer?.className).not.toContain("md:w-[32ch]");
      expect(triggerContainer?.className).toContain("md:w-[24ch]");
      expect(triggerContainer?.className).toContain("flex-1");
      expect(navigation.className).toContain("basis-full");
      expect(navigation.className).toContain("md:basis-auto");
      expect(getTrigger()).toHaveTextContent("Apr 21–27, 2026 (Current)");
    });

    it("does not show the submitted marker when the flag is off (head/viewer)", () => {
      render(
        <PeriodNavigator periods={PERIODS} leadSubmittedAt={SUBMITTED_AT} />,
      );
      fireEvent.click(getTrigger());
      expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
    });

    it("does not show the submitted marker when submittedAt is null even if enabled", () => {
      render(
        <PeriodNavigator
          periods={PERIODS}
          showLeadSubmissionMarkers
          leadSubmittedAt={null}
        />,
      );
      expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
    });
  });
});
