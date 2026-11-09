import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ItemOutcomeResult,
  LeadOpenWorkHistoryOccurrence,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { expect, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { OverviewInputProvider } from "./overview-input-provider";

export const REPORT_ID = "a0000000-0000-4000-8000-000000000001";
export const PROJECT_ID = "a0000000-0000-4000-8000-000000000002";
const STAGE_ID = "a0000000-0000-4000-8000-000000000003";
export const SECOND_PROJECT_ID = "a0000000-0000-4000-8000-000000000004";
const SECOND_STAGE_ID = "a0000000-0000-4000-8000-000000000005";
export const ACTIVITY_ID = "a0000000-0000-4000-8000-000000000006";
export const PREDECESSOR_REPORT_ID = "a0000000-0000-4000-8000-000000000007";
const HEAD_REVIEWER_ID = "a0000000-0000-4000-8000-000000000099";

function createSectionStore(initial: ReportSectionReadModel) {
  let current = initial;
  return {
    read: () => current,
    write: (next: ReportSectionReadModel) => {
      current = next;
      return next;
    },
  };
}

export function Wrapper({
  children,
  reportId = REPORT_ID,
  client,
  failOverview,
  resolvePlan,
  promotePlan,
  saveDraft,
  openWork = [],
  inputProvider = false,
  legacyNextText,
  withActivity = false,
  currentWorkflowStatus = "in_progress",
  nextWorkflowStatus = "planned",
  currentCarriedOver = false,
  coveringRisk = false,
  predecessorItem,
  reviewerFeedback = false,
  extraCurrentRow = false,
}: {
  readonly children: ReactNode;
  readonly reportId?: string;
  readonly client?: QueryClient;
  readonly failOverview?: () => boolean;
  readonly resolvePlan?: (
    input: unknown,
    section: ReportSectionReadModel,
  ) => Promise<unknown>;
  readonly promotePlan?: (
    input: unknown,
    current: ReportSectionReadModel,
  ) => Promise<ItemOutcomeResult>;
  readonly saveDraft?: (
    input: unknown,
    current: ReportSectionReadModel,
  ) => Promise<ReportSectionReadModel>;
  readonly openWork?: readonly LeadOpenWorkHistoryOccurrence[];
  readonly inputProvider?: boolean;
  readonly legacyNextText?: string | undefined;
  readonly withActivity?: boolean | undefined;
  readonly currentWorkflowStatus?:
    "planned" | "in_progress" | "paused" | "postponed" | "done";
  readonly nextWorkflowStatus?:
    "planned" | "in_progress" | "paused" | "postponed" | "done";
  readonly currentCarriedOver?: boolean | undefined;
  readonly coveringRisk?: boolean;
  readonly predecessorItem?:
    ReportSectionReadModel["items"][number] | undefined;
  readonly reviewerFeedback?: boolean;
  readonly extraCurrentRow?: boolean;
}) {
  const section = makeReportSectionFixture({
    reportId,
    reviews: reviewerFeedback
      ? [
          {
            reviewerId: HEAD_REVIEWER_ID,
            reviewerName: "Head",
            verdict: "changes_requested",
            judgedVersion: 1,
            isCurrent: true,
            comment: "Clarify the delivery outcome.",
            createdAt: new Date("2026-08-31T00:00:00Z"),
          },
        ]
      : [],
    ...(reportId === REPORT_ID
      ? {}
      : { reportSectionId: "a0000000-0000-4000-8000-000000000061" }),
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Payments",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
          },
        ],
      },
      {
        projectId: SECOND_PROJECT_ID,
        projectName: "Analytics",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: SECOND_STAGE_ID,
            stageName: "Analysis",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [
          {
            stageId: SECOND_STAGE_ID,
            stageName: "Analysis",
            sortOrder: 0,
          },
        ],
      },
    ],
    risks: coveringRisk
      ? [
          {
            id: HEAD_REVIEWER_ID,
            projectId: PROJECT_ID,
            stageNames: ["Development"],
            severity: "blocked",
            risk: "Access unavailable",
            impact: "Cannot ship",
            mitigation: "Escalate",
          },
        ]
      : [],
    activities: withActivity
      ? [
          {
            activityId: ACTIVITY_ID,
            activityName: "Operational duty",
            status: "green",
            note: "Keep this description",
          },
        ]
      : [],
    items: [
      {
        id: "a0000000-0000-4000-8000-000000000010",
        stableId: "a0000000-0000-4000-8000-000000000011",
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text: "Current work",
        comments: reviewerFeedback
          ? [
              {
                id: "a0000000-0000-4000-8000-000000000098",
                reviewerId: HEAD_REVIEWER_ID,
                reviewerName: "Head",
                text: "Add the delivery result.",
                createdAt: new Date("2026-08-31T00:00:00Z"),
              },
            ]
          : [],
        tag: "delivery",
        workflowStatus: currentWorkflowStatus,
        pausedReason:
          currentWorkflowStatus === "paused" ? "Waiting for access" : null,
        carriedOver: currentCarriedOver,
        nextStepText: legacyNextText ?? null,
        stageNames: ["Development"],
      },
      ...(extraCurrentRow
        ? [
            {
              id: "a0000000-0000-4000-8000-000000000014",
              stableId: "a0000000-0000-4000-8000-000000000015",
              projectId: PROJECT_ID,
              activityId: null,
              type: "current" as const,
              text: "Second current work",
              tag: "delivery",
              workflowStatus: "in_progress" as const,
              pausedReason: null,
              carriedOver: false,
              nextStepText: null,
              stageNames: ["Development"],
            },
          ]
        : []),
      {
        id: "a0000000-0000-4000-8000-000000000012",
        stableId: "a0000000-0000-4000-8000-000000000013",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Next work",
        tag: "delivery",
        workflowStatus: nextWorkflowStatus,
        pausedReason:
          nextWorkflowStatus === "paused" ? "Waiting for access" : null,
        carriedOver: false,
        stageNames: ["Development"],
      },
    ],
  });
  const sectionStore = createSectionStore(section);
  const { proxy, captured } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: () => sectionStore.read(),
    },
    { path: ["review", "leadItemComment"], mutation: true },
    {
      path: ["leadForm", "statusOverview"],
      queryByInput: () => {
        if (failOverview?.()) throw new Error("Overview refresh failed");
        return {
          current: {
            reportId,
            periodStart: new Date("2026-08-31T00:00:00.000Z"),
            periodEnd: new Date("2026-09-06T00:00:00.000Z"),
            section: sectionStore.read(),
          },
          predecessor: {
            ...(predecessorItem
              ? {
                  availability: "available" as const,
                  source: "published" as const,
                  reportId: PREDECESSOR_REPORT_ID,
                  periodStart: new Date("2026-08-24T00:00:00.000Z"),
                  periodEnd: new Date("2026-08-30T00:00:00.000Z"),
                  section: makeReportSectionFixture({
                    reportId: PREDECESSOR_REPORT_ID,
                    projects: section.projects.map((project) => ({
                      projectId: project.projectId,
                      projectName: project.projectName,
                      trafficLight: project.trafficLight,
                      ownedStages: project.ownedStages,
                      stageSet: project.stageSet,
                    })),
                    activities: section.activities,
                    items: [predecessorItem],
                  }),
                }
              : {
                  availability: "unavailable" as const,
                  reason: "no_predecessor" as const,
                }),
          },
        };
      },
    },
    {
      path: ["leadForm", "openWork"],
      query: { occurrences: openWork, nextCursor: null },
    },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: () => ({
        section: sectionStore.read(),
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    {
      path: ["ai", "availability"],
      query: { availability: "unavailable" },
    },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
  ]);
  captured["reports.saveDraft"]?.mutationFn.mockImplementation(
    async (input: unknown) => {
      if (saveDraft) {
        try {
          return sectionStore.write(
            await saveDraft(input, sectionStore.read()),
          );
        } catch (error) {
          const serverSection = (error as { serverSection?: unknown })
            .serverSection;
          if (serverSection)
            sectionStore.write(serverSection as ReportSectionReadModel);
          throw error;
        }
      }
      const draft = input as {
        readonly version: number;
        readonly items: ReportSectionReadModel["items"];
      };
      return sectionStore.write({
        ...sectionStore.read(),
        version: draft.version + 1,
        items: draft.items,
      });
    },
  );
  if (resolvePlan)
    captured["leadForm.resolvePlan"]?.mutationFn.mockImplementation((input) =>
      resolvePlan(input, section),
    );
  if (promotePlan)
    captured["leadForm.promotePlan"]?.mutationFn.mockImplementation(
      async (input) => {
        const result = await promotePlan(input, sectionStore.read());
        sectionStore.write(result.section);
        return result;
      },
    );
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProxyContext.Provider value={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: section.authorId,
              name: "Test Lead",
              email: "lead@example.test",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          {inputProvider ? (
            <OverviewInputProvider>
              <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
            </OverviewInputProvider>
          ) : (
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          )}
        </SessionContext.Provider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}

