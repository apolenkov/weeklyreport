import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { usePauseReason } from "./use-pause-reason";

const ITEM = { id: "item-1" };

describe("usePauseReason", () => {
  it("fires onPause exactly once per confirm, even under Strict Mode double-invocation", () => {
    const onPause = vi.fn();
    // StrictMode double-invokes render and state updaters — a persist side
    // effect left inside the setPending updater would double-fire here.
    const { result } = renderHook(() => usePauseReason(onPause), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.request(ITEM);
    });
    act(() => {
      result.current.confirm("waiting on a dependency");
    });

    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledWith("item-1", "waiting on a dependency");
    expect(result.current.pending).toBeNull();
  });

  it("cancel closes the prompt without pausing", () => {
    const onPause = vi.fn();
    const { result } = renderHook(() => usePauseReason(onPause), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.request(ITEM);
    });
    act(() => {
      result.current.cancel();
    });

    expect(onPause).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it("confirm with no pending item is a no-op", () => {
    const onPause = vi.fn();
    const { result } = renderHook(() => usePauseReason(onPause), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.confirm("orphan reason");
    });

    expect(onPause).not.toHaveBeenCalled();
  });
});
