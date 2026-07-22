import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLeadFormAddSignals } from "./use-lead-form-add-signals";

describe("useLeadFormAddSignals", () => {
  it("bumps each counter independently on its add trigger", () => {
    const { result } = renderHook(() => useLeadFormAddSignals());

    expect(result.current.currentWeekAddSignal).toBe(0);
    expect(result.current.risksAddSignal).toBe(0);

    act(() => {
      result.current.addCurrentWeekItem();
      result.current.addNextWeekItem();
      result.current.addRisk();
      result.current.addRisk();
      result.current.addDecision();
      result.current.addDecision();
      result.current.addDecision();
    });

    expect(result.current.currentWeekAddSignal).toBe(1);
    expect(result.current.nextWeekAddSignal).toBe(1);
    expect(result.current.risksAddSignal).toBe(2);
    expect(result.current.decisionsAddSignal).toBe(3);
  });
});
