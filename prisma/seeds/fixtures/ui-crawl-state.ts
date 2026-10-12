import "dotenv/config";

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@prisma/client";
import {
  buildAssembledReportFromPrismaRow,
  parsePublishedSnapshot,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "@weeklyreport/report-persistence";
import {
  buildPublishedProjections,
  currentPeriodLifecycleSchema,
  REOPEN_AUTO_CLOSE_NOTES,
} from "@weeklyreport/shared";
import pg from "pg";

import { buildTransition } from "../../../apps/api/src/modules/period/domain/period-transition.js";
import {
  lockAllReminderPolicies,
  pauseReminderRulesForReport,
  synchronizeReminderRulesForReport,
} from "../../../apps/api/src/modules/reminders/reminder-rule-reconcile.prisma.js";
import { applyRevokeTransition } from "../../../apps/api/src/modules/report-sections/application/revoke-transition.js";
import {
  CRAWL_AUTHOR_ID,
  CRAWL_REPORT_ID,
  type CrawlState,
  type CrawlStateManifest,
  parseCrawlState,
  readStateManifest,
} from "../../../scripts/ui-crawl/states.ts";
import {
  assertE2eRuntimeDestructive,
  parseE2eRuntimeDatabaseTarget,
} from "../../guards/_destructive-guard.js";
import { isEntrypoint } from "../../guards/_entrypoint.js";
import { requireEnv } from "../../guards/_require-env.js";
import { runSeedProfile } from "../profiles/seed-profile-runner.js";
import { provisionalPublishedSnapshot } from "../support/published-snapshot.js";
import {
  ACTIVE_REPORT_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
} from "../support/seed-constants.js";

const RETURN_COMMENT =
  "UI crawl fixture: clarify the delivery date and resubmit.";
const REVIEW_ID = "a0000000-0000-4000-8000-00000000c701";
const SCRIPT_NAME = "ui-crawl-state";

async function freezeSnapshot(tx: Prisma.TransactionClient): Promise<void> {
  // Same assembly and frozen projection boundary as the canonical seed.
  const row = await tx.report.findUniqueOrThrow({
    where: { id: ACTIVE_REPORT_ID },
    include: reportFullIncludeForSnapshot,
  });
  const snapshot = buildAssembledReportFromPrismaRow(row);
  const snapshotJson = toPublishedSnapshotJson(snapshot);
  const parsed = parsePublishedSnapshot(snapshotJson);
  assert(parsed !== null, "Publication assembly must produce a valid snapshot");
  const projections = buildPublishedProjections(parsed);
  await tx.report.update({
    where: { id: ACTIVE_REPORT_ID },
    data: { publishedSnapshot: snapshotJson },
  });
  await tx.publishedSearchDocument.deleteMany({
    where: { reportId: ACTIVE_REPORT_ID },
  });
  await tx.publishedSectionScope.deleteMany({
    where: { reportId: ACTIVE_REPORT_ID },
  });
  if (projections.sectionScopes.length > 0) {
    await tx.publishedSectionScope.createMany({
      data: [...projections.sectionScopes],
    });
  }
  if (projections.searchDocuments.length > 0) {
    await tx.publishedSearchDocument.createMany({
      data: [...projections.searchDocuments],
    });
  }
}

async function publishFixture(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<void> {
  const report = await tx.report.findUniqueOrThrow({
    where: { id: ACTIVE_REPORT_ID },
  });
  const head = await tx.user.findUniqueOrThrow({ where: { id: HEAD_USER_ID } });
  assert(
    report.deadline !== null,
    "The full fixture report must have a deadline",
  );
  await tx.report.update({
    where: { id: ACTIVE_REPORT_ID },
    data: {
      ...buildTransition("publish", { now, userId: HEAD_USER_ID }),
      publishedSnapshot: provisionalPublishedSnapshot({
        reportId: report.id,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        deadline: report.deadline,
        publishedAt: now,
        publishedById: head.id,
        publishedByName: head.name,
      }),
    },
  });
  await pauseReminderRulesForReport(tx, ACTIVE_REPORT_ID);
  await freezeSnapshot(tx);
}

async function prepareSection(
  tx: Prisma.TransactionClient,
  state: CrawlState,
): Promise<void> {
  const section = await tx.reportSection.findUniqueOrThrow({
    where: {
      reportId_authorId: { reportId: ACTIVE_REPORT_ID, authorId: LEAD_1_ID },
    },
  });
  assert.equal(
    section.status,
    "submitted",
    "Full seed must start with the primary Lead submitted",
  );
  if (state === "draft" || state === "closed") {
    await tx.reportSection.update({
      where: { id: section.id },
      data: {
        status: "draft",
        submittedAt: null,
        revokedAt: null,
        revokedBy: null,
      },
    });
  }
  if (state === "returned") {
    await tx.sectionReview.create({
      data: {
        id: REVIEW_ID,
        reportSectionId: section.id,
        reviewerId: HEAD_USER_ID,
        judgedVersion: section.version,
        verdict: "changes_requested",
        comment: RETURN_COMMENT,
      },
    });
    assert.equal(
      await applyRevokeTransition(tx, section.id, HEAD_USER_ID, {
        scope: { reportId: ACTIVE_REPORT_ID, authorId: LEAD_1_ID },
        expectedVersion: section.version,
      }),
      1,
    );
  }
}

async function prepareState(
  prisma: PrismaClient,
  state: CrawlState,
): Promise<void> {
  assertE2eRuntimeDestructive(SCRIPT_NAME);
  await prisma.$transaction(async (tx) => {
    const policies = await lockAllReminderPolicies(tx);
    const now = new Date();
    await prepareSection(tx, state);
    if (state === "published" || state === "archived" || state === "reopened") {
      await publishFixture(tx, now);
    }
    if (state === "archived" || state === "closed") {
      await tx.report.update({
        where: { id: ACTIVE_REPORT_ID },
        data: buildTransition("archive", {}),
      });
      await pauseReminderRulesForReport(tx, ACTIVE_REPORT_ID);
    }
    if (state === "reopened") {
      await tx.report.update({
        where: { id: ACTIVE_REPORT_ID },
        data: buildTransition("reopen", { now }),
      });
      await tx.reportSection.updateMany({
        where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
        data: { status: "draft", submittedAt: null },
      });
      await tx.reopenRequest.updateMany({
        where: {
          status: "pending",
          reportSection: { reportId: ACTIVE_REPORT_ID },
        },
        data: {
          status: "rejected",
          reviewedAt: now,
          reviewNote: REOPEN_AUTO_CLOSE_NOTES.periodReopened,
        },
      });
      await synchronizeReminderRulesForReport(
        tx,
        policies,
        ACTIVE_REPORT_ID,
        now,
      );
    }
  });
}

async function observeState(
  prisma: PrismaClient,
): Promise<Pick<CrawlStateManifest, "sectionId" | "observed">> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: ACTIVE_REPORT_ID },
  });
  currentPeriodLifecycleSchema.parse(report);
  const section = await prisma.reportSection.findUniqueOrThrow({
    where: {
      reportId_authorId: { reportId: ACTIVE_REPORT_ID, authorId: LEAD_1_ID },
    },
    include: { sectionReviews: true },
  });
  const snapshot = parsePublishedSnapshot(report.publishedSnapshot);
  if (report.status === "published") {
    assert(
      snapshot !== null && snapshot.sections.length > 0,
      "Published fixture needs a populated frozen snapshot",
    );
    assert.equal(snapshot.reportId, report.id);
    assert(
      snapshot.sections.some((entry) => entry.authorId === LEAD_1_ID),
      "The primary Lead must be present in the publication",
    );
    assert(
      (await prisma.publishedSectionScope.count({
        where: { reportId: report.id },
      })) > 0,
    );
  }
  const review = section.sectionReviews.find(
    (entry) => entry.reviewerId === HEAD_USER_ID,
  );
  if (review) {
    assert.equal(
      review.judgedVersion,
      section.version,
      "The returned verdict must be current",
    );
    assert.equal(section.revokedBy, HEAD_USER_ID);
    assert(section.revokedAt !== null);
  }
  assert.equal(section.submittedAt !== null, section.status === "submitted");
  return {
    sectionId: section.id,
    observed: {
      periodState: report.periodState,
      status: report.status,
      periodStatus: report.periodStatus,
      archived: report.archived,
      sectionStatus: section.status,
      sectionVersion: section.version,
      hasPublishedSnapshot: snapshot !== null,
      reviewVerdict: review?.verdict ?? null,
      reviewComment: review?.comment ?? null,
    },
  };
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: { manifest: { type: "string" } },
    allowPositionals: true,
  });
  assert.equal(
    positionals.length,
    1,
    "Usage: ui-crawl-state.ts <state> --manifest <path>",
  );
  const state = parseCrawlState(positionals[0]);
  assert(values.manifest, "--manifest is required before any fixture write");
  assert.equal(ACTIVE_REPORT_ID, CRAWL_REPORT_ID);
  assert.equal(LEAD_1_ID, CRAWL_AUTHOR_ID);
  assertE2eRuntimeDestructive(SCRIPT_NAME);
  const databaseUrl = requireEnv("DATABASE_URL");
  const target = parseE2eRuntimeDatabaseTarget(SCRIPT_NAME, databaseUrl);
  assert.match(
    target.database,
    /^weeklyreport_e2e(?:_lane_[ab]_test)?$/u,
    "Unprovisioned lanes are not authorized",
  );
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(target.host),
    "The crawler manifest supports only canonical loopback hosts",
  );
  const targetUrl = `postgresql://***@${target.host}:${target.port}/${target.database}`;
  console.log(`[${SCRIPT_NAME}] Target: ${targetUrl}; state: ${state}`);
  runSeedProfile("full");
  assertE2eRuntimeDestructive(SCRIPT_NAME);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await prepareState(prisma, state);
    const manifest = readStateManifest(
      {
        version: 1,
        state,
        seedProfile: "full",
        target,
        targetUrl,
        reportId: ACTIVE_REPORT_ID,
        authorId: LEAD_1_ID,
        preparedAt: new Date().toISOString(),
        ...(await observeState(prisma)),
        specs: [
          "period-dual-state",
          "published-portfolio-snapshot",
          "reopen-requests",
          "demo-seed-datasets",
        ],
      },
      state,
    );
    mkdirSync(dirname(values.manifest), { recursive: true });
    writeFileSync(values.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `[${SCRIPT_NAME}] Verified database read-back: ${values.manifest}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(`[${SCRIPT_NAME}] Failed:`, error);
    process.exitCode = 1;
  });
}
