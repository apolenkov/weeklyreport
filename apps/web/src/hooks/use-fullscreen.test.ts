/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { useFullscreen } from "./use-fullscreen";

function setFullscreenElement(el: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: el,
  });
}

function countType(
  spy: { mock: { calls: unknown[][] } },
  type: "keydown" | "fullscreenchange",
): number {
  return spy.mock.calls.filter((call) => call[0] === type).length;
}

describe("useFullscreen — single-listener invariant", () => {
  let addSpy: MockInstance<typeof document.addEventListener>;
  let removeSpy: MockInstance<typeof document.removeEventListener>;

  beforeEach(() => {
    setFullscreenElement(null);
    addSpy = vi.spyOn(document, "addEventListener");
    removeSpy = vi.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setFullscreenElement(null);
  });

  it("registers exactly one keydown + one fullscreenchange listener and cleans them up", () => {
    const { unmount } = renderHook(() =>
      useFullscreen(createRef<HTMLElement>()),
    );

    expect(countType(addSpy, "keydown")).toBe(1);
    expect(countType(addSpy, "fullscreenchange")).toBe(1);

    unmount();
    expect(countType(removeSpy, "keydown")).toBe(1);
    expect(countType(removeSpy, "fullscreenchange")).toBe(1);
  });

  it("registers NO listeners when disabled (the hosted-path topology)", () => {
    renderHook(() => useFullscreen(createRef<HTMLElement>(), undefined, false));

    expect(countType(addSpy, "keydown")).toBe(0);
    expect(countType(addSpy, "fullscreenchange")).toBe(0);
  });

  it("two hooks, one disabled, leave exactly ONE keydown owner (lead-form + hosted deck)", () => {
    renderHook(() => {
      useFullscreen(createRef<HTMLElement>(), undefined, true); // lead-form owner
      useFullscreen(createRef<HTMLElement>(), undefined, false); // hosted deck
      return null;
    });

    expect(countType(addSpy, "keydown")).toBe(1);
    expect(countType(addSpy, "fullscreenchange")).toBe(1);
  });
});

describe("useFullscreen — behaviour", () => {
  afterEach(() => {
    setFullscreenElement(null);
  });

  function stubTarget() {
    const el = document.createElement("div");
    const requestFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(el, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    return { ref: { current: el }, requestFullscreen };
  }

  it("pressing `f` toggles fullscreen exactly once via the target element", () => {
    setFullscreenElement(null);
    const { ref, requestFullscreen } = stubTarget();
    renderHook(() => useFullscreen(ref));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("ignores `f` typed into a form field", () => {
    setFullscreenElement(null);
    const { ref, requestFullscreen } = stubTarget();
    renderHook(() => useFullscreen(ref));

    const input = document.createElement("input");
    document.body.append(input);
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", bubbles: true }),
      );
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    input.remove();
  });

  it("returns focus to the stable control ONLY on the transition out of fullscreen", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const focusSpy = vi.spyOn(button, "focus");
    renderHook(() =>
      useFullscreen(createRef<HTMLElement>(), { current: button }),
    );

    // Enter fullscreen — focus must NOT move yet.
    setFullscreenElement(document.createElement("div"));
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(focusSpy).not.toHaveBeenCalled();

    // Exit — focus returns to the stable control (not the unmounted pill).
    setFullscreenElement(null);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(focusSpy).toHaveBeenCalledTimes(1);

    button.remove();
  });
});
