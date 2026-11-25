import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { REPORT_ID, Wrapper } from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
it("keeps one read-only banner, the stage legend and discussion access in a submitted report", async () => {
  const user = userEvent.setup();
  render(
    <Wrapper submitted>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  expect(await screen.findByText("This report is read-only.")).toBeVisible();
  expect(
    screen.queryByText("Click text to edit. Use status to answer a plan."),
  ).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: /Risk or decision|Add what happened|Choose outcome:/,
    }),
  ).toBeNull();
  const grid = screen.getByTestId("status-overview");
  expect(
    within(grid).getByRole("group", { name: "Stage legend" }),
  ).toBeVisible();
  await user.click(
    within(grid).getByRole("button", {
      name: "View text: Current work, This week",
    }),
  );
  const panel = screen.getByRole("dialog", { name: "Record" });
  expect(
    within(panel)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent),
  ).toEqual(["Discussion (0)", "Close"]);
  await user.click(
    within(panel).getByRole("button", { name: "Discussion (0)" }),
  );
  expect(screen.getByRole("dialog", { name: "Discussion" })).toBeVisible();
});
