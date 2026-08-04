import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useGenerationState } from "./use-generation-state";

describe("useGenerationState", () => {
  it("hides prior state immediately and isolates stale setters", () => {
    const rendered = renderHook(
      ({ generation }) => useGenerationState(generation, false),
      { initialProps: { generation: "report-a:section-a" } },
    );
    act(() => rendered.result.current[1](true));
    const setReportA = rendered.result.current[1];

    rendered.rerender({ generation: "report-b:section-b" });
    expect(rendered.result.current[0]).toBe(false);
    act(() => rendered.result.current[1](true));
    act(() => setReportA(false));
    expect(rendered.result.current[0]).toBe(true);

    rendered.rerender({ generation: "report-a:section-a" });
    expect(rendered.result.current[0]).toBe(false);
  });
});
