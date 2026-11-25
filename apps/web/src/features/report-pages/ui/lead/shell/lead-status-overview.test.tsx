import { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import type {
  LeadOpenWorkHistoryOccurrence,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_ID,
  chooseDirectMove,
  chooseUpdateProgress,
  echoSaveDraft,
  itemPreview,
  openItemEditor,
  openMoveMenu,
  pollUntil,
  PREDECESSOR_REPORT_ID,
  PROJECT_ID,
  REPORT_ID,
  SECOND_PROJECT_ID,
  Wrapper,
} from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("LeadForm Overview", () => {
  it("confirms carried work under a covering risk without changing its status or opening an editor", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper coveringRisk currentCarriedOver>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Status not set",
      }),
    );
    expect(screen.getByRole("menu")).toHaveAccessibleDescription(
      "Set by risk: Access unavailable — resolve it in Risks & Blockers",
    );
    expect(screen.getByRole("menuitem", { name: "Done" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("menuitem", { name: "In progress" }));
    expect(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Description/ })).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    );
    expect(
      screen.getByRole("menuitem", { name: "In progress" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("pauses from the status menu with two clicks, text and Enter", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Paused…" }));
    const reason = screen.getByRole("textbox", {
      name: "Paused reason — Current work",
    });
    await pollUntil(() => expect(reason).toHaveFocus());
    expect(screen.queryByRole("textbox", { name: /Description/ })).toBeNull();
    await user.keyboard("Waiting for access{Enter}");
    expect(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: Paused",
      }),
    ).toBeVisible();
  });

  it("clears a linked next step inline when choosing Done", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper legacyNextText="Verify production">
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Done" }));
    expect(screen.getByTestId("overview-status-next-step")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Description/ })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Clear and mark done" }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: Done",
      }),
    ).toBeVisible();
    expect(screen.queryByText("Verify production")).toBeNull();
    expect(screen.queryByText(/Cancel, then choose/)).toBeNull();
  });
  it("keeps one Submit and one autosave indicator while preserving the end summary", async () => {
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await screen.findByTestId("lead-submit-readiness");
    expect(screen.getAllByRole("button", { name: /^Submit\b/u })).toHaveLength(
      1,
    );
    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(screen.queryByText("Draft is saved.")).toBeNull();
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      "All changes saved",
    );
    expect(
      screen.getByTestId("lead-status-overview-page").parentElement
        ?.parentElement,
    ).toHaveAttribute("data-testid", "lead-completion-layout");
    expect(screen.getByTestId("lead-completion-layout")).toHaveClass(
      "lead-completion-layout",
    );
    expect(screen.getByTestId("lead-completion-scrollport")).toHaveClass(
      "lead-completion-scrollport",
    );
  });

  it("jumps from the pending-review action to the first carried work", async () => {
    render(
      <Wrapper currentCarriedOver>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    const action = await screen.findByRole("link", {
      name: /Review "Current work"/,
    });
    await userEvent.click(action);
    expect(
      screen.getByRole("button", {
        name: "Status not set",
      }),
    ).toHaveFocus();
  });
  it("puts changes-requested feedback first below the header and focuses the actual record", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper reviewerFeedback>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    const feedback = await screen.findByTestId("lead-review-feedback");
    expect(screen.getAllByTestId("lead-review-feedback")).toHaveLength(1);
    expect(feedback.previousElementSibling).toHaveAttribute(
      "data-layout-key",
      "report-context-toolbar",
    );
    expect(feedback.nextElementSibling).toBe(
      screen.getByTestId("status-overview"),
    );
    const link = within(feedback).getByRole("link", { name: "Current work" });
    const preview = await itemPreview("Current work");
    expect(link).toHaveAttribute("href", `#${preview.id}`);
    await user.click(link);
    expect(
      await screen.findByRole("dialog", { name: "Discussion" }),
    ).toBeVisible();
  });

  it("keeps an authoritative prior-only row informational with only the verdict rail", async () => {
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
    // Previously planned stays read-only: no progress, edit or move controls on
    // the row — only the verdict rail (which writes the selected week).
    // Replanning lives in the earlier open work register, not beside the rail.
    expect(
      within(preview).queryByRole("button", { name: /^Plan this work/ }),
    ).toBeNull();
    expect(
      within(preview).queryByRole("button", {
        name: /Status of|Edit item/,
      }),
    ).toBeNull();
    expect(
      within(preview).queryByRole("button", { name: /Update status/ }),
    ).toBeNull();
    const more = screen.queryByRole("button", { name: /^\+\d+ more/ });
    if (more) await userEvent.click(more);
    await userEvent.click(
      within(preview).getByRole("button", { name: /^Choose outcome/ }),
    );
    for (const verdict of [
      "Done",
      "In progress",
      "Next week",
      "Paused…",
      "Won’t do…",
    ])
      expect(
        screen.getByRole("menuitem", {
          name: verdict,
        }),
      ).toBeVisible();
    expect(
      within(preview).queryByRole("button", { name: /Move .* week/ }),
    ).toBeNull();
  });

  it("replans historical work after choosing a parent with one automatically applied stage", async () => {
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
      await screen.findByRole("button", {
        name: /^Replan deferred work: Deferred provider rollout, /,
      }),
    );
    const composer = screen.getByRole("form", { name: "Resolve plan" });
    expect(
      within(composer).getByRole("button", { name: "Plan next" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(composer).getByText("Parent and stages"));
    await user.selectOptions(
      within(composer).getByLabelText("Product"),
      `product:${SECOND_PROJECT_ID}`,
    );
    expect(within(composer).getByText("Applied automatically")).toBeVisible();
    await user.click(
      within(composer).getByRole("button", { name: "Save outcome" }),
    );

    await vi.waitFor(
      () => {
        expect(
          screen.queryByText("Select at least one stage."),
        ).not.toBeInTheDocument();
        expect(resolvePlan).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 },
    );
    expect(resolvePlan.mock.calls[0]?.[0]).toMatchObject({
      source: {
        kind: "prior",
        reportId: sourceReportId,
        recordId: sourceRecordId,
      },
      outcome: "plan_next",
      text: "Deferred provider rollout",
      parent: { kind: "product", id: SECOND_PROJECT_ID },
      stageNames: ["Analysis"],
    });
    await pollUntil(() =>
      expect(
        screen.queryByRole("button", {
          name: /^Replan deferred work: Deferred provider rollout, /,
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("asks before discarding edited plan text on Escape and Cancel", async () => {
    const user = userEvent.setup();
    const openWork: LeadOpenWorkHistoryOccurrence = {
      source: "published",
      reportId: "a0000000-0000-4000-8000-000000000020",
      reportSectionId: "a0000000-0000-4000-8000-000000000023",
      periodStart: new Date("2026-07-06T00:00:00.000Z"),
      periodEnd: new Date("2026-07-12T00:00:00.000Z"),
      parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
      item: {
        id: "a0000000-0000-4000-8000-000000000021",
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
    render(
      <Wrapper openWork={[openWork]}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /^Replan deferred work: Deferred provider rollout, /,
      }),
    );
    // An untouched composer closes without asking.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("form", { name: "Resolve plan" })).toBeNull();

    await user.click(
      await screen.findByRole("button", {
        name: /^Replan deferred work: Deferred provider rollout, /,
      }),
    );
    const text = screen.getByRole("textbox", {
      name: "Next-period commitment",
    });
    await user.type(text, " edited");
    await user.keyboard("{Escape}");
    expect(
      await screen.findByRole("heading", { name: "Discard changes?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("form", { name: "Resolve plan" })).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Next-period commitment" }),
    ).toHaveValue("Deferred provider rollout edited");

    await user.click(
      within(screen.getByRole("form", { name: "Resolve plan" })).getByRole(
        "button",
        { name: "Cancel" },
      ),
    );
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("form", { name: "Resolve plan" })).toBeNull();
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
    await chooseUpdateProgress(user, "Current work");
    const editor = screen.getByRole("form", {
      name: "Current week update for Payments",
    });
    expect(
      within(editor).getByRole("textbox", { name: /Description/ }),
    ).toHaveValue("Current work");
    await user.click(within(editor).getByRole("button", { name: "Done" }));
    await user.click(
      within(editor).getByRole("button", { name: "Save update" }),
    );
    await pollUntil(() =>
      expect(
        screen.queryByRole("form", {
          name: "Current week update for Payments",
        }),
      ).not.toBeInTheDocument(),
    );
    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    expect(resolvePlan).not.toHaveBeenCalled();
    const done = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items.find((item) => item.text === "Current work");
    expect(done).toMatchObject({ type: "current", workflowStatus: "done" });
    expect(
      within(await itemPreview("Current work")).getByRole("button", {
        name: /Status: Done/,
      }),
    ).toBeVisible();
  });

  it("reaches the terminal outcome composer through the status menu for a committed Current item", async () => {
    const user = userEvent.setup();
    const resolvePlan = vi.fn();
    render(
      <Wrapper legacyNextText="Continue next week" resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await openItemEditor(user, "Current work");
    const editor = await screen.findByRole("form", {
      name: "Current week update for Payments",
    });
    // A hidden next-step validation error reveals the field in place instead
    // of sending the lead through a different editor.
    await user.click(within(editor).getByRole("button", { name: "Done" }));
    await user.click(
      within(editor).getByRole("button", { name: "Save update" }),
    );
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "A completed item cannot have a next step",
    );
    expect(
      within(editor).getByRole("textbox", { name: /Next step/ }),
    ).toHaveValue("Continue next week");
    expect(screen.queryByText(/Cancel, then choose/)).toBeNull();
    await user.click(within(editor).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    const settled = await itemPreview("Current work");
    await user.click(
      await within(settled).findByRole("button", {
        name: /^Choose outcome: Current work/,
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Won’t do…",
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
      await screen.findByRole("button", {
        name: /^Replan deferred work: Deferred provider rollout, /,
      }),
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
    await openItemEditor(user, "Current work");
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
    // A background refresh can complete while the modal protects pending input.
    await act(async () => {
      await client.refetchQueries({
        queryKey: [["leadForm", "statusOverview"]],
      });
    });
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
      await openItemEditor(user, "Current work");
      const text = screen.getByRole("textbox", { name: /Description/ });
      await user.clear(text);
      await user.type(text, "My unsaved result");
      const queryKey = [["leadForm", "byPeriod"], { reportId: REPORT_ID }];
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
    await openItemEditor(user, "Current work");
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
    expect(screen.getByTestId("overview-save-state")).not.toHaveTextContent(
      "All changes saved",
    );
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
      await openItemEditor(user, "Current work");
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

      // The retry re-sends the identical request; later typing is never mixed
      // into it and stays in the editor for its own Save.
      await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(2));
      expect(
        (
          saveDraft.mock.calls[1]?.[0] as {
            items: readonly { text: string }[];
          }
        ).items.map((item) => item.text),
      ).toContain("Retained retry value");
      if (editAfterFailure) {
        const kept = await screen.findByRole("textbox", {
          name: /Description/,
        });
        expect(kept).toHaveValue("Retained retry value plus correction");
        await user.click(screen.getByRole("button", { name: "Save update" }));
        await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(3));
        expect(
          (
            saveDraft.mock.calls[2]?.[0] as {
              items: readonly { text: string }[];
            }
          ).items.map((item) => item.text),
        ).toContain("Retained retry value plus correction");
      }
      expect(
        await screen.findByRole("button", {
          name: `Edit text: ${
            editAfterFailure
              ? "Retained retry value plus correction"
              : "Retained retry value"
          }, This week`,
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
      screen.queryByRole("link", { name: "Risks & decisions" }),
    ).toBeNull();
    expect(screen.queryByTestId("lead-report-form")).toBeNull();
    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(documentActions).toBeVisible();
    expect(screen.getByRole("button", { name: /^Submit\b/ })).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeVisible();
  });

  it("never sends stale weekly fields after a versioned refresh and saves the latest pair after Cancel/reopen", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          version: number;
          activityStatuses: readonly {
            activityId: string;
            titleOverride: string | null;
            note: string | null;
          }[];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          activities: current.activities.map((activity) => ({
            ...activity,
            ...draft.activityStatuses.find(
              (row) => row.activityId === activity.activityId,
            ),
          })),
        });
      },
    );
    render(
      <Wrapper client={client} withActivity saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByTestId(`activity-fields-edit-${ACTIVITY_ID}`),
    );
    const title = screen.getByTestId(`activity-title-${ACTIVITY_ID}`);
    await user.type(title, "  My pending title  ");
    const queryKey = [["leadForm", "byPeriod"], { reportId: REPORT_ID }];
    const loaded = client.getQueryData<{ section: ReportSectionReadModel }>(
      queryKey,
    );
    if (!loaded) throw new Error("Expected a loaded section");
    expect(loaded.section.version).toBe(1);
    act(() => {
      client.setQueryData(queryKey, {
        ...loaded,
        section: {
          ...loaded.section,
          version: 2,
          activities: loaded.section.activities.map((activity) => ({
            ...activity,
            note: "Description saved in another tab",
          })),
        },
      });
    });
    expect(
      await screen.findByText("Description saved in another tab"),
    ).toBeVisible();
    const form = screen.getByRole("form", {
      name: "Weekly fields for Operational duty",
    });
    fireEvent.submit(form);
    // Wait beyond the canonical debounce so a stale patch cannot hide in its queue.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5500));
    });
    expect(saveDraft.mock.calls).toEqual([]);
    expect(title).toHaveValue("  My pending title  ");
    expect(within(form).getByLabelText("Description")).toHaveValue(
      "Keep this description",
    );
    expect(within(form).getByRole("alert")).toHaveTextContent(/changed|stale/i);
    expect(
      within(form).getByRole("button", { name: "Save weekly fields" }),
    ).toBeDisabled();
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      /unsaved change/i,
    );
    expect(
      screen.getByRole("button", { name: /^Submit\b/, hidden: true }),
    ).toHaveAttribute("aria-disabled", "true");

    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    const editButton = screen.getByTestId(
      `activity-fields-edit-${ACTIVITY_ID}`,
    );
    expect(editButton).toHaveFocus();
    expect(
      screen.queryByRole("form", {
        name: "Weekly fields for Operational duty",
      }),
    ).toBeNull();
    await user.click(editButton);
    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveValue("");
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Description saved in another tab");
    expect(within(screen.getByRole("form")).queryByRole("alert")).toBeNull();
    await user.type(
      screen.getByTestId(`activity-title-${ACTIVITY_ID}`),
      "Fresh title",
    );
    await user.click(
      screen.getByRole("button", { name: "Save weekly fields" }),
    );
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledOnce(), {
      timeout: 10_000,
    });
    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({
      reportSectionId: "10000000-0000-4000-8000-000000000002",
      version: 2,
      activityStatuses: [
        {
          activityId: ACTIVITY_ID,
          titleOverride: "Fresh title",
          note: "Description saved in another tab",
        },
      ],
    });
  }, 20_000);

  it("guards unsaved Activity weekly fields until they are cancelled", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <Wrapper withActivity>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    expect(screen.queryByTestId(`activity-title-${ACTIVITY_ID}`)).toBeNull();
    const editButton = await screen.findByTestId(
      `activity-fields-edit-${ACTIVITY_ID}`,
    );
    await user.click(editButton);
    const title = await screen.findByTestId(`activity-title-${ACTIVITY_ID}`);
    await user.type(title, "Unsaved weekly title");

    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      /unsaved change/i,
    );
    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Submit\b/, hidden: true }),
    ).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("link", { name: "Slides" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(title).toHaveValue("Unsaved weekly title");

    await user.click(
      screen.getByTestId(`activity-fields-cancel-${ACTIVITY_ID}`),
    );
    expect(
      screen.getByTestId(`activity-fields-edit-${ACTIVITY_ID}`),
    ).toHaveFocus();
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      "All changes saved",
    );
    expect(screen.getByTestId("lead-submit-readiness")).toBeVisible();
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

      await openItemEditor(user, initial);
      const description = screen.getByLabelText(/Description \*/i);
      await user.clear(description);
      await user.type(description, updated);
      expect(screen.getByRole("dialog")).toContainElement(description);
      await user.click(screen.getByRole("button", { name: "Save update" }));

      expect(await screen.findByText(updated)).toBeInTheDocument();
      expect(
        await screen.findByRole("button", {
          name: `Edit text: ${updated}, ${initial.startsWith("Next") ? "Next" : "This"} week`,
        }),
      ).toHaveFocus();
      expect(await screen.findByTestId("lead-submit-readiness")).toBeVisible();
      expect(
        screen.queryByText(
          "Save or cancel the open update before submitting the report.",
        ),
      ).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
        /unsaved change|Saving…|All changes saved/,
      );
    },
  );

  it("keeps Cancel reachable and fields locked while an update save is in flight", async () => {
    const user = userEvent.setup();
    let releaseSave: (() => void) | undefined;
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) =>
        new Promise<ReportSectionReadModel>((resolve) => {
          releaseSave = () => {
            const draft = input as {
              readonly version: number;
              readonly items: ReportSectionReadModel["items"];
            };
            resolve({
              ...current,
              version: draft.version + 1,
              items: draft.items,
            });
          };
        }),
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await openItemEditor(user, "Current work");
    const editor = await screen.findByRole("form", {
      name: "Current week update for Payments",
    });
    const description = within(editor).getByRole("textbox", {
      name: /Description/,
    });
    await user.type(description, " — in-flight edit");
    await user.click(
      within(editor).getByRole("button", { name: "Save update" }),
    );
    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    // In-flight window: the editable fields stay locked…
    await pollUntil(() => expect(description).toBeDisabled());
    expect(
      within(editor).getByRole("button", { name: "Save update" }),
    ).toBeDisabled();
    // …but Cancel is never trapped behind the save.
    const cancel = within(editor).getByRole("button", { name: "Cancel" });
    expect(cancel).toBeEnabled();
    // Escape routes through the same requestClose as Cancel: the dirty draft
    // asks for confirmation instead of silently discarding the pending save.
    fireEvent.keyDown(editor, { key: "Escape" });
    const discardPrompt = await screen.findByRole("alertdialog", {
      name: "Discard changes?",
    });
    await user.click(
      within(discardPrompt).getByRole("button", { name: "Keep editing" }),
    );
    expect(
      screen.queryByRole("alertdialog", { name: "Discard changes?" }),
    ).toBeNull();
    // Keep editing returns to the still-pending save: fields stay locked with
    // the dirty input, and Cancel remains reachable.
    expect(description).toBeDisabled();
    expect(description).toHaveValue("Current work — in-flight edit");
    expect(
      within(editor).getByRole("button", { name: "Save update" }),
    ).toBeDisabled();
    expect(cancel).toBeEnabled();
    // Cancel hits the same requestClose: the dirty draft is asked about again,
    // and Discard closes the editor without waiting for the paused save.
    await user.click(cancel);
    await user.click(
      within(
        await screen.findByRole("alertdialog", { name: "Discard changes?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    expect(
      screen.queryByRole("form", {
        name: "Current week update for Payments",
      }),
    ).toBeNull();
    // No cancellation guarantee: the in-flight save still lands once it
    // resolves, and the discard writes no second draft of its own.
    releaseSave?.();
    await pollUntil(() =>
      expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
        "All changes saved",
      ),
    );
    expect(saveDraft).toHaveBeenCalledOnce();
    await itemPreview("Current work — in-flight edit");
  });

  it("returns focus and restores report actions when an inline edit is cancelled", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openItemEditor(user, "Current work");
    await user.type(screen.getByLabelText(/Description \*/i), " unsaved");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(
      screen.getByRole("button", {
        name: "Edit text: Current work, This week",
      }),
    ).toHaveFocus();
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      "All changes saved",
    );
  });

  it("waits for the exact persisted restoration before closing a failed edit", async () => {
    const user = userEvent.setup();
    let acknowledgeRestore: (() => void) | undefined;
    const restoreAck = new Promise<void>((resolve) => {
      acknowledgeRestore = resolve;
    });
    const saveDraft = vi.fn(
      async (input: unknown, current: ReportSectionReadModel) => {
        if (saveDraft.mock.calls.length === 1)
          throw new Error("failed before commit");
        // Call 2 re-sends the original request verbatim; call 3 is the
        // compensating restoration against the settled state.
        if (saveDraft.mock.calls.length >= 3) await restoreAck;
        const draft = input as {
          version: number;
          items: ReportSectionReadModel["items"];
        };
        expect(draft.version).toBe(current.version);
        return { ...current, version: current.version + 1, items: draft.items };
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openItemEditor(user, "Current work");
    const description = screen.getByRole("textbox", { name: /Description/ });
    await user.clear(description);
    await user.type(description, "Detached failed text");
    await user.click(screen.getByRole("button", { name: "Save update" }));
    await screen.findByText(
      "Save failed. Your update is still here; try saving again.",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(3), {
      timeout: 1000,
    });
    expect(screen.getByLabelText(/Description \*/)).toHaveValue(
      "Detached failed text",
    );
    expect(screen.getByText("Save update").closest("button")).toBeDisabled();
    await act(async () => {
      acknowledgeRestore?.();
      await restoreAck;
    });
    await pollUntil(() =>
      expect(screen.queryByRole("textbox", { name: /Description/ })).toBeNull(),
    );
    expect(
      screen.getByRole("button", {
        name: "Edit text: Current work, This week",
      }),
    ).toBeInTheDocument();
    expect(saveDraft).toHaveBeenCalledTimes(3);
  });

  it("sends the restored item text, not the abandoned text, when a failed edit is discarded", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        if (saveDraft.mock.calls.length === 1)
          return Promise.reject(new Error("failed before commit"));
        const draft = input as { items: ReportSectionReadModel["items"] };
        return Promise.resolve({
          ...current,
          version: current.version + 1,
          items: draft.items,
        });
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openItemEditor(user, "Current work");
    const description = screen.getByRole("textbox", { name: /Description/ });
    await user.clear(description);
    await user.type(description, "Detached failed text");
    await user.click(screen.getByRole("button", { name: "Save update" }));
    await screen.findByText(
      "Save failed. Your update is still here; try saving again.",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(3), {
      timeout: 1000,
    });
    const restoredTexts = JSON.stringify(saveDraft.mock.calls[2]?.[0]);
    expect(restoredTexts).toContain("Current work");
    expect(restoredTexts).not.toContain("Detached failed text");
  });

  it("retains detached edit recovery when the restorative write also fails", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(() =>
      Promise.reject(new Error("network unavailable")),
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openItemEditor(user, "Current work");
    const description = screen.getByRole("textbox", { name: /Description/ });
    await user.clear(description);
    await user.type(description, "Never saved text");
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(
      await screen.findByText(
        "Save failed. Your update is still here; try saving again.",
      ),
    ).toBeInTheDocument();
    // The editor stays open and the retry path keeps the typed text.
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "Never saved text",
    );

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));

    const recovery = await screen.findByRole("region", {
      name: "Unsaved update recovery",
    });
    expect(recovery).toHaveTextContent("Never saved text");
    expect(recovery).toHaveTextContent("restoration was not confirmed");
    expect(
      screen.getByRole("button", { name: /^Submit\b/, hidden: true }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(saveDraft).toHaveBeenCalledTimes(2);
  });

  it("disables the header Retry while a failed Save update is still open", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(() =>
      Promise.reject(new Error("network unavailable")),
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openItemEditor(user, "Current work");
    await user.type(screen.getByLabelText(/Description \*/i), " unsaved");
    await user.click(screen.getByRole("button", { name: "Save update" }));
    await screen.findByText(
      "Save failed. Your update is still here; try saving again.",
    );
    expect(
      screen.getByRole("button", { name: "Retry save", hidden: true }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("retains detached create recovery when its restorative write fails", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(() =>
      Promise.reject(new Error("network unavailable")),
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.type(
      await screen.findByRole("textbox", {
        name: "Add what happened — Payments, This week",
      }),
      "Phantom item",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Save failed. Your update is still here; try saving again.",
      ),
    ).toBeInTheDocument();
    const board = within(screen.getByTestId("status-overview"));
    expect(board.getAllByText("Phantom item").length).toBeGreaterThan(0);

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));

    const recovery = await screen.findByRole("region", {
      name: "Unsaved update recovery",
    });
    expect(recovery).toHaveTextContent("Phantom item");
    expect(recovery).toHaveTextContent("restoration was not confirmed");
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(board.queryAllByText("Phantom item")).toHaveLength(0);
  });

  it("accepts a saved parent change as the new editor baseline", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openItemEditor(user, "Current work");
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
      screen.getByRole("button", {
        name: "Edit text: Current work, This week",
      }),
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
    await openItemEditor(user, "Current work");
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

  it("moves a Current item to next week in one action through the ordinary autosave", async () => {
    const saveDraft = echoSaveDraft();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const { saved } = await chooseDirectMove(
      "Current work",
      "next week",
      saveDraft,
    );
    const movedStableId = "a0000000-0000-4000-8000-000000000011";
    const moved = saved.find((item) => item.text === "Current work");
    expect(moved).toMatchObject({
      id: "a0000000-0000-4000-8000-000000000010",
      stableId: movedStableId,
      type: "next",
      text: "Current work",
      workflowStatus: "in_progress",
      carriedOver: false,
      nextStepText: null,
    });
    // Placement changes, the occurrence does not: the same record is no longer
    // Current and no second occurrence is synthesized for the lineage.
    expect(
      saved.filter((item) => item.stableId === movedStableId),
    ).toHaveLength(1);
    expect(
      saved.filter(
        (item) => item.type === "current" && item.stableId === movedStableId,
      ),
    ).toHaveLength(0);
    // The action is named postponement; stored progress keeps its own meaning.
    expect(moved?.workflowStatus).not.toBe("postponed");
  });

  it("moves focus to the moved item's visible control in the Next lane", async () => {
    const saveDraft = echoSaveDraft();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const { focused } = await chooseDirectMove(
      "Current work",
      "next week",
      saveDraft,
    );

    // The Current-lane trigger left the tree; focus must not fall to the body.
    expect(focused).toBeInstanceOf(HTMLElement);
    expect(focused).not.toBe(document.body);
    expect(focused).toBeVisible();
    expect(
      (focused as HTMLElement).dataset.overviewFocus?.endsWith(
        ":a0000000-0000-4000-8000-000000000011",
      ),
    ).toBe(true);
    expect(document.activeElement).toBe(focused);
  });

  it("moves a Next item to this week in one action through the ordinary autosave", async () => {
    const saveDraft = echoSaveDraft();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const { saved } = await chooseDirectMove(
      "Next work",
      "this week",
      saveDraft,
    );
    const movedStableId = "a0000000-0000-4000-8000-000000000013";
    expect(saved.find((item) => item.text === "Next work")).toMatchObject({
      id: "a0000000-0000-4000-8000-000000000012",
      stableId: movedStableId,
      type: "current",
      text: "Next work",
    });
    // Placement changes, the occurrence does not: the same record is no longer
    // Next and no second occurrence is synthesized for the lineage.
    expect(
      saved.filter((item) => item.stableId === movedStableId),
    ).toHaveLength(1);
  });

  // A move is an ordinary draft change: when another tab saved the section
  // first, the autosave is refused and the Overview must show the saved
  // placement again instead of keeping the move this tab never persisted.
  it("reloads the saved placement when a move autosave hits a stale-tab conflict", async () => {
    const conflict = new TRPCClientError("stale version");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });
    // The other tab changed the content too: a version-only bump would look
    // unchanged to the draft and keep the local move.
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

    const moveItem = await openMoveMenu("Current work", "next week");
    vi.useFakeTimers();
    try {
      fireEvent.click(moveItem);
      await act(() => vi.advanceTimersByTimeAsync(0));
      await act(() => vi.advanceTimersByTimeAsync(5000));
      await act(() => vi.advanceTimersByTimeAsync(0));
    } finally {
      vi.useRealTimers();
    }
    expect(saveDraft).toHaveBeenCalledOnce();

    await pollUntil(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
      ),
    );
    // The lanes render twice (mobile and desktop copies); the server text
    // must sit in a Current lane and nowhere in Next.
    const laneSelector = {
      current: '[data-overview-lineage-lane="current"]',
      next: '[data-overview-lineage-lane="next"]',
    } as const;
    const lanesHolding = (source: keyof typeof laneSelector) =>
      Array.from(
        document.querySelectorAll<HTMLElement>(laneSelector[source]),
      ).filter(
        (lane) => within(lane).queryByText("Saved in the other tab") !== null,
      );
    await pollUntil(() => {
      expect(lanesHolding("current").length).toBeGreaterThan(0);
      expect(lanesHolding("next")).toHaveLength(0);
    });
  });

  // A genuine Next item moves directly, so the editor Move only remains on
  // the legacy derived plan — the promotion path still exercised below.
  it("returns focus to a visible same-item control after cancelling a Move", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper legacyNextText="Legacy next-week plan" saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const preview = await itemPreview("Legacy next-week plan");
    const opener = within(preview).getByRole("button", { name: /^Edit text:/ });
    await user.click(opener);
    expect(screen.getByRole("button", { name: /^Move/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveDraft).not.toHaveBeenCalled();
    await pollUntil(() => expect(opener).toHaveFocus());
  });

  it("returns focus to More details when dismissing the unchanged Sheet", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    const resolvePlan = vi.fn(() => Promise.resolve({}));
    render(
      <Wrapper saveDraft={saveDraft} resolvePlan={resolvePlan}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await openItemEditor(user, "Next work");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(saveDraft).not.toHaveBeenCalled();
    expect(resolvePlan).not.toHaveBeenCalled();
    const moreDetails = await screen.findByRole("button", {
      name: "More details",
    });
    await pollUntil(() => expect(moreDetails).toHaveFocus());
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

    const status = await screen.findByRole("button", {
      name: "Status not set",
    });
    // The submit-readiness deep link still resolves to the status icon.
    expect(status).toHaveAttribute(
      "data-overview-focus",
      "confirm:current:a0000000-0000-4000-8000-000000000011",
    );
    await openItemEditor(user, "Current work");
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
        screen.queryByRole("button", {
          name: "Status not set",
        }),
      ).toBeNull(),
    );
    // Focus returns to the Edit details control that opened the editor.
    expect(
      await screen.findByRole("button", {
        name: "Edit text: Current work, This week",
      }),
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
      await screen.findByRole("button", {
        name: "Status not set",
      }),
    ).toBeVisible();
    await openItemEditor(user, "Current work");
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

  it("confirms carried work from the status menu in the draft, with no editor", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper currentCarriedOver saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Status not set",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "In progress" }));

    // The draft takes the change at once (autosave persists it as for any
    // other draft edit); no editor opens and no Confirm button was needed.
    expect(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("form", { name: "Current week update for Payments" }),
    ).toBeNull();
  });

  it("sets a simple status in place and asks inline for a pause", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Paused…" }));
    // A pause asks only for its reason and does not change the draft yet.
    expect(
      await screen.findByRole("textbox", {
        name: "Paused reason — Current work",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("form", { name: "Current week update for Payments" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Choose outcome: Current work. Status: In progress",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Done" }));
    expect(
      await screen.findByRole("button", {
        name: "Choose outcome: Current work. Status: Done",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("form", { name: "Current week update for Payments" }),
    ).toBeNull();
  });

  it("keeps carried work unconfirmed when the editor is cancelled", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper currentCarriedOver saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await openItemEditor(user, "Current work");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveDraft).not.toHaveBeenCalled();
    // The marker is untouched, so the carried copy and confirm anchor remain.
    expect(
      screen.getByRole("button", {
        name: "Status not set",
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole("button", {
        name: "Edit text: Current work, This week",
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

    await user.click(
      within(await itemPreview("Legacy next-week plan")).getByRole("button", {
        name: /^Edit text:/,
      }),
    );
    expect(screen.getByRole("textbox", { name: "Step text" })).toHaveValue(
      "Legacy next-week plan",
    );
    await user.click(screen.getByRole("button", { name: "More details" }));
    expect(screen.getByRole("dialog", { name: /step/i })).toBeVisible();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("refuses Move when the current item has a saved next step", async () => {
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
    const promotePlan = vi.fn();
    render(
      <Wrapper
        legacyNextText="Legacy next-week plan"
        currentCarriedOver
        promotePlan={promotePlan}
        saveDraft={saveDraft}
      >
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    const move = await openMoveMenu("Current work", "next week");
    const reason =
      "Its next step is already planned in Next week. Edit the next step instead";
    expect(move).toHaveAttribute("aria-disabled", "true");
    expect(move).toHaveAccessibleDescription(reason);
    await userEvent.click(move);
    expect(toast.info).toHaveBeenCalledWith(reason);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(promotePlan).not.toHaveBeenCalled();
  });

  // Week moves from the menu apply directly in both directions, so both rows
  // reach the editor's Save through Edit details and its week radio instead.
  it.each([
    {
      initial: "Current work",
      target: "next" as const,
      open: async (user: ReturnType<typeof userEvent.setup>) => {
        await openItemEditor(user, "Current work");
        await user.click(screen.getByRole("radio", { name: "Next week" }));
      },
    },
    {
      initial: "Next work",
      target: "current" as const,
      open: async (user: ReturnType<typeof userEvent.setup>) => {
        await openItemEditor(user, "Next work");
        await user.click(screen.getByRole("radio", { name: "Current week" }));
      },
    },
  ])(
    "retries an edited $target move from the latest draft without a duplicate",
    async ({ initial, target, open }) => {
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

      await open(user);
      await user.click(screen.getByRole("button", { name: "Save update" }));
      expect(
        await screen.findByText(
          "Save failed. Your update is still here; try saving again.",
        ),
      ).toBeVisible();
      const editedField = screen.getByRole("textbox", { name: /Description/ });
      await user.type(editedField, " after retry");
      await user.click(screen.getByRole("button", { name: "Save update" }));

      // The retry re-sends the identical request (same move, same identity);
      // the later typing is saved by its own Save without a duplicate.
      const savedItems = (call: number) =>
        (
          saveDraft.mock.calls[call]?.[0] as {
            readonly items: ReportSectionReadModel["items"];
          }
        ).items;
      await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(2));
      const resent = savedItems(1).filter(
        (item) => item.text === initial && item.type === target,
      );
      expect(resent).toHaveLength(1);
      await screen.findByRole("textbox", { name: /Description/ });
      await user.click(screen.getByRole("button", { name: "Save update" }));
      await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(3));
      const retryItems = savedItems(2);
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
    ["in_progress", "In progress"],
    ["paused", "Paused"],
    ["postponed", "Postponed"],
  ] as const)(
    "keeps current status %s stored and hidden after moving directly to next week",
    async (status, statusLabel) => {
      const user = userEvent.setup();
      const saveDraft = echoSaveDraft();
      render(
        <Wrapper currentWorkflowStatus={status} saveDraft={saveDraft}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );

      const { saved } = await chooseDirectMove(
        "Current work",
        "next week",
        saveDraft,
      );

      // The move is a placement change only: stored progress is not rewritten.
      expect(saved.find((item) => item.text === "Current work")).toMatchObject({
        type: "next",
        workflowStatus: status,
      });

      await openItemEditor(user, "Current work");
      expect(screen.getByRole("radio", { name: "Next week" })).toBeChecked();
      expect(screen.queryByRole("button", { name: statusLabel })).toBeNull();
    },
  );

  it.each([
    ["in_progress", "In progress"],
    ["paused", "Paused"],
    ["postponed", "Postponed"],
  ] as const)(
    "keeps next status %s selected while moving to this week",
    async (status, statusLabel) => {
      const user = userEvent.setup();
      render(
        <Wrapper nextWorkflowStatus={status}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );

      // The menu move is direct; the status selection check lives in the
      // editor, reached through Edit details and its week radio.
      await openItemEditor(user, "Next work");
      await user.click(screen.getByRole("radio", { name: "Current week" }));

      expect(screen.getByRole("button", { name: statusLabel })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    },
  );
});

it.each(["pending", "failed"] as const)(
  "isolates %s plan UI when switching to a warm report and retains A input",
  async (phase) => {
    const user = userEvent.setup();
    const reportB = "a0000000-0000-4000-8000-000000000060";
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const work: LeadOpenWorkHistoryOccurrence = {
      source: "published",
      reportId: PREDECESSOR_REPORT_ID,
      reportSectionId: "a0000000-0000-4000-8000-000000000062",
      periodStart: new Date("2026-07-06"),
      periodEnd: new Date("2026-07-12"),
      parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
      item: {
        id: "a0000000-0000-4000-8000-000000000063",
        stableId: "a0000000-0000-4000-8000-000000000064",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Report scoped deferred work",
        tag: "delivery",
        workflowStatus: "postponed",
        carriedOver: false,
        pausedReason: null,
        stageNames: ["Development"],
      },
    };
    const warm = render(
      <Wrapper reportId={reportB} client={client} openWork={[work]}>
        <LeadForm reportId={reportB} mode="overview" />
      </Wrapper>,
    );
    await screen.findByRole("textbox", {
      name: "Add what happened — Payments, This week",
    });
    warm.unmount();
    const pending = Promise.withResolvers<unknown>();
    const resolvePlan = vi.fn(() =>
      phase === "failed"
        ? Promise.reject(new Error("Report A plan failed"))
        : pending.promise,
    );
    function RenderReport({ reportId }: { reportId: string }) {
      return (
        <Wrapper
          reportId={reportId}
          client={client}
          openWork={[work]}
          resolvePlan={resolvePlan}
          inputProvider
        >
          <LeadForm reportId={reportId} mode="overview" />
        </Wrapper>
      );
    }
    const rendered = render(<RenderReport reportId={REPORT_ID} />);
    await user.click(
      await screen.findByRole("button", {
        name: /^Replan deferred work: Report scoped deferred work, /,
      }),
    );
    const form = screen.getByRole("form", { name: "Resolve plan" });
    await user.click(
      within(form).getByRole("button", { name: "Save outcome" }),
    );
    await pollUntil(() => expect(resolvePlan).toHaveBeenCalledOnce());
    if (phase === "failed") await screen.findByText("Report A plan failed");
    rendered.rerender(<RenderReport reportId={reportB} />);
    await screen.findByRole("textbox", {
      name: "Add what happened — Payments, This week",
    });
    expect(screen.queryByText("Report A plan failed")).not.toBeInTheDocument();
    const bAction = screen.getByRole("button", {
      name: /^Replan deferred work: Report scoped deferred work, /,
    });
    expect(screen.getByTestId("overview-save-state")).not.toHaveTextContent(
      "Saving plan outcome…",
    );
    if (phase === "pending") {
      // B has a different physical section; A remains guarded by the adapter.
      expect(bAction).toBeEnabled();
      await act(async () => {
        pending.reject(new Error("Late Report A plan failed"));
        await pending.promise.catch(() => undefined);
      });
    }
    await vi.waitFor(() => expect(bAction).toBeEnabled(), { timeout: 1000 });
    expect(
      screen.queryByText("Late Report A plan failed"),
    ).not.toBeInTheDocument();
    await user.click(bAction);
    expect(
      screen.getByRole("form", { name: "Resolve plan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save outcome" })).toBeEnabled();
    rendered.rerender(<RenderReport reportId={REPORT_ID} />);
    await screen.findByRole("form", { name: "Resolve plan" });
    expect(
      screen.getByRole("form", { name: "Resolve plan" }),
    ).toHaveTextContent("Report scoped deferred work");
    rendered.unmount();
    client.clear();
  },
);

it("keeps lost-ACK discard recovery after a real CAS conflict and never compensates at the refetched version", async () => {
  const user = userEvent.setup();
  const versions: number[] = [];
  let server: ReportSectionReadModel | undefined;
  const saveDraft = vi.fn((input: unknown, current: ReportSectionReadModel) => {
    server ??= current;
    const draft = input as {
      version: number;
      items: ReportSectionReadModel["items"];
    };
    versions.push(draft.version);
    if (saveDraft.mock.calls.length === 1) {
      server = { ...server, version: server.version + 1, items: draft.items };
      return Promise.reject(
        Object.assign(new Error("ACK lost after commit"), {
          serverSection: server,
        }),
      );
    }
    if (draft.version !== server.version) {
      const conflict = new TRPCClientError("Version conflict");
      Object.defineProperty(conflict, "data", {
        value: { code: "CONFLICT", httpStatus: 409 },
        configurable: true,
      });
      return Promise.reject(conflict);
    }
    return Promise.reject(new Error("Unexpected automatic compensation"));
  });
  render(
    <Wrapper saveDraft={saveDraft}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await openItemEditor(user, "Current work");
  const description = screen.getByRole("textbox", { name: /Description/ });
  await user.clear(description);
  await user.type(description, "Committed but unacknowledged");
  await user.click(screen.getByRole("button", { name: "Save update" }));
  await screen.findByText(
    "Save failed. Your update is still here; try saving again.",
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Discard" }));
  const recovery = await screen.findByRole("region", {
    name: "Unsaved update recovery",
  });
  expect(
    within(recovery).getByRole("textbox", { name: /Description/ }),
  ).toHaveValue("Committed but unacknowledged");
  expect(
    screen.getByRole("button", { name: /^Submit\b/, hidden: true }),
  ).toHaveAttribute("aria-disabled", "true");
  expect(server?.items.find((item) => item.type === "current")?.text).toBe(
    "Committed but unacknowledged",
  );
  expect(versions).toEqual([1, 1]);
  expect(saveDraft).toHaveBeenCalledTimes(2);
});

it.each(["success", "error"] as const)(
  "allows a valid B plan while A is pending and isolates A's late %s",
  async (late) => {
    const user = userEvent.setup();
    const reportB = "a0000000-0000-4000-8000-000000000060";
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const work: LeadOpenWorkHistoryOccurrence = {
      source: "published",
      reportId: PREDECESSOR_REPORT_ID,
      reportSectionId: "a0000000-0000-4000-8000-000000000062",
      periodStart: new Date("2026-07-06"),
      periodEnd: new Date("2026-07-12"),
      parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
      item: {
        id: "a0000000-0000-4000-8000-000000000063",
        stableId: "a0000000-0000-4000-8000-000000000064",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Report scoped deferred work",
        tag: "delivery",
        workflowStatus: "postponed",
        carriedOver: false,
        pausedReason: null,
        stageNames: ["Development"],
      },
    };

    const flightA = Promise.withResolvers<unknown>();
    const flightB = Promise.withResolvers<unknown>();
    const resolvePlan = vi.fn(
      (input: unknown, section: ReportSectionReadModel) => {
        const command = input as {
          reportSectionId: string;
          version: number;
          planText: string;
        };
        expect(command.reportSectionId).toBe(section.reportSectionId);
        expect(command.version).toBe(section.version);
        return section.reportId === REPORT_ID
          ? flightA.promise
          : flightB.promise;
      },
    );
    function RenderReport({ reportId }: { reportId: string }) {
      return (
        <Wrapper
          reportId={reportId}
          client={client}
          openWork={[work]}
          resolvePlan={resolvePlan}
          inputProvider
        >
          <LeadForm reportId={reportId} mode="overview" />
        </Wrapper>
      );
    }
    const rendered = render(<RenderReport reportId={REPORT_ID} />);
    await user.click(
      await screen.findByRole("button", {
        name: /^Replan deferred work: Report scoped deferred work, /,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save outcome" }));
    await pollUntil(() => expect(resolvePlan).toHaveBeenCalledOnce());
    rendered.rerender(<RenderReport reportId={reportB} />);
    const replanB = await screen.findByRole("button", {
      name: /^Replan deferred work: Report scoped deferred work, /,
    });
    await vi.waitFor(() => expect(replanB).toBeEnabled(), { timeout: 1000 });
    await user.click(replanB);
    const inputB = screen.getByRole("textbox", {
      name: "Next-period commitment",
    });
    await user.clear(inputB);
    await user.type(inputB, "Only B's authored commitment");
    await user.click(screen.getByRole("button", { name: "Save outcome" }));
    await pollUntil(() => expect(resolvePlan).toHaveBeenCalledTimes(2));
    const sectionA = resolvePlan.mock.calls.at(0)?.[1];
    const sectionB = resolvePlan.mock.calls.at(1)?.[1];
    if (!sectionA || !sectionB)
      throw new Error("Both scoped commands must have been sent");
    expect(sectionB.reportId).toBe(reportB);
    expect(sectionB.reportSectionId).not.toBe(sectionA.reportSectionId);
    vi.mocked(toast.success).mockClear();
    await act(async () => {
      if (late === "error") flightA.reject(new Error("Late A failure"));
      else
        flightA.resolve({
          section: {
            ...sectionA,
            version: 2,
            items: [
              ...sectionA.items,
              {
                ...work.item,
                id: "a0000000-0000-4000-8000-000000000066",
                workflowStatus: "planned",
              },
            ],
          },
          stableId: work.item.stableId,
          replayed: false,
        });
      await flightA.promise.catch(() => undefined);
    });
    expect(inputB).toHaveValue("Only B's authored commitment");
    expect(
      screen.getByRole("form", { name: "Resolve plan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
    expect(screen.queryByText("Late A failure")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => {
      flightB.resolve({
        section: {
          ...sectionB,
          version: 2,
          items: [
            ...sectionB.items,
            {
              ...work.item,
              id: "a0000000-0000-4000-8000-000000000065",
              text: "Only B's authored commitment",
              workflowStatus: "planned",
            },
          ],
        },
        stableId: work.item.stableId,
        replayed: false,
      });
      await flightB.promise;
    });
    await pollUntil(() =>
      expect(
        screen.queryByRole("form", { name: "Resolve plan" }),
      ).not.toBeInTheDocument(),
    );
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Plan outcome saved");
    await itemPreview("Only B's authored commitment");
    expect(
      screen.getByRole("textbox", {
        name: "Add what happened — Payments, This week",
      }),
    ).toBeEnabled();
    rendered.unmount();
    client.clear();
  },
);
