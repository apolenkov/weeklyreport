import { act, renderHook } from "@testing-library/react";
import type {
  ItemOutcomeResult,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import type { AutosaveSnapshot } from "../autosave/autosave-types";
import { leadFormGenerationOf } from "./lead-form-generation";
import type { OutcomeCoordinatorArgs } from "./lead-form-outcome-coordinator-helpers";
import { LeadFormWriteError } from "./lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";
import { useLeadFormOutcomeCoordinator } from "./use-lead-form-outcome-coordinator";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STABLE_ID = "55555555-5555-4555-8555-555555555555";
const RECORD_ID = "66666666-6666-4666-8666-666666666666";
const REMINTED_ID = "77777777-7777-4777-8777-777777777777";
const COMMAND_ID = "88888888-8888-4888-8888-888888888888";

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

const CLEAN_AUTOSAVE: AutosaveSnapshot = {
  state: "saved",
  lastSavedAt: null,
  dirty: false,
  currentPayloadMatchesSavedBaseline: true,
  isInFlight: false,
  forceSave: () => Promise.resolve(),
};

function resolveInput(commandId = COMMAND_ID) {
  return {
    commandId,
    source: { kind: "current" as const, recordId: RECORD_ID },
    outcome: "done" as const,
    stageNames: [],
  };
}

function outcome(section: ReportSectionReadModel): ItemOutcomeResult {
  return { section, stableId: STABLE_ID, replayed: false };
}

function buildArgs(
  overrides: Partial<OutcomeCoordinatorArgs> = {},
): OutcomeCoordinatorArgs {
  const section = makeSection();
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: () => Promise.resolve(section),
    submit: () => Promise.resolve(section),
    resolvePlan: () => Promise.resolve(outcome({ ...section, version: 2 })),
    restorePlan: () => Promise.resolve(outcome({ ...section, version: 2 })),
  });
  return {
    writePort,
    generation: leadFormGenerationOf(section),
    sectionId: section.reportSectionId,
    draftSection: section,
    version: section.version,
    autosave: CLEAN_AUTOSAVE,
    readOnly: false,
    submitted: false,
    acceptVersion: () => true,
    adoptServerSection: () => undefined,
    ...overrides,
  };
}

