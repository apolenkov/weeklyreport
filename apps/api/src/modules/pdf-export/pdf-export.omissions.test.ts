// A PDF prints the unfinished-record totals frozen with the publication its job
// was requested against (openspec: lead-incomplete-record-drafts, task 4.8):
// the job keeps the requester's scoped snapshot, so a later publication, a
// wider scope or a live read never changes what the document says.
import type {
  PdfExportJob,
  RecordOmission,
  UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { createNullLogger } from "../../lib/logger.js";
import { NOOP_PDF_EXPORT_TELEMETRY } from "../../test-utils/pdf-export.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository.js";
import { PdfExportService } from "./pdf-export.service.js";

const REPORT = "40000000-0000-4000-8000-000000000001";
const JOB = "40000000-0000-4000-8000-000000000002";
const GROUP_A = "40000000-0000-4000-8000-00000000000a";
const GROUP_B = "40000000-0000-4000-8000-00000000000b";
const LEAD_A = "40000000-0000-4000-8000-000000000011";
const LEAD_B = "40000000-0000-4000-8000-000000000012";
const PROJECT_A = "40000000-0000-4000-8000-000000000021";
const PROJECT_B = "40000000-0000-4000-8000-000000000022";
const CREATED_AT = new Date("2026-04-22T12:00:00.000Z");

const head: UserSession = {
  userId: "40000000-0000-4000-8000-000000000031",
  email: "head@example.com",
  name: "Head",
  role: "head",
  reportingGroupId: GROUP_A,
};

const risks = (parentId: string, count: number): RecordOmission => ({
  version: 1,
  buckets: [
    {
      kind: "risk",
      parentKind: "product",
      parentId,
      stageNames: ["Development"],
      count,
    },
  ],
});

interface SectionInput {
  readonly index: number;
  readonly authorId: string;
  readonly groupId: string;
  readonly projectId: string;
  readonly recordOmission?: RecordOmission;
}

function section(input: SectionInput) {
  return {
    reportSectionId: `40000000-0000-4000-8000-0000000001${String(input.index).padStart(2, "0")}`,
    reportId: REPORT,
    authorId: input.authorId,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: "2026-04-20T12:00:00.000Z",
    late: false,
    projects: [
      {
        projectId: input.projectId,
        projectName: "Project",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: input.groupId,
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: input.groupId,
    groupName: "Group",
    ...(input.recordOmission ? { recordOmission: input.recordOmission } : {}),
  };
}

function publication(sections: readonly SectionInput[]) {
  return {
    reportId: REPORT,
    periodStart: "2026-04-15T00:00:00.000Z",
    periodEnd: "2026-04-21T12:00:00.000Z",
    deadline: "2026-04-20T00:00:00.000Z",
    status: "published",
    publishedAt: "2026-04-21T13:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: sections.map(section),
  };
}

const own = (recordOmission?: RecordOmission): SectionInput => ({
  index: 1,
  authorId: LEAD_A,
  groupId: GROUP_A,
  projectId: PROJECT_A,
  ...(recordOmission ? { recordOmission } : {}),
});
const foreign: SectionInput = {
  index: 2,
  authorId: LEAD_B,
  groupId: GROUP_B,
  projectId: PROJECT_B,
  recordOmission: risks(PROJECT_B, 5),
};

const pendingJob: PdfExportJob = {
  jobId: JOB,
  reportId: REPORT,
  status: "queued",
  generation: 1,
  requestedAt: CREATED_AT,
  completedAt: null,
  checksum: null,
  templateVersion: "phase-2-pdf-v1",
  artifactUrl: null,
};

// Job rows live in memory and pass through JSON like the database column; the
// report read serves whichever publication is current at that moment.
function harness(firstPublication: readonly SectionInput[]) {
  const state = { current: publication(firstPublication) };
  const jobs = new Map<string, Record<string, unknown>>();
  const findReport = vi.fn(() =>
    Promise.resolve({ id: REPORT, publishedSnapshot: state.current }),
  );
  const tx = { report: { findFirst: findReport } };
  const prisma = {
    $transaction: (run: (client: typeof tx) => unknown) => run(tx),
    pdfExportJob: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...(JSON.parse(JSON.stringify(data)) as Record<string, unknown>),
          publicationAt: data.publicationAt,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        };
        jobs.set(String(data.id), row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(jobs.get(where.id) ?? null),
    },
  } as unknown as PrismaService;
  const repository = new PdfExportPrismaRepository(prisma);
  const service = new PdfExportService(
    repository,
    createNullLogger(),
    { enqueue: () => Promise.resolve() },
    NOOP_PDF_EXPORT_TELEMETRY,
    {
      PDF_BASE_URL: "http://localhost:3000",
      PDF_EXPORT_JWT_SECRET: "test-pdf-export-secret-at-least-32-chars",
    },
  );

  async function requestJob(session: UserSession): Promise<void> {
    const snapshot = await repository.getPublishedReportForExport(
      REPORT,
      session,
    );
    if (!snapshot) throw new Error("The fixture report must be readable.");
    await repository.createExportJob(pendingJob, session.userId, snapshot);
  }

  return {
    service,
    findReport,
    requestJob,
    republish: (sections: readonly SectionInput[]) => {
      state.current = publication(sections);
    },
  };
}

describe("PDF export omission totals", () => {
  it("prints the totals of the requester's frozen group scope", async () => {
    const { service, requestJob } = harness([
      own(risks(PROJECT_A, 2)),
      foreign,
    ]);
    await requestJob(head);

    const render = await service.getPdfExportRender(JOB, head.userId, REPORT);

    expect(render.leadSections).toHaveLength(1);
    expect(render.recordOmissions).toEqual({
      risks: 2,
      decisions: 0,
      unknown: false,
    });
  });

  it("keeps the first publication's totals when the job renders after a second one", async () => {
    const { service, requestJob, republish, findReport } = harness([
      own(risks(PROJECT_A, 2)),
    ]);
    await requestJob(head);
    republish([own(risks(PROJECT_A, 7))]);
    findReport.mockClear();

    const render = await service.getPdfExportRender(JOB, head.userId, REPORT);

    expect(render.recordOmissions).toEqual({
      risks: 2,
      decisions: 0,
      unknown: false,
    });
    // The render reads the job's own snapshot and never the live report.
    expect(findReport).not.toHaveBeenCalled();
  });

  it("says the total is unknown for a section frozen before counting", async () => {
    const { service, requestJob } = harness([own()]);
    await requestJob(head);

    const render = await service.getPdfExportRender(JOB, head.userId, REPORT);

    expect(render.recordOmissions).toEqual({
      risks: 0,
      decisions: 0,
      unknown: true,
    });
  });

  it("refuses the render to anyone but the job's requester", async () => {
    const { service, requestJob } = harness([own(risks(PROJECT_A, 2))]);
    await requestJob(head);

    await expect(
      service.getPdfExportRender(JOB, LEAD_B, REPORT),
    ).rejects.toThrow(`PDF export job ${JOB} was not found.`);
  });
});
