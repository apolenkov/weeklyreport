// @vitest-environment jsdom
// What a Head or viewer is told about unfinished risks and decisions that are
// left out of the report they read (openspec: viewer-report-navigation).
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  publishOmissionNote,
  recordOmissionNoticeText,
} from "../../../../shared/lib/format/record-omission-text";
import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

describe("recordOmissionNoticeText", () => {
  it("says nothing when every record is shown", () => {
    expect(
      recordOmissionNoticeText({ risks: 0, decisions: 0, unknown: false }),
    ).toBeNull();
  });

  it("names each kind that is left out, in singular and plural", () => {
    expect(
      recordOmissionNoticeText({ risks: 2, decisions: 1, unknown: false }),
    ).toBe(
      "Not shown: 2 unfinished risks and 1 unfinished decision, still being written. This report may be incomplete.",
    );
    expect(
      recordOmissionNoticeText({ risks: 0, decisions: 3, unknown: false }),
    ).toBe(
      "Not shown: 3 unfinished decisions, still being written. This report may be incomplete.",
    );
  });

  // Unfinished records could not be stored before counting shipped, so a
  // report frozen earlier left nothing out and earns no warning.
  it("stays silent on a report frozen before counting", () => {
    expect(
      recordOmissionNoticeText({ risks: 0, decisions: 0, unknown: true }),
    ).toBeNull();
  });

  it("names only what was counted when older sections sit beside it", () => {
    expect(
      recordOmissionNoticeText({ risks: 1, decisions: 0, unknown: true }),
    ).toBe(
      "Not shown: 1 unfinished risk, still being written. This report may be incomplete.",
    );
  });
});

describe("publishOmissionNote", () => {
  it("names what publishing leaves out, and is silent when nothing is", () => {
    expect(
      publishOmissionNote({ risks: 1, decisions: 2, unknown: false }),
    ).toBe(
      "1 unfinished risk and 2 unfinished decisions will be left out of the published report.",
    );
    expect(
      publishOmissionNote({ risks: 0, decisions: 0, unknown: false }),
    ).toBeUndefined();
  });
});

describe("WeeklyReportPage — records not shown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it.each(["head", "viewer"] as const)(
    "tells a %s how many unfinished records the report leaves out once drafts are shown",
    async (role) => {
      renderWeeklyReportPage(
        makeWeeklyReportData("open", {
          recordOmissions: { risks: 2, decisions: 1, unknown: false },
        }),
        { role },
      );

      // Submitted sections hold no unfinished records, so the default
      // submitted-only view has nothing to disclose.
      await screen.findByRole("heading", { name: "Status Report" });
      expect(
        screen.queryByRole("note", { name: "Records not shown" }),
      ).not.toBeInTheDocument();

      await userEvent.click(await screen.findByRole("button", { name: "All" }));

      expect(
        await screen.findByRole("note", { name: "Records not shown" }),
      ).toHaveTextContent(
        "Not shown: 2 unfinished risks and 1 unfinished decision, still being written.",
      );
      // The pending-section count keeps its own place in the header.
      expect(screen.getByText(/4\/6\s+Submitted/u)).toBeInTheDocument();
    },
  );

  it("shows no notice when nothing is left out", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("open"), { role: "head" });

    await screen.findByRole("heading", { name: "Status Report" });
    expect(
      screen.queryByRole("note", { name: "Records not shown" }),
    ).not.toBeInTheDocument();
  });
});