// vi.waitFor defaults to 1 s, which heavy renders exceed under suite load.
export const pollUntil = <T,>(check: () => T | Promise<T>) =>
  vi.waitFor(check, { timeout: 5000 });

export async function itemPreview(text: string): Promise<HTMLElement> {
  // The item text also renders in the details section; poll until the
  // overview preview that owns the row actions exists.
  return pollUntil(() => {
    const preview =
      screen
        .queryAllByText(text)
        .map((element) =>
          element.closest<HTMLElement>("[data-overview-item-preview]"),
        )
        .find((element) => element !== null) ?? null;
    if (!preview) throw new Error(`Expected an item preview for "${text}"`);
    return preview;
  });
}

export async function openMoveMenu(
  text: string,
  destination: "this week" | "next week",
) {
  // The week move is a direct row button.
  const preview = await itemPreview(text);
  return within(preview).findByRole("button", {
    name: `Move ${text} to ${destination === "this week" ? "current week" : "next week"}`,
  });
}

export async function chooseMove(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
  destination: "this week" | "next week",
) {
  await user.click(await openMoveMenu(text, destination));
}

export function echoSaveDraft() {
  return vi.fn((input: unknown, current: ReportSectionReadModel) => {
    const draft = input as {
      readonly version: number;
      readonly items: ReportSectionReadModel["items"];
    };
    return Promise.resolve({
      ...current,
      version: draft.version + 1,
      items: draft.items,
    });
  });
}

