import type {
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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000002";
const STAGE_ID = "a0000000-0000-4000-8000-000000000003";

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
  saveDraft,
  openWork = [],
}: {
  readonly children: ReactNode;
  readonly client?: QueryClient;
  readonly failOverview?: () => boolean;
  readonly resolvePlan?: (
    input: unknown,
    section: ReportSectionReadModel,
  ) => Promise<unknown>;
  readonly saveDraft?: (
    input: unknown,
    current: ReportSectionReadModel,
  ) => Promise<ReportSectionReadModel>;
  readonly openWork?: readonly LeadOpenWorkHistoryOccurrence[];
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
    ],
    items: [
      {
        id: "a0000000-0000-4000-8000-000000000010",
        stableId: "a0000000-0000-4000-8000-000000000011",
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text: "Current work",
        tag: "delivery",
        workflowStatus: "in_progress",
        carriedOver: false,
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
        workflowStatus: "planned",
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
            availability: "unavailable",
            reason: "no_predecessor",
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
          <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
        </SessionContext.Provider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}

describe("LeadForm Overview", () => {
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

    await vi.waitFor(() => expect(resolvePlan).toHaveBeenCalledTimes(1));
    expect(resolvePlan.mock.calls[0]?.[0]).toMatchObject({
      source: {
        kind: "prior",
        reportId: sourceReportId,
        recordId: sourceRecordId,
      },
      outcome: "plan_next",
      text: "Deferred provider rollout",
    });
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Replan deferred work" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("adopts Done immediately and does not replace it with an older query echo", async () => {
    const user = userEvent.setup();
    const resolvePlan = vi.fn(
      (_input: unknown, section: ReportSectionReadModel) =>
        Promise.resolve({
          section: {
            ...section,
            version: section.version + 1,
            items: section.items.map((item) =>
              item.type === "next"
                ? { ...item, type: "current", workflowStatus: "done" }
                : item,
            ),
          },
          stableId: "a0000000-0000-4000-8000-000000000013",
          replayed: false,
        }),
    );
    render(
      <Wrapper resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Resolve plan: Next work" }),
    );
    await user.click(
      within(screen.getByRole("form", { name: "Resolve plan" })).getByRole(
        "button",
        { name: "Done" },
      ),
    );
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Resolve plan" }),
      ).not.toBeInTheDocument(),
    );
    expect(resolvePlan).toHaveBeenCalledTimes(1);
    expect(resolvePlan.mock.calls[0]?.[0]).toMatchObject({
      outcome: "done",
      text: "Next work",
    });
    expect(
      screen.getByRole("button", { name: "Resolve plan: Next work" }),
    ).toHaveAttribute(
      "data-overview-focus",
      "resolve:current:a0000000-0000-4000-8000-000000000013",
    );
    expect(screen.getByText(/^Done · Development/)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Edit Next work" }),
    ).toBeInTheDocument();
  });

  it("retains a failed outcome and retries the same command without losing its reason", async () => {
    const user = userEvent.setup();
    const resolvePlan = vi
      .fn<
        (input: unknown, section: ReportSectionReadModel) => Promise<unknown>
      >()
      .mockRejectedValue(new Error("Network unavailable"));
    render(
      <Wrapper resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Resolve plan: Next work" }),
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
    await vi.waitFor(() => expect(resolvePlan).toHaveBeenCalledTimes(2));
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
      await screen.findByRole("button", { name: "Edit Current work" }),
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
        await screen.findByRole("button", { name: "Edit Current work" }),
      );
      const text = screen.getByRole("textbox", { name: /Description/ });
      await user.clear(text);
      await user.type(text, "My unsaved result");
      await user.type(
        screen.getByRole("textbox", { name: /Next step/ }),
        "My unsaved plan",
      );
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
      expect(recovery.getByRole("textbox", { name: /Next step/ })).toHaveValue(
        "My unsaved plan",
      );
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

  it("keeps the current result while editing its linked next step", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit Current work" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /Next step/ }),
      "Test the delivered API",
    );
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(
      await screen.findByRole("button", { name: "Edit Current work" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next week" }));
    await user.click(
      screen.getByRole("button", { name: "Edit Test the delivered API" }),
    );
    expect(screen.getByRole("button", { name: "Next week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Current week" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Next step/ })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Current work",
    );
    await user.clear(screen.getByRole("textbox", { name: /Next step/ }));
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(
      await screen.findByRole("button", { name: "Edit Current work" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Edit Test the delivered API" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Current week" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Edit Current work" }),
    ).toHaveFocus();
  });

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
                ? { ...item, nextStepText: "Saved in the other tab" }
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
      await screen.findByRole("button", { name: "Edit Current work" }),
    );
    const nextStep = screen.getByRole("textbox", { name: /Next step/ });
    await user.type(nextStep, "Keep my submitted next step");
    await user.click(screen.getByRole("button", { name: "Save update" }));

    const recovery = within(
      await screen.findByRole("region", { name: "Unsaved update recovery" }),
    );
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(recovery.getByRole("textbox", { name: /Next step/ })).toHaveValue(
      "Keep my submitted next step",
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
        await screen.findByRole("button", { name: "Edit Current work" }),
      );
      const nextStep = screen.getByRole("textbox", { name: /Next step/ });
      await user.type(nextStep, "Retained retry value");
      await user.click(screen.getByRole("button", { name: "Save update" }));
      expect(
        await screen.findByText(
          "Save failed. Your update is still here; try saving again.",
        ),
      ).toBeInTheDocument();
      if (editAfterFailure) {
        const retainedNextStep = screen.getByRole("textbox", {
          name: /Next step/,
        });
        await user.type(retainedNextStep, " plus correction");
        expect(retainedNextStep).toHaveValue(
          "Retained retry value plus correction",
        );
      }
      await user.click(screen.getByRole("button", { name: "Save update" }));

      await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));

      const expected = editAfterFailure
        ? "Retained retry value plus correction"
        : "Retained retry value";
      expect(
        (
          saveDraft.mock.calls[1]?.[0] as {
            items: readonly { nextStepText?: string | null }[];
          }
        ).items.map((item) => item.nextStepText),
      ).toContain(expected);
      expect(
        await screen.findByRole("button", { name: `Edit ${expected}` }),
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
    expect(screen.getByRole("button", { name: "+ Add" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit" })).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeVisible();
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
        await screen.findByRole("button", { name: `Edit ${initial}` }),
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
        await screen.findByRole("button", { name: `Edit ${updated}` }),
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
        name: "Add current week update to Payments",
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
    expect(screen.getByRole("button", { name: "+ Add" })).toBeDisabled();
    expect(screen.getByLabelText("Product")).toHaveValue(
      `product:${PROJECT_ID}`,
    );

    const description = screen.getByLabelText(/Description \*/i);
    // Deliberately duplicate the existing row's complete authored fields. A
    // text/content lookup cannot distinguish the acknowledgement; only the
    // server stableId introduced for this attempt can.
    await user.type(description, "Current work");
    await user.click(screen.getByRole("button", { name: "Save update" }));

    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
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
      screen.getAllByRole("button", { name: "Edit Current work" }),
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
        name: "Add current week update to Payments",
      }),
    ).toHaveFocus();
  });

  it("waits for the queued create receipt and retries it without a duplicate", async () => {
    const user = userEvent.setup();
    interface SaveRequest {
      readonly version: number;
      readonly items: ReportSectionReadModel["items"];
    }
    const requests: SaveRequest[] = [];
    const firstSave = Promise.withResolvers<ReportSectionReadModel>();
    const queuedSave = Promise.withResolvers<ReportSectionReadModel>();
    let firstResponse!: ReportSectionReadModel;
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const request = input as SaveRequest;
        requests.push(request);
        if (requests.length === 1) {
          firstResponse = {
            ...current,
            version: request.version + 1,
            items: request.items.map((item) =>
              item.stableId
                ? item
                : {
                    ...item,
                    id: "a0000000-0000-4000-8000-000000000050",
                    stableId: "a0000000-0000-4000-8000-000000000051",
                  },
            ),
          };
          return firstSave.promise;
        }
        if (requests.length === 2) return queuedSave.promise;
        return Promise.resolve({
          ...current,
          version: request.version + 1,
          items: request.items.map((item) =>
            item.stableId
              ? item
              : {
                  ...item,
                  id: "a0000000-0000-4000-8000-000000000052",
                  stableId: "a0000000-0000-4000-8000-000000000053",
                },
          ),
        });
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(await screen.findByRole("button", { name: "+ Add" }));
    await user.click(screen.getByRole("button", { name: "Current week item" }));
    await user.type(screen.getByLabelText(/Description \*/i), "Parallel twins");
    await user.click(screen.getByRole("button", { name: "Save Item" }));
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledOnce(), {
      timeout: 10_000,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Add current week update to Payments",
      }),
    );
    await user.type(screen.getByLabelText(/Description \*/i), "Parallel twins");
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(saveDraft).toHaveBeenCalledOnce();
    await act(() => {
      firstSave.resolve(firstResponse);
      return Promise.resolve();
    });
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("form", {
        name: "Current week update for Payments",
      }),
    ).toBeInTheDocument();

    const queuedRequest = requests[1];
    if (!queuedRequest) throw new Error("Expected the queued save request");
    const queuedTemporaryTwins = queuedRequest.items.filter(
      (item) => item.text === "Parallel twins" && !item.stableId,
    );
    expect(queuedTemporaryTwins).toHaveLength(1);
    await act(() => {
      queuedSave.reject(new Error("Queued save deliberately failed"));
      return Promise.resolve();
    });
    expect(
      await screen.findByText(
        "Save failed. Your update is still here; try saving again.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText(/Description \*/i)).toHaveValue(
      "Parallel twins",
    );
    await user.type(screen.getByLabelText(/Description \*/i), " retry");
    expect(
      screen.queryByRole("region", { name: "Unsaved update recovery" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save update" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save update" }));
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(3));
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("form", {
          name: "Current week update for Payments",
        }),
      ).not.toBeInTheDocument(),
    );

    const retryRequest = requests[2];
    if (!retryRequest) throw new Error("Expected the retry save request");
    const retryTemporaryTwins = retryRequest.items.filter(
      (item) => !item.stableId,
    );
    expect(retryTemporaryTwins).toHaveLength(1);
    expect(retryTemporaryTwins[0]?.id).toBe(queuedTemporaryTwins[0]?.id);
    expect(retryTemporaryTwins[0]?.text).toBe("Parallel twins retry");
    expect(
      screen.getByRole("button", { name: "Edit Parallel twins" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit Parallel twins retry" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Unsaved update recovery" }),
    ).not.toBeInTheDocument();
  }, 20_000);

  it("returns focus and restores report actions when an inline edit is cancelled", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Edit Current work" }),
    );
    await user.type(screen.getByLabelText(/Description \*/i), " unsaved");
    expect(screen.getByRole("button", { name: "+ Add" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Edit Current work" }),
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "+ Add" })).toBeEnabled();
    expect(
      within(screen.getByTestId("status-overview")).getByRole("status"),
    ).toHaveTextContent("Draft saved");
  });
});
