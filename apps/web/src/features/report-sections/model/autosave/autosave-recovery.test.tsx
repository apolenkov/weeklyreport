import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { LeadFormWriteError } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { useLeadFormAutosave } from "./use-lead-form-autosave";
import {
  AUTOSAVE_SECTION_ID,
  buildAutosaveHarness,
  makeAutosavePayload,
  makeAutosaveResponse,
} from "./use-lead-form-autosave-harness";

function setup() {
  const transports: ReturnType<
    typeof Promise.withResolvers<ReportSectionReadModel>
  >[] = [];
  const harness = buildAutosaveHarness({
    mutationFn: () => {
      const transport = Promise.withResolvers<ReportSectionReadModel>();
      transports.push(transport);
      return transport.promise;
    },
  });
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ payload, version, sectionId }) =>
      useLeadFormAutosave({
        writePort: harness.writePort,
        reportSectionId: sectionId,
        payload,
        enabled: true,
        version,
        onVersionChange: vi.fn(),
        onSaved,
        debounceMs: 60_000,
      }),
    {
      wrapper: harness.wrapper,
      initialProps: {
        payload: sectionToDraftPayload(
          makeAutosaveResponse(makeAutosavePayload()),
        ),
        version: 1,
        sectionId: AUTOSAVE_SECTION_ID,
      },
    },
  );
  const finish = async (index: number, error?: Error) => {
    const transport = transports[index];
    const request = harness.calls[index];
    if (!transport || !request) throw new Error("Missing dispatch");
    await act(async () => {
      if (error) transport.reject(error);
      else transport.resolve(makeAutosaveResponse(request));
      await Promise.resolve();
    });
  };
  return { ...hook, ...harness, transports, onSaved, finish };
}

