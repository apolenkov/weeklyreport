import { act, renderHook } from "@testing-library/react";
import type {
  ItemOutcomeResult,
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewVerdictActions } from "./use-overview-verdict-actions";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SectionItem = ReportSectionReadModel["items"][number];
type Resolve = ReadyEditor["outcomes"]["resolve"];

const PRIOR_REPORT = "80000000-0000-4000-8000-000000000001";
const PRIOR_ID = "80000000-0000-4000-8000-000000000002";
const STABLE_ID = "80000000-0000-4000-8000-000000000003";
const PROJECT_ID = "80000000-0000-4000-8000-000000000004";
const LINKED_ID = "80000000-0000-4000-8000-000000000005";
const CREATED_ID = "80000000-0000-4000-8000-000000000006";
const NEXT_TWIN_ID = "80000000-0000-4000-8000-000000000007";

function record(overrides: Partial<SectionItem>): SectionItem {
  return {
    id: PRIOR_ID,
    stableId: STABLE_ID,
    projectId: PROJECT_ID,
    type: "next",
    text: "Ship the importer",
    tag: "delivery",
    workflowStatus: "planned",
    carriedOver: false,
    stageNames: ["Development"],
    priorityRank: 1,
    ...overrides,
  };
}

const projects = [
  {
    projectId: PROJECT_ID,
    projectName: "Payments",
    trafficLight: "green" as const,
  },
];
const priorSection = makeReportSectionFixture({
  projects,
  items: [record({})],
});
const output = {
  current: { reportId: "x", section: makeReportSectionFixture({}) },
  predecessor: {
    availability: "available",
    source: "published",
    reportId: PRIOR_REPORT,
    periodStart: new Date("2026-08-24T00:00:00.000Z"),
    periodEnd: new Date("2026-08-30T00:00:00.000Z"),
    section: priorSection,
  },
} as unknown as LeadStatusOverviewOutput;

const overviewItem = {
  key: `previous:${STABLE_ID}`,
  recordId: PRIOR_ID,
  stableId: STABLE_ID,
  source: "previous",
  text: "Ship the importer",
  verdict: "pending",
} as unknown as StatusOverviewItem;

interface EditorState {
  section: ReportSectionReadModel;
  pending: boolean;
  dirty: boolean;
  canExecute: boolean;
  autosaveState: "idle" | "error";
}

function setup({
  linked,
  nextTwin = false,
  resolve,
  pendingReviewCount = 0,
  initial = {},
  save,
}: {
  readonly linked?: Partial<SectionItem> | undefined;
  readonly nextTwin?: boolean;
  readonly resolve?: (
    state: EditorState,
    commit: (next: Partial<EditorState>) => void,
  ) => Promise<ItemOutcomeResult>;
  readonly pendingReviewCount?: number;
  readonly initial?: Partial<EditorState>;
  readonly save?: (commit: (next: Partial<EditorState>) => void) => void;
} = {}) {
  const items = [
    ...(linked ? [record({ id: LINKED_ID, type: "current", ...linked })] : []),
    ...(nextTwin ? [record({ id: NEXT_TWIN_ID, type: "next" })] : []),
  ];
  const state: EditorState = {
    section: makeReportSectionFixture({ projects, items }),
    pending: false,
    dirty: false,
    canExecute: true,
    autosaveState: "idle",
    ...initial,
  };
  const apply = vi.fn<ReadyEditor["draft"]["apply"]>();
  const resolveCommand = vi.fn<Resolve>();
  const saveNow = vi.fn(() => {
    save?.(commit);
    return Promise.resolve();
  });
  const build = (): ReadyEditor =>
    ({
      status: "ready",
      draft: {
        section: state.section,
        apply,
        dirty: state.dirty,
        save: saveNow,
        autosave: { state: state.autosaveState, isInFlight: false },
      },
      outcomes: {
        pending: state.pending,
        canExecute: state.canExecute,
        blockedReason: state.canExecute
          ? null
          : "Wait for autosave to finish before changing an outcome.",
        resolve: resolveCommand,
      },
      view: { submitReadiness: { pendingReviewCount } },
    }) as unknown as ReadyEditor;
  const hook = renderHook(
    ({ editor }) => useOverviewVerdictActions(editor, output),
    { initialProps: { editor: build() } },
  );
  function commit(next: Partial<EditorState>) {
    Object.assign(state, next);
    act(() => hook.rerender({ editor: build() }));
  }
  // The draft takes an item patch the way the real reducer does.
  apply.mockImplementation((patch) => {
    if (patch.kind !== "item-patch") return;
    commit({
      section: {
        ...state.section,
        items: state.section.items.map((item) =>
          item.id === patch.itemId ? { ...item, ...patch.patch } : item,
        ),
      },
      dirty: true,
      canExecute: false,
    });
  });
  resolveCommand.mockImplementation(
    resolve
      ? () => resolve(state, commit)
      : () => {
          const result = {
            stableId: STABLE_ID,
            replayed: false,
            section: makeReportSectionFixture({
              projects,
              items: [record({ id: CREATED_ID, type: "current" })],
            }),
          } satisfies ItemOutcomeResult;
          commit({ section: result.section });
          return Promise.resolve(result);
        },
  );
  return { hook, apply, resolve: resolveCommand, commit, state, saveNow };
}

