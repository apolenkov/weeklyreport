import type {
  ItemOutcomeResult,
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@customreport/shared";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function setup({
  linked,
  canExecute = true,
  resolve,
  pendingReviewCount = 0,
}: {
  readonly linked?: Partial<SectionItem> | undefined;
  readonly canExecute?: boolean;
  readonly resolve?: ReturnType<typeof vi.fn<Resolve>>;
  readonly pendingReviewCount?: number;
} = {}) {
  const items = linked
    ? [record({ id: LINKED_ID, type: "current", ...linked })]
    : [];
  const section = makeReportSectionFixture({ projects, items });
  const apply = vi.fn<ReadyEditor["draft"]["apply"]>();
  const resolveCommand =
    resolve ??
    vi.fn<Resolve>().mockResolvedValue({
      stableId: STABLE_ID,
      replayed: false,
      section: makeReportSectionFixture({
        projects,
        items: [record({ id: CREATED_ID, type: "current" })],
      }),
    } satisfies ItemOutcomeResult);
  const editor = {
    status: "ready",
    draft: { section, apply },
    outcomes: {
      canExecute,
      blockedReason: canExecute ? null : "Wait for autosave to finish.",
      resolve: resolveCommand,
    },
    view: { submitReadiness: { pendingReviewCount } },
  } as unknown as ReadyEditor;
  const hook = renderHook(() => useOverviewVerdictActions(editor, output));
  return { hook, apply, resolve: resolveCommand };
}

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

    await hook.result.current.onVerdict(overviewItem, "paused", " Waiting ");

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0]?.[0]).toMatchObject({ outcome: "continue" });
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      kind: "item-patch",
      itemId: CREATED_ID,
      patch: { workflowStatus: "paused", pausedReason: "Waiting" },
    });
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

  it("explains why the command is blocked instead of sending it", async () => {
    const { hook, resolve } = setup({ canExecute: false });

    await expect(
      hook.result.current.onVerdict(overviewItem, "done"),
    ).resolves.toBe("Wait for autosave to finish.");

    expect(resolve).not.toHaveBeenCalled();
  });

  it("reports a failed command so the reason stays editable", async () => {
    const { hook } = setup({
      resolve: vi
        .fn<Resolve>()
        .mockRejectedValue(new Error("Stale prior plan.")),
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
});
