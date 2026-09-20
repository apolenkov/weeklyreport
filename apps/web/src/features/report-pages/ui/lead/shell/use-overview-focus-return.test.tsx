import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOverviewFocusReturn } from "./use-overview-focus-return";

describe("overview focus recovery", () => {
  it("uses the heading when the surviving lineage is in a hidden mobile column", () => {
    const page = render(
      <button data-overview-focus="resolve:next:stable">Resolve</button>,
    );
    const hook = renderHook(({ open }) => useOverviewFocusReturn(open), {
      initialProps: { open: false },
    });
    screen.getByRole("button").focus();
    act(() => hook.result.current());
    hook.rerender({ open: true });
    page.rerender(
      <>
        <div style={{ display: "none" }}>
          <button data-overview-focus="edit:current:stable">Edit</button>
        </div>
        <h2 tabIndex={-1} data-overview-focus-heading>
          Report
        </h2>
      </>,
    );
    hook.rerender({ open: false });
    expect(screen.getByRole("heading")).toHaveFocus();
  });
  it("skips an origin inside a closed disclosure and falls back by identity", () => {
    render(
      <>
        <details>
          <summary>More actions</summary>
          <button data-overview-focus="move:current:stable">Move</button>
        </details>
        <button data-overview-focus="edit:current:stable">
          Update progress
        </button>
        <h2 tabIndex={-1} data-overview-focus-heading>
          Report
        </h2>
      </>,
    );
    const hook = renderHook(({ open }) => useOverviewFocusReturn(open), {
      initialProps: { open: false },
    });
    screen.getByRole("button", { name: "Move" }).focus();
    act(() => hook.result.current());
    hook.rerender({ open: true });
    // The disclosure closed when the editor opened: the exact origin key now
    // belongs to a hidden control, so the visible same-item button wins.
    hook.rerender({ open: false });
    expect(
      screen.getByRole("button", { name: "Update progress" }),
    ).toHaveFocus();
  });
  it("returns to the report heading after closing a composer retained across navigation", () => {
    render(
      <h2 tabIndex={-1} data-overview-focus-heading>
        Report
      </h2>,
    );
    const hook = renderHook(({ open }) => useOverviewFocusReturn(open), {
      initialProps: { open: true },
    });
    hook.rerender({ open: false });
    expect(screen.getByRole("heading")).toHaveFocus();
  });
  it.each([true, false])(
    "restores a surviving lineage target or heading (lineage: %s)",
    (survives) => {
      const page = render(
        <>
          <button data-overview-focus="resolve:next:stable">Resolve</button>
          <h2 tabIndex={-1} data-overview-focus-heading>
            Report
          </h2>
        </>,
      );
      const hook = renderHook(({ open }) => useOverviewFocusReturn(open), {
        initialProps: { open: false },
      });
      screen.getByRole("button", { name: "Resolve" }).focus();
      act(() => hook.result.current());
      hook.rerender({ open: true });
      page.rerender(
        <>
          {survives ? (
            <button data-overview-focus="edit:current:stable">Edit</button>
          ) : null}
          <h2 tabIndex={-1} data-overview-focus-heading>
            Report
          </h2>
        </>,
      );
      hook.rerender({ open: false });
      expect(screen.getByRole(survives ? "button" : "heading")).toHaveFocus();
    },
  );
});
