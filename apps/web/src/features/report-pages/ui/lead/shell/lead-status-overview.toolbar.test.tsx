import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
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
it("explains editing and sends blocked Submit to the readiness list", async () => {
  const user = userEvent.setup();
  render(
    <Wrapper currentCarriedOver>
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  expect(
    await screen.findByText("Click text to edit. Use status to answer a plan."),
  ).toBeVisible();
  const blocked = screen.getByRole("button", { name: /Submit.*to fix/ });
  await user.click(blocked);
  expect(document.activeElement).toContainElement(
    within(screen.getByTestId("lead-submit-readiness")).getByRole("link", {
      name: /Review "Current work"/,
    }),
  );
});

it("links an unanswered plan to its outcome inside a collapsed unit and explains submission", async () => {
  const user = userEvent.setup();
  render(
    <Wrapper
      predecessorItem={{
        id: "a0000000-0000-4000-8000-000000000034",
        stableId: "a0000000-0000-4000-8000-000000000035",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Review test plan",
        tag: "delivery",
        workflowStatus: "planned",
        carriedOver: false,
        stageNames: ["Development"],
      }}
    >
      <LeadForm reportId={REPORT_ID} mode="overview" />
    </Wrapper>,
  );
  const link = await screen.findByRole("link", { name: "1 plan to answer" });
  expect(
    within(screen.getByTestId("lead-submit-readiness")).getByText(
      "Unanswered plans are sent as Not answered.",
    ),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Collapse Payments" }));
  await user.click(link);
  expect(
    screen.getByRole("button", { name: /Choose outcome: Review test plan/ }),
  ).toHaveFocus();
});