// A week move on an item without a saved plan applies at once in both
// directions: no editor, one autosave. The 5 s debounce is advanced instead of
// waited out; the confirmation toast carries the same Undo action as every
// other direct move.
export async function chooseDirectMove(
  text: string,
  destination: "this week" | "next week",
  saveDraft: ReturnType<typeof echoSaveDraft>,
) {
  const moveItem = await openMoveMenu(text, destination);
  vi.useFakeTimers();
  try {
    fireEvent.click(moveItem);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(
      screen.queryByRole("form", { name: /week update for/ }),
    ).not.toBeInTheDocument();
    const moveToast = vi.mocked(toast.success).mock.calls.at(-1);
    expect(moveToast?.[0]).toBe(
      destination === "next week" ? "Moved to next week" : "Moved to this week",
    );
    const toastOptions = moveToast?.[1] as
      | {
          readonly duration?: number;
          readonly action?: { readonly label: ReactNode };
        }
      | undefined;
    expect(toastOptions?.duration).toBe(8000);
    expect(toastOptions?.action?.label).toBe("Undo");
    expect(saveDraft).not.toHaveBeenCalled();
    const focused = document.activeElement;
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(saveDraft).toHaveBeenCalledOnce();
    return {
      focused,
      saved: (
        saveDraft.mock.calls[0]?.[0] as {
          readonly items: ReportSectionReadModel["items"];
        }
      ).items,
    };
  } finally {
    vi.useRealTimers();
  }
}

// The item title opens the inline text editor; the canonical editor is
// reached through the row's Edit details (pencil) button.
export async function openItemEditor(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  const preview = await itemPreview(text);
  await user.click(
    await within(preview).findByRole("button", {
      name: `Edit details: ${text}`,
    }),
  );
}

export async function chooseUpdateProgress(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await openItemEditor(user, text);
}
