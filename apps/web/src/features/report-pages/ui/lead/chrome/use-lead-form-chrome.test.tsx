// @vitest-environment jsdom

import type { MyHistoryEntry } from "@customreport/shared";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { useLeadFormChrome } from "./use-lead-form-chrome";

const HISTORY: readonly MyHistoryEntry[] = [
  {
    sectionId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    reportStatus: "draft",
    sectionStatus: "draft",
    submittedAt: null,
    publishedAt: null,
  },
];

const REPORT_ID = "22222222-2222-4222-8222-222222222222";

function ChromeHarness({
  byPeriodData,
}: {
  readonly byPeriodData: { section: { reportId: string } } | undefined;
}) {
  useLeadFormChrome({
    pinnedReportId: REPORT_ID,
    activeReportId: null,
    byPeriodData,
    history: HISTORY,
  });
  useEffect(() => () => undefined, []);
  return null;
}

describe("useLeadFormChrome — document title branding", () => {
  afterEach(() => {
    document.title = "";
  });

  it("derives the title brand from the session organization", () => {
    render(
      <SessionContext.Provider
        value={{
          user: {
            id: "u1",
            name: "Lead User",
            email: "lead@example.test",
            role: "lead",
          },
          organization: { shortName: "Demo", fullName: "Example Software Department" },
          isLoading: false,
          isAuthenticated: true,
        }}
      >
        <ChromeHarness byPeriodData={{ section: { reportId: REPORT_ID } }} />
      </SessionContext.Provider>,
    );
    expect(document.title).toContain("Week 16");
    expect(document.title).toContain("· Example Software Department");
    expect(document.title).not.toContain("CustomReport");
  });

  it("falls back to the tenant-neutral placeholder, never a product brand, when organization is absent", () => {
    render(
      <ChromeHarness byPeriodData={{ section: { reportId: REPORT_ID } }} />,
    );
    expect(document.title).toContain("· Organization");
    expect(document.title).not.toContain("CustomReport");
  });
});
