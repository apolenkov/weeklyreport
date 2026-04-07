import { PrismaClient, Role, ReportSectionStatus, ReportStatus, TrafficLightStatus, ItemType, ItemWorkflowStatus } from '@prisma/client';

const prisma = new PrismaClient();

const leadSeeds = [
  { email: 'lead1@customreport.local', name: 'Lead 1', samlId: 'lead-1' },
  { email: 'lead2@customreport.local', name: 'Lead 2', samlId: 'lead-2' },
  { email: 'lead3@customreport.local', name: 'Lead 3', samlId: 'lead-3' },
  { email: 'lead4@customreport.local', name: 'Lead 4', samlId: 'lead-4' },
  { email: 'lead5@customreport.local', name: 'Lead 5', samlId: 'lead-5' },
  { email: 'lead6@customreport.local', name: 'Lead 6', samlId: 'lead-6' },
] as const;

async function main() {
  const head = await prisma.user.upsert({
    where: { email: 'head@customreport.local' },
    update: {},
    create: {
      email: 'head@customreport.local',
      name: 'Department Head',
      role: Role.head,
      samlId: 'head-1',
    },
  });

  const leads = await Promise.all(
    leadSeeds.map((lead) =>
      prisma.user.upsert({
        where: { email: lead.email },
        update: {},
        create: {
          ...lead,
          role: Role.lead,
        },
      }),
    ),
  );

  const report = await prisma.report.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      periodStart: new Date('2026-04-06T00:00:00.000Z'),
      periodEnd: new Date('2026-04-12T23:59:59.000Z'),
      deadline: new Date('2026-04-10T15:00:00.000Z'),
      status: ReportStatus.draft,
      publishedById: head.id,
    },
  });

  for (const [index, lead] of leads.entries()) {
    const project = await prisma.project.upsert({
      where: { id: `00000000-0000-0000-0000-00000000010${index}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000010${index}`,
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

    await prisma.item.create({
      data: {
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
}

void main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    await prisma.$disconnect();
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
