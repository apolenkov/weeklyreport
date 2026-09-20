import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadFormWriteError } from "../../report-sections/model/lead-form/lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "../../report-sections/model/lead-form/lead-form-write-port.in-memory";
import { useLeadFormFillFrom } from "./use-lead-form-fill-from";

describe("useLeadFormFillFrom", () => {
  it("confirms with the latest version after autosave advances it", async () => {
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected save")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
    });
    const { result, rerender } = renderHook(
      ({ version }) =>
        useLeadFormFillFrom({
          generation: "report-a:section-a",
          sectionIdForActions: "target",
          autosaveDirty: true,
          version,
          onConflict: () => undefined,
          onFilled: () => undefined,
          writePort,
        }),
      { initialProps: { version: 4 } },
    );

    await act(async () => {
      await result.current.handleFillFrom("source");
    });
    rerender({ version: 5 });
    expect(writePort.calls.fillFrom).toEqual([]);

    act(() => result.current.confirmPendingFillFrom());
    await waitFor(() =>
      expect(writePort.calls.fillFrom).toEqual([
        { targetSectionId: "target", sourceSectionId: "source", version: 5 },
      ]),
    );
  });

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
        onFilled: () => undefined,
        writePort,
      }),
    );

    await act(async () => {
      await result.current.handleFillFrom("source");
    });
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

  it("adopts the returned section so the follow-up refetch is not an external conflict", async () => {
    const adopted: unknown[] = [];
    const section = { reportSectionId: "target" } as never;
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected save")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
      fillFrom: () =>
        Promise.resolve({ success: true, copiedItems: 2, section }),
    });
    const { result } = renderHook(() =>
      useLeadFormFillFrom({
        generation: "report-a:section-a",
        sectionIdForActions: "target",
        autosaveDirty: false,
        version: 4,
        onConflict: () => undefined,
        onFilled: (next) => adopted.push(next),
        writePort,
      }),
    );

    await act(async () => {
      await result.current.handleFillFrom("source");
    });
    await waitFor(() => expect(adopted).toEqual([section]));
  });

  it("returns the failed write so the source confirmation can stay open", async () => {
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected save")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
      fillFrom: () => Promise.reject(new Error("Fill from failed. Try again.")),
    });
    const { result } = renderHook(() =>
      useLeadFormFillFrom({
        generation: "report-a:section-a",
        sectionIdForActions: "target",
        autosaveDirty: false,
        version: 4,
        onConflict: () => undefined,
        onFilled: () => undefined,
        writePort,
      }),
    );

    await act(async () => {
      await expect(result.current.handleFillFrom("source")).rejects.toThrow(
        "Fill from failed. Try again.",
      );
    });
  });

  it("routes a write conflict to the conflict callback", async () => {
    const onConflict = vi.fn();
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected save")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
      fillFrom: () =>
        Promise.reject(new LeadFormWriteError("conflict", "Section changed")),
    });
    const { result } = renderHook(() =>
      useLeadFormFillFrom({
        generation: "report-a:section-a",
        sectionIdForActions: "target",
        autosaveDirty: false,
        version: 4,
        onConflict,
        onFilled: () => undefined,
        writePort,
      }),
    );

    await act(async () => {
      await result.current.handleFillFrom("source");
    });

    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(writePort.calls.fillFrom).toEqual([
      { targetSectionId: "target", sourceSectionId: "source", version: 4 },
    ]);
  });

  it("cancels a pending overwrite without writing", async () => {
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
        onFilled: () => undefined,
        writePort,
      }),
    );

    await act(async () => {
      await result.current.handleFillFrom("source");
    });
    expect(result.current.pendingFillFrom).toBe(true);

    act(() => result.current.cancelPendingFillFrom());

    expect(result.current.pendingFillFrom).toBe(false);
    expect(writePort.calls.fillFrom).toEqual([]);
  });

  it("does not write when the action section is unavailable", async () => {
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected save")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
    });
    const { result } = renderHook(() =>
      useLeadFormFillFrom({
        generation: "report-a:section-a",
        sectionIdForActions: null,
        autosaveDirty: false,
        version: 4,
        onConflict: () => undefined,
        onFilled: () => undefined,
        writePort,
      }),
    );

    await act(async () => {
      await result.current.handleFillFrom("source");
    });

    expect(result.current.pendingFillFrom).toBe(false);
    expect(writePort.calls.fillFrom).toEqual([]);
  });
});
