import 'dotenv/config';

import net from 'node:net';

import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PeriodStatus,
  PrismaClient,
  ReportSectionStatus,
  ReportStatus,
  Role,
} from '@prisma/client';

import { ACTIVE_REPORT_ID, SEED_REPORTS } from './seed-constants.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CountMap = Record<string, number>;

function writeRedisCommand(command: string, ...args: string[]): Buffer {
  const parts = [command, ...args];
  return Buffer.from(
    '*' +
      parts.length +
      '\r\n' +
      parts
        .map((part) => '$' + Buffer.byteLength(part) + '\r\n' + part)
        .join('\r\n') +
      '\r\n',
    'utf8',
  );
}

async function flushRedisDb(): Promise<
  { flushed: true } | { flushed: false; reason: string }
> {
  if (process.env.MANUAL_UAT_WIPE_FLUSH_REDIS === 'false') {
    return { flushed: false, reason: 'disabled-by-env' };
  }

  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? '6379');
  if (!Number.isInteger(port) || port <= 0) {
    return { flushed: false, reason: 'invalid-redis-port' };
  }

  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ flushed: false, reason: 'timeout' });
    }, 5_000);

    let response = '';
    socket.once('connect', () => {
      socket.write(writeRedisCommand('FLUSHDB'));
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (!response.includes('\r\n')) return;
      clearTimeout(timer);
      socket.end();
      if (response.startsWith('+OK')) {
        resolve({ flushed: true });
      } else {
        resolve({ flushed: false, reason: response.trim().slice(0, 200) });
      }
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      resolve({ flushed: false, reason: error.message });
    });
    socket.once('close', () => {
      clearTimeout(timer);
    });
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Manual UAT wipe is forbidden when NODE_ENV=production.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const baseCounts = {
      users: await tx.user.count(),
      leads: await tx.user.count({ where: { role: Role.lead } }),
      projects: await tx.project.count({ where: { archived: false } }),
      stages: await tx.stage.count(),
      stageAssignments: await tx.stageAssignment.count(),
      appSettings: await tx.appSettings.count(),
    };

    if (
      baseCounts.leads === 0 ||
      baseCounts.projects === 0 ||
      baseCounts.stageAssignments === 0
    ) {
      throw new Error(
        'Manual UAT wipe needs seeded base users, products, and stage assignments. Run pnpm db:seed:advanced first.',
      );
    }

    const before = {
      reports: await tx.report.count(),
      sections: await tx.reportSection.count(),
      projectStatuses: await tx.projectStatus.count(),
      items: await tx.item.count(),
      risks: await tx.risk.count(),
      decisions: await tx.decision.count(),
      priorities: await tx.priority.count(),
      pdfExportJobs: await tx.pdfExportJob.count(),
      reminderRules: await tx.reminderRule.count({
        where: { reportId: { not: null } },
      }),
      reminderExecutions: await tx.reminderExecution.count(),
      carryOverExecutions: await tx.carryOverExecution.count(),
      carryOverRecords: await tx.carryOverRecord.count(),
      reopenRequests: await tx.reopenRequest.count(),
      versionSnapshots: await tx.versionSnapshot.count(),
      aiInsights: await tx.aiInsight.count(),
    };

    const deleted: CountMap = {
      reminderExecutions: (await tx.reminderExecution.deleteMany({})).count,
      reportBoundReminderRules: (
        await tx.reminderRule.deleteMany({ where: { reportId: { not: null } } })
      ).count,
      carryOverRecords: (await tx.carryOverRecord.deleteMany({})).count,
      carryOverExecutions: (await tx.carryOverExecution.deleteMany({})).count,
      pdfExportJobs: (await tx.pdfExportJob.deleteMany({})).count,
      reopenRequests: (await tx.reopenRequest.deleteMany({})).count,
      versionSnapshots: (await tx.versionSnapshot.deleteMany({})).count,
      priorities: (await tx.priority.deleteMany({})).count,
      decisions: (await tx.decision.deleteMany({})).count,
      risks: (await tx.risk.deleteMany({})).count,
      items: (await tx.item.deleteMany({})).count,
      projectStatuses: (await tx.projectStatus.deleteMany({})).count,
      reportSections: (await tx.reportSection.deleteMany({})).count,
      aiInsights: (await tx.aiInsight.deleteMany({})).count,
      reports: (await tx.report.deleteMany({})).count,
    };

    const settings = await tx.appSettings.findUnique({
      where: { id: 'singleton' },
    });
    if (!settings) {
      await tx.appSettings.create({
        data: {
          id: 'singleton',
          departmentName: 'Core Development',
          autoCreatePeriods: false,
          defaultDeadlineDays: 5,
        },
      });
    }

    const report = await tx.report.create({
      data: {
        id: ACTIVE_REPORT_ID,
        periodStart: new Date(SEED_REPORTS.active.periodStart),
        periodEnd: new Date(SEED_REPORTS.active.periodEnd),
        deadline: new Date(SEED_REPORTS.active.deadline),
        weekLabel: SEED_REPORTS.active.weekLabel,
        periodStatus: PeriodStatus.open,
        status: ReportStatus.draft,
      },
    });

    const leads = await tx.user.findMany({
      where: { role: Role.lead },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, email: true, name: true },
    });

    const sections: Array<{ id: string; authorId: string }> = [];
    for (const lead of leads) {
      const section = await tx.reportSection.create({
        data: {
          reportId: report.id,
          authorId: lead.id,
          status: ReportSectionStatus.draft,
        },
        select: { id: true, authorId: true },
      });
      sections.push(section);
    }

    const projectStatusRows: Array<{
      reportSectionId: string;
      projectId: string;
      status: null;
    }> = [];
    for (const section of sections) {
      const projects = await tx.project.findMany({
        where: {
          archived: false,
          OR: [
            { leadId: section.authorId },
            { stageAssignments: { some: { userId: section.authorId } } },
          ],
        },
        select: { id: true },
        orderBy: { name: 'asc' },
      });

      for (const project of projects) {
        projectStatusRows.push({
          reportSectionId: section.id,
          projectId: project.id,
          status: null,
        });
      }
    }

    if (projectStatusRows.length > 0) {
      await tx.projectStatus.createMany({
        data: projectStatusRows,
        skipDuplicates: true,
      });
    }

    const after = {
      reports: await tx.report.count(),
      openReports: await tx.report.count({
        where: { periodStatus: PeriodStatus.open },
      }),
      publishedReports: await tx.report.count({
        where: { periodStatus: PeriodStatus.published },
      }),
      sections: await tx.reportSection.count(),
      projectStatuses: await tx.projectStatus.count(),
      items: await tx.item.count(),
      risks: await tx.risk.count(),
      decisions: await tx.decision.count(),
      priorities: await tx.priority.count(),
      pdfExportJobs: await tx.pdfExportJob.count(),
      reminderExecutions: await tx.reminderExecution.count(),
      carryOverExecutions: await tx.carryOverExecution.count(),
      reopenRequests: await tx.reopenRequest.count(),
      versionSnapshots: await tx.versionSnapshot.count(),
      aiInsights: await tx.aiInsight.count(),
    };

    return {
      baseCounts,
      before,
      deleted,
      after,
      activeReport: {
        id: report.id,
        weekLabel: report.weekLabel,
        periodStart: report.periodStart.toISOString(),
        periodEnd: report.periodEnd.toISOString(),
        leadSections: leads.length,
        projectStatuses: projectStatusRows.length,
      },
    };
  });

  const redis = await flushRedisDb();

  console.log(
    '[wipe-manual-uat] Done: ' + JSON.stringify({ ...result, redis }),
  );
}

void main()
  .catch((error) => {
    console.error('[wipe-manual-uat] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
