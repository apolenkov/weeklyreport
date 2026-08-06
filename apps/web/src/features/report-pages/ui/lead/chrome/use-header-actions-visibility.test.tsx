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

describe("useHeaderActionsVisibility", () => {
  it("hands off between header and sticky presentations on leave and enter", () => {
    let notify: IntersectionObserverCallback = (_entries, _observer) =>
      undefined;
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
    const { unmount } = render(<Harness />);

    expect(observe).toHaveBeenCalledOnce();
    act(() =>
      notify(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(screen.getByText("sticky")).toBeInTheDocument();
    act(() =>
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(screen.getByText("header")).toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("keeps the canonical header presentation when observation is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Harness />);
    expect(screen.getByText("header")).toBeInTheDocument();
  });
});
