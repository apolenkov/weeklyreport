import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20260530162224_init/migration.sql", import.meta.url),
  "utf8",
);

describe("canonical init migration", () => {
  it("requires a persisted worker payload on every reminder execution", () => {
    expect(migration).toContain('"queuePayload" JSONB NOT NULL');
  });

  it("enforces coherent reminder execution lifecycle outcomes", () => {
    expect(migration).toContain(
      'CONSTRAINT "ReminderExecution_lifecycle_check"',
    );
    expect(migration).toContain(
      '"status" = \'sent\' AND "sentAt" IS NOT NULL AND "error" IS NULL',
    );
    expect(migration).toContain(
      '"status" = \'failed\' AND "sentAt" IS NULL AND "error" IS NOT NULL',
    );
    expect(migration).toContain("\"error\" ~ '[^[:space:]]'");
    expect(migration).toContain(
      '"status" IN (\'pending\', \'sending\') AND "sentAt" IS NULL AND "error" IS NULL',
    );
  });

  it("requires every reminder rule to belong to one report and policy", () => {
    expect(migration).toContain('"reportId" TEXT NOT NULL');
    expect(migration).toContain('"policyId" TEXT NOT NULL');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "uq_rule_report_policy_version" ON "ReminderRule"("reportId", "policyId", "version")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("policyId") REFERENCES "ReminderPolicy"("id") ON DELETE CASCADE',
    );
  });

  it("binds each reminder policy kind to its only supported audience", () => {
    expect(migration).toContain(
      'CONSTRAINT "ReminderPolicy_kind_audience_check"',
    );
    expect(migration).toContain(
      "\"kind\" = 'deadline' AND \"audience\" = 'LEAD_WITH_DRAFT'",
    );
    expect(migration).toContain(
      "\"kind\" = 'escalation' AND \"audience\" = 'HEAD_OF_LATE'",
    );
  });

  it("requires explicit stages for product records and none for activities", () => {
    expect(
      migration.match(/"stageNames" TEXT\[\] NOT NULL DEFAULT/g),
    ).toHaveLength(3);
    expect(migration).toContain('CONSTRAINT "Item_parent_stage_names_check"');
    expect(migration).toContain('CONSTRAINT "Risk_parent_stage_names_check"');
    expect(migration).toContain(
      'CONSTRAINT "Decision_parent_stage_names_check"',
    );
  });

  it("requires a reason only while an item is paused", () => {
    expect(migration).toContain('CONSTRAINT "Item_paused_reason_check"');
    expect(migration).toContain("\"workflowStatus\" = 'paused'");
    expect(migration).toContain("btrim(\"pausedReason\") <> ''");
  });

  it("uses only the current live-period overlap guard", () => {
    expect(migration).toContain('CONSTRAINT "Report_no_live_period_overlap"');
  });

  it("requires an immutable snapshot for published reports", () => {
    expect(migration).toContain(
      'CONSTRAINT "Report_published_requires_snapshot"',
    );
    expect(migration).toContain('"publishedAt" IS NOT NULL');
    expect(migration).toContain(
      "(\"publishedSnapshot\"->>'publishedAt') IS NOT NULL",
    );
    expect(migration).toContain(
      "((\"publishedSnapshot\"->>'publishedAt')::timestamptz AT TIME ZONE 'UTC') = \"publishedAt\"",
    );
  });

  it("indexes the immutable PDF scope and seven-day telemetry window", () => {
    expect(migration).toContain('"publicationGroupIds" TEXT[] NOT NULL');
    expect(migration).toContain(
      'CREATE INDEX "PdfExportJob_publicationGroupIds_idx" ON "PdfExportJob" USING GIN ("publicationGroupIds")',
    );
    expect(migration).toContain(
      'CREATE INDEX "PdfExportJob_createdAt_idx" ON "PdfExportJob"("createdAt" DESC)',
    );
  });

  it("retains the publisher referenced by published history", () => {
    expect(migration).toContain(
      'CONSTRAINT "Report_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT',
    );
  });

  it("materializes immutable indexed publication scope and search projections", () => {
    expect(migration).toContain('CREATE TABLE "PublishedSectionScope"');
    expect(migration).toContain('CREATE TABLE "PublishedSearchDocument"');
    expect(migration).toContain(
      'CONSTRAINT "PublishedSectionScope_pkey" PRIMARY KEY ("reportId", "reportSectionId")',
    );
    expect(migration).toContain(
      'CONSTRAINT "PublishedSearchDocument_pkey" PRIMARY KEY ("reportId", "recordType", "recordId")',
    );
    expect(migration).toContain(
      'CREATE INDEX "PublishedSectionScope_groupId_reportId_idx" ON "PublishedSectionScope"("groupId", "reportId")',
    );
    expect(migration).toContain(
      'CREATE INDEX "PublishedSectionScope_authorId_reportId_idx" ON "PublishedSectionScope"("authorId", "reportId")',
    );
    expect(migration).toMatch(
      /CREATE TABLE "PublishedSearchDocument" \([\s\S]*?"stableId" TEXT NOT NULL[\s\S]*?\);/,
    );
    expect(migration).toContain(
      'CREATE INDEX "PublishedSearchDocument_recordType_stableId_idx" ON "PublishedSearchDocument"("recordType", "stableId")',
    );
    expect(migration).toContain(
      'CREATE INDEX "PublishedSearchDocument_searchTsv_idx" ON "PublishedSearchDocument" USING GIN ("searchTsv")',
    );
    expect(migration).toContain(
      '"searchTsv" tsvector GENERATED ALWAYS AS (to_tsvector',
    );
    expect(migration).toContain(
      'CONSTRAINT "PublishedSectionScope_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE',
    );
    expect(migration).toContain(
      'CONSTRAINT "PublishedSearchDocument_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE',
    );
    for (const forbiddenForeignKey of [
      "PublishedSectionScope_reportSectionId_fkey",
      "PublishedSectionScope_authorId_fkey",
      "PublishedSectionScope_groupId_fkey",
      "PublishedSearchDocument_reportSectionId_fkey",
      "PublishedSearchDocument_recordId_fkey",
      "PublishedSearchDocument_groupId_fkey",
      "PublishedSearchDocument_projectId_fkey",
    ]) {
      expect(migration).not.toContain(forbiddenForeignKey);
    }
  });

  it("creates exactly the current persistence model", () => {
    const currentTables = [
      "ActivityStatus",
      "AiFeaturePromptControl",
      "AiPromptBundleRevision",
      "AiProviderConfiguration",
      "AiProviderControl",
      "AiProviderTestExecution",
      "AppSettings",
      "CarryOverExecution",
      "CarryOverRecord",
      "Decision",
      "GroupProduct",
      "Item",
      "Organization",
      "PdfExportJob",
      "Project",
      "ProjectActivity",
      "ProjectActivityLead",
      "ProjectActivityProduct",
      "ProjectStatus",
      "PublishedSearchDocument",
      "PublishedSectionScope",
      "RecordComment",
      "ReminderExecution",
      "ReminderPolicy",
      "ReminderRule",
      "ReopenRequest",
      "Report",
      "ReportSection",
      "ReportingGroup",
      "ReviewAcknowledgement",
      "Risk",
      "SectionReview",
      "SemanticEmbedding",
      "SemanticSourceState",
      "SitepingAnnotation",
      "SitepingFeedback",
      "Stage",
      "StageAssignment",
      "StageStatus",
      "User",
      "UserActionLog",
      "ViewerGroupAccess",
    ];
    const createdTables = [...migration.matchAll(/^CREATE TABLE "([^"]+)"/gmu)]
      .map((match) => match[1])
      .sort();

    expect(createdTables).toEqual(currentTables);
  });

  it("tracks every mutable semantic source through one durable generation", () => {
    expect(migration).toContain('CREATE TABLE "SemanticSourceState"');
    expect(migration).toContain(
      `INSERT INTO "SemanticSourceState" ("id", "generation", "updatedAt")`,
    );
    expect(migration).toContain(`VALUES ('singleton', 0, CURRENT_TIMESTAMP)`);
    for (const table of [
      "Report",
      "ReportSection",
      "ProjectStatus",
      "StageStatus",
      "ActivityStatus",
      "Item",
      "Risk",
      "Decision",
      "Project",
      "ProjectActivity",
      "Stage",
    ]) {
      expect(migration).toContain(
        `AFTER INSERT OR UPDATE OR DELETE ON "${table}"`,
      );
    }
  });

  it("provisions both required configuration singletons", () => {
    expect(migration).toContain(
      `INSERT INTO "AppSettings" ("id", "updatedAt")`,
    );
    expect(migration).toContain(`VALUES ('singleton', CURRENT_TIMESTAMP)`);
    expect(migration).toContain(
      `INSERT INTO "Organization" ("id", "shortName", "fullName", "updatedAt")`,
    );
    expect(migration).toContain(
      `VALUES ('singleton', 'Demo', 'Example Software Department', CURRENT_TIMESTAMP)`,
    );
    expect(migration.match(/ON CONFLICT \("id"\) DO NOTHING/g)).toHaveLength(2);
  });
});