describe("useLeadFormOutcomeCoordinator", () => {
  it.each([
    {
      name: "dirty",
      autosave: { ...CLEAN_AUTOSAVE, dirty: true, state: "pending" as const },
    },
    {
      name: "in-flight",
      autosave: {
        ...CLEAN_AUTOSAVE,
        isInFlight: true,
        state: "saving" as const,
      },
    },
  ])(
    "refuses a $name autosave instead of pretending to flush it",
    async ({ autosave }) => {
      const args = buildArgs({ autosave });
      const { result } = renderHook(() => useLeadFormOutcomeCoordinator(args));

      expect(result.current.canExecute).toBe(false);
      expect(result.current.blockedReason).toContain("autosave");
      await expect(
        result.current.resolve(resolveInput(), STABLE_ID),
      ).rejects.toEqual(
        new LeadFormWriteError(
          "error",
          "Wait for autosave to finish before changing an outcome.",
        ),
      );
      expect(args.writePort.pending.resolvePlan).toBe(false);
    },
  );

  it("remaps a new command by stable identity and freezes its prepared request for retry", async () => {
    const first = makeSection();
    const failure = new LeadFormWriteError("error", "lost acknowledgement");
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.resolve(first),
      submit: () => Promise.resolve(first),
      resolvePlan: () => Promise.reject(failure),
    });
    const initial = buildArgs({ writePort, draftSection: first });
    const { result, rerender } = renderHook(
      ({ args }: { readonly args: OutcomeCoordinatorArgs }) =>
        useLeadFormOutcomeCoordinator(args),
      { initialProps: { args: initial } },
    );

    await expect(
      result.current.resolve(resolveInput(), STABLE_ID),
    ).rejects.toBe(failure);

    const reminted = makeSection({
      version: 2,
      items: [makeItem({ id: REMINTED_ID })],
    });
    rerender({
      args: { ...initial, draftSection: reminted, version: 2 },
    });
    await expect(
      result.current.resolve(resolveInput(), STABLE_ID),
    ).rejects.toBe(failure);
    await expect(
      result.current.resolve(
        resolveInput("99999999-9999-4999-8999-999999999999"),
        STABLE_ID,
      ),
    ).rejects.toBe(failure);

    expect(writePort.calls.resolvePlan).toHaveLength(3);
    expect(writePort.calls.resolvePlan[0]).toMatchObject({
      version: 1,
      source: { kind: "current", recordId: RECORD_ID },
    });
    expect(writePort.calls.resolvePlan[1]).toEqual(
      writePort.calls.resolvePlan[0],
    );
    expect(writePort.calls.resolvePlan[2]).toMatchObject({
      version: 2,
      source: { kind: "current", recordId: REMINTED_ID },
    });
  });

  it("locks synchronously so a duplicate click cannot start a second command", async () => {
    const section = makeSection();
    let finish!: (value: ItemOutcomeResult) => void;
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.resolve(section),
      submit: () => Promise.resolve(section),
      resolvePlan: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const args = buildArgs({ writePort, draftSection: section });
    const { result } = renderHook(() => useLeadFormOutcomeCoordinator(args));

    let first!: Promise<ItemOutcomeResult>;
    act(() => {
      first = result.current.resolve(resolveInput(), STABLE_ID);
    });
    await expect(
      result.current.resolve(resolveInput(), STABLE_ID),
    ).rejects.toThrow("Wait for the current outcome update to finish.");
    expect(writePort.calls.resolvePlan).toHaveLength(1);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      finish(outcome({ ...section, version: 2 }));
      await first;
    });
    expect(result.current.pending).toBe(false);
  });

  it("keeps a prior source id immutable and remaps restore and promotion by stable identity", async () => {
    const section = makeSection({ items: [makeItem({ id: REMINTED_ID })] });
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.resolve(section),
      submit: () => Promise.resolve(section),
      resolvePlan: () => Promise.resolve(outcome(section)),
      restorePlan: () => Promise.resolve(outcome(section)),
      promotePlan: () => Promise.resolve(outcome(section)),
    });
    const args = buildArgs({ writePort, draftSection: section });
    const { result } = renderHook(() => useLeadFormOutcomeCoordinator(args));
    const priorRecordId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    await act(() =>
      result.current.resolve(
        {
          commandId: COMMAND_ID,
          source: {
            kind: "prior",
            reportId: REPORT_ID,
            recordId: priorRecordId,
          },
          outcome: "done",
          stageNames: [],
        },
        STABLE_ID,
      ),
    );
    await act(() =>
      result.current.restore(
        {
          commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          recordId: RECORD_ID,
        },
        STABLE_ID,
      ),
    );

    expect(writePort.calls.resolvePlan[0]?.source.recordId).toBe(priorRecordId);
    expect(writePort.calls.restorePlan[0]?.recordId).toBe(REMINTED_ID);

    await act(() =>
      result.current.promote(
        {
          commandId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          recordId: RECORD_ID,
        },
        STABLE_ID,
      ),
    );

    expect(writePort.calls.promotePlan[0]).toMatchObject({
      recordId: REMINTED_ID,
      reportSectionId: section.reportSectionId,
      version: section.version,
    });
  });

  it.each(
    (["resolve", "restore"] as const).flatMap((operation) =>
      (["different", "returned", "unmounted", "same"] as const).map(
        (activation) => ({ operation, activation }),
      ),
    ),
  )(
    "binds $operation replies to the $activation activation",
    async ({ operation, activation }) => {
      const sectionA = makeSection();
      const sectionB = makeSection({
        reportSectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      });
      let finish!: (value: ItemOutcomeResult) => void;
      const waitForReply = () =>
        new Promise<ItemOutcomeResult>((resolve) => {
          finish = resolve;
        });
      const writePort = new InMemoryLeadFormWriteAdapter({
        saveDraft: () => Promise.resolve(sectionA),
        submit: () => Promise.resolve(sectionA),
        resolvePlan: waitForReply,
        restorePlan: waitForReply,
      });
      const acceptVersion = vi.fn(() => true);
      const adoptServerSection = vi.fn();
      const initial = buildArgs({
        writePort,
        draftSection: sectionA,
        acceptVersion,
        adoptServerSection,
      });
      const { result, rerender, unmount } = renderHook(
        ({ args }: { readonly args: OutcomeCoordinatorArgs }) =>
          useLeadFormOutcomeCoordinator(args),
        { initialProps: { args: initial } },
      );
      let request!: Promise<ItemOutcomeResult>;
      act(() => {
        request =
          operation === "resolve"
            ? result.current.resolve(resolveInput(), STABLE_ID)
            : result.current.restore(
                { commandId: COMMAND_ID, recordId: RECORD_ID },
                STABLE_ID,
              );
      });

      if (activation === "unmounted") {
        unmount();
      } else if (activation === "same") {
        rerender({ args: { ...initial, draftSection: { ...sectionA } } });
      } else {
        rerender({
          args: {
            ...initial,
            generation: leadFormGenerationOf(sectionB),
            sectionId: sectionB.reportSectionId,
            draftSection: sectionB,
          },
        });
        if (activation === "returned") rerender({ args: initial });
      }
      await act(async () => {
        finish(outcome({ ...sectionA, version: 2 }));
        await request;
      });

      if (activation === "same") {
        expect(acceptVersion).toHaveBeenCalledWith(SECTION_ID, 2);
        expect(adoptServerSection).toHaveBeenCalledWith({
          ...sectionA,
          version: 2,
        });
      } else {
        expect(acceptVersion).not.toHaveBeenCalled();
        expect(adoptServerSection).not.toHaveBeenCalled();
      }
    },
  );
});
