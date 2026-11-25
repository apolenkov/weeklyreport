import { render, screen, within } from "@testing-library/react";
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
it("keeps a changed record draft when its Product is collapsed and expanded", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  render(
    <Wrapper saveDraft={save}>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  const row = await itemPreview("Current work");
  await user.click(within(row).getByRole("button", { name: /^Edit text:/ }));
  await user.type(
    screen.getByRole("textbox", { name: "Record text" }),
    " retained",
  );
  await user.click(screen.getByRole("button", { name: "Collapse Payments" }));
  expect(row).not.toBeVisible();
  expect(screen.queryByRole("dialog", { name: "Record" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Expand Payments" }));
  expect(screen.getByRole("textbox", { name: "Record text" })).toHaveValue(
    "Current work retained",
  );
  expect(save).not.toHaveBeenCalled();
});
