import 'dotenv/config';

import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, ReportSectionStatus, ReportStatus, TrafficLightStatus, ItemType, ItemWorkflowStatus } from '@prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const leadSeeds = [
  { id: 'a0000000-0000-4000-8000-000000000001', email: 'lead1@customreport.local', name: 'Lead 1', samlId: 'lead-1' },
  { id: 'a0000000-0000-4000-8000-000000000002', email: 'lead2@customreport.local', name: 'Lead 2', samlId: 'lead-2' },
  { id: 'a0000000-0000-4000-8000-000000000003', email: 'lead3@customreport.local', name: 'Lead 3', samlId: 'lead-3' },
  { id: 'a0000000-0000-4000-8000-000000000004', email: 'lead4@customreport.local', name: 'Lead 4', samlId: 'lead-4' },
  { id: 'a0000000-0000-4000-8000-000000000005', email: 'lead5@customreport.local', name: 'Lead 5', samlId: 'lead-5' },
  { id: 'a0000000-0000-4000-8000-000000000006', email: 'lead6@customreport.local', name: 'Lead 6', samlId: 'lead-6' },
] as const;

async function main() {
  const head = await prisma.user.upsert({
    where: { email: 'head@customreport.local' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000099',
      email: 'head@customreport.local',
      name: 'Department Head',
      role: Role.head,
      samlId: 'head-1',
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@customreport.local' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000098',
      email: 'viewer@customreport.local',
      name: 'Report Viewer',
      role: Role.viewer,
      samlId: 'viewer-1',
    },
  });

  const leads = await Promise.all(
    leadSeeds.map((lead) =>
      prisma.user.upsert({
        where: { email: lead.email },
        update: {},
        create: {
          id: lead.id,
          email: lead.email,
          name: lead.name,
          samlId: lead.samlId,
          role: Role.lead,
        },
      }),
    ),
  );

  const report = await prisma.report.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000101' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000101',
      periodStart: new Date('2026-04-06T00:00:00.000Z'),
      periodEnd: new Date('2026-04-12T23:59:59.000Z'),
      deadline: new Date('2026-04-10T15:00:00.000Z'),
      status: ReportStatus.draft,
      publishedById: head.id,
    },
  });

  for (const [index, lead] of leads.entries()) {
    const projectId = `a0000000-0000-4000-8000-00000000020${index}`;
    const project = await prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        name: `Project ${index + 1}`,
        leadId: lead.id,
      },
    });

    const section = await prisma.reportSection.upsert({
      where: {
        reportId_authorId: {
          reportId: report.id,
          authorId: lead.id,
        },
      },
      update: {},
      create: {
        reportId: report.id,
        authorId: lead.id,
        status: index === 0 ? ReportSectionStatus.submitted : ReportSectionStatus.draft,
        submittedAt: index === 0 ? new Date('2026-04-09T10:00:00.000Z') : null,
      },
    });

    await prisma.projectStatus.upsert({
      where: {
        reportSectionId_projectId: {
          reportSectionId: section.id,
          projectId: project.id,
        },
      },
      update: {},
      create: {
        reportSectionId: section.id,
        projectId: project.id,
        status: index === 0 ? TrafficLightStatus.green : TrafficLightStatus.yellow,
      },
    });

    const itemId = `a0000000-0000-4000-8000-00000003${index}000`;
    await prisma.item.upsert({
      where: { id: itemId },
      update: {},
      create: {
        id: itemId,
        reportSectionId: section.id,
        projectId: project.id,
        type: ItemType.current,
        text: `Current week update for ${project.name}`,
        tag: 'feature',
        workflowStatus: ItemWorkflowStatus.in_progress,
      },
    });

    for (const rank of [1, 2, 3]) {
      await prisma.priority.upsert({
        where: {
          reportSectionId_rank: {
            reportSectionId: section.id,
            rank,
          },
        },
        update: {},
        create: {
          reportSectionId: section.id,
          rank,
          text: `Priority ${rank} for ${project.name}`,
        },
      });
    }
  }

  console.log(`Seeded: ${leads.length} leads, 1 head (${head.id}), 1 viewer (${viewer.id}), 1 report, ${leads.length} projects`);
}

void main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
