// @vitest-environment jsdom
// @vitest-environment jsdom
import { buildEscalationsFromReadSections } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
} from "../../../report-sections";
import { buildAccordionModel } from "./weekly-report-page-helpers";
import {
  AUTHOR_A,
  baseReport,
  PRODUCT_A,
  REPORT_ID,
  SECTION_A,
} from "./weekly-report-page-helpers.test-support";

describe.each(["product", "lead"] as const)(
  "own red draft count in %s scope",
  (scope) => {
    it.each([
      { order: "submitted-first", draftRed: true, expected: 1 },
      { order: "draft-first", draftRed: true, expected: 1 },
      { order: "submitted-first", draftRed: false, expected: 0 },
      { order: "draft-first", draftRed: false, expected: 0 },
    ])(
      "counts row-free co-owner independently: $order, red=$draftRed",
      ({ order, draftRed, expected }) => {
        const submitted = {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          status: "submitted" as const,
          submittedAt: new Date("2026-04-14T09:00:00Z"),
          projects: [
            {
              projectId: PRODUCT_A,
              projectName: "Shared red",
              trafficLight: "red" as const,
            },
          ],
          items: [],
          risks: [],
          decisions: [],
        };
        const draft = {
          ...submitted,
          reportSectionId: "66666666-6666-4666-8666-666666666666",
          authorId: "77777777-7777-4777-8777-777777777777",
          authorName: "Bob",
          status: "draft" as const,
          submittedAt: null,
          projects: [
            {
              projectId: PRODUCT_A,
              projectName: "Shared red",
              trafficLight: draftRed ? ("red" as const) : ("green" as const),
            },
          ],
        };
        const raw = baseReport({
          leadSections:
            order === "submitted-first"
              ? [submitted, draft]
              : [draft, submitted],
        });
        const report = {
          ...raw,
          escalations: buildEscalationsFromReadSections(raw.leadSections),
        };
        const model = buildAccordionModel({
          reportData: report,
          scope,
          submittedOnly: true,
          fullProducts: mapWeeklyReport(report).products,
          fullLeadGroups: mapWeeklyReportLeadGroups(report),
        });
        expect(model.draftCount).toBe(expected);
      },
    );
  },
);
