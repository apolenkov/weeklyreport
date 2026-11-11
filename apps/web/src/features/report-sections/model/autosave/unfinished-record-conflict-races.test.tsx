import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { LeadFormWriteError } from "../lead-form/lead-form-write-port";
import { useDraftVersion } from "../lead-form/use-lead-form-draft-parts";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { buildAutosaveHarness } from "./use-lead-form-autosave-harness";
import { useDraftServerSync } from "./use-lead-form-server-sync";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const risk: ReportSectionReadModel["risks"][number] = {
  id: "10000000-0000-4000-8000-000000000010",
  stableId: "10000000-0000-4000-8000-000000000010",
  projectId: "10000000-0000-4000-8000-000000000004",
  activityId: null,
  stageNames: ["Development"],
  severity: "at-risk",
  risk: "Initial risk",
  impact: "",
  mitigation: "",
};
const decision: ReportSectionReadModel["decisions"][number] = {
  id: "10000000-0000-4000-8000-000000000011",
  stableId: "10000000-0000-4000-8000-000000000011",
  productId: risk.projectId,
  activityId: null,
  stageNames: ["Development"],
  text: "Initial decision",
  impact: "",
  owner: "Test Lead",
  deadline: null,
};
const records = { risks: [risk], decisions: [decision] };
function setup(initial = makeReportSectionFixture()) {
  const requests: {
    resolve: (section: ReportSectionReadModel) => void;
    reject: (error: Error) => void;
  }[] = [];
  const h = buildAutosaveHarness({
    mutationFn: () =>
      new Promise((resolve, reject) => requests.push({ resolve, reject })),
  });
  const hook = renderHook(
    () => {
      const [server, setServer] = useState(initial);
      const [draft, setDraft] = useState<ReportSectionReadModel | null>(null);
      const version = useDraftVersion(server.reportSectionId);
      const sync = useDraftServerSync({
        generation: null,
        receiptScope: "unfinished-races",
        writePort: h.writePort,
        serverSection: server,
        reportSectionId: server.reportSectionId,
        payload: draft && sectionToDraftPayload(draft),
        enabled: draft !== null,
        localOnlyRows: 0,
        version: version.version,
        setVersionSafe: version.setVersionSafe,
        acceptVersion: version.acceptVersion,
        setIsSubmitted: () => undefined,
        setDraftSection: setDraft,
        handleConflict: () => undefined,
      });
      return {
        draft,
        setDraft,
        server,
        setServer,
        sync,
        version: version.version,
      };
    },
    { wrapper: h.wrapper },
  );
  return { ...hook, requests, calls: h.calls };
}
type Harness = ReturnType<typeof setup>;
function patch(
  h: Harness,
  change: (draft: ReportSectionReadModel) => ReportSectionReadModel,
) {
  act(() => h.result.current.setDraft((draft) => change(expectDefined(draft))));
}
async function update(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}
async function save(h: Harness) {
  await update(() => {
    void h.result.current.sync.autosave.forceSave();
  });
  return expectDefined(h.requests.at(-1));
}

