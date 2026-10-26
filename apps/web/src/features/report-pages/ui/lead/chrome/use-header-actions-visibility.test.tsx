import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHeaderActionsVisibility } from "./use-header-actions-visibility";

function Harness() {
  const { headerActionsVisible, sentinelRef } = useHeaderActionsVisibility();
  return (
    <>
      <div ref={sentinelRef}>Header actions</div>
      <span>{headerActionsVisible ? "header" : "sticky"}</span>
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubIntersectionObserver() {
  let notify: IntersectionObserverCallback = (_entries, _observer) => undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();
  class Observer {
    constructor(callback: IntersectionObserverCallback) {
      notify = callback;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = () => [];
    root = null;
    rootMargin = "0px";
    thresholds = [0];
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  return {
    notify: (entries: IntersectionObserverEntry[]) =>
      notify(entries, {} as IntersectionObserver),
    observe,
    disconnect,
  };
}

function entry(isIntersecting: boolean): IntersectionObserverEntry {
  return { isIntersecting } as IntersectionObserverEntry;
}

describe("useHeaderActionsVisibility", () => {
  it("hands off between header and sticky presentations on leave and enter", () => {
    const { notify, observe, disconnect } = stubIntersectionObserver();
    const { unmount } = render(<Harness />);

    expect(observe).toHaveBeenCalledOnce();
    act(() => notify([entry(false)]));
    expect(screen.getByText("sticky")).toBeInTheDocument();
    act(() => notify([entry(true)]));
    expect(screen.getByText("header")).toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("takes the last observation when one batch coalesces both edges", () => {
    const { notify } = stubIntersectionObserver();
    render(<Harness />);

    // A fast fling can coalesce enter+exit for the same sentinel into one
    // callback batch; only the last observation is the current truth.
    act(() => notify([entry(false), entry(true)]));
    expect(screen.getByText("header")).toBeInTheDocument();
    act(() => notify([entry(true), entry(false)]));
    expect(screen.getByText("sticky")).toBeInTheDocument();
  });

  it("keeps the canonical header presentation when observation is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Harness />);
    expect(screen.getByText("header")).toBeInTheDocument();
  });
});