afterEach(() => vi.useRealTimers());

describe("useOverviewVerdictActions.onVerdict", () => {
  it("patches the linked occurrence in the draft and never calls the command", async () => {
    const before = structuredClone(priorSection);
    const { hook, apply, resolve } = setup({
      linked: { carriedOver: true, workflowStatus: "planned" },
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBeNull();

    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0]?.[0]).toMatchObject({
      kind: "item-patch",
      itemId: LINKED_ID,
      patch: { workflowStatus: "done", carriedOver: false },
    });
    expect(resolve).not.toHaveBeenCalled();
    // The prior week is read, never written.
    expect(priorSection).toEqual(before);
  });

  it("uses the prior-plan outcome command when the week has no occurrence", async () => {
    const { hook, apply, resolve } = setup();

    await expect(
      hook.result.current.onVerdict(overviewItem, "next"),
    ).resolves.toBeNull();

    expect(resolve).toHaveBeenCalledOnce();
    const [command, stableId] = resolve.mock.calls[0] ?? [];
    expect(command).toMatchObject({
      source: { kind: "prior", reportId: PRIOR_REPORT, recordId: PRIOR_ID },
      outcome: "plan_next",
    });
    expect(typeof command?.commandId).toBe("string");
    expect(stableId).toBe(STABLE_ID);
    expect(apply).not.toHaveBeenCalled();
  });

  it("finishes paused on the occurrence the command created", async () => {
    const { hook, apply, resolve } = setup();

    await expect(
      hook.result.current.onVerdict(overviewItem, "paused", " Waiting "),
    ).resolves.toBeNull();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0]?.[0]).toMatchObject({ outcome: "continue" });
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      kind: "item-patch",
      itemId: CREATED_ID,
      patch: { workflowStatus: "paused", pausedReason: "Waiting" },
    });
  });

  it("reports an error, not success, when the created occurrence never reaches the draft", async () => {
    vi.useFakeTimers();
    const { hook, apply } = setup({
      // The section was not accepted: the draft keeps the old section.
      resolve: () =>
        Promise.resolve({
          stableId: STABLE_ID,
          replayed: false,
          section: makeReportSectionFixture({
            projects,
            items: [record({ id: CREATED_ID, type: "current" })],
          }),
        }),
    });

    const result = hook.result.current.onVerdict(
      overviewItem,
      "paused",
      "Waiting",
    );
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toMatch(/pause was not applied/);
    expect(apply).not.toHaveBeenCalled();
  });

  it("reports an error, not success, when an outcome lock rejects the pause patch", async () => {
    vi.useFakeTimers();
    const { hook, apply } = setup({
      resolve: (_state, commit) => {
        const created = makeReportSectionFixture({
          projects,
          items: [record({ id: CREATED_ID, type: "current" })],
        });
        // Adopted, but the writer is still locked: the patch is dropped.
        commit({ section: created });
        apply.mockImplementation(() => undefined);
        return Promise.resolve({
          stableId: STABLE_ID,
          replayed: false,
          section: created,
        });
      },
    });

    const result = hook.result.current.onVerdict(
      overviewItem,
      "paused",
      "Waiting",
    );
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toMatch(/pause was not applied/);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("returns a message for a blank reason and writes nothing", async () => {
    const { hook, apply, resolve } = setup();

    await expect(
      hook.result.current.onVerdict(overviewItem, "paused", "  "),
    ).resolves.toMatch(/paused/);
    await expect(
      hook.result.current.onVerdict(overviewItem, "wont_do"),
    ).resolves.toMatch(/not be done/);

    expect(apply).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("does not duplicate an existing Next commitment", async () => {
    const { hook, apply, resolve } = setup({ linked: { type: "next" } });

    await expect(
      hook.result.current.onVerdict(overviewItem, "next"),
    ).resolves.toBeNull();

    expect(apply).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("never adds a second Next when a separate Next record shares the stableId", async () => {
    const { hook, apply, resolve } = setup({
      linked: { type: "current", carriedOver: true },
      nextTwin: true,
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "next"),
    ).resolves.toBeNull();

    expect(apply).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("explains why the command is blocked instead of sending it", async () => {
    const { hook, resolve } = setup({ initial: { canExecute: false } });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBe("Wait for autosave to finish before changing an outcome.");

    expect(resolve).not.toHaveBeenCalled();
  });

  it("reports a failed command so the reason stays editable", async () => {
    const { hook } = setup({
      resolve: () => Promise.reject(new Error("Stale prior plan.")),
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBe("Stale prior plan.");
  });

  it("records won't do through the command with its reason", async () => {
    const { hook, resolve } = setup({ linked: { carriedOver: true } });

    await hook.result.current.onVerdict(overviewItem, "wont_do", "Dropped");

    expect(resolve.mock.calls[0]?.[0]).toMatchObject({
      source: { kind: "current", recordId: LINKED_ID },
      outcome: "wont_do",
      reason: "Dropped",
    });
  });
});

describe("useOverviewVerdictActions autosave handoff", () => {
  it("saves the dirty draft before a command instead of refusing it", async () => {
    const { hook, resolve, saveNow } = setup({
      initial: { dirty: true, canExecute: false },
      save: (commit) => commit({ dirty: false, canExecute: true }),
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBeNull();

    expect(saveNow).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledOnce();
  });

  it("applies Done on a linked item and at once Done on one without an occurrence", async () => {
    const { hook, apply, resolve, saveNow } = setup({
      linked: { carriedOver: true },
      save: (commit) => commit({ dirty: false, canExecute: true }),
    });
    // No occurrence of this one in the selected week: it goes by the command.
    const second = {
      ...overviewItem,
      stableId: "80000000-0000-4000-8000-0000000000aa",
    } as StatusOverviewItem;

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBeNull();
    await expect(
      hook.result.current.onVerdict(second, "done"),
    ).resolves.toBeNull();

    expect(apply).toHaveBeenCalledOnce();
    expect(saveNow).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledOnce();
  });

  it("shows the save failure instead of sending the command", async () => {
    const { hook, resolve } = setup({
      initial: { dirty: true, canExecute: false },
      save: (commit) => commit({ autosaveState: "error" }),
    });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toMatch(/autosave/);

    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("useOverviewVerdictActions.onConfirmAll", () => {
  it("confirms every pending continuation in one patch", () => {
    const { hook, apply } = setup({
      linked: { carriedOver: true },
      pendingReviewCount: 1,
    });

    hook.result.current.onConfirmAll();

    expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: "confirm-carried" });
    expect(hook.result.current.pendingReviewCount).toBe(1);
  });

  it("writes nothing when nothing is pending", () => {
    const { hook, apply } = setup({ linked: { carriedOver: false } });

    hook.result.current.onConfirmAll();

    expect(apply).not.toHaveBeenCalled();
  });

  it("applies right after a running command instead of dropping the click", () => {
    const { hook, apply, commit } = setup({
      linked: { carriedOver: true },
      initial: { pending: true },
    });

    hook.result.current.onConfirmAll();
    expect(apply).not.toHaveBeenCalled();

    commit({ pending: false });
    return vi.waitFor(() =>
      expect(apply).toHaveBeenCalledExactlyOnceWith({
        kind: "confirm-carried",
      }),
    );
  });
});