describe("unfinished records across unobserved save and refetch races", () => {
  afterEach(() => vi.useRealTimers());

  it("ignores a matching stale read while newer-version input is held", async () => {
    const initial = makeReportSectionFixture(records);
    const h = setup(initial);
    const local = { ...risk, risk: "Local retained" };
    patch(h, (draft) => ({ ...draft, risks: [local] }));
    const request = await save(h);
    await update(() =>
      request.reject(new LeadFormWriteError("ambiguous", "Lost")),
    );
    act(() =>
      h.result.current.setServer({
        ...initial,
        version: 3,
        risks: [{ ...risk, risk: "Remote v3" }],
      }),
    );
    expect(h.result.current.sync.autosave.state).toBe("error");
    act(() =>
      h.result.current.setServer({ ...initial, version: 2, risks: [local] }),
    );
    expect(h.result.current.version).toBe(3);
    expect(h.result.current.sync.autosave.state).toBe("error");
    act(() =>
      h.result.current.setServer({
        ...initial,
        version: 4,
        risks: [{ ...risk, risk: "Remote v4" }],
      }),
    );
    expect(h.result.current.draft?.risks[0]?.risk).toBe(local.risk);
    expect(h.result.current.sync.autosave.state).toBe("error");
    expect(h.calls).toHaveLength(1);
  });

  it.each([true, false])(
    "reconciles retention across consecutive reads (later local input: %s)",
    async (laterInput) => {
      const initial = makeReportSectionFixture(records);
      const h = setup(initial);
      patch(h, (draft) => ({
        ...draft,
        risks: [{ ...risk, risk: "Unconfirmed write" }],
      }));
      const request = await save(h);
      await update(() =>
        request.reject(new LeadFormWriteError("ambiguous", "Response lost")),
      );
      patch(h, (draft) => ({
        ...draft,
        risks: [{ ...risk, risk: laterInput ? "Earlier input" : risk.risk }],
      }));
      act(() => h.result.current.setServer({ ...initial, version: 2 }));
      if (laterInput) {
        patch(h, (draft) => ({
          ...draft,
          risks: [{ ...risk, risk: "Latest input" }],
        }));
      }
      act(() =>
        h.result.current.setServer({
          ...initial,
          version: 3,
          risks: [{ ...risk, risk: "Remote update" }],
        }),
      );
      expect(h.result.current.draft?.risks[0]?.risk).toBe(
        laterInput ? "Latest input" : "Remote update",
      );
      expect(h.result.current.sync.autosave.dirty).toBe(laterInput);
      expect(h.calls).toHaveLength(1);
    },
  );

  it.each([true, false])(
    "retains typing batched with a newer read (changed server payload: %s)",
    async (changedPayload) => {
      const h = setup();
      patch(h, (draft) => ({ ...draft, ...records }));
      const request = await save(h);
      await update(() =>
        request.reject(new LeadFormWriteError("conflict", "Stale")),
      );
      const remote = {
        ...decision,
        id: "10000000-0000-4000-8000-000000000042",
        stableId: "10000000-0000-4000-8000-000000000042",
        text: "Unrelated server decision",
      };
      act(() => {
        h.result.current.setDraft((draft) => ({
          ...expectDefined(draft),
          risks: [{ ...risk, risk: "Batched input" }],
          decisions: [{ ...decision, text: "Batched decision" }],
        }));
        h.result.current.setServer(
          makeReportSectionFixture({
            version: 2,
            decisions: changedPayload ? [remote] : [],
          }),
        );
      });
      expect(h.result.current.draft?.risks[0]?.risk).toBe("Batched input");
      expect(h.result.current.sync.autosave.state).toBe("error");
      act(() =>
        h.result.current.setServer(
          makeReportSectionFixture({ version: 3, decisions: [remote] }),
        ),
      );
      expect(h.result.current.draft?.risks[0]?.risk).toBe("Batched input");
      expect(h.result.current.draft?.decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ...decision, text: "Batched decision" }),
          remote,
        ]),
      );
      expect(h.calls).toHaveLength(1);
    },
  );

  it("keeps an edit debounce when a same-payload newer read settles uncertainty", async () => {
    vi.useFakeTimers();
    const initial = makeReportSectionFixture(records);
    const h = setup(initial);
    patch(h, (draft) => ({
      ...draft,
      risks: [{ ...risk, risk: "First edit" }],
    }));
    const request = await save(h);
    await update(() =>
      request.reject(new LeadFormWriteError("ambiguous", "Response lost")),
    );
    patch(h, (draft) => ({
      ...draft,
      risks: [{ ...risk, risk: "Later edit" }],
    }));
    act(() => h.result.current.setServer({ ...initial, version: 2 }));
    expect(h.result.current.sync.autosave.lastFailureKind).toBeUndefined();
    expect(h.result.current.sync.autosave.state).toBe("pending");
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]).toMatchObject({
      version: 2,
      risks: [expect.objectContaining({ risk: "Later edit" })],
    });
    await update(() =>
      expectDefined(h.requests[1]).resolve({
        ...initial,
        version: 3,
        risks: [{ ...risk, risk: "Later edit" }],
      }),
    );
    expect(h.result.current.sync.autosave.dirty).toBe(false);
  });

  it.each([false, true])(
    "settles an older failure after a confirmed baseline (new edit: %s)",
    async (newEdit) => {
      vi.useFakeTimers();
      const initial = makeReportSectionFixture(records);
      const h = setup(initial);
      patch(h, (draft) => ({
        ...draft,
        risks: [{ ...risk, risk: "In flight edit" }],
      }));
      const request = await save(h);
      patch(h, (draft) => ({ ...draft, ...records }));
      act(() => h.result.current.setServer({ ...initial, version: 2 }));
      if (newEdit)
        patch(h, (draft) => ({
          ...draft,
          risks: [{ ...risk, risk: "New input" }],
        }));
      await update(() =>
        request.reject(new LeadFormWriteError("ambiguous", "Response lost")),
      );
      act(() => h.result.current.setServer({ ...initial, version: 2 }));
      expect(h.result.current.sync.autosave.lastFailureKind).toBeUndefined();
      expect(h.result.current.sync.autosave.dirty).toBe(newEdit);
      expect(h.result.current.sync.autosave.state).toBe(
        newEdit ? "pending" : "idle",
      );
      expect(
        h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
      ).toBe(!newEdit);
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      expect(h.calls).toHaveLength(newEdit ? 2 : 1);
      if (newEdit) {
        expect(h.calls[1]).toMatchObject({
          version: 2,
          risks: [expect.objectContaining({ risk: "New input" })],
        });
        await update(() =>
          expectDefined(h.requests[1]).resolve({
            ...initial,
            version: 3,
            risks: [{ ...risk, risk: "New input" }],
          }),
        );
      }
      await save(h);
      expect(h.calls).toHaveLength(newEdit ? 2 : 1);
    },
  );

  it("uses an acknowledged base even while the query still exposes the previous version", async () => {
    const h = setup();
    patch(h, (draft) => ({ ...draft, ...records }));
    const first = await save(h);
    const saved = makeReportSectionFixture({ version: 2, ...records });
    await update(() => first.resolve(saved));
    expect(h.result.current.server.version).toBe(1);
    const newRisk = {
      ...risk,
      id: "10000000-0000-4000-8000-000000000030",
      stableId: "10000000-0000-4000-8000-000000000030",
      risk: "Second risk",
    };
    patch(h, (draft) => ({
      ...draft,
      risks: [...draft.risks, newRisk],
      decisions: draft.decisions.map((row) => ({
        ...row,
        text: "Latest decision",
      })),
    }));
    const next = await save(h);
    expect(h.calls[1]?.version).toBe(2);
    await update(() =>
      next.reject(new LeadFormWriteError("conflict", "Stale")),
    );
    act(() => h.result.current.setServer({ ...saved, version: 3 }));
    expect(h.result.current.draft?.risks).toContainEqual(newRisk);
    expect(h.result.current.draft?.decisions[0]?.text).toBe("Latest decision");
    expect(h.result.current.sync.autosave.state).toBe("error");
    expect(h.calls).toHaveLength(2);
  });

  it("keeps typing after a 409 while the authoritative refetch is pending", async () => {
    const h = setup();
    patch(h, (draft) => ({ ...draft, ...records }));
    const request = await save(h);
    await update(() =>
      request.reject(new LeadFormWriteError("conflict", "Stale")),
    );
    patch(h, (draft) => ({
      ...draft,
      risks: draft.risks.map((row) => ({
        ...row,
        risk: "Typing during refetch",
      })),
    }));
    const remote = {
      ...decision,
      id: "10000000-0000-4000-8000-000000000042",
      stableId: "10000000-0000-4000-8000-000000000042",
      text: "Unrelated server decision",
    };
    act(() =>
      h.result.current.setServer(
        makeReportSectionFixture({ version: 3, decisions: [remote] }),
      ),
    );
    expect(h.result.current.draft?.risks[0]?.risk).toBe(
      "Typing during refetch",
    );
    expect(h.result.current.draft?.decisions).toEqual(
      expect.arrayContaining([expect.objectContaining(decision), remote]),
    );
    expect(h.result.current.sync.autosave.state).toBe("error");
    expect(h.calls).toHaveLength(1);
  });

  it("keeps undo uncertain after a lost response until a confirmed write", async () => {
    const initial = makeReportSectionFixture(records);
    const h = setup(initial);
    patch(h, (draft) => ({
      ...draft,
      risks: [{ ...risk, risk: "In flight edit" }],
    }));
    const request = await save(h);
    patch(h, (draft) => ({ ...draft, ...records }));
    await update(() =>
      request.reject(new LeadFormWriteError("ambiguous", "Response lost")),
    );
    expect(
      h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
    ).toBe(false);
    expect(h.result.current.sync.autosave.state).toBe("error");
    expect(h.result.current.sync.autosave.lastFailureKind).toBe("uncertain");
    expect(h.result.current.sync.autosave.dirty).toBe(true);
    const retry = await save(h);
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]?.risks[0]?.risk).toBe(risk.risk);
    await update(() => retry.resolve({ ...initial, version: 2 }));
    expect(
      h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
    ).toBe(true);
    expect(h.result.current.sync.autosave.lastFailureKind).not.toBe(
      "uncertain",
    );
  });
  it("settles uncertainty on a newer authoritative read, not a repeat of the old revision", async () => {
    const initial = makeReportSectionFixture(records);
    const h = setup(initial);
    patch(h, (draft) => ({
      ...draft,
      risks: [{ ...risk, risk: "In flight edit" }],
    }));
    const request = await save(h);
    patch(h, (draft) => ({ ...draft, ...records }));
    await update(() =>
      request.reject(new LeadFormWriteError("ambiguous", "Response lost")),
    );
    act(() => h.result.current.setServer({ ...initial }));
    expect(h.result.current.sync.autosave.lastFailureKind).toBe("uncertain");
    expect(
      h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
    ).toBe(false);
    act(() => h.result.current.setServer({ ...initial, version: 2 }));
    expect(
      h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
    ).toBe(true);
    expect(h.result.current.sync.autosave.lastFailureKind).toBeUndefined();
    expect(h.calls).toHaveLength(1);
  });

  it("allows explicit edits after a newer read with unchanged server payload", async () => {
    const h = setup();
    patch(h, (draft) => ({ ...draft, ...records }));
    const request = await save(h);
    await update(() =>
      request.reject(new LeadFormWriteError("conflict", "Stale")),
    );
    act(() =>
      h.result.current.setServer(makeReportSectionFixture({ version: 3 })),
    );
    expect(h.result.current.sync.autosave.state).toBe("error");
    patch(h, (draft) => ({
      ...draft,
      risks: draft.risks.map((row) => ({ ...row, risk: "Reconciled edit" })),
    }));
    expect(h.result.current.sync.autosave.state).toBe("pending");
    expect(h.result.current.draft?.risks[0]?.risk).toBe("Reconciled edit");
  });
  it.each([true, false])(
    "retains an undo after the lost write committed (explicit conflict: %s)",
    async (explicitConflict) => {
      const initial = makeReportSectionFixture(records);
      const h = setup(initial);
      const committedRisk = { ...risk, risk: "Committed without response" };
      patch(h, (draft) => ({ ...draft, risks: [committedRisk] }));
      const original = await save(h);
      patch(h, (draft) => ({ ...draft, ...records }));
      await update(() =>
        original.reject(new LeadFormWriteError("ambiguous", "Response lost")),
      );
      if (explicitConflict) {
        const undo = await save(h);
        await update(() =>
          undo.reject(new LeadFormWriteError("conflict", "Already committed")),
        );
      }
      expect(
        h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
      ).toBe(false);
      act(() =>
        h.result.current.setServer({
          ...initial,
          version: 2,
          risks: [committedRisk],
        }),
      );
      expect(h.result.current.draft?.risks[0]?.risk).toBe(risk.risk);
      expect(h.result.current.sync.autosave.dirty).toBe(true);
      expect(h.result.current.sync.autosave.state).toBe("error");
      const reconciled = await save(h);
      expect(h.calls.at(-1)?.version).toBe(2);
      await update(() => reconciled.resolve({ ...initial, version: 3 }));
      expect(
        h.result.current.sync.autosave.currentPayloadMatchesSavedBaseline,
      ).toBe(true);
    },
  );
});