describe("immutable persisted recovery", () => {
  it.each([0, 1])(
    "keeps the barrier after ambiguous competitor %i until a direct winner arrives",
    async (failed) => {
      const h = setup();
      let outcome: unknown;
      await act(async () => {
        await Promise.resolve();
        void h.result.current.savePersisted("attempt").then((value) => {
          outcome = value;
        });
        h.result.current.retrySameAttempt("attempt");
      });
      await h.finish(failed, new Error("response lost, commit unknown"));
      expect(h.result.current.recovery).toMatchObject({
        phase: "ambiguous",
        pendingTransports: 1,
      });
      expect(outcome).toBeUndefined();
      await act(async () => {
        h.result.current.adoptBaseline("unproven", "read");
        await h.result.current.forceSave();
      });
      expect(h.result.current.isRecoveryBlocked()).toBe(true);
      expect(h.calls).toHaveLength(2);
      await h.finish(1 - failed);
      expect(outcome).toMatchObject({ status: "accepted", token: "attempt" });
      expect(h.result.current.isRecoveryBlocked()).toBe(false);
      expect(h.onSaved).toHaveBeenCalledTimes(1);
    },
  );

  it("does not turn a same-version read after lost transport into settlement", async () => {
    const h = setup();
    await act(async () => {
      await Promise.resolve();
      void h.result.current.savePersisted("attempt");
    });
    await h.finish(0, new Error("connection closed before response"));
    h.rerender({
      payload: makeAutosavePayload("new input while outcome is unknown"),
      version: 1,
      sectionId: AUTOSAVE_SECTION_ID,
    });
    await act(async () => {
      h.result.current.adoptBaseline("same-version-read", "read");
      h.result.current.abandonPersisted("attempt");
      await h.result.current.forceSave();
    });
    expect(h.result.current.recovery?.pendingTransports).toBe(0);
    expect(h.result.current.isRecoveryBlocked()).toBe(true);
    expect(h.result.current.state).toBe("error");
    expect(h.result.current.dirty).toBe(true);
    expect(h.calls).toHaveLength(1);
    expect(h.onSaved).not.toHaveBeenCalled();
  });

  it("keeps an eventual old success separate from a higher server revision", async () => {
    const h = setup();
    let outcome: unknown;
    await act(async () => {
      await Promise.resolve();
      void h.result.current.savePersisted("attempt").then((value) => {
        outcome = value;
      });
    });
    h.rerender({
      payload: makeAutosavePayload("newer local text"),
      version: 3,
      sectionId: AUTOSAVE_SECTION_ID,
    });
    await h.finish(0);
    expect(outcome).toBeUndefined();
    expect(h.result.current.recovery).toMatchObject({
      phase: "reconciliation",
      pendingTransports: 0,
    });
    expect(h.result.current.state).toBe("error");
    expect(h.result.current.lastSavedAt).toBeNull();
    expect(h.onSaved).not.toHaveBeenCalled();
    await act(async () => {
      await h.result.current.forceSave();
    });
    expect(h.calls).toHaveLength(1);
  });

  it("does not let a retry restriction settle an outstanding original", async () => {
    const h = setup();
    await act(async () => {
      await Promise.resolve();
      void h.result.current.savePersisted("attempt");
      h.result.current.retrySameAttempt("attempt");
    });
    await h.finish(1, new LeadFormWriteError("restriction", "editing revoked"));
    expect(h.result.current.recovery).toMatchObject({
      phase: "reconciliation",
      pendingTransports: 1,
    });
    await act(async () => {
      expect(h.result.current.retrySameAttempt("attempt")).toBe(false);
      await h.result.current.forceSave();
    });
    expect(h.calls).toHaveLength(2);
    expect(h.onSaved).not.toHaveBeenCalled();
    await h.finish(0, new Error("original response also lost"));
    expect(h.result.current.recovery?.pendingTransports).toBe(0);
    expect(h.result.current.isRecoveryBlocked()).toBe(true);
    expect(h.result.current.lastSavedAt).toBeNull();
  });

  it("does not adopt an old response after A to B to A activation", async () => {
    const h = setup();
    let outcome: unknown;
    await act(async () => {
      await Promise.resolve();
      void h.result.current.savePersisted("attempt").then((value) => {
        outcome = value;
      });
    });
    h.rerender({
      payload: makeAutosavePayload("B"),
      version: 1,
      sectionId: "section-B",
    });
    h.rerender({
      payload: makeAutosavePayload("new A input"),
      version: 1,
      sectionId: AUTOSAVE_SECTION_ID,
    });
    await h.finish(0);
    expect(outcome).toMatchObject({ status: "obsolete", token: "attempt" });
    expect(h.onSaved).not.toHaveBeenCalled();
    expect(h.result.current.lastSavedAt).toBeNull();
    expect(h.result.current.dirty).toBe(true);
    expect(h.calls).toHaveLength(1);
  });

  it.each([0, 1])(
    "ignores loser errors after competitor %i succeeds",
    async (winner) => {
      const h = setup();
      await act(async () => {
        void h.result.current.savePersisted("attempt");
        h.result.current.retrySameAttempt("attempt");
        await Promise.resolve();
      });
      h.rerender({
        payload: makeAutosavePayload("newer local edit"),
        version: 1,
        sectionId: AUTOSAVE_SECTION_ID,
      });
      await h.finish(winner);
      expect(h.result.current.dirty).toBe(true);
      expect(h.onSaved).toHaveBeenCalledTimes(1);
      await h.finish(1 - winner, new LeadFormWriteError("conflict", "loser"));
      expect(h.onSaved).toHaveBeenCalledTimes(1);
      expect(h.calls).toHaveLength(2);
      expect(h.result.current.recovery).toBeNull();
    },
  );

  it("does not report success for a mismatching whole-section response", async () => {
    const h = setup();
    h.rerender({
      payload: makeAutosavePayload("not returned by fixture"),
      version: 1,
      sectionId: AUTOSAVE_SECTION_ID,
    });
    await act(async () => {
      void h.result.current.savePersisted("attempt");
      await Promise.resolve();
    });
    await h.finish(0);
    expect(h.result.current.recovery?.phase).toBe("reconciliation");
    expect(h.onSaved).not.toHaveBeenCalled();
    expect(h.result.current.lastSavedAt).toBeNull();
  });

  it("captures queued dispatch after rebase and ignores later nested mutations", async () => {
    const h = setup();
    await act(async () => {
      void h.result.current.forceSave();
      await Promise.resolve();
    });
    const payload = makeAutosavePayload("queued");
    h.rerender({ payload, version: 1, sectionId: AUTOSAVE_SECTION_ID });
    await act(async () => {
      void h.result.current.savePersisted("queued-attempt");
      await Promise.resolve();
    });
    await h.finish(0);
    expect(h.calls[1]?.version).toBe(2);
    const captured = structuredClone(h.calls[1]);
    Object.assign(payload, { items: [] });
    await h.finish(1, new Error("lost ACK"));
    await act(async () => {
      h.result.current.retrySameAttempt("queued-attempt");
      await Promise.resolve();
    });
    expect(h.calls[2]).toEqual(captured);
  });

  it.each([0, 1])(
    "does not let competitor %i failure suppress the other success",
    async (failed) => {
      const h = setup();
      let result: unknown;
      await act(async () => {
        await Promise.resolve();
        void h.result.current.savePersisted("attempt").then((value) => {
          result = value;
        });
      });
      await act(async () => {
        await Promise.resolve();
        h.result.current.retrySameAttempt("attempt");
      });
      expect(h.calls).toHaveLength(2);
      expect(h.calls[1]).toEqual(h.calls[0]);
      await h.finish(failed, new LeadFormWriteError("conflict", "CAS lost"));
      expect(result).toBeUndefined();
      expect(h.result.current.recovery?.phase).toBe("reconciliation");
      expect(h.onSaved).not.toHaveBeenCalled();
      await h.finish(1 - failed);
      expect(result).toMatchObject({ status: "accepted", token: "attempt" });
      expect(h.onSaved).toHaveBeenCalledTimes(1);
    },
  );

  it("retains exact dispatch despite later edits/version and repeated lost responses", async () => {
    const h = setup();
    await act(async () => {
      await Promise.resolve();
      void h.result.current.savePersisted("attempt");
    });
    const original = structuredClone(h.calls[0]);
    h.rerender({
      payload: makeAutosavePayload("newer"),
      version: 9,
      sectionId: AUTOSAVE_SECTION_ID,
    });
    await h.finish(0, new Error("lost ACK"));
    await act(async () => {
      await Promise.resolve();
      h.result.current.retrySameAttempt("attempt");
    });
    expect(h.calls[1]).toEqual(original);
    await h.finish(1, new Error("lost again"));
    expect(h.result.current.recovery?.phase).toBe("ambiguous");
    await act(async () => {
      h.result.current.abandonPersisted("attempt");
      h.result.current.adoptBaseline("unproven-read", "read");
      await h.result.current.forceSave();
    });
    expect(h.calls).toHaveLength(2);
    expect(h.result.current.isRecoveryBlocked()).toBe(true);
    expect(h.result.current.dirty).toBe(true);
    expect(h.onSaved).not.toHaveBeenCalled();
  });

  it.each(["conflict", "restriction", "error"] as const)(
    "does not retry a known %s",
    async (kind) => {
      const h = setup();
      await act(async () => {
        await Promise.resolve();
        void h.result.current.savePersisted("attempt");
      });
      await h.finish(
        0,
        new LeadFormWriteError(kind, "other writer won or restriction"),
      );
      await act(async () => {
        await Promise.resolve();
        h.result.current.retrySameAttempt("attempt");
      });
      expect(h.calls).toHaveLength(1);
      expect(h.result.current.recovery?.phase).toBe("reconciliation");
      expect(h.onSaved).not.toHaveBeenCalled();
    },
  );

  it("fences an old activation and refuses retry after navigation", async () => {
    const h = setup();
    await act(async () => {
      await Promise.resolve();
      void h.result.current.savePersisted("attempt");
    });
    h.rerender({
      payload: makeAutosavePayload("other"),
      version: 1,
      sectionId: "other-section",
    });
    await act(async () => {
      await Promise.resolve();
      h.result.current.retrySameAttempt("attempt");
    });
    await h.finish(0);
    expect(h.calls).toHaveLength(1);
    expect(h.onSaved).not.toHaveBeenCalled();
  });
});
