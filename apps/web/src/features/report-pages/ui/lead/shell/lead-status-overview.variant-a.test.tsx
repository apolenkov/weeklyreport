import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("saves a record through its anchored form using the section draft", async () => {
  const saveDraft = echoSaveDraft();
  const user = userEvent.setup();
  render(
    <Wrapper saveDraft={saveDraft}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  const preview = await itemPreview("Current work");
  await user.click(
    within(preview).getByRole("button", {
      name: "Edit text: Current work, This week",
    }),
  );
  const panel = await screen.findByRole("dialog", { name: "Record" });
  const text = within(panel).getByRole("textbox", { name: "Record text" });
  await user.clear(text);
  await user.type(text, "Revised delivery");
  await user.type(
    within(panel).getByRole("textbox", { name: "Next step" }),
    "Check result",
  );
  expect(saveDraft).not.toHaveBeenCalled();
  await user.click(within(panel).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
  expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({
    items: expect.arrayContaining([
      expect.objectContaining({
        text: "Revised delivery",
        nextStepText: "Check result",
        type: "current",
      }),
    ]),
  });
});
