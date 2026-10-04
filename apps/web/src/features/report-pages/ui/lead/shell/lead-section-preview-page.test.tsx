import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../index", () => ({
  LeadSectionPreviewAuth: () => null,
}));

vi.mock("../../../../../shared/ui/auth-runtime/role-gate", () => ({
  RoleGate: ({ children }: { readonly children: ReactNode }) => children,
}));

import LeadReportPreviewPage from "../../../../../app/(app)/lead/report/[reportId]/preview/page";

describe("LeadReportPreviewPage", () => {
  it.each([
    ["report-001", "/lead/report/report-001"],
    ["report/with space", "/lead/report/report%2Fwith%20space"],
  ])(
    "returns from the preview to the addressed report %s",
    async (reportId, href) => {
      render(
        await LeadReportPreviewPage({ params: Promise.resolve({ reportId }) }),
      );

      expect(screen.getByText("Section preview")).toBeVisible();
      expect(
        screen.queryByRole("heading", { name: /section preview/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Back to form/ }),
      ).toHaveAttribute("href", href);
      expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    },
  );
});
