import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import { useLeadFormAutosave } from "./use-lead-form-autosave";
import {
  AUTOSAVE_SECTION_ID as SECTION_ID,
  buildAutosaveHarness as buildHarness,
  makeAutosavePayload as makePayload,
  makeAutosaveResponse as makeResponse,
} from "./use-lead-form-autosave-harness";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

it("captures dispatched payload before later in-place draft edits", async () => {
  let resolveSave!: () => void;
  const onSaved: NonNullable<
    Parameters<typeof useLeadFormAutosave>[0]["onSaved"]
  > = vi.fn((_saved, payload) => ({
    savedKey: encodeAutosaveComparisonKey(payload),
    queuedPayload: null,
  }));
  const { wrapper, writePort } = buildHarness({
    mutationFn: (request) =>
      new Promise((resolve) => {
        resolveSave = () => resolve(makeResponse(request));
      }),
  });
  const payload = makePayload("original");
  const { result } = renderHook(
    () =>
      useLeadFormAutosave({
        writePort,
        reportSectionId: SECTION_ID,
        payload,
        enabled: true,
        version: 1,
        onVersionChange: vi.fn(),
        onSaved,
        debounceMs: 5000,
      }),
    { wrapper },
  );
  await act(async () => {
    void result.current.forceSave();
    await vi.advanceTimersByTimeAsync(0);
  });
  const item = payload.items[0];
  if (!item) throw new Error("Missing item");
  Object.assign(item, { text: "later edit" });
  await act(async () => {
    resolveSave();
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(vi.mocked(onSaved).mock.calls[0]?.[1].items[0]?.text).toBe("original");
});
