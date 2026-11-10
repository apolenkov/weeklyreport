// @vitest-environment jsdom
// What a Head or viewer is told about unfinished risks and decisions that are
// left out of the report they read (openspec: viewer-report-navigation).
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  publishOmissionNote,
  recordOmissionNoticeText,
} from "../../../report-sections";
import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

const UNCOUNTED =
  "Part of this report was published before unfinished records were counted, so some may be missing here.";

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
      "Not shown: 2 unfinished risks and 1 unfinished decision. Authors are still working on them, so this report may be incomplete.",
    );
    expect(
      recordOmissionNoticeText({ risks: 0, decisions: 3, unknown: false }),
    ).toBe(
      "Not shown: 3 unfinished decisions. Authors are still working on them, so this report may be incomplete.",
    );
  });

  it("calls an uncounted report unknown instead of passing it off as complete", () => {
    expect(
      recordOmissionNoticeText({ risks: 0, decisions: 0, unknown: true }),
    ).toBe(UNCOUNTED);
  });

  it("gives a known count as a lower bound when part of the report is uncounted", () => {
    expect(
      recordOmissionNoticeText({ risks: 1, decisions: 0, unknown: true }),
    ).toBe(
      `Not shown: at least 1 unfinished risk. Authors are still working on them, so this report may be incomplete. ${UNCOUNTED}`,
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
    "tells a %s how many unfinished records the report leaves out",
    async (role) => {
      renderWeeklyReportPage(
        makeWeeklyReportData("open", {
          recordOmissions: { risks: 2, decisions: 1, unknown: false },
        }),
        { role },
      );

      expect(
        await screen.findByRole("note", { name: "Records not shown" }),
      ).toHaveTextContent(
        "Not shown: 2 unfinished risks and 1 unfinished decision.",
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
