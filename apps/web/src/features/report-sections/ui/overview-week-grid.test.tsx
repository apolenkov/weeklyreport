import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { OverviewWeekGrid } from "./overview-week-grid";

afterEach(() => vi.unstubAllGlobals());

it("switches at the table width and retains the selected week across resize", async () => {
  let resize: ResizeObserverCallback | undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const width = (value: number) =>
    act(() =>
      resize?.(
        [{ contentRect: { width: value } }] as ResizeObserverEntry[],
        {} as ResizeObserver,
      ),
    );
  render(
    <OverviewWeekGrid plans={0}>
      <input aria-label="Draft" defaultValue="Retained text" />
    </OverviewWeekGrid>,
  );
  width(1087);
  expect(screen.queryByRole("tablist")).toBeNull();
  width(1086);
  const current = screen.getByRole("tab", { name: "This week" });
  expect(current).toHaveAttribute("aria-selected", "true");
  current.focus();
  await userEvent.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Next week" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await userEvent.keyboard("{Home}{ArrowRight}");
  expect(current).toHaveFocus();
  width(1728);
  width(375);
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("This week");
  expect(screen.getByRole("textbox")).toHaveValue("Retained text");
});
