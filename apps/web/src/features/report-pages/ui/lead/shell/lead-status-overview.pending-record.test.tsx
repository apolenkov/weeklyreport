import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
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
it("retains newer popover text and one blocker when an earlier write fails", async () => {
  const user = userEvent.setup();
  const request = Promise.withResolvers<never>();
  const save = vi.fn(() => request.promise);
  render(
    <Wrapper saveDraft={save}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  await user.click(
    within(await itemPreview("Current work")).getByRole("button", {
      name: /Edit text:/,
    }),
  );
  const panel = screen.getByRole("dialog", { name: "Record" });
  const field = within(panel).getByRole("textbox", { name: "Record text" });
  await user.type(field, " dispatched{Enter}");
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  await user.type(field, " later");
  await act(async () => {
    request.reject(new Error("Unavailable"));
    await request.promise.catch(() => undefined);
  });
  expect(
    await within(panel).findByText(
      "Not saved. The connection dropped. Your text is kept here.",
    ),
  ).toBeVisible();
  expect(field).toHaveValue("Current work dispatched later");
  expect(within(panel).getByRole("button", { name: "Retry" })).toBeEnabled();
  expect(within(panel).getByRole("button", { name: "Discard" })).toBeEnabled();
  expect(
    within(screen.getByTestId("lead-submit-readiness")).getByText(
      /Unsaved update: Current work dispatched later/,
    ),
  ).toBeVisible();
});
