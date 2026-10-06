import type {
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@customreport/shared";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import type {
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type { OpenWorkRegisterItem } from "./open-work-register-model";
import { OverviewInputProvider } from "./overview-input-provider";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewPlanActions } from "./use-overview-plan-actions";

const session = vi.hoisted(() => ({ user: { id: "test-user" } }));
vi.mock("../../../../../shared/lib/auth/session-provider", () => ({
  useSession: () => session,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const REPORT_ID = "70000000-0000-4000-8000-000000000001";
const SOURCE_REPORT_ID = "70000000-0000-4000-8000-000000000002";
const SOURCE_RECORD_ID = "70000000-0000-4000-8000-000000000003";
const STABLE_ID = "70000000-0000-4000-8000-000000000004";
const PROJECT_ID = "70000000-0000-4000-8000-000000000005";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type Resolve = ReadyEditor["outcomes"]["resolve"];

function openWork(): OpenWorkRegisterItem {
  return {
    key: STABLE_ID,
    periodLabel: "Jul 6–12, 2026",
    action: { kind: "resume", label: "Resume paused work" },
    occurrence: {
      source: "published",
      reportId: SOURCE_REPORT_ID,
      reportSectionId: "70000000-0000-4000-8000-000000000006",
      periodStart: new Date("2026-07-06T00:00:00.000Z"),
      periodEnd: new Date("2026-07-12T00:00:00.000Z"),
      parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
      item: {
        id: SOURCE_RECORD_ID,
        stableId: STABLE_ID,
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text: "Resume provider rollout",
        tag: "delivery",
        workflowStatus: "paused",
        carriedOver: false,
        pausedReason: "Waiting for legal",
        stageNames: ["Development"],
      },
    },
  };
}

function editor(
  resolve: Resolve,
  items: ReportSectionReadModel["items"] = [],
): ReadyEditor {
  return {
    status: "ready",
    generation: `${REPORT_ID}:target-section`,
    outcomes: {
      pending: false,
      canExecute: true,
      blockedReason: null,
      resolve,
      restore: vi.fn(),
    },
    draft: {
      section: {
        projects: [{ projectId: PROJECT_ID }],
        activities: [],
        items,
      } as unknown as ReportSectionReadModel,
    },
    view: { viewModel: { isReadOnly: false } },
  } as unknown as ReadyEditor;
}

const OUTPUT = {
  current: { reportId: REPORT_ID },
} as unknown as LeadStatusOverviewOutput;
const MODEL = { units: [] } as unknown as StatusOverviewModel;
type PlanActions = ReturnType<typeof useOverviewPlanActions>;

function retainedHarness(
  resolve: Resolve,
  items: ReportSectionReadModel["items"] = [],
) {
  let latest: PlanActions | null = null;
  function Harness() {
    latest = useOverviewPlanActions(
      editor(resolve, items),
      OUTPUT,
      MODEL,
      false,
    );
    return null;
  }
  function Page({ mount }: { readonly mount: string }) {
    return (
      <OverviewInputProvider>
        <Harness key={mount} />
      </OverviewInputProvider>
    );
  }
  const page = render(<Page mount="first" />);
  return {
    current: () => {
      if (latest === null) throw new Error("Plan actions did not render.");
      return latest;
    },
    remount: () => page.rerender(<Page mount="second" />),
  };
}

function currentItem(): ReportSectionReadModel["items"][number] {
  return {
    ...openWork().occurrence.item,
    id: SOURCE_RECORD_ID,
    stableId: STABLE_ID,
    workflowStatus: "in_progress",
    pausedReason: null,
  };
}

function currentOverviewItem(): StatusOverviewItem {
  const item = currentItem();
  return {
    key: `current:${SOURCE_RECORD_ID}`,
    recordId: SOURCE_RECORD_ID,
    source: "current",
    editTarget: null,
    stableId: STABLE_ID,
    text: item.text,
    tag: item.tag,
    stageNames: item.stageNames,
    pausedReason: null,
    comments: [],
    resolution: null,
    outcomeHistory: [],
    canResolve: true,
    canRestore: false,
    workflowStatus: "in_progress",
    continuity: null,
  };
}

describe("useOverviewPlanActions open-work retry", () => {
  it("retains the same command id and immutable prior source after a lost acknowledgement", async () => {
    const failure = new Error("Lost acknowledgement");
    const resolve = vi.fn<Resolve>(() => Promise.reject(failure));
    const { result } = renderHook(() =>
      useOverviewPlanActions(editor(resolve), OUTPUT, MODEL, false),
    );

    act(() => result.current.openWork(openWork()));
    expect(result.current.dialog?.fields.outcome).toBe("continue");
    act(() => result.current.submit());
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.pending).toBe(false));
    act(() => result.current.submit());
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));

    expect(resolve.mock.calls[0]?.[0]).toMatchObject({
      source: {
        kind: "prior",
        reportId: SOURCE_REPORT_ID,
        recordId: SOURCE_RECORD_ID,
      },
      outcome: "continue",
    });
    expect(resolve.mock.calls[1]?.[0].commandId).toBe(
      resolve.mock.calls[0]?.[0].commandId,
    );
  });

  it("retries retained prior work after a route remount with the exact command identity", async () => {
    const resolve = vi
      .fn<Resolve>()
      .mockRejectedValueOnce(new Error("Lost acknowledgement"))
      .mockResolvedValueOnce({} as Awaited<ReturnType<Resolve>>);
    const harness = retainedHarness(resolve);

    act(() => harness.current().openWork(openWork()));
    act(() => harness.current().submit());
    await waitFor(() => expect(harness.current().pending).toBe(false));
    harness.remount();
    expect(harness.current().recoveryReason).toBeNull();
    act(() => harness.current().submit());
    await waitFor(() => expect(harness.current().dialog).toBeNull());

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.mock.calls[1]?.[0]).toEqual(resolve.mock.calls[0]?.[0]);
    expect(resolve.mock.calls[1]?.[0]).toMatchObject({
      source: {
        kind: "prior",
        reportId: SOURCE_REPORT_ID,
        recordId: SOURCE_RECORD_ID,
      },
    });
  });

  it("blocks a current-source retry after remount when the prepared request outcome is unknown", async () => {
    const resolve = vi
      .fn<Resolve>()
      .mockRejectedValue(new Error("Lost acknowledgement"));
    const harness = retainedHarness(resolve, [currentItem()]);

    act(() => harness.current().resolve(currentOverviewItem()));
    act(() => harness.current().choose("continue"));
    act(() => harness.current().submit());
    await waitFor(() => expect(harness.current().pending).toBe(false));
    harness.remount();

    const recovery =
      "The previous save outcome is unknown after navigation. Reload this report to confirm it before trying again.";
    expect(harness.current().recoveryReason).toBe(recovery);
    act(() => harness.current().submit());
    await waitFor(() => expect(harness.current().error).toBe(recovery));
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("retains edited remounted prior-plan input when the previous command succeeds late", async () => {
    let finish!: (value: Awaited<ReturnType<Resolve>>) => void;
    const resolve = vi.fn<Resolve>(
      () =>
        new Promise((fulfil) => {
          finish = fulfil;
        }),
    );
    const harness = retainedHarness(resolve);
    vi.mocked(toast.success).mockClear();

    act(() => harness.current().openWork(openWork()));
    act(() => harness.current().submit());
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    harness.remount();
    act(() =>
      harness.current().change({
        resultText: "New unsaved input after navigation",
      }),
    );

    await act(() => {
      finish({} as Awaited<ReturnType<Resolve>>);
      return Promise.resolve();
    });

    expect(harness.current().dialog?.fields.resultText).toBe(
      "New unsaved input after navigation",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("lets only the remounted attempt close and announce its changed input", async () => {
    const finishes: ((value: Awaited<ReturnType<Resolve>>) => void)[] = [];
    const resolve = vi.fn<Resolve>(
      () =>
        new Promise((fulfil) => {
          finishes.push(fulfil);
        }),
    );
    const harness = retainedHarness(resolve);
    vi.mocked(toast.success).mockClear();

    act(() => harness.current().openWork(openWork()));
    act(() => harness.current().submit());
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    harness.remount();
    act(() =>
      harness.current().change({ resultText: "Retained replacement result" }),
    );
    act(() => harness.current().submit());
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));

    await act(() => {
      finishes[0]?.({} as Awaited<ReturnType<Resolve>>);
      return Promise.resolve();
    });
    expect(harness.current().dialog?.fields.resultText).toBe(
      "Retained replacement result",
    );
    expect(toast.success).not.toHaveBeenCalled();

    await act(() => {
      finishes[1]?.({} as Awaited<ReturnType<Resolve>>);
      return Promise.resolve();
    });
    expect(harness.current().dialog).toBeNull();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[1]?.[0]).toMatchObject({
      text: "Retained replacement result",
    });
    expect(resolve.mock.calls[1]?.[0].commandId).not.toBe(
      resolve.mock.calls[0]?.[0].commandId,
    );
  });
});
