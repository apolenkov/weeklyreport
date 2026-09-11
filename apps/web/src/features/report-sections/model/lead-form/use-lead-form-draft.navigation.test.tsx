// @vitest-environment jsdom

import type { ReportSectionReadModel } from "@customreport/shared";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { leadFormGenerationOf } from "./lead-form-generation";
import { LeadFormWriteError } from "./lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const ACTIVITY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const sectionA = makeReportSectionFixture({
  reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  reportSectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  version: 10,
  activities: [{ activityId: ACTIVITY, activityName: "Support", status: null }],
});
const sectionB = makeReportSectionFixture({
  ...sectionA,
  reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  reportSectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  version: 20,
});

function mountDraft() {
  const pending = Promise.withResolvers<ReportSectionReadModel>();
  const queued = Promise.withResolvers<ReportSectionReadModel>();
  let saveCount = 0;
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: () => (saveCount++ === 0 ? pending.promise : queued.promise),
    submit: () => pending.promise,
  });
  const refetchSection = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(
    (serverSection: ReportSectionReadModel) =>
      useLeadFormDraftCore({
        writePort,
        serverSection,
        generation: leadFormGenerationOf(serverSection),
        sectionIdForActions: serverSection.reportSectionId,
        serverReadOnly: false,
        refetchSection,
      }),
    { initialProps: sectionA },
  );
  return { ...hook, pending, queued, writePort, refetchSection };
}

type Harness = ReturnType<typeof mountDraft>;
type Completion = "success" | "error" | "conflict";

async function editAndSave(harness: Harness) {
  act(() => {
    harness.result.current.apply({
      kind: "activity-status",
      activityId: ACTIVITY,
      status: "green",
    });
  });
  await act(async () => {
    void harness.result.current.save();
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function finish(
  harness: Harness,
  completion: Completion,
  submit = false,
) {
  await act(async () => {
    if (completion === "success") {
      harness.pending.resolve({
        ...sectionA,
        version: 11,
        status: submit ? "submitted" : "draft",
        submittedAt: submit ? new Date("2026-09-05T00:00:00Z") : null,
      });
    } else {
      harness.pending.reject(
        new LeadFormWriteError(completion, "Old write failed"),
      );
    }
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("lead draft writes across navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(["success", "error", "conflict"] as const)(
    "preserves B's queued content and version after A's autosave %s",
    async (completion) => {
      const harness = mountDraft();
      await editAndSave(harness);
      harness.rerender(sectionB);
      await editAndSave(harness);
      expect(harness.writePort.calls.saveDraft).toHaveLength(1);
      expect(harness.refetchSection).not.toHaveBeenCalled();
      vi.mocked(toast.error).mockClear();

      await finish(harness, completion);

      expect(harness.writePort.calls.saveDraft).toHaveLength(2);
      expect(harness.writePort.calls.saveDraft[1]).toMatchObject({
        reportSectionId: sectionB.reportSectionId,
        version: 20,
        activityStatuses: [{ activityId: ACTIVITY, status: "green" }],
      });
      expect(harness.result.current.version).toBe(20);
      expect(harness.result.current.isSubmitted).toBe(false);
      expect(harness.result.current.draft?.reportSectionId).toBe(
        sectionB.reportSectionId,
      );
      expect(harness.result.current.autosave.lastSavedAt).toBeNull();
      expect(harness.refetchSection).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it("keeps a new A activation's queued version after navigating A to B to A", async () => {
    const harness = mountDraft();
    await editAndSave(harness);
    harness.rerender(sectionB);
    harness.rerender({ ...sectionA, version: 30 });
    await editAndSave(harness);

    await finish(harness, "success");

    expect(harness.writePort.calls.saveDraft[1]).toMatchObject({
      reportSectionId: sectionA.reportSectionId,
      version: 30,
    });
    expect(harness.result.current.version).toBe(30);
  });

  it.each(["success", "error", "conflict"] as const)(
    "leaves B editable without announcements after A's submit %s",
    async (completion) => {
      const harness = mountDraft();
      let submitted: Promise<unknown> | undefined;
      act(() => {
        submitted = harness.result.current.submit();
      });
      harness.rerender(sectionB);

      await finish(harness, completion, true);

      await expect(submitted).resolves.toBe("not-ready");
      expect(harness.result.current.version).toBe(20);
      expect(harness.result.current.isSubmitted).toBe(false);
      expect(harness.result.current.draft?.reportSectionId).toBe(
        sectionB.reportSectionId,
      );
      expect(harness.refetchSection).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it("ignores a submitted result from A's previous activation", async () => {
    const harness = mountDraft();
    let submitted: Promise<unknown> | undefined;
    act(() => {
      submitted = harness.result.current.submit();
    });
    harness.rerender(sectionB);
    harness.rerender({ ...sectionA, version: 30 });

    await finish(harness, "success", true);

    await expect(submitted).resolves.toBe("not-ready");
    expect(harness.result.current.version).toBe(30);
    expect(harness.result.current.isSubmitted).toBe(false);
  });

  it("does not invoke a submit callback retained from a previous activation", async () => {
    const harness = mountDraft();
    const oldSubmit = harness.result.current.submit;
    harness.rerender(sectionB);

    await act(async () => {
      await expect(oldSubmit()).resolves.toBe("not-ready");
    });

    expect(harness.writePort.calls.submit).toHaveLength(0);
    expect(harness.result.current.version).toBe(20);
  });

  it("drains A's existing queue with A's new version without changing B", async () => {
    const harness = mountDraft();
    await editAndSave(harness);
    act(() => {
      harness.result.current.apply({
        kind: "activity-status",
        activityId: ACTIVITY,
        status: "red",
      });
    });
    await act(async () => {
      void harness.result.current.save();
      await vi.advanceTimersByTimeAsync(0);
    });
    harness.rerender(sectionB);

    await finish(harness, "success");

    expect(harness.writePort.calls.saveDraft[1]).toMatchObject({
      reportSectionId: sectionA.reportSectionId,
      version: 11,
      activityStatuses: [{ activityId: ACTIVITY, status: "red" }],
    });
    await act(async () => {
      harness.queued.resolve({ ...sectionA, version: 12 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(harness.result.current.version).toBe(20);
    expect(harness.result.current.draft?.reportSectionId).toBe(
      sectionB.reportSectionId,
    );
    expect(harness.result.current.autosave.lastSavedAt).toBeNull();
    expect(harness.refetchSection).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)(
    "does not announce an old conflict reload after navigation when it %ss",
    async (settlement) => {
      const harness = mountDraft();
      const reload = Promise.withResolvers<unknown>();
      harness.refetchSection.mockReturnValue(reload.promise);
      act(() => harness.result.current.reloadAfterConflict());
      expect(harness.refetchSection).toHaveBeenCalledOnce();
      harness.rerender(sectionB);

      await act(async () => {
        if (settlement === "resolve") reload.resolve(undefined);
        else reload.reject(new Error("Old reload failed"));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(toast.error).not.toHaveBeenCalled();
    },
  );
});
