// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScrollFade } from "./use-scroll-fade";

describe("useScrollFade", () => {
  it("returns true on mount when the container initially has content below the fold", () => {
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    const { result, unmount } = renderHook(() =>
      useScrollFade({ current: container }),
    );

    expect(result.current).toBe(true);
    unmount();
  });

  it("recomputes when the container scrolls", () => {
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    const { result, unmount } = renderHook(() =>
      useScrollFade({ current: container }),
    );
    expect(result.current).toBe(true);

    act(() => {
      container.scrollTop = 100;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current).toBe(false);
    unmount();
  });

  it("recomputes when child content grows without a container resize", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let scrollHeight = 100;
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    const ref = { current: container };
    const { result, unmount } = renderHook(() => useScrollFade(ref));

    expect(result.current).toBe(false);

    await act(async () => {
      scrollHeight = 200;
      container.append(document.createElement("div"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(true);
    unmount();
    container.remove();
  });
});
