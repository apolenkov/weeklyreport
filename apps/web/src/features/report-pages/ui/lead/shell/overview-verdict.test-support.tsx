import { act, renderHook } from "@testing-library/react";
import type {
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { vi } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import type { StatusOverviewItem } from "../../../../report-sections";
import type { LeadFormOutcomeResult } from "../../../../report-sections/client";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewVerdictActions } from "./use-overview-verdict-actions";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SectionItem = ReportSectionReadModel["items"][number];
type Resolve = ReadyEditor["outcomes"]["resolve"];

export const PRIOR_REPORT = "80000000-0000-4000-8000-000000000001";
export const PRIOR_ID = "80000000-0000-4000-8000-000000000002";
export const STABLE_ID = "80000000-0000-4000-8000-000000000003";
const PROJECT_ID = "80000000-0000-4000-8000-000000000004";
export const LINKED_ID = "80000000-0000-4000-8000-000000000005";
export const CREATED_ID = "80000000-0000-4000-8000-000000000006";
export const NEXT_TWIN_ID = "80000000-0000-4000-8000-000000000007";

export function record(overrides: Partial<SectionItem>): SectionItem {
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

export const projects = [
  {
    projectId: PROJECT_ID,
    projectName: "Payments",
    trafficLight: "green" as const,
  },
];
export const priorSection = makeReportSectionFixture({
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

export const overviewItem = {
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

interface SetupOptions {
  readonly guardedWrite?: Parameters<typeof useOverviewVerdictActions>[2];
  readonly linked?: Partial<SectionItem> | undefined;
  readonly nextTwin?: boolean;
  readonly resolve?: (
    state: EditorState,
    commit: (next: Partial<EditorState>) => void,
  ) => Promise<LeadFormOutcomeResult>;
  readonly pendingReviewCount?: number;
  readonly initial?: Partial<EditorState>;
  readonly save?: (commit: (next: Partial<EditorState>) => void) => void;
}

export function setup({
  linked,
  nextTwin = false,
  resolve,
  pendingReviewCount = 0,
  guardedWrite,
  initial = {},
  save,
}: SetupOptions = {}) {
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
  const build = () =>
    makeReadyEditor(
      state,
      { apply, saveNow, resolveCommand },
      pendingReviewCount,
    );
  const hook = renderHook(
    ({ editor }) => useOverviewVerdictActions(editor, output, guardedWrite),
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
          } satisfies LeadFormOutcomeResult;
          commit({ section: result.section });
          return Promise.resolve(result);
        },
  );
  return { hook, apply, resolve: resolveCommand, commit, state, saveNow };
}

function makeReadyEditor(
  state: EditorState,
  {
    apply,
    saveNow,
    resolveCommand,
  }: {
    apply: ReadyEditor["draft"]["apply"];
    saveNow: () => Promise<void>;
    resolveCommand: Resolve;
  },
  pendingReviewCount: number,
): ReadyEditor {
  return {
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
    view: {
      viewModel: { isReadOnly: false },
      submitReadiness: { pendingReviewCount },
    },
  } as unknown as ReadyEditor;
}
