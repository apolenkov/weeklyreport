import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { expect, it, vi } from "vitest";

import {
  pollUntil,
  PROJECT_ID,
  REPORT_ID,
  Wrapper,
} from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";

vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const currentStableId = "a0000000-0000-4000-8000-000000000011";
const nextStableId = "a0000000-0000-4000-8000-000000000013";
const currentEntry = "Add what happened — Payments, This week";
const priorCommitment = {
  id: "a0000000-0000-4000-8000-000000000034",
  stableId: nextStableId,
  projectId: PROJECT_ID,
  activityId: null,
  type: "next",
  text: "Prior commitment",
  tag: "delivery",
  workflowStatus: "planned",
  carriedOver: false,
  stageNames: ["Development"],
} satisfies ReportSectionReadModel["items"][number];

type DraftRequest = Pick<ReportSectionReadModel, "items" | "version">;

function saveWithIdentity() {
  return vi.fn((input: unknown, current: ReportSectionReadModel) => {
    const draft = input as DraftRequest;
    return Promise.resolve({
      ...current,
      version: draft.version + 1,
      items: draft.items.map((item) =>
        item.stableId
          ? item
          : {
              ...item,
              id: "a0000000-0000-4000-8000-000000000021",
              stableId: "a0000000-0000-4000-8000-000000000022",
            },
      ),
    });
  });
}

it("blocks Submit after saving only a carried record's derived next step", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  render(
    <Wrapper
      currentCarriedOver
      legacyNextText="Verify delivery"
      saveDraft={saveDraft}
    >
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Edit text: Verify delivery, Next week",
    }),
  );
  const input = screen.getByRole("textbox", { name: "Step text" });
  await user.clear(input);
  await user.type(input, "Verify the draft{Enter}");
  await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
  const draft = saveDraft.mock.calls[0]?.[0] as DraftRequest;
  expect(
    draft.items.find((item) => item.stableId === currentStableId),
  ).toMatchObject({
    text: "Current work",
    nextStepText: "Verify the draft",
    carriedOver: true,
  });
  expect(screen.getByText("Needs status")).toBeVisible();
  await pollUntil(() =>
    expect(screen.queryByRole("dialog", { name: "Record" })).toBeNull(),
  );
  const submit = screen.getByRole("button", { name: /Submit.*to fix/ });
  expect(submit).toHaveAttribute("aria-disabled", "true");
  await user.click(submit);
  expect(document.activeElement).toContainElement(
    within(screen.getByTestId("lead-submit-readiness")).getByRole("link", {
      name: /Review "Current work"/,
    }),
  );
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("offers a This week answer for the prior plan when its only record is in Next week", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  render(
    <Wrapper saveDraft={saveDraft} predecessorItem={priorCommitment}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  const menu = await screen.findByRole("button", {
    name: /^Choose outcome: Prior commitment/,
  });
  menu.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("menuitem", { name: "Done" }));
  const prompt = await screen.findByRole("alertdialog", {
    name: "Already planned in Next week",
  });
  expect(saveDraft).not.toHaveBeenCalled();
  await user.click(
    within(prompt).getByRole("button", { name: "Bring into This week" }),
  );
  await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
  const request = saveDraft.mock.calls[0]?.[0] as {
    items: ReportSectionReadModel["items"];
  };
  expect(
    request.items.filter((item) => item.stableId === nextStableId),
  ).toEqual([
    expect.objectContaining({
      type: "current",
      workflowStatus: "done",
      text: "Next work",
    }),
  ]);
});

