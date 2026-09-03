import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InMemoryLeadFormWriteAdapter } from "../../report-sections/model/lead-form/lead-form-write-port.in-memory";
import { useLeadFormFillFrom } from "./use-lead-form-fill-from";

describe("useLeadFormFillFrom", () => {
  it("keeps an unsaved overwrite pending until the shared dialog confirms it", async () => {
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected save")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
    });
    const { result } = renderHook(() =>
      useLeadFormFillFrom({
        generation: "report-a:section-a",
        sectionIdForActions: "target",
        autosaveDirty: true,
        version: 4,
        onConflict: () => undefined,
        writePort,
      }),
    );

    act(() => result.current.handleFillFrom("source"));
    expect(result.current.pendingFillFrom).toBe(true);
    expect(writePort.calls.fillFrom).toEqual([]);

    act(() => result.current.confirmPendingFillFrom());
    expect(result.current.pendingFillFrom).toBe(false);
    await waitFor(() =>
      expect(writePort.calls.fillFrom).toEqual([
        {
          targetSectionId: "target",
          sourceSectionId: "source",
          version: 4,
        },
      ]),
    );
  });
});
