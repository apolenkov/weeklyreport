import type {
  ItemOutcomeResult,
  LeadOpenWorkHistoryOccurrence,
  ReportSectionReadModel,
} from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";
import { OverviewInputProvider } from "./overview-input-provider";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000002";
const STAGE_ID = "a0000000-0000-4000-8000-000000000003";
const SECOND_PROJECT_ID = "a0000000-0000-4000-8000-000000000004";
const SECOND_STAGE_ID = "a0000000-0000-4000-8000-000000000005";
const ACTIVITY_ID = "a0000000-0000-4000-8000-000000000006";
const PREDECESSOR_REPORT_ID = "a0000000-0000-4000-8000-000000000007";

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

function Wrapper({
  children,
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
  predecessorItem,
}: {
  readonly children: ReactNode;
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
  readonly predecessorItem?:
    ReportSectionReadModel["items"][number] | undefined;
}) {
  const section = makeReportSectionFixture({
    reportId: REPORT_ID,
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
        tag: "delivery",
        workflowStatus: currentWorkflowStatus,
        pausedReason:
          currentWorkflowStatus === "paused" ? "Waiting for access" : null,
        carriedOver: currentCarriedOver,
        nextStepText: legacyNextText ?? null,
        stageNames: ["Development"],
      },
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
    {
      path: ["leadForm", "statusOverview"],
      query: () => {
        if (failOverview?.()) throw new Error("Overview refresh failed");
        return {
          current: {
            reportId: REPORT_ID,
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
      query: () => ({
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
const pollUntil = <T,>(check: () => T | Promise<T>) =>
  vi.waitFor(check, { timeout: 5000 });

async function itemPreview(text: string): Promise<HTMLElement> {
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

async function chooseMove(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
  destination: "this week" | "next week",
) {
  const preview = await itemPreview(text);
  await user.click(await within(preview).findByText("More actions"));
  await user.click(
    await within(preview).findByRole("button", {
      name: `Move ${text} to ${destination}`,
    }),
  );
}

async function chooseUpdateProgress(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.click(
    await screen.findByRole("button", { name: `Update progress for ${text}` }),
  );
}

describe("LeadForm Overview", () => {
  it("plans an authoritative prior-only lineage through the canonical item editor", async () => {
    const user = userEvent.setup();
    const stableId = "a0000000-0000-4000-8000-000000000030";
    const predecessorItem: ReportSectionReadModel["items"][number] = {
      id: "a0000000-0000-4000-8000-000000000031",
      stableId,
      projectId: PROJECT_ID,
      activityId: null,
      type: "next",
      text: "Authoritative prior plan",
      tag: "delivery",
      workflowStatus: "paused",
      pausedReason: "Waiting for approval",
      carriedOver: false,
      priorityRank: 4,
      stageNames: ["Development"],
    };
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items,
        });
      },
    );
    render(
      <Wrapper predecessorItem={predecessorItem} saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", { name: /^Plan this work/ }),
    );
    expect(
      screen.getByRole("form", {
        name: "Current week update for Payments",
      }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("form", {
        name: "Current week update for Payments",
      }),
    ).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Current week" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Next week" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Authoritative prior plan",
    );
    expect(screen.getByRole("button", { name: /Paused/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/Pause reason/)).toHaveValue(
      "Waiting for approval",
    );
    expect(screen.getAllByText("Authoritative prior plan")).toHaveLength(2);
    expect(saveDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "Next week" }));
    await user.click(screen.getByRole("button", { name: "Save update" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    const occurrences = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items.filter((candidate) => candidate.stableId === stableId);
    expect(occurrences[0]?.id).not.toBe(predecessorItem.id);
    expect(occurrences).toEqual([
      expect.objectContaining({
        stableId,
        type: "next",
        text: "Authoritative prior plan",
        workflowStatus: "paused",
        pausedReason: "Waiting for approval",
        priorityRank: 4,
        tag: "delivery",
        projectId: PROJECT_ID,
        stageNames: ["Development"],
      }),
    ]);
    expect(screen.getAllByText("Authoritative prior plan")).toHaveLength(2);
  });

  it("cancels prior planning without a write and returns focus to Plan this work", async () => {
    const user = userEvent.setup();
    const predecessorItem: ReportSectionReadModel["items"][number] = {
      id: "a0000000-0000-4000-8000-000000000032",
      stableId: "a0000000-0000-4000-8000-000000000033",
      projectId: PROJECT_ID,
      activityId: null,
      type: "next",
      text: "Cancel this prior plan",
      tag: "delivery",
      workflowStatus: "planned",
      carriedOver: false,
      stageNames: ["Development"],
    };
    const saveDraft = vi.fn();
    render(
      <Wrapper predecessorItem={predecessorItem} saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const plan = await screen.findByRole("button", { name: /^Plan this work/ });
    await user.click(plan);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(saveDraft).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: /^Plan this work/ }),
    ).toHaveFocus();
    expect(screen.getByText("Cancel this prior plan")).toBeInTheDocument();
  });

  it("keeps an authoritative prior-only row informational with only replanning", async () => {
    const predecessorItem: ReportSectionReadModel["items"][number] = {
      id: "a0000000-0000-4000-8000-000000000034",
      stableId: "a0000000-0000-4000-8000-000000000035",
      projectId: PROJECT_ID,
      activityId: null,
      type: "next",
      text: "Resolve this prior plan",
      tag: "delivery",
      workflowStatus: "planned",
      carriedOver: false,
      stageNames: ["Development"],
    };
    render(
      <Wrapper predecessorItem={predecessorItem}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await screen.findByText("Resolve this prior plan");
    const preview = await itemPreview("Resolve this prior plan");
    // Previously planned stays read-only: no progress, edit, move, or
    // outcome controls on the row — only explicit replanning.
    expect(
      within(preview).getByRole("button", { name: /^Plan this work/ }),
    ).toBeVisible();
    expect(
      within(preview).queryByRole("button", { name: /Update progress/ }),
    ).toBeNull();
    expect(
      within(preview).queryByRole("button", { name: /Update status/ }),
    ).toBeNull();
    expect(within(preview).queryByText("More actions")).toBeNull();
    expect(
      within(preview).queryByRole("button", { name: /Move .* week/ }),
    ).toBeNull();
  });

  it("replans historical open work through immutable prior lineage", async () => {
    const user = userEvent.setup();
    const sourceReportId = "a0000000-0000-4000-8000-000000000020";
    const sourceRecordId = "a0000000-0000-4000-8000-000000000021";
    const stableId = "a0000000-0000-4000-8000-000000000022";
    const openWork: LeadOpenWorkHistoryOccurrence = {
      source: "published",
      reportId: sourceReportId,
      reportSectionId: "a0000000-0000-4000-8000-000000000023",
      periodStart: new Date("2026-07-06T00:00:00.000Z"),
      periodEnd: new Date("2026-07-12T00:00:00.000Z"),
      parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
      item: {
        id: sourceRecordId,
        stableId,
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Deferred provider rollout",
        tag: "delivery",
        workflowStatus: "postponed",
        carriedOver: false,
        pausedReason: null,
        stageNames: ["Development"],
      },
    };
    const resolvePlan = vi.fn(
      (_input: unknown, section: ReportSectionReadModel) =>
        Promise.resolve({
          section: {
            ...section,
            version: section.version + 1,
            items: [
              ...section.items,
              {
                ...openWork.item,
                id: "a0000000-0000-4000-8000-000000000024",
                workflowStatus: "planned" as const,
              },
            ],
          },
          stableId,
          replayed: false,
        }),
    );
    render(
      <Wrapper openWork={[openWork]} resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Replan deferred work" }),
    );
    const composer = screen.getByRole("form", { name: "Resolve plan" });
    expect(
      within(composer).getByRole("button", { name: "Plan next" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      within(composer).getByRole("button", { name: "Save outcome" }),
    );

    await pollUntil(() => expect(resolvePlan).toHaveBeenCalledTimes(1));
    expect(resolvePlan.mock.calls[0]?.[0]).toMatchObject({
      source: {
        kind: "prior",
        reportId: sourceReportId,
        recordId: sourceRecordId,
      },
      outcome: "plan_next",
      text: "Deferred provider rollout",
    });
    await pollUntil(() =>
      expect(
        screen.queryByRole("button", { name: "Replan deferred work" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("marks active work done through the canonical progress editor", async () => {
    const user = userEvent.setup();
    const resolvePlan = vi.fn();
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items,
        });
      },
    );
    render(
      <Wrapper resolvePlan={resolvePlan} saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await chooseUpdateProgress(user, "Next work");
    const editor = screen.getByRole("form", {
      name: "Next week update for Payments",
    });
    expect(
      within(editor).getByRole("textbox", { name: /Description/ }),
    ).toHaveValue("Next work");
    await user.click(within(editor).getByRole("button", { name: "Done" }));
    await user.click(
      within(editor).getByRole("button", { name: "Save update" }),
    );
    await pollUntil(() =>
      expect(
        screen.queryByRole("form", { name: "Next week update for Payments" }),
      ).not.toBeInTheDocument(),
    );
    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    expect(resolvePlan).not.toHaveBeenCalled();
    const done = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items.find((item) => item.text === "Next work");
    expect(done).toMatchObject({ type: "next", workflowStatus: "done" });
    // A terminal item no longer offers the progress primary.
    expect(
      screen.queryByRole("button", { name: "Update progress for Next work" }),
    ).toBeNull();
    // The metadata line renders an icon per fact, so the progress and stage
    // labels are separate nodes rather than one "Done · Development" string.
    const preview = await itemPreview("Next work");
    expect(preview).toHaveTextContent("Done");
    expect(preview).toHaveTextContent("Development");
  });

  it("reaches the terminal outcome composer through More actions for a committed Current item", async () => {
    const user = userEvent.setup();
    const resolvePlan = vi.fn();
    render(
      <Wrapper legacyNextText="Continue next week" resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const preview = await itemPreview("Current work");
    await user.click(
      await within(preview).findByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    const editor = await screen.findByRole("form", {
      name: "Current week update for Payments",
    });
    // A hidden legacy next-step commitment blocks Completed in the editor and
    // points at More actions → Update status.
    await user.click(within(editor).getByRole("button", { name: "Done" }));
    await user.click(
      within(editor).getByRole("button", { name: "Save update" }),
    );
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "More actions → Update status",
    );
    await user.click(within(editor).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    const settled = await itemPreview("Current work");
    await user.click(await within(settled).findByText("More actions"));
    await user.click(
      await within(settled).findByRole("button", {
        name: "Update status: Current work",
      }),
    );
    const composer = await screen.findByRole("form", { name: "Resolve plan" });
    await user.click(
      within(composer).getByRole("button", { name: "Won't do" }),
    );
    await user.type(
      within(composer).getByRole("textbox"),
      "The dependency was retired",
    );
    await user.click(
      within(composer).getByRole("button", { name: "Save outcome" }),
    );
    await pollUntil(() => expect(resolvePlan).toHaveBeenCalledOnce());
    expect(resolvePlan.mock.calls[0]?.[0]).toMatchObject({
      outcome: "wont_do",
      reason: "The dependency was retired",
    });
  });

  it("retains a failed outcome and retries the same command without losing its reason", async () => {
    const user = userEvent.setup();
    const sourceReportId = "a0000000-0000-4000-8000-000000000020";
    const sourceRecordId = "a0000000-0000-4000-8000-000000000021";
    const openWork: LeadOpenWorkHistoryOccurrence = {
      source: "published",
      reportId: sourceReportId,
      reportSectionId: "a0000000-0000-4000-8000-000000000023",
      periodStart: new Date("2026-07-06T00:00:00.000Z"),
      periodEnd: new Date("2026-07-12T00:00:00Z"),
      parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
      item: {
        id: sourceRecordId,
        stableId: "a0000000-0000-4000-8000-000000000022",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Deferred provider rollout",
        tag: "delivery",
        workflowStatus: "postponed",
        carriedOver: false,
        pausedReason: null,
        stageNames: ["Development"],
      },
    };
    const resolvePlan = vi
      .fn<
        (input: unknown, section: ReportSectionReadModel) => Promise<unknown>
      >()
      .mockRejectedValue(new Error("Network unavailable"));
    render(
      <Wrapper openWork={[openWork]} resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Replan deferred work" }),
    );
    const form = screen.getByRole("form", { name: "Resolve plan" });
    await user.click(within(form).getByRole("button", { name: "Won't do" }));
    const reason = within(form).getByRole("textbox");
    await user.type(reason, "The dependency was retired");
    await user.click(
      within(form).getByRole("button", { name: "Save outcome" }),
    );
    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
    expect(reason).toHaveValue("The dependency was retired");
    await user.click(
      within(form).getByRole("button", { name: "Save outcome" }),
    );
    await pollUntil(() => expect(resolvePlan).toHaveBeenCalledTimes(2));
    expect(resolvePlan.mock.calls[1]?.[0]).toEqual(
      resolvePlan.mock.calls[0]?.[0],
    );
    expect(resolvePlan.mock.calls[0]?.[0]).toMatchObject({
      outcome: "wont_do",
      reason: "The dependency was retired",
    });
  });

  it("keeps the open composer mounted when an overview refresh fails", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const failOverview = vi.fn(() => false);
    render(
      <Wrapper client={client} failOverview={failOverview}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    const text = screen.getByRole("textbox", { name: /Description/ });
    await user.clear(text);
    await user.type(text, "Keep my work during a network error");
    failOverview.mockReturnValue(true);
    await act(async () => {
      await client.refetchQueries({
        queryKey: [["leadForm", "statusOverview"]],
      });
    });
    expect(
      await screen.findByText(
        "Overview could not refresh. Showing the last loaded overview.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Description/ })).toBe(text);
    expect(text).toHaveValue("Keep my work during a network error");
    failOverview.mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Retry overview" }));
    expect(text).toHaveValue("Keep my work during a network error");
  });

  it.each(["replacement", "removal", "conflict", "read-only"] as const)(
    "preserves unsaved input without writing over a %s",
    async (change) => {
      const user = userEvent.setup();
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <Wrapper client={client}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );
      await user.click(
        await screen.findByRole("button", {
          name: "Update progress for Current work",
        }),
      );
      const text = screen.getByRole("textbox", { name: /Description/ });
      await user.clear(text);
      await user.type(text, "My unsaved result");
      const queryKey = [["leadForm", "byPeriod"]];
      const loaded = client.getQueryData<{ section: ReportSectionReadModel }>(
        queryKey,
      );
      if (!loaded) throw new Error("Expected a loaded section");
      const replacement = {
        ...loaded,
        readOnly: change === "read-only",
        section: {
          ...loaded.section,
          version: loaded.section.version + 1,
          reportSectionId:
            change === "replacement"
              ? "a0000000-0000-4000-8000-000000000099"
              : loaded.section.reportSectionId,
          items:
            change === "removal"
              ? []
              : loaded.section.items.map((item) => ({
                  ...item,
                  text:
                    change === "conflict" ? "Another saved update" : item.text,
                })),
        },
      };
      act(() => {
        client.setQueryData(queryKey, replacement);
      });
      const recovery = within(
        await screen.findByRole("region", { name: "Unsaved update recovery" }),
      );
      expect(
        recovery.getByRole("textbox", { name: /Description/ }),
      ).toHaveValue("My unsaved result");
      expect(recovery.queryByRole("textbox", { name: /Next step/ })).toBeNull();
      expect(
        recovery.getByRole("button", { name: "Save update" }),
      ).toBeDisabled();
      fireEvent.keyDown(
        recovery.getByRole("textbox", { name: /Description/ }),
        { key: "Enter", ctrlKey: true },
      );
      expect(client.getQueryData(queryKey)).toEqual(replacement);
      expect(
        recovery.getByRole("textbox", { name: /Description/ }),
      ).toHaveValue("My unsaved result");
      await user.click(recovery.getByRole("button", { name: "Cancel" }));
      expect(
        screen.queryByRole("region", { name: "Unsaved update recovery" }),
      ).not.toBeInTheDocument();
    },
  );

  it("retains the submitted inline value when the save coordinator refetches after a conflict", async () => {
    const user = userEvent.setup();
    const conflict = new TRPCClientError("stale version");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });
    const saveDraft = vi.fn(
      (_input: unknown, current: ReportSectionReadModel) => {
        Object.defineProperty(conflict, "serverSection", {
          configurable: true,
          value: {
            ...current,
            version: current.version + 1,
            items: current.items.map((item) =>
              item.text === "Current work"
                ? { ...item, text: "Saved in the other tab" }
                : item,
            ),
          },
        });
        return Promise.reject(conflict);
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    const description = screen.getByRole("textbox", { name: /Description/ });
    await user.clear(description);
    await user.type(description, "Keep my submitted update");
    await user.click(screen.getByRole("button", { name: "Save update" }));

    const recovery = within(
      await screen.findByRole("region", { name: "Unsaved update recovery" }),
    );
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(recovery.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Keep my submitted update",
    );
    expect(
      recovery.getByRole("button", { name: "Save update" }),
    ).toBeDisabled();
    expect(screen.getByText("Saved in the other tab")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).not.toHaveTextContent("Draft saved");
  });

  it.each([false, true])(
    "retries a failed inline save and keeps a later edit=%s",
    async (editAfterFailure) => {
      const user = userEvent.setup();
      let attempt = 0;
      const saveDraft = vi.fn(
        (input: unknown, current: ReportSectionReadModel) => {
          attempt += 1;
          if (attempt === 1)
            return Promise.reject(new Error("network unavailable"));
          const draft = input as {
            readonly version: number;
            readonly items: ReportSectionReadModel["items"];
          };
          return Promise.resolve({
            ...current,
            version: draft.version + 1,
            items: draft.items,
          });
        },
      );
      render(
        <Wrapper saveDraft={saveDraft}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );
      await user.click(
        await screen.findByRole("button", {
          name: "Update progress for Current work",
        }),
      );
      const description = screen.getByRole("textbox", { name: /Description/ });
      await user.clear(description);
      await user.type(description, "Retained retry value");
      await user.click(screen.getByRole("button", { name: "Save update" }));
      expect(
        await screen.findByText(
          "Save failed. Your update is still here; try saving again.",
        ),
      ).toBeInTheDocument();
      if (editAfterFailure) {
        const retainedDescription = screen.getByRole("textbox", {
          name: /Description/,
        });
        await user.type(retainedDescription, " plus correction");
        expect(retainedDescription).toHaveValue(
          "Retained retry value plus correction",
        );
      }
      await user.click(screen.getByRole("button", { name: "Save update" }));

      await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(2));

      const expected = editAfterFailure
        ? "Retained retry value plus correction"
        : "Retained retry value";
      expect(
        (
          saveDraft.mock.calls[1]?.[0] as {
            items: readonly { text: string }[];
          }
        ).items.map((item) => item.text),
      ).toContain(expected);
      expect(
        await screen.findByRole("button", {
          name: `Update progress for ${expected}`,
        }),
      ).toBeInTheDocument();
    },
  );
  it("uses the overview query and exposes the shared authoring chrome", async () => {
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    expect(await screen.findByTestId("status-overview")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("status-overview")).getByText("Payments"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Report$/ })).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}`,
    );
    expect(screen.queryByRole("link", { name: /^Edit$/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}?mode=slides`,
    );
    expect(
      screen.getByRole("link", { name: "Risks & decisions" }),
    ).toHaveAttribute("href", "#report-details");
    expect(screen.queryByTestId("lead-report-form")).toBeNull();
    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(documentActions).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit" })).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeVisible();
  });

  it("guards unsaved Activity weekly fields until they are cancelled", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <Wrapper withActivity>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const title = await screen.findByTestId(`activity-title-${ACTIVITY_ID}`);
    await user.type(title, "Unsaved weekly title");

    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).toHaveTextContent("Unsaved update");
    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    await user.click(screen.getByRole("link", { name: "Slides" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(title).toHaveValue("Unsaved weekly title");

    await user.click(
      screen.getByTestId(`activity-fields-cancel-${ACTIVITY_ID}`),
    );
    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).toHaveTextContent("Draft saved");
    expect(
      screen.getByRole("button", { name: "Submit" }).closest("fieldset"),
    ).not.toHaveAttribute("disabled");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it.each([
    ["Current work", "Updated current work"],
    ["Next work", "Updated next work"],
  ])(
    "edits %s inline through the existing live draft",
    async (initial, updated) => {
      const user = userEvent.setup();
      render(
        <Wrapper>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );

      await user.click(
        await screen.findByRole("button", {
          name: `Update progress for ${initial}`,
        }),
      );
      expect(screen.queryByTestId("lead-submit-readiness")).toBeNull();
      expect(
        screen.getByText(
          "Save or cancel the open update before submitting the report.",
        ),
      ).toBeVisible();
      const description = screen.getByLabelText(/Description \*/i);
      await user.clear(description);
      await user.type(description, updated);
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Save update" }));

      expect(await screen.findByText(updated)).toBeInTheDocument();
      expect(
        await screen.findByRole("button", {
          name: `Update progress for ${updated}`,
        }),
      ).toHaveFocus();
      expect(await screen.findByTestId("lead-submit-readiness")).toBeVisible();
      expect(
        screen.queryByText(
          "Save or cancel the open update before submitting the report.",
        ),
      ).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        within(screen.getByTestId("status-overview")).getByRole("status"),
      ).toHaveTextContent(/Draft changes pending|Saving draft|Draft saved/);
    },
  );

  it("opens quick-create with the selected product and saves through the live draft", async () => {
    const user = userEvent.setup();
    const serverItemId = "a0000000-0000-4000-8000-000000000020";
    const serverStableId = "a0000000-0000-4000-8000-000000000021";
    const savedResponses: ReportSectionReadModel[] = [];
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        const savedResponse = {
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? { ...item, id: serverItemId, stableId: serverStableId }
              : item,
          ),
        };
        savedResponses.push(savedResponse);
        return Promise.resolve(savedResponse);
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Add item to Payments",
      }),
    );

    expect(
      screen.getByRole("form", { name: "Current week update for Payments" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).toHaveTextContent("Unsaved update");
    expect(screen.queryByText("Autosaved")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByLabelText("Product")).toHaveValue(
      `product:${PROJECT_ID}`,
    );

    const description = screen.getByLabelText(/Description \*/i);
    // Deliberately duplicate the existing row's complete authored fields. A
    // text/content lookup cannot distinguish the acknowledgement; only the
    // server stableId introduced for this attempt can.
    await user.type(description, "Current work");
    await user.click(screen.getByRole("button", { name: "Save update" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await pollUntil(() =>
      expect(
        screen.queryByRole("form", {
          name: "Current week update for Payments",
        }),
      ).not.toBeInTheDocument(),
    );
    const submittedItems = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items;
    const submittedItemsWithoutStableIdentity = submittedItems.filter(
      (item) => item.stableId === undefined,
    );
    expect(submittedItemsWithoutStableIdentity).toHaveLength(1);
    expect(submittedItemsWithoutStableIdentity[0]?.id).not.toBe(serverItemId);
    expect(
      savedResponses[0]?.items.filter(
        (item) => item.stableId === serverStableId,
      ),
    ).toEqual([
      expect.objectContaining({ id: serverItemId, stableId: serverStableId }),
    ]);
    expect(
      screen.getAllByRole("button", {
        name: "Update progress for Current work",
      }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("region", { name: "Unsaved update recovery" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).toHaveTextContent(/Draft changes pending|Saving draft|Draft saved/);
    expect(
      screen.getByRole("button", {
        name: "Add item to Payments",
      }),
    ).toHaveFocus();
  });

  it("returns focus and restores report actions when an inline edit is cancelled", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    await user.type(screen.getByLabelText(/Description \*/i), " unsaved");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(
      screen.getByRole("button", { name: "Update progress for Current work" }),
    ).toHaveFocus();
    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).toHaveTextContent("Draft saved");
  });

  it("accepts a saved parent change as the new editor baseline", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    // "Edit details" is also the row's menu label; scope to the editor form.
    const editor = screen.getByRole("form", {
      name: "Current week update for Payments",
    });
    await user.click(within(editor).getByText("Edit details"));
    await user.selectOptions(
      screen.getByLabelText("Product"),
      `product:${SECOND_PROJECT_ID}`,
    );
    await user.click(screen.getByRole("button", { name: "Save update" }));

    await pollUntil(() =>
      expect(
        screen.queryByRole("form", {
          name: "Current week update for Analytics",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("region", { name: "Unsaved update recovery" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update progress for Current work" }),
    ).toHaveFocus();
  });

  it("retries a failed parent-change save against the submitted parent", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(new Error("network failure"));
        const request = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: request.version + 1,
          items: request.items,
        });
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    const editor = screen.getByRole("form", {
      name: "Current week update for Payments",
    });
    await user.click(within(editor).getByText("Edit details"));
    await user.selectOptions(
      screen.getByLabelText("Product"),
      `product:${SECOND_PROJECT_ID}`,
    );
    await user.click(screen.getByRole("button", { name: "Save update" }));

    expect(
      await screen.findByText(
        "Save failed. Your update is still here; try saving again.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Unsaved update recovery" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Current week update for Analytics" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save update" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(2));
    await pollUntil(() =>
      expect(
        screen.queryByRole("form", {
          name: "Current week update for Analytics",
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("moves an item through the canonical editor without writing before Save", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items,
        });
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await chooseMove(user, "Current work", "next week");
    expect(screen.getByRole("radio", { name: "Next week" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Current work",
    );
    expect(screen.queryByRole("textbox", { name: /Next step/ })).toBeNull();
    expect(saveDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save update" }));
    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    const moved = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items.find((item) => item.text === "Current work");
    expect(moved).toMatchObject({
      type: "next",
      text: "Current work",
      workflowStatus: "in_progress",
      carriedOver: false,
    });
  });

  it("returns focus to a visible same-item control after cancelling a Move", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const preview = await itemPreview("Current work");
    await user.click(await within(preview).findByText("More actions"));
    const opener = await within(preview).findByRole("button", {
      name: "Move Current work to next week",
    });
    expect(opener).toHaveAttribute(
      "data-overview-focus",
      "move:current:a0000000-0000-4000-8000-000000000011",
    );
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(saveDraft).not.toHaveBeenCalled();
    // The Move origin sits inside the closed disclosure, so focus falls back
    // by stable identity to the item's first visible control.
    const settled = await itemPreview("Current work");
    expect(
      within(settled).getByRole("button", { name: "Edit item: Current work" }),
    ).toHaveFocus();
    expect(document.activeElement?.closest("details:not([open])")).toBeNull();
  });

  it("returns focus to Update progress after cancelling the editor", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    const resolvePlan = vi.fn(() => Promise.resolve({}));
    render(
      <Wrapper saveDraft={saveDraft} resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const opener = await screen.findByRole("button", {
      name: "Update progress for Next work",
    });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(saveDraft).not.toHaveBeenCalled();
    expect(resolvePlan).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", {
        name: "Update progress for Next work",
      }),
    ).toHaveFocus();
  });

  it("confirms carried work through the canonical editor save without field changes", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items,
        });
      },
    );
    render(
      <Wrapper currentCarriedOver saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const progress = await screen.findByRole("button", {
      name: "Update progress for Current work",
    });
    // The submit-readiness deep link still resolves to this control.
    expect(progress).toHaveAttribute(
      "data-overview-focus",
      "confirm:current:a0000000-0000-4000-8000-000000000011",
    );
    expect(screen.getByText("Continued · not updated this week")).toBeVisible();
    await user.click(progress);
    const editor = screen.getByRole("form", {
      name: "Current week update for Payments",
    });
    expect(
      within(editor).getByRole("textbox", { name: /Description/ }),
    ).toHaveValue("Current work");

    // Saving with no field change still clears the carriedOver marker via the
    // existing confirmation patch on the normal draft save path.
    await user.click(
      within(editor).getByRole("button", { name: "Save update" }),
    );
    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    const saved = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items.find((item) => item.text === "Current work");
    expect(saved).toMatchObject({ carriedOver: false });
    await pollUntil(() =>
      expect(
        screen.queryByText("Continued · not updated this week"),
      ).toBeNull(),
    );
    // The confirm anchor is gone after the marker clears; focus return falls
    // back to the same row's first control through the existing plumbing.
    expect(
      await screen.findByRole("button", { name: "Edit item: Current work" }),
    ).toHaveFocus();
  });

  it("clears the carried marker alongside edited fields on the same save", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items,
        });
      },
    );
    render(
      <Wrapper
        currentCarriedOver
        currentWorkflowStatus="planned"
        saveDraft={saveDraft}
      >
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    expect(
      await screen.findByText("Planned · not updated this week"),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: "Update progress for Current work",
      }),
    );
    await user.click(screen.getByRole("button", { name: "In progress" }));
    await user.click(screen.getByRole("button", { name: "Save update" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    const saved = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items.find((item) => item.text === "Current work");
    expect(saved).toMatchObject({
      carriedOver: false,
      workflowStatus: "in_progress",
    });
  });

  it("keeps carried work unconfirmed when the editor is cancelled", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper currentCarriedOver saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const progress = await screen.findByRole("button", {
      name: "Update progress for Current work",
    });
    await user.click(progress);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(saveDraft).not.toHaveBeenCalled();
    // The marker is untouched, so the carried copy and confirm anchor remain.
    expect(screen.getByText("Continued · not updated this week")).toBeVisible();
    expect(
      await screen.findByRole("button", {
        name: "Update progress for Current work",
      }),
    ).toHaveFocus();
  });

  it("opens a legacy derived Next item in the canonical editor before promotion", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper legacyNextText="Legacy next-week plan" saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await chooseMove(user, "Legacy next-week plan", "this week");
    expect(
      screen.getByRole("form", { name: "Current week update for Payments" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Legacy next-week plan",
    );
    expect(screen.getByRole("textbox", { name: /Description/ })).toBeDisabled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("keeps a legacy next-week commitment linked to its Current result", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const saveDraft = vi.fn();
    const promotePlan = vi.fn(
      (_input: unknown, current: ReportSectionReadModel) => {
        const source = current.items.find(
          (item) => item.text === "Current work",
        );
        if (!source?.stableId || !source.nextStepText)
          throw new Error("Expected a linked next-week commitment");
        const occurredAt = "2026-09-14T18:45:00.000Z";
        const moved = {
          ...source,
          type: "next" as const,
          text: source.nextStepText,
          nextStepText: null,
          carriedOver: false,
          outcomeHistory: [
            ...(source.outcomeHistory ?? []),
            {
              id: "a0000000-0000-4000-8000-000000000030",
              stableId: source.stableId,
              outcome: "plan_next" as const,
              reason: null,
              actorId: current.authorId,
              actorName: current.authorName,
              occurredAt,
              beforeState: {
                type: source.type,
                workflowStatus: source.workflowStatus,
                pausedReason: source.pausedReason ?? null,
                nextStepText: source.nextStepText,
                text: source.text,
              },
              afterState: {
                type: "next" as const,
                workflowStatus: source.workflowStatus,
                pausedReason: source.pausedReason ?? null,
                nextStepText: null,
                text: source.nextStepText,
              },
              reversesEventId: null,
            },
          ],
        };
        return Promise.resolve({
          section: {
            ...current,
            version: current.version + 1,
            items: current.items.map((item) =>
              item.id === source.id ? moved : item,
            ),
          },
          stableId: source.stableId,
          replayed: false,
        });
      },
    );
    render(
      <Wrapper
        client={client}
        legacyNextText="Legacy next-week plan"
        promotePlan={promotePlan}
        saveDraft={saveDraft}
      >
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await chooseMove(user, "Current work", "next week");
    expect(
      screen.getByRole("form", { name: "Next week update for Payments" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Legacy next-week plan",
    );
    expect(screen.getByRole("textbox", { name: /Description/ })).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: /Next step/ })).toBeNull();
    expect(promotePlan).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save update" }));

    await pollUntil(() => expect(promotePlan).toHaveBeenCalledOnce());
    expect(promotePlan.mock.calls[0]?.[0]).toMatchObject({ target: "next" });
    expect(saveDraft).not.toHaveBeenCalled();
    await pollUntil(() =>
      expect(
        screen.queryByRole("form", { name: "Next week update for Payments" }),
      ).not.toBeInTheDocument(),
    );

    await act(async () => {
      await client.refetchQueries({
        queryKey: [["leadForm", "statusOverview"]],
      });
    });
    expect(
      await screen.findByRole("button", {
        name: "Update progress for Legacy next-week plan",
      }),
    ).toBeInTheDocument();
    const preview = screen
      .getByRole("button", {
        name: "Update progress for Legacy next-week plan",
      })
      .closest("[data-overview-item-preview]");
    expect(preview).toHaveTextContent("In progress");
    await user.click(screen.getByText("History"));
    expect(screen.getByText(/Moved to next week by Test Lead/)).toBeVisible();
    expect(screen.getByText(/Previous: Current work/)).toBeVisible();
  });

  it.each([
    {
      initial: "Current work",
      target: "next" as const,
      destination: "next week" as const,
    },
    {
      initial: "Next work",
      target: "current" as const,
      destination: "this week" as const,
    },
  ])(
    "retries an edited $target move from the latest draft without a duplicate",
    async ({ initial, target, destination }) => {
      const user = userEvent.setup();
      let attempt = 0;
      const saveDraft = vi.fn(
        (input: unknown, current: ReportSectionReadModel) => {
          attempt += 1;
          if (attempt === 1)
            return Promise.reject(new Error("move network failure"));
          const request = input as {
            readonly version: number;
            readonly items: ReportSectionReadModel["items"];
          };
          return Promise.resolve({
            ...current,
            version: request.version + 1,
            items: request.items,
          });
        },
      );
      render(
        <Wrapper saveDraft={saveDraft}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );

      await chooseMove(user, initial, destination);
      await user.click(screen.getByRole("button", { name: "Save update" }));
      expect(
        await screen.findByText(
          "Save failed. Your update is still here; try saving again.",
        ),
      ).toBeVisible();
      const editedField = screen.getByRole("textbox", { name: /Description/ });
      await user.type(editedField, " after retry");
      await user.click(screen.getByRole("button", { name: "Save update" }));

      await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(2));
      const retryItems = (
        saveDraft.mock.calls[1]?.[0] as {
          readonly items: ReportSectionReadModel["items"];
        }
      ).items;
      const moved = retryItems.filter(
        (item) =>
          item.text === `${initial} after retry` && item.type === target,
      );
      expect(moved).toHaveLength(1);
      expect(
        retryItems.filter((item) => item.stableId === moved[0]?.stableId),
      ).toHaveLength(1);
    },
  );

  it.each([
    ["current", "next", "in_progress", "In progress"],
    ["next", "current", "in_progress", "In progress"],
    ["current", "next", "paused", "Paused"],
    ["next", "current", "paused", "Paused"],
    ["current", "next", "postponed", "Postponed"],
    ["next", "current", "postponed", "Postponed"],
  ] as const)(
    "keeps %s status %s selected while moving to %s",
    async (source, target, status, statusLabel) => {
      const user = userEvent.setup();
      const text = source === "current" ? "Current work" : "Next work";
      render(
        <Wrapper
          {...(source === "current"
            ? { currentWorkflowStatus: status }
            : { nextWorkflowStatus: status })}
        >
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );

      await chooseMove(
        user,
        text,
        target === "next" ? "next week" : "this week",
      );

      expect(screen.getByRole("button", { name: statusLabel })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    },
  );
});
