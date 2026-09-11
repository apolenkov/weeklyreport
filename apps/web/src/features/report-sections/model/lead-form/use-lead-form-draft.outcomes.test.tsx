import type {
  ItemOutcomeResult,
  ReportSectionReadModel,
} from "@customreport/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { leadFormGenerationOf } from "./lead-form-generation";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STABLE_ID = "55555555-5555-4555-8555-555555555555";
const RECORD_ID = "66666666-6666-4666-8666-666666666666";
const COMMAND_ID = "77777777-7777-4777-8777-777777777777";

function makeItem(
  overrides: Partial<ReportSectionReadModel["items"][number]> = {},
): ReportSectionReadModel["items"][number] {
  return {
    id: RECORD_ID,
    stableId: STABLE_ID,
    projectId: PROJECT_ID,
    activityId: null,
    type: "current",
    text: "Tracked work",
    tag: "general",
    workflowStatus: "in_progress",
    carriedOver: false,
    stageNames: [],
    ...overrides,
  };
}

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    projects: [
      { projectId: PROJECT_ID, projectName: "Project", trafficLight: "green" },
    ],
    items: [makeItem()],
    ...overrides,
  });
}

function commandInput() {
  return {
    commandId: COMMAND_ID,
    source: { kind: "current" as const, recordId: RECORD_ID },
    outcome: "done" as const,
    stageNames: [],
  };
}

function buildHarness(
  resolvePlan: (input: unknown) => Promise<ItemOutcomeResult>,
  saveDraft?: () => Promise<ReportSectionReadModel>,
) {
  const initial = makeSection();
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: saveDraft ?? (() => Promise.resolve(initial)),
    submit: () => Promise.resolve({ ...initial, status: "submitted" }),
    resolvePlan,
  });
  const initialProps = { serverSection: initial };
  const rendered = renderHook(
    ({ serverSection }: { readonly serverSection: ReportSectionReadModel }) =>
      useLeadFormDraftCore({
        writePort,
        generation: leadFormGenerationOf(serverSection),
        serverSection,
        sectionIdForActions: serverSection.reportSectionId,
        serverReadOnly: false,
        refetchSection: () => Promise.resolve(),
      }),
    { initialProps },
  );
  return { ...rendered, initial, writePort };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useLeadFormDraftCore outcome coordination", () => {
  it("adopts metadata-only cancellation and restoration from newer server revisions", () => {
    const harness = buildHarness(() =>
      Promise.reject(new Error("Unexpected command")),
    );
    const resolution = {
      kind: "wont_do" as const,
      eventId: COMMAND_ID,
      reason: "No longer needed",
      actorId: AUTHOR_ID,
      actorName: "Test Lead",
      occurredAt: "2026-09-04T20:00:00.000Z",
      previousState: {
        type: "current" as const,
        workflowStatus: "in_progress" as const,
        pausedReason: null,
        nextStepText: null,
      },
    };
    harness.rerender({
      serverSection: makeSection({
        version: 2,
        items: [makeItem({ resolution })],
      }),
    });
    expect(harness.result.current.draft?.items[0]?.resolution).toEqual(
      resolution,
    );
    expect(harness.result.current.version).toBe(2);
    expect(harness.result.current.dirty).toBe(false);
    harness.rerender({
      serverSection: makeSection({
        version: 3,
        items: [makeItem({ resolution: null })],
      }),
    });
    expect(harness.result.current.draft?.items[0]?.resolution).toBeNull();
    expect(harness.result.current.version).toBe(3);
    expect(harness.result.current.dirty).toBe(false);
    expect(harness.writePort.calls.saveDraft).toHaveLength(0);
  });

  it("does not claim a write timestamp merely from loading a saved section", () => {
    const harness = buildHarness(() =>
      Promise.reject(new Error("Unexpected command")),
    );
    expect(harness.result.current.autosave.state).toBe("idle");
    expect(harness.result.current.autosave.lastSavedAt).toBeNull();
  });

  it("allows outcomes after undoing a failed autosave to the confirmed baseline", async () => {
    const harness = buildHarness(
      () => Promise.reject(new Error("Unexpected command")),
      () => Promise.reject(new Error("Save failed")),
    );
    act(() =>
      harness.result.current.apply({
        kind: "item-patch",
        itemId: RECORD_ID,
        patch: { text: "Unsaved change" },
      }),
    );
    await act(async () => {
      await harness.result.current.autosave.forceSave();
    });
    expect(harness.result.current.autosave.state).toBe("error");
    expect(harness.result.current.outcomes.canExecute).toBe(false);
    act(() =>
      harness.result.current.apply({
        kind: "item-patch",
        itemId: RECORD_ID,
        patch: { text: "Tracked work" },
      }),
    );
    expect(harness.result.current.dirty).toBe(false);
    expect(harness.result.current.autosave.state).toBe("idle");
    expect(harness.result.current.outcomes.canExecute).toBe(true);
  });

  it("adopts the command reply as the saved baseline without an extra autosave", async () => {
    const returned = makeSection({
      version: 2,
      items: [makeItem({ workflowStatus: "done", text: "Delivered" })],
    });
    const harness = buildHarness(() =>
      Promise.resolve({
        section: returned,
        stableId: STABLE_ID,
        replayed: false,
      }),
    );

    await act(async () => {
      await harness.result.current.outcomes.resolve(commandInput(), STABLE_ID);
    });

    expect(harness.result.current.version).toBe(2);
    expect(harness.result.current.draft?.items[0]?.text).toBe("Delivered");
    expect(harness.result.current.dirty).toBe(false);
    expect(harness.result.current.autosave.state).toBe("saved");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(harness.writePort.calls.saveDraft).toHaveLength(0);
  });

  it("blocks local apply and submit synchronously while an outcome command is pending", async () => {
    let finish!: (result: ItemOutcomeResult) => void;
    const harness = buildHarness(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let request!: Promise<ItemOutcomeResult>;
    act(() => {
      request = harness.result.current.outcomes.resolve(
        commandInput(),
        STABLE_ID,
      );
      harness.result.current.apply({
        kind: "item-patch",
        itemId: RECORD_ID,
        patch: { text: "Must not apply" },
      });
    });

    await expect(harness.result.current.submit()).resolves.toBe("not-ready");
    expect(harness.result.current.draft?.items[0]?.text).toBe("Tracked work");
    expect(harness.writePort.calls.submit).toHaveLength(0);

    await act(async () => {
      finish({
        section: { ...harness.initial, version: 2 },
        stableId: STABLE_ID,
        replayed: false,
      });
      await request;
    });
  });

  it("ignores an older query echo after adopting a newer command version", async () => {
    const returned = makeSection({
      version: 3,
      items: [makeItem({ text: "Command result" })],
    });
    const harness = buildHarness(() =>
      Promise.resolve({
        section: returned,
        stableId: STABLE_ID,
        replayed: false,
      }),
    );

    await act(async () => {
      await harness.result.current.outcomes.resolve(commandInput(), STABLE_ID);
    });
    harness.rerender({
      serverSection: makeSection({
        version: 2,
        items: [makeItem({ text: "Stale query echo" })],
      }),
    });

    expect(harness.result.current.version).toBe(3);
    expect(harness.result.current.draft?.items[0]?.text).toBe("Command result");
    expect(harness.result.current.dirty).toBe(false);
  });
});