it("keeps the prior plan answered on reopening when Next has a persisted plan_next event", async () => {
  const state = {
    type: "next",
    workflowStatus: "planned",
    pausedReason: null,
    nextStepText: null,
    text: "Next work",
  } as const;
  const reopened = () => (
    <Wrapper
      predecessorItem={priorCommitment}
      nextOutcomeHistory={[
        {
          id: "a0000000-0000-4000-8000-000000000035",
          stableId: nextStableId,
          outcome: "plan_next",
          reason: null,
          actorId: "a0000000-0000-4000-8000-000000000036",
          actorName: "Test Lead",
          occurredAt: "2026-09-01T12:00:00.000Z",
          beforeState: state,
          afterState: state,
          reversesEventId: null,
        },
      ]}
    >
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>
  );
  const first = render(reopened());
  await screen.findByRole("button", {
    name: "Edit text: Next work, Next week",
  });
  first.unmount();

  render(reopened());
  const next = await screen.findByRole("button", {
    name: "Edit text: Next work, Next week",
  });
  expect(
    screen.queryByRole("button", { name: /^Choose outcome: Prior commitment/ }),
  ).toBeNull();
  const row = next.closest("[data-testid=overview-lineage-row]");
  expect(row).toHaveTextContent("No entry in This week");
});

it("offers the existing Next placement again on reopening without a saved answer", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  const resolvePlan = vi.fn();
  const page = () => (
    <Wrapper
      predecessorItem={priorCommitment}
      saveDraft={saveDraft}
      resolvePlan={resolvePlan}
    >
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>
  );
  const outcome = { name: /^Choose outcome: Prior commitment/ };
  const first = render(page());
  const menu = await screen.findByRole("button", outcome);
  menu.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("menuitem", { name: "Next week" }));
  await pollUntil(() =>
    expect(screen.queryByRole("button", outcome)).toBeNull(),
  );
  expect(saveDraft).not.toHaveBeenCalled();
  expect(resolvePlan).not.toHaveBeenCalled();
  first.unmount();

  render(page());
  expect(await screen.findByRole("button", outcome)).toBeVisible();
});

it("withholds Delete for published lineage outside the visible predecessor", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  render(
    <Wrapper publishedItemStableIds={[currentStableId]} saveDraft={saveDraft}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Edit text: Current work, This week",
    }),
  );
  const remove = screen.getByRole("button", { name: "Delete" });
  expect(remove).toHaveAttribute("aria-disabled", "true");
  expect(remove).toHaveAccessibleDescription(
    "Published in last week’s report. It can’t be deleted",
  );
  await user.click(remove);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(saveDraft).not.toHaveBeenCalled();
});

it.each([false, true])(
  "restores the record panel after closing More details (Sheet changed: %s)",
  async (changed) => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Edit text: Current work, This week",
      }),
    );
    const panel = screen.getByRole("dialog", { name: "Record" });
    const field = within(panel).getByRole("textbox", { name: "Record text" });
    await user.type(field, " plus draft");
    const more = within(panel).getByRole("button", { name: "More details" });
    await user.click(more);
    const details = await screen.findByRole("dialog", { name: "Edit item" });
    expect(panel).toBeInTheDocument();
    if (changed) {
      const description = within(details).getByRole("textbox", {
        name: /Description/,
      });
      // This matches the record's saved text but differs from the pre-Sheet draft.
      await user.clear(description);
      await user.type(description, "Current work");
    }
    await user.click(within(details).getByRole("button", { name: "Close" }));
    if (changed) {
      const confirmation = await screen.findByRole("alertdialog", {
        name: "Discard changes?",
      });
      await user.click(
        within(confirmation).getByRole("button", { name: "Discard" }),
      );
    }
    await pollUntil(() => expect(more).toHaveFocus());
    expect(panel).toBeInTheDocument();
    expect(field).toHaveValue("Current work plus draft");
  },
);

