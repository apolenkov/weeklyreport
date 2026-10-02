// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { Role } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// RoleGate is the spec's single SSR gate seam (ui-role-route-access): the test
// records the allowedRoles the page delegates with and renders children as the
// allowed path does.
const roleGateSpy = vi.hoisted(() =>
  vi.fn<
    (props: { allowedRoles: readonly Role[]; children: ReactNode }) => void
  >(),
);

vi.mock("../../../../../../shared/ui/auth-runtime/role-gate", () => ({
  RoleGate: (props: { allowedRoles: readonly Role[]; children: ReactNode }) => {
    roleGateSpy(props);
    return props.children;
  },
}));

vi.mock("../../../../../../features/report-pages", () => ({
  LeadSectionPreviewAuth: ({ reportId }: { readonly reportId: string }) => (
    <div data-testid="lead-section-preview" data-report-id={reportId} />
  ),
}));

import LeadReportPreviewPage from "./page";

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";

async function renderPage(reportId: string = REPORT_ID) {
  render(
    await LeadReportPreviewPage({ params: Promise.resolve({ reportId }) }),
  );
}

describe("LeadReportPreviewPage — lead-only preview shell", () => {
  beforeEach(() => roleGateSpy.mockClear());

  it("gates the preview to the lead role only", async () => {
    await renderPage();

    expect(roleGateSpy).toHaveBeenCalledTimes(1);
    expect(roleGateSpy.mock.lastCall?.[0].allowedRoles).toEqual(["lead"]);
  });

  it("renders the preview for the route reportId on a focusable main", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Section Preview" }),
    ).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("lead-section-preview")).toHaveAttribute(
      "data-report-id",
      REPORT_ID,
    );
  });

  it("links back to the lead form for the same report", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /back to form/i })).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}`,
    );
  });
});
