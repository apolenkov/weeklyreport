// @vitest-environment jsdom
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

  it.each(["f", "F"])(
    "pressing unmodified `%s` toggles fullscreen exactly once via the target element",
    (key) => {
      setFullscreenElement(null);
      const { ref, requestFullscreen } = stubTarget();
      renderHook(() => useFullscreen(ref));

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key }));
      });

      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { name: "Ctrl+F", init: { ctrlKey: true } },
    { name: "Meta+F", init: { metaKey: true } },
    { name: "Alt+F", init: { altKey: true } },
    { name: "Shift+F", init: { shiftKey: true } },
    { name: "composing F", init: { isComposing: true } },
    { name: "repeated F", init: { repeat: true } },
  ])("ignores $name without preventing its default behavior", ({ init }) => {
    setFullscreenElement(null);
    const { ref, requestFullscreen } = stubTarget();
    renderHook(() => useFullscreen(ref));

    const event = new KeyboardEvent("keydown", {
      key: "f",
      cancelable: true,
      ...init,
    });
    act(() => {
      document.dispatchEvent(event);
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores an already-prevented F event", () => {
    setFullscreenElement(null);
    const { ref, requestFullscreen } = stubTarget();
    renderHook(() => useFullscreen(ref));

    const event = new KeyboardEvent("keydown", {
      key: "f",
      cancelable: true,
    });
    event.preventDefault();
    act(() => {
      document.dispatchEvent(event);
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
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

  it("ignores `f` typed into a content-editable field", () => {
    setFullscreenElement(null);
    const { ref, requestFullscreen } = stubTarget();
    renderHook(() => useFullscreen(ref));

    const editor = document.createElement("div");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.append(editor);
    act(() => {
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", bubbles: true }),
      );
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    editor.remove();
  });

  it("toggle exits when the document is already fullscreen", () => {
    const fullscreenElement = document.createElement("div");
    setFullscreenElement(fullscreenElement);
    const exitFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    const { ref, requestFullscreen } = stubTarget();
    const { result } = renderHook(() => useFullscreen(ref));

    act(() => {
      result.current.toggle();
    });

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  describe("useFullscreen — rejection observability", () => {
    afterEach(() => {
      setFullscreenElement(null);
    });

    function rejectingTarget() {
      const el = document.createElement("div");
      const requestFullscreen = vi.fn(() =>
        Promise.reject(new Error("denied")),
      );
      Object.defineProperty(el, "requestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
      return { ref: { current: el }, requestFullscreen };
    }

    it("reports a rejected requestFullscreen through the typed failure callback", async () => {
      setFullscreenElement(null);
      const onError = vi.fn();
      const { ref, requestFullscreen } = rejectingTarget();
      renderHook(() => useFullscreen(ref, undefined, true, onError));

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
      });
      expect(requestFullscreen).toHaveBeenCalledTimes(1);

      // Flush the microtask so the .catch runs.
      await act(async () => {
        await Promise.resolve();
      });
      expect(onError).toHaveBeenCalledWith("request", new Error("denied"));
    });

    it("reports a rejected exitFullscreen through the typed failure callback", async () => {
      setFullscreenElement(document.createElement("div"));
      const onError = vi.fn();
      const exitFullscreen = vi.fn(() =>
        Promise.reject(new Error("exit-failed")),
      );
      Object.defineProperty(document, "exitFullscreen", {
        configurable: true,
        value: exitFullscreen,
      });
      const { ref } = rejectingTarget();
      const { result } = renderHook(() =>
        useFullscreen(ref, undefined, true, onError),
      );

      act(() => {
        result.current.toggle();
      });
      expect(exitFullscreen).toHaveBeenCalledTimes(1);

      await act(async () => {
        await Promise.resolve();
      });
      expect(onError).toHaveBeenCalledWith("exit", new Error("exit-failed"));
    });

    it("still swallows the rejection (no unhandled promise rejection) when no callback is given", async () => {
      setFullscreenElement(null);
      const { ref, requestFullscreen } = rejectingTarget();
      renderHook(() => useFullscreen(ref));

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
      });
      expect(requestFullscreen).toHaveBeenCalledTimes(1);

      await act(async () => {
        await Promise.resolve();
      });
    });
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

describe("useFullscreen — reset when the deck surface leaves slides mode", () => {
  afterEach(() => {
    setFullscreenElement(null);
  });

  function exitControl() {
    const button = document.createElement("button");
    document.body.append(button);
    return { button, focusSpy: vi.spyOn(button, "focus") };
  }

  it("resets the stale fullscreen state when enabled turns false during fullscreen", () => {
    const { button } = exitControl();
    const { rerender, result } = renderHook(
      ({ enabled }: { readonly enabled: boolean }) =>
        useFullscreen(createRef<HTMLElement>(), { current: button }, enabled),
      { initialProps: { enabled: true } },
    );

    setFullscreenElement(document.createElement("div"));
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.isFullscreen).toBe(true);

    // Browser Back: the deck unmounts while in fullscreen, the element leaves
    // the DOM, and the browser exits fullscreen without an observed change.
    setFullscreenElement(null);
    rerender({ enabled: false });
    expect(result.current.isFullscreen).toBe(false);

    button.remove();
  });

  it("reports not-fullscreen after re-enabling and moves no stale exit focus", () => {
    const { button, focusSpy } = exitControl();
    const { rerender, result } = renderHook(
      ({ enabled }: { readonly enabled: boolean }) =>
        useFullscreen(createRef<HTMLElement>(), { current: button }, enabled),
      { initialProps: { enabled: true } },
    );

    setFullscreenElement(document.createElement("div"));
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.isFullscreen).toBe(true);

    setFullscreenElement(null);
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current.isFullscreen).toBe(false);

    // A later not-fullscreen change must not fire the stale exit-focus.
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(focusSpy).not.toHaveBeenCalled();

    button.remove();
  });

  it("keeps the fullscreen state when the error callback identity changes", () => {
    const ref = createRef<HTMLElement>();
    const onErrorA = vi.fn();
    const onErrorB = vi.fn();
    const { rerender, result } = renderHook(
      ({
        onError,
      }: {
        readonly onError: (kind: "request" | "exit", error: unknown) => void;
      }) => useFullscreen(ref, undefined, true, onError),
      { initialProps: { onError: onErrorA } },
    );

    setFullscreenElement(document.createElement("div"));
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.isFullscreen).toBe(true);

    rerender({ onError: onErrorB });
    expect(result.current.isFullscreen).toBe(true);
  });
});