it(
  "changes the status of a fresh result immediately after saving it from the entry line",
  { timeout: 12_000 },
  async () => {
    const user = userEvent.setup();
    const saveDraft = saveWithIdentity();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    const input = await screen.findByRole("textbox", { name: currentEntry });
    expect(input).toHaveAttribute("placeholder", "What happened…");
    expect(screen.queryByRole("button", { name: currentEntry })).toBeNull();
    await user.type(input, "Review the draft{Enter}");
    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await pollUntil(() =>
      expect(screen.getByRole("textbox", { name: currentEntry })).toHaveFocus(),
    );
    expect(screen.getByRole("textbox", { name: currentEntry })).toHaveValue("");
    const status = await screen.findByRole("button", {
      name: /^Choose outcome: Review the draft\. Status: Done/,
    });
    status.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("menuitem", { name: "Done" }),
    ).toHaveAttribute("aria-current", "true");
    await user.click(screen.getByRole("menuitem", { name: "In progress" }));
    expect(
      await screen.findByRole("button", {
        name: /^Choose outcome: Review the draft\. Status: In progress/,
      }),
    ).toBeVisible();
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2), {
      timeout: 8000,
    });
    const created = (saveDraft.mock.calls[1]?.[0] as DraftRequest).items.filter(
      (item) => item.text === "Review the draft",
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      stableId: "a0000000-0000-4000-8000-000000000022",
      workflowStatus: "in_progress",
    });
  },
);

it("keeps Save and add another in the detailed create Sheet for the same unit and week", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  render(
    <Wrapper saveDraft={saveDraft}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await user.type(
    await screen.findByRole("textbox", {
      name: "Plan something — Payments, Next week",
    }),
    "Prepare a draft",
  );
  await user.click(screen.getByRole("button", { name: "More details" }));
  const sheet = await screen.findByRole("dialog", { name: "Add item" });
  expect(
    within(sheet).getByRole("textbox", { name: /Description/ }),
  ).toHaveValue("Prepare a draft");
  expect(saveDraft).not.toHaveBeenCalled();
  await user.click(
    within(sheet).getByRole("button", { name: "Save and add another" }),
  );
  await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
  const saved = (saveDraft.mock.calls[0]?.[0] as DraftRequest).items.find(
    (item) => item.text === "Prepare a draft",
  );
  expect(saved).toMatchObject({ type: "next", projectId: PROJECT_ID });
  await pollUntil(() => {
    const nextForm = within(sheet).getByRole("form", {
      name: "Next week update for Payments",
    });
    const description = within(nextForm).getByRole("textbox", {
      name: /Description/,
    });
    expect(description).toHaveValue("");
    expect(description).toHaveFocus();
  });
});

it("edits a Next week record in More details while preserving its hidden status and reason", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  render(
    <Wrapper nextWorkflowStatus="paused" saveDraft={saveDraft}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Edit text: Next work, Next week",
    }),
  );
  expect(screen.queryByText("Waiting for access")).toBeNull();
  await user.click(screen.getByRole("button", { name: "More details" }));
  const details = await screen.findByRole("dialog", { name: "Edit item" });
  expect(within(details).queryByRole("button", { name: "Paused" })).toBeNull();
  expect(
    within(details).queryByRole("textbox", { name: /Pause reason/ }),
  ).toBeNull();
  await user.type(
    within(details).getByRole("textbox", { name: /Description/ }),
    " revised",
  );
  await user.click(
    within(details).getByRole("button", { name: "Save update" }),
  );
  await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
  const edited = (saveDraft.mock.calls[0]?.[0] as DraftRequest).items.find(
    (item) => item.stableId === nextStableId,
  );
  expect(edited).toMatchObject({
    type: "next",
    text: "Next work revised",
    workflowStatus: "paused",
    pausedReason: "Waiting for access",
  });
  await user.click(
    await screen.findByRole("button", {
      name: "Edit text: Next work revised, Next week",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Move to this week" }));
  expect(await screen.findByText("Waiting for access")).toBeVisible();
  await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(2));
  const draft = saveDraft.mock.calls[1]?.[0] as DraftRequest;
  expect(
    draft.items.find((item) => item.stableId === nextStableId),
  ).toMatchObject({
    workflowStatus: "paused",
    pausedReason: "Waiting for access",
  });
});
