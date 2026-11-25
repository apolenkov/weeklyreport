import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { toast } from "sonner";
import { expect, it, vi } from "vitest";

import {
  echoSaveDraft,
  itemPreview,
  REPORT_ID,
  Wrapper,
} from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";

vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

it("offers Undo after an acknowledged deletion and restores the exact saved entry", async () => {
  const user = userEvent.setup();
  const success = vi.spyOn(toast, "success");
  const save = echoSaveDraft();
  render(
    <Wrapper saveDraft={save}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await user.click(
    within(await itemPreview("Current work")).getByRole("button", {
      name: /^Edit text:/,
    }),
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));
  const confirm = screen.getByRole("alertdialog", {
    name: "Delete this entry?",
  });
  expect(save).not.toHaveBeenCalled();
  await user.click(within(confirm).getByRole("button", { name: "Delete" }));
  await waitFor(() =>
    expect(
      success.mock.calls.some(([message]) => message === "Entry deleted"),
    ).toBe(true),
  );
  const action = success.mock.calls.find(
    ([message]) => message === "Entry deleted",
  )?.[1]?.action;
  if (!action || typeof action !== "object" || !("onClick" in action))
    throw new Error("Missing Undo action");
  const before = save.mock.calls[0]?.[1];
  if (!before) throw new Error("Missing initial section");
  render(<button onClick={action.onClick}>Undo saved deletion</button>);
  await user.click(screen.getByRole("button", { name: "Undo saved deletion" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  const input = save.mock.calls[1]?.[0];
  const restored = (input as Pick<ReportSectionReadModel, "items">).items.find(
    (row) => row.text === "Current work",
  );
  expect(restored).toMatchObject({
    stableId: before.items.find((row) => row.text === "Current work")?.stableId,
    workflowStatus: "in_progress",
    stageNames: ["Development"],
  });
});

it("restores a discarded draft to its editor without writing or replacing newer input", async () => {
  const user = userEvent.setup();
  const success = vi.spyOn(toast, "success");
  const error = vi.spyOn(toast, "error");
  const save = echoSaveDraft();
  render(
    <Wrapper saveDraft={save}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  const trigger = within(await itemPreview("Current work")).getByRole(
    "button",
    { name: /Edit text:/ },
  );
  await user.click(trigger);
  await user.type(
    screen.getByRole("textbox", { name: "Record text" }),
    " retained{Escape}",
  );
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Discard",
    }),
  );
  const offer = success.mock.calls.find(
    ([message]) => message === "Draft discarded.",
  )?.[1]?.action;
  if (!offer || typeof offer !== "object" || !("onClick" in offer))
    throw new Error("Missing Undo for discarded draft");
  render(<button onClick={offer.onClick}>Restore discarded draft</button>);
  await user.click(trigger);
  await user.type(
    screen.getByRole("textbox", { name: "Record text" }),
    " newer",
  );
  await user.click(
    screen.getByRole("button", { name: "Restore discarded draft" }),
  );
  expect(screen.getByRole("textbox", { name: "Record text" })).toHaveValue(
    "Current work newer",
  );
  expect(error).toHaveBeenCalledWith(
    "Can’t put it back now: save or cancel the open form first.",
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Discard",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Restore discarded draft" }),
  );
  expect(screen.getByRole("textbox", { name: "Record text" })).toHaveValue(
    "Current work retained",
  );
  expect(save).not.toHaveBeenCalled();
});
