import { describe, expect, it } from "vitest";

import { roleSchema } from "../schemas/auth";
import {
  adminProjectSchema,
  adminReminderExecutionSchema,
  adminReminderRuleSchema,
  adminUserSchema,
  assembledReportSchema,
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  carryOverExecutionSchema,
  carryOverRecordSchema,
  draftSaveSchema,
  pdfExportJobSchema,
  pdfExportRequestSchema,
  portfolioOverviewSchema,
  reportPeriodSchema,
  reportSectionReadModelSchema,
  reportStatusSchema,
  submitSectionSchema,
  submissionDashboardRowSchema,
} from "../schemas/report";

const sectionId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const authorId = "33333333-3333-4333-8333-333333333333";
const projectId = "44444444-4444-4444-8444-444444444444";

describe("shared auth/report schemas", () => {
  it("accepts only supported roles", () => {
    expect(roleSchema.parse("lead")).toBe("lead");
    expect(roleSchema.parse("admin")).toBe("admin");
    expect(() => roleSchema.parse("superadmin")).toThrow();
  });

  it("allows draft payloads without mandatory traffic-light values", () => {
    const parsed = draftSaveSchema.parse({
      reportSectionId: sectionId,
      projectStatuses: [{ projectId }],
      items: [
        {
          projectId,
          type: "current",
          text: "Build entry form",
          tag: "feature",
          workflowStatus: "in_progress",
        },
      ],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: "Priority 1" },
        { rank: 2, text: "Priority 2" },
        { rank: 3, text: "Priority 3" },
      ],
    });

    expect(parsed.status).toBe("draft");
    expect(parsed.projectStatuses[0]?.status).toBeUndefined();
  });

  it("requires confirmed submit payloads with strict project-status values", () => {
    expect(() =>
      submitSectionSchema.parse({
        reportSectionId: sectionId,
        confirmed: true,
        projectStatuses: [{ projectId }],
        items: [
          {
            projectId,
            type: "current",
            text: "Submit item",
            tag: "feature",
            workflowStatus: "in_progress",
          },
        ],
        risks: [],
        decisions: [],
        priorities: [
          { rank: 1, text: "Priority 1" },
          { rank: 2, text: "Priority 2" },
          { rank: 3, text: "Priority 3" },
        ],
      }),
    ).toThrow();

    const parsed = submitSectionSchema.parse({
      reportSectionId: sectionId,
      confirmed: true,
      projectStatuses: [{ projectId, status: "green" }],
      items: [
        {
          projectId,
          type: "current",
          text: "Submit item",
          tag: "feature",
          workflowStatus: "in_progress",
        },
      ],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: "Priority 1" },
        { rank: 2, text: "Priority 2" },
        { rank: 3, text: "Priority 3" },
      ],
    });

    expect(parsed.confirmed).toBe(true);
    expect(parsed.projectStatuses[0]?.status).toBe("green");
  });

  it("parses report-section and dashboard read models", () => {
    const section = reportSectionReadModelSchema.parse({
      reportSectionId: sectionId,
      reportId,
      authorId,
      authorName: "Lead 1",
      status: "draft",
      submittedAt: null,
      projects: [{ projectId, projectName: "Project 1", trafficLight: null }],
      items: [],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: "Priority 1" },
        { rank: 2, text: "Priority 2" },
        { rank: 3, text: "Priority 3" },
      ],
    });
    const dashboardRows = submissionDashboardRowSchema.array().parse([
      {
        leadId: authorId,
        leadName: "Lead 1",
        role: "lead",
        projectNames: ["Project 1"],
        status: "submitted",
        submittedAt: "2026-04-09T10:00:00.000Z",
      },
    ]);

    expect(section.authorName).toBe("Lead 1");
    expect(dashboardRows[0]?.status).toBe("submitted");
  });

  it("parses portfolio overview and assembled report contracts", () => {
    const overview = portfolioOverviewSchema.parse({
      status: "yellow",
      totals: {
        green: 1,
        yellow: 2,
        red: 0,
      },
    });

    const assembled = assembledReportSchema.parse({
      reportId,
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-12T23:59:59.000Z",
      deadline: "2026-04-10T15:00:00.000Z",
      status: reportStatusSchema.parse("draft"),
      portfolioOverview: overview,
      sections: [
        {
          reportSectionId: sectionId,
          reportId,
          authorId,
          authorName: "Lead 1",
          status: "submitted",
          submittedAt: "2026-04-09T10:00:00.000Z",
          projects: [
            { projectId, projectName: "Project 1", trafficLight: "yellow" },
          ],
          items: [],
          risks: [],
          decisions: [],
          priorities: [
            { rank: 1, text: "Priority 1" },
            { rank: 2, text: "Priority 2" },
            { rank: 3, text: "Priority 3" },
          ],
        },
      ],
    });

    expect(assembled.portfolioOverview.status).toBe("yellow");
    expect(assembled.sections).toHaveLength(1);
  });

  it("rejects invalid portfolio overview totals", () => {
    expect(() =>
      portfolioOverviewSchema.parse({
        status: "green",
        totals: {
          green: -1,
          yellow: 0,
          red: 0,
        },
      }),
    ).toThrow();
  });

  it("parses async PDF export request and result contracts", () => {
    const request = pdfExportRequestSchema.parse({ reportId });
    const job = pdfExportJobSchema.parse({
      jobId: "99999999-9999-4999-8999-999999999999",
      reportId,
      status: "completed",
      requestedAt: "2026-04-09T15:00:00.000Z",
      completedAt: "2026-04-09T15:00:02.000Z",
      checksum: "phase-2-demo-checksum",
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: "/exports/report.pdf",
    });

    expect(request.reportId).toBe(reportId);
    expect(job.status).toBe("completed");
  });

  it("rejects invalid PDF export job payloads", () => {
    expect(() =>
      pdfExportJobSchema.parse({
        jobId: "not-a-uuid",
        reportId,
        status: "queued",
        requestedAt: "2026-04-09T15:00:00.000Z",
        completedAt: null,
        checksum: null,
        templateVersion: "",
        artifactUrl: null,
      }),
    ).toThrow();
  });

  it("parses admin users, projects, periods, and reminder rules", () => {
    const user = adminUserSchema.parse({
      id: authorId,
      email: "lead1@customreport.local",
      name: "Lead 1",
      role: "lead",
      reportingGroupId: reportId,
      reportingGroupName: "Core Development",
    });
    const project = adminProjectSchema.parse({
      id: projectId,
      name: "Project 1",
      archived: false,
      leadId: authorId,
      leadName: "Lead 1",
    });
    const period = reportPeriodSchema.parse({
      id: reportId,
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-12T23:59:59.000Z",
      deadline: "2026-04-10T15:00:00.000Z",
      status: "draft",
    });
    const reminderRule = adminReminderRuleSchema.parse({
      id: "99999999-9999-4999-8999-999999999998",
      reportId,
      kind: "deadline",
      fireAt: "2026-04-10T09:00:00.000Z",
      timezone: "Europe/Moscow",
      status: "active",
      version: 1,
    });
    const execution = adminReminderExecutionSchema.parse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ruleId: reminderRule.id,
      reportId,
      dedupeKey: `${reminderRule.id}:2026-04-10T09:00:00.000Z`,
      status: "queued",
      scheduledFor: "2026-04-10T09:00:00.000Z",
      sentAt: null,
      recipientEmail: "lead1@customreport.local",
      errorMessage: null,
    });

    expect(user.role).toBe("lead");
    expect(project.leadName).toBe("Lead 1");
    expect(period.status).toBe("draft");
    expect(reminderRule.status).toBe("active");
    expect(execution.status).toBe("queued");
  });

  it("parses carry-over lineage contracts", () => {
    const record = carryOverRecordSchema.parse({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sourceReportId: reportId,
      targetReportId: "55555555-5555-4555-8555-555555555555",
      sourceItemId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      targetItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      sourceDecisionId: null,
      targetDecisionId: null,
      status: "completed",
      carriedAt: "2026-04-13T00:00:01.000Z",
    });
    const execution = carryOverExecutionSchema.parse({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      sourceReportId: reportId,
      targetReportId: "55555555-5555-4555-8555-555555555555",
      dedupeKey: `${reportId}:55555555-5555-4555-8555-555555555555`,
      status: "completed",
      startedAt: "2026-04-13T00:00:00.000Z",
      completedAt: "2026-04-13T00:00:01.000Z",
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    });

    expect(record.status).toBe("completed");
    expect(execution.carriedItemCount).toBe(1);
  });

  it("parses archive history list and detail contracts", () => {
    const summary = archiveReportSummarySchema.parse({
      reportId,
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-12T23:59:59.000Z",
      publishedAt: "2026-04-09T14:00:00.000Z",
      publishedByName: "Department Head",
      portfolioStatus: "yellow",
    });
    const detail = archiveReportDetailSchema.parse({
      summary,
      report: assembledReportSchema.parse({
        reportId,
        periodStart: "2026-04-06T00:00:00.000Z",
        periodEnd: "2026-04-12T23:59:59.000Z",
        deadline: "2026-04-10T15:00:00.000Z",
        status: "published",
        publishedAt: "2026-04-09T14:00:00.000Z",
        publishedById: authorId,
        publishedByName: "Department Head",
        portfolioOverview: {
          status: "yellow",
          totals: { green: 1, yellow: 2, red: 0 },
        },
        sections: [],
      }),
    });

    expect(summary.portfolioStatus).toBe("yellow");
    expect(detail.report.status).toBe("published");
  });
});
