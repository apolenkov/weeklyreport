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

it("keeps Needs status when saving only a carried record's derived next step", async () => {
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
});

it("offers a This week answer for the prior plan when its only record is in Next week", async () => {
  const user = userEvent.setup();
  const saveDraft = saveWithIdentity();
  render(
    <Wrapper
      saveDraft={saveDraft}
      predecessorItem={{
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
      }}
    >
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
  await user.click(remove);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(saveDraft).not.toHaveBeenCalled();
});

it("keeps the record panel and its draft under More details and returns focus", async () => {
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
  await user.click(within(details).getByRole("button", { name: "Close" }));
  await pollUntil(() => expect(more).toHaveFocus());
  expect(field).toHaveValue("Current work plus draft");
});

it("accepts direct typing in the quiet entry line and gives a saved result its menu", async () => {
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
  expect(await screen.findByRole("menuitem", { name: "Done" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

it("hides a saved pause reason in Next week and restores it in This week", async () => {
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
  await user.click(screen.getByRole("button", { name: "Move to this week" }));
  expect(await screen.findByText("Waiting for access")).toBeVisible();
  const draft = saveDraft.mock.calls[0]?.[0] as DraftRequest;
  expect(
    draft.items.find((item) => item.stableId === nextStableId),
  ).toMatchObject({
    workflowStatus: "paused",
    pausedReason: "Waiting for access",
  });
});
