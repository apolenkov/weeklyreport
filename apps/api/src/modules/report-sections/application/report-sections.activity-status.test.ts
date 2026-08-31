// Activity-status slice of the lead section save: statuses fold onto the
// SEEDED server-side set, an omitted slice keeps the seeded values, and an
// unattached activityId is a hard reject (delete-recreate never trusts client ids).
import type { TrafficLightStatus } from "@customreport/shared";
import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const testGraceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const ACTIVITY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNATTACHED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const baseSection: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Lead 1",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [],
  referencedProjects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [
    {
      activityId: ACTIVITY_A,
      activityName: "Jira triage duty",
      status: "green",
      jiraAccounts: [],
      linkedProducts: [],
      derivedStatus: "green",
      alarmFloor: null,
    },
    {
      activityId: ACTIVITY_B,
      activityName: "Ops rotation",
      status: "green",
      jiraAccounts: [],
      linkedProducts: [],
      derivedStatus: "green",
      alarmFloor: null,
    },
  ],
  reviews: [],
};

function createRepository(
  sections: readonly ReportSectionReadModel[],
): ReportSectionsRepository {
  const store = new Map(
    sections.map((section) => [
      section.reportSectionId,
      structuredClone(section),
    ]),
  );

  return {
    getSectionById(reportSectionId) {
      const section = store.get(reportSectionId);
      return Promise.resolve(section ? structuredClone(section) : null);
    },
    getReportPeriodWriteGateForSection() {
      return Promise.resolve({ periodStatus: "open", archived: false });
    },
    getReportMeta: reportMetaReader(OPEN_REPORT_META),
    getPublishedLineage() {
      return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
    },
    saveSection(nextSection) {
      const saved = structuredClone(nextSection);
      store.set(saved.reportSectionId, saved);
      return Promise.resolve(structuredClone(saved));
    },
    getMyHistoryPage() {
      return Promise.resolve({ items: [], nextCursor: null });
    },
  };
}

function draftPayload(
  activityStatuses?: {
    activityId: string;
    status?: TrafficLightStatus | null;
    note?: string | null;
  }[],
) {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: activityStatuses ?? [],
    items: [],
    risks: [],
    decisions: [],
  };
}

describe("ReportSectionsService — activity statuses on saveDraft", () => {
  it("folds written statuses onto the seeded set, keeping omitted entries", async () => {
    const service = new ReportSectionsService(
      createRepository([baseSection]),
      testGraceSettings,
    );

    const saved = await service.saveDraft(
      draftPayload([
        { activityId: ACTIVITY_A, status: "red", note: "Blocked on vendor" },
      ]),
      AUTHOR_ID,
    );

    // mergeSection folds status/note onto the seeded slice; the read-only
    // `linkedProducts` / `derivedStatus` ride through unchanged (they are
    // re-derived on the next DB read, never persisted).
    expect(saved.activities).toEqual([
      {
        activityId: ACTIVITY_A,
        activityName: "Jira triage duty",
        alarmFloor: null,
        status: "red",
        note: "Blocked on vendor",
        jiraAccounts: [],
        linkedProducts: [],
        derivedStatus: "green",
      },
      // Not in the payload → seeded value survives untouched.
      {
        activityId: ACTIVITY_B,
        activityName: "Ops rotation",
        alarmFloor: null,
        status: "green",
        jiraAccounts: [],
        linkedProducts: [],
        derivedStatus: "green",
      },
    ]);
  });

  it("keeps every seeded status when the payload omits the slice entirely", async () => {
    const service = new ReportSectionsService(
      createRepository([baseSection]),
      testGraceSettings,
    );

    const saved = await service.saveDraft(draftPayload(), AUTHOR_ID);

    expect(saved.activities.map((a) => a.status)).toEqual(["green", "green"]);
  });

  it("hard-rejects a status for an unattached activity", async () => {
    const service = new ReportSectionsService(
      createRepository([baseSection]),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        draftPayload([{ activityId: UNATTACHED, status: "red" }]),
        AUTHOR_ID,
      ),
    ).rejects.toMatchObject({
      name: "ReportSectionDomainError",
      code: "ACTIVITY_NOT_ATTACHED",
    });
  });

  it("the reject is a ReportSectionDomainError (maps to BAD_REQUEST)", async () => {
    const service = new ReportSectionsService(
      createRepository([baseSection]),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        draftPayload([{ activityId: UNATTACHED, status: "red" }]),
        AUTHOR_ID,
      ),
    ).rejects.toBeInstanceOf(ReportSectionDomainError);
  });

  it("saves cleanly after a detach: the re-fetched form no longer carries the activity", async () => {
    // Detach cascades the seeded row away, so a re-fetched section (and the
    // form payload built from it) simply omit the detached activity — the
    // save must succeed without it.
    const afterDetach: ReportSectionReadModel = {
      ...structuredClone(baseSection),
      activities: baseSection.activities.filter(
        (activity) => activity.activityId !== ACTIVITY_B,
      ),
    };
    const service = new ReportSectionsService(
      createRepository([afterDetach]),
      testGraceSettings,
    );

    const saved = await service.saveDraft(
      draftPayload([{ activityId: ACTIVITY_A, status: "yellow" }]),
      AUTHOR_ID,
    );

    expect(saved.activities.map((a) => a.activityId)).toEqual([ACTIVITY_A]);
  });

  it("an in-flight save from a form loaded before the detach fails loudly (fail-closed)", async () => {
    // A stale open form can still send the detached id; that save is rejected
    // with ACTIVITY_NOT_ATTACHED (never silently dropped), and the reloaded
    // form is consistent — see ProjectActivityService.detachLead.
    const afterDetach: ReportSectionReadModel = {
      ...structuredClone(baseSection),
      activities: baseSection.activities.filter(
        (activity) => activity.activityId !== ACTIVITY_B,
      ),
    };
    const service = new ReportSectionsService(
      createRepository([afterDetach]),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        draftPayload([{ activityId: ACTIVITY_B, status: "red" }]),
        AUTHOR_ID,
      ),
    ).rejects.toMatchObject({
      name: "ReportSectionDomainError",
      code: "ACTIVITY_NOT_ATTACHED",
    });
  });

  it("two authors of one activity keep independent statuses (per-section rows)", async () => {
    // Same activity seeded on two sections; each service write only touches
    // its own section's rows — the sibling's status is untouched.
    const sectionB: ReportSectionReadModel = {
      ...structuredClone(baseSection),
      reportSectionId: "99999999-9999-4999-8999-999999999999",
      authorId: "88888888-8888-4888-8888-888888888888",
      authorName: "Lead 2",
    };
    const repository = createRepository([baseSection, sectionB]);
    const service = new ReportSectionsService(repository, testGraceSettings);

    await service.saveDraft(
      draftPayload([{ activityId: ACTIVITY_A, status: "red" }]),
      AUTHOR_ID,
    );
    const savedB = await service.saveDraft(
      {
        ...draftPayload([{ activityId: ACTIVITY_A, status: "green" }]),
        reportSectionId: sectionB.reportSectionId,
      },
      sectionB.authorId,
    );
    const savedA = await service.getActiveSection(baseSection.reportSectionId);

    expect(savedA.activities[0]?.status).toBe("red");
    expect(savedB.activities[0]?.status).toBe("green");
  });
});
