import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { type ReviewRepository, ReviewService } from "./review.service";

const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_SESSION = { role: "admin" as const };

function makeRow(
  overrides: Partial<SubmissionDashboardRow> & {
    leadId: string;
    leadName: string;
  },
): SubmissionDashboardRow {
  return {
    role: "lead",
    projectNames: ["Default Project"],
    status: "draft",
    submittedAt: null,
    ...overrides,
  };
}

function createRepository(rows: SubmissionDashboardRow[]): ReviewRepository {
  return {
    getSubmissionDashboard: (activeReportId) =>
      Promise.resolve(
        activeReportId === REPORT_ID ? structuredClone(rows) : [],
      ),
  };
}

describe("ReviewService output contract", () => {
  it("returns an empty dashboard when the repository has no rows", async () => {
    const service = new ReviewService(createRepository([]), createNullLogger());

    await expect(
      service.getSubmissionDashboard(REPORT_ID, ADMIN_SESSION),
    ).resolves.toEqual([]);
  });

  it("strips unknown repository fields from dashboard rows", async () => {
    const rowWithExtra = {
      leadId: "00000000-0000-4000-8000-000000000001",
      leadName: "Lead A",
      role: "lead" as const,
      projectNames: ["Project X"],
      status: "draft" as const,
      submittedAt: null,
      extraField: "not part of the contract",
    };
    const repository: ReviewRepository = {
      getSubmissionDashboard: () => Promise.resolve([rowWithExtra]),
    };
    const service = new ReviewService(repository, createNullLogger());

    const result = await service.getSubmissionDashboard(
      REPORT_ID,
      ADMIN_SESSION,
    );

    expect(result).toHaveLength(1);
    expect("extraField" in expectDefined(result[0])).toBe(false);
    expect(submissionDashboardRowSchema.array().parse(result)).toEqual(result);
  });

  it("sorts a cloned result without mutating repository-owned rows", async () => {
    const rows = [
      makeRow({
        leadId: "00000000-0000-4000-8000-000000000002",
        leadName: "Bravo",
        status: "submitted",
        submittedAt: new Date("2026-04-09T10:00:00.000Z"),
      }),
      makeRow({
        leadId: "00000000-0000-4000-8000-000000000001",
        leadName: "Alpha",
        status: "submitted",
        submittedAt: new Date("2026-04-09T09:00:00.000Z"),
      }),
      makeRow({
        leadId: "00000000-0000-4000-8000-000000000003",
        leadName: "Zulu",
      }),
    ];
    const repository: ReviewRepository = {
      getSubmissionDashboard: () => Promise.resolve(rows),
    };
    const service = new ReviewService(repository, createNullLogger());

    const result = await service.getSubmissionDashboard(
      REPORT_ID,
      ADMIN_SESSION,
    );

    expect(result.map(({ leadName }) => leadName)).toEqual([
      "Zulu",
      "Alpha",
      "Bravo",
    ]);
    expect(rows.map(({ leadName }) => leadName)).toEqual([
      "Bravo",
      "Alpha",
      "Zulu",
    ]);
  });

  it("uses Russian collation for equal-status lead names", async () => {
    const service = new ReviewService(
      createRepository([
        makeRow({
          leadId: "00000000-0000-4000-8000-000000000001",
          leadName: "Alpha",
        }),
        makeRow({
          leadId: "00000000-0000-4000-8000-000000000002",
          leadName: "Альфа",
        }),
      ]),
      createNullLogger(),
    );

    const result = await service.getSubmissionDashboard(
      REPORT_ID,
      ADMIN_SESSION,
    );

    expect(result.map(({ leadName }) => leadName)).toEqual(["Альфа", "Alpha"]);
  });

  it("passes the ru locale to name collation explicitly", async () => {
    // The outcome above cannot pin the locale ARGUMENT on a host whose
    // default ICU locale is already ru-RU (dropping "ru" changes nothing
    // there), so the explicit-locale contract is pinned at the call site.
    const localeCompare = vi.spyOn(String.prototype, "localeCompare");
    try {
      const service = new ReviewService(
        createRepository([
          makeRow({
            leadId: "00000000-0000-4000-8000-000000000001",
            leadName: "Alpha",
          }),
          makeRow({
            leadId: "00000000-0000-4000-8000-000000000002",
            leadName: "Альфа",
          }),
        ]),
        createNullLogger(),
      );
      await service.getSubmissionDashboard(REPORT_ID, ADMIN_SESSION);

      expect(localeCompare).toHaveBeenCalled();
      const locales = localeCompare.mock.calls.map(([, locale]) => locale);
      expect(locales).toContain("ru");
    } finally {
      localeCompare.mockRestore();
    }
  });
});
