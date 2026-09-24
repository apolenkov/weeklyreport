import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  AUTHOR_ID,
  createMockRepository,
  draftSection,
  forPeriod,
  HEAD_GROUP_ID,
  OTHER_USER_ID,
  PROJECT_ID,
  REPORT_ID,
} from "./__tests__/lead-form-contract-harness.js";
import {
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormRepository,
  LeadFormService,
} from "./lead-form.service";

// ---------------------------------------------------------------------------
// getByPeriod — lead cross-author product scoping
// ---------------------------------------------------------------------------

const UNSHARED_PROJECT_ID = "44444444-4444-4444-8444-555555555555";
const STAGE_BUILD = "55555555-5555-4555-8555-555555555551";
const STAGE_TEST = "55555555-5555-4555-8555-555555555552";
const OTHER_GROUP_ID = "66666666-6666-4666-8666-666666666662";

// A foreign section (authored by OTHER_USER_ID) on TWO products: PROJECT_ID is
// shared with the viewer, UNSHARED_PROJECT_ID is the author's alone.
function foreignSectionWithTwoProducts(): ReportSectionReadModel {
  return {
    ...structuredClone(draftSection),
    authorId: OTHER_USER_ID,
    authorName: "Lead 2",
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Shared Alpha",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: STAGE_BUILD,
            stageName: "Build",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [{ stageId: STAGE_BUILD, stageName: "Build", sortOrder: 0 }],
        ownerGroupId: "66666666-6666-4666-8666-666666666661",
      },
      {
        projectId: UNSHARED_PROJECT_ID,
        projectName: "Secret Beta",
        trafficLight: "red",
        ownedStages: [
          {
            stageId: STAGE_TEST,
            stageName: "Test",
            sortOrder: 1,
            status: "red",
          },
        ],
        stageSet: [{ stageId: STAGE_TEST, stageName: "Test", sortOrder: 1 }],
        ownerGroupId: "66666666-6666-4666-8666-666666666662",
      },
    ],
    referencedProjects: [
      { projectId: UNSHARED_PROJECT_ID, projectName: "Secret Beta" },
    ],
    items: [
      {
        projectId: PROJECT_ID,
        type: "current",
        text: "Shared current",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
      {
        projectId: PROJECT_ID,
        type: "next",
        text: "Shared next",
        tag: "plan",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
      {
        projectId: UNSHARED_PROJECT_ID,
        type: "current",
        text: "Secret current",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
      {
        projectId: UNSHARED_PROJECT_ID,
        type: "next",
        text: "Secret next",
        tag: "plan",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
    ],
    risks: [
      {
        projectId: PROJECT_ID,
        risk: "Shared risk",
        impact: "i",
        mitigation: "m",
        severity: "at-risk",
        stageNames: ["Development"],
      },
      {
        projectId: UNSHARED_PROJECT_ID,
        risk: "Secret risk",
        impact: "i",
        mitigation: "m",
        severity: "blocked",
        stageNames: ["Development"],
      },
    ],
    decisions: [
      {
        productId: PROJECT_ID,
        text: "Shared decision",
        owner: "o",
        impact: "i",
        deadline: null,
        stageNames: ["Development"],
      },
      {
        productId: UNSHARED_PROJECT_ID,
        text: "Secret decision",
        owner: "o",
        impact: "i",
        deadline: null,
        stageNames: ["Development"],
      },
      // A cross-cutting decision with no product scope (productId null). It has
      // no shared product identity, so the co-lead filter drops it.
      {
        productId: null,
        text: "Cross-cutting decision",
        owner: "o",
        impact: "i",
        deadline: null,
        stageNames: ["Development"],
      },
    ],
  };
}

// Repo where AUTHOR_ID owns a section, OTHER_USER_ID owns the two-product
// foreign section, and the pair co-owns the non-archived PROJECT_ID.
function crossAuthorRepo(
  overrides: Partial<LeadFormRepository> = {},
): LeadFormRepository {
  return createMockRepository({
    getSectionForPeriod: vi
      .fn()
      .mockImplementation((_reportId: string, authorId: string) =>
        forPeriod(
          authorId === OTHER_USER_ID
            ? foreignSectionWithTwoProducts()
            : structuredClone(draftSection),
          false,
        ),
      ),
    // The head-cross branch reads via this atomic, group-scoped method
    // instead — same fixture data, keyed the same way by `authorId`.
    getSectionForPeriodAsGroupPeer: vi
      .fn()
      .mockImplementation((_reportId: string, authorId: string) =>
        authorId === OTHER_USER_ID
          ? forPeriod(foreignSectionWithTwoProducts(), false)
          : null,
      ),
    getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([PROJECT_ID]),
    // Default: the head (AUTHOR_ID) and every target live in the same group, so
    // a head cross-author read is in-group. Cross-group cases override this.
    getUserReportingGroupId: vi.fn().mockResolvedValue(HEAD_GROUP_ID),
    ...overrides,
  });
}

describe("LeadFormService — getByPeriod cross-author scoping", () => {
  it("returns lineage computed from the product-filtered foreign section", async () => {
    const publishedLineage = {
      itemStableIds: ["shared-item"],
      decisionStableIds: ["shared-decision"],
    };
    const getPublishedLineage = vi.fn().mockResolvedValue(publishedLineage);
    const service = new LeadFormService(
      crossAuthorRepo({ getPublishedLineage }),
    );

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    expect(result.publishedLineage).toEqual(publishedLineage);
    expect(getPublishedLineage).toHaveBeenCalledExactlyOnceWith(result.section);
    expect(result.section.projects.map(({ projectId }) => projectId)).toEqual([
      PROJECT_ID,
    ]);
  });

  it("excludes unshared-product items/risks/decisions and keeps shared ones", async () => {
    const repo = crossAuthorRepo();
    const service = new LeadFormService(repo);

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    // no report-scoped override → the report-independent fallback is used with
    // (viewerId, authorId) only — no reportId.
    expect(repo.getSharedNonArchivedProductIds).toHaveBeenCalledExactlyOnceWith(
      AUTHOR_ID,
      OTHER_USER_ID,
    );
    expect(section.authorId).toBe(OTHER_USER_ID);
    // items — current AND next week
    expect(section.items.map((i) => i.text).sort()).toEqual([
      "Shared current",
      "Shared next",
    ]);
    expect(section.items.every((i) => i.projectId === PROJECT_ID)).toBe(true);
    expect(section.risks.map((r) => r.risk)).toEqual(["Shared risk"]);
    // only the shared-product decision survives; the unshared-product decision
    // and the non-product-scoped (null productId) one are both dropped, mirroring
    // getCrossAuthorContent's sharedIds.has(productId) filter.
    expect(section.decisions.map((d) => d.text)).toEqual(["Shared decision"]);
  });

  it("dispatches the report-scoped co-ownership read with (reportId, viewerId, authorId) and never calls the fallback", async () => {
    const getSharedNonArchivedProductIdsForReport = vi
      .fn()
      .mockResolvedValue([PROJECT_ID]);
    const repo = crossAuthorRepo({ getSharedNonArchivedProductIdsForReport });
    const service = new LeadFormService(repo);

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    // exact dispatch: (reportId, viewerId, requestedAuthorId)
    expect(
      getSharedNonArchivedProductIdsForReport,
    ).toHaveBeenCalledExactlyOnceWith(REPORT_ID, AUTHOR_ID, OTHER_USER_ID);
    // the report-independent fallback is not consulted when the scoped read exists
    expect(repo.getSharedNonArchivedProductIds).not.toHaveBeenCalled();
    // the scoped product set still gates AND filters the foreign section
    expect(section.projects.map((p) => p.projectId)).toEqual([PROJECT_ID]);
    expect(section.items.map((i) => i.text).sort()).toEqual([
      "Shared current",
      "Shared next",
    ]);
  });

  it("drops both a non-product-scoped (null productId) decision and the unshared-product one, mirroring getCrossAuthorContent", async () => {
    const service = new LeadFormService(crossAuthorRepo());

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    const texts = section.decisions.map((d) => d.text);
    // The co-lead lens mirrors getCrossAuthorContent's sharedIds.has(productId):
    // a null-productId (cross-cutting) decision is not on a shared product, so
    // it is dropped here exactly as the Everyone lens drops it.
    expect(texts).not.toContain("Cross-cutting decision");
    // a decision on the author's unshared product is also hidden.
    expect(texts).not.toContain("Secret decision");
    // the shared-product decision survives.
    expect(texts).toContain("Shared decision");
  });

  it("drops the unshared product card, its stage data, and its referenced name", async () => {
    const service = new LeadFormService(crossAuthorRepo());

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    expect(section.projects.map((p) => p.projectId)).toEqual([PROJECT_ID]);
    // no leak of the unshared product's name, traffic light, or stage grid
    const serialized = JSON.stringify(section);
    expect(serialized).not.toContain("Secret Beta");
    expect(serialized).not.toContain(STAGE_TEST);
    // the shared product's card + stage data survive
    const shared = expectDefined(section.projects[0]);
    expect(shared.projectName).toBe("Shared Alpha");
    expect(shared.trafficLight).toBe("green");
    expect(shared.stageSet).toEqual([
      { stageId: STAGE_BUILD, stageName: "Build", sortOrder: 0 },
    ]);
    // referencedProjects recomputed from the filtered rows → unshared name gone
    expect(section.referencedProjects).toEqual([]);
  });

  it("empties activities and drops reviews, keeping shared items/risks/decisions", async () => {
    const withActivitiesAndReviews: ReportSectionReadModel = {
      ...foreignSectionWithTwoProducts(),
      activities: [
        {
          activityId: "77777777-7777-4777-8777-777777777771",
          activityName: "Sensitive activity",
          status: "red",
          jiraAccounts: [],
          note: "Confidential note",
          linkedProducts: [],
          derivedStatus: null,
          alarmFloor: null,
        },
      ],
      reviews: [
        {
          reviewerId: "88888888-8888-4888-8888-888888888881",
          verdict: "approved",
          judgedVersion: 1,
          isCurrent: true,
          createdAt: new Date("2026-04-06T12:00:00Z"),
        },
      ],
    };
    const repo = crossAuthorRepo({
      getSectionForPeriod: vi
        .fn()
        .mockImplementation((_reportId: string, authorId: string) =>
          forPeriod(
            authorId === OTHER_USER_ID
              ? withActivitiesAndReviews
              : structuredClone(draftSection),
            false,
          ),
        ),
    });
    const service = new LeadFormService(repo);

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    expect(section.activities).toEqual([]);
    expect(section.reviews).toEqual([]);
    const serialized = JSON.stringify(section);
    expect(serialized).not.toContain("Confidential note");
    expect(serialized).not.toContain("Sensitive activity");
    // shared-product records survive, still product-scoped
    expect(section.items.map((i) => i.text).sort()).toEqual([
      "Shared current",
      "Shared next",
    ]);
    expect(section.risks.map((r) => r.risk)).toEqual(["Shared risk"]);
    expect(section.decisions.map((d) => d.text)).toEqual(["Shared decision"]);
  });

  it("strips reviewer comments from every retained shared-product record", async () => {
    const reviewerComment = {
      id: "99999999-9999-4999-8999-999999999991",
      reviewerId: "99999999-9999-4999-8999-999999999992",
      reviewerName: "Private Reviewer",
      text: "Private review feedback",
      createdAt: new Date("2026-04-06T12:00:00Z"),
    };
    const foreignSection = foreignSectionWithTwoProducts();
    const sectionWithComments: ReportSectionReadModel = {
      ...foreignSection,
      items: foreignSection.items.map((row) => ({
        ...row,
        comments: [{ ...reviewerComment }],
      })),
      risks: foreignSection.risks.map((row) => ({
        ...row,
        comments: [{ ...reviewerComment }],
      })),
      decisions: foreignSection.decisions.map((row) => ({
        ...row,
        comments: [{ ...reviewerComment }],
      })),
    };
    const repo = crossAuthorRepo({
      getSectionForPeriod: vi
        .fn()
        .mockImplementation((_reportId: string, authorId: string) =>
          forPeriod(
            authorId === OTHER_USER_ID
              ? sectionWithComments
              : structuredClone(draftSection),
            false,
          ),
        ),
    });
    const service = new LeadFormService(repo);

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );
    const retainedRows = [
      ...section.items,
      ...section.risks,
      ...section.decisions,
    ];
    const serialized = JSON.stringify(section);

    expect(retainedRows).toHaveLength(4);
    expect(retainedRows.every((row) => !("comments" in row))).toBe(true);
    expect(serialized).not.toContain(reviewerComment.reviewerName);
    expect(serialized).not.toContain(reviewerComment.text);
  });

  it("returns the full section for the author's own read (no filter)", async () => {
    const service = new LeadFormService(crossAuthorRepo());

    const { section, readOnly } = await service.getByPeriod(
      REPORT_ID,
      OTHER_USER_ID,
    );

    expect(section.projects).toHaveLength(2);
    expect(section.items).toHaveLength(4);
    expect(readOnly).toBe(false);
  });

  it("returns the full section for an in-group head cross-author read (no filter)", async () => {
    const repo = crossAuthorRepo();
    const service = new LeadFormService(repo);

    const { section, readOnly } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    expect(section.authorId).toBe(OTHER_USER_ID);
    expect(section.projects).toHaveLength(2);
    expect(section.items).toHaveLength(4);
    expect(readOnly).toBe(true);
    // group-scoped read never consults product co-ownership
    expect(repo.getSharedNonArchivedProductIds).not.toHaveBeenCalled();
    // the head's cross-author read IS bounded to its own reporting group
    expect(repo.getUserReportingGroupId).toHaveBeenCalledWith(OTHER_USER_ID);
    // the atomic group-scoped read is what actually loaded the section
    expect(repo.getSectionForPeriodAsGroupPeer).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
      AUTHOR_ID,
    );
  });

  it("rejects a head cross-author read for a target in another reporting group", async () => {
    const repo = crossAuthorRepo({
      getUserReportingGroupId: vi
        .fn()
        .mockImplementation((userId: string) =>
          Promise.resolve(
            userId === OTHER_USER_ID ? OTHER_GROUP_ID : HEAD_GROUP_ID,
          ),
        ),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.getByPeriod(REPORT_ID, AUTHOR_ID, "head", OTHER_USER_ID),
    ).rejects.toThrow(LeadFormAccessError);

    // the pre-check rejected before the atomic group-scoped read ever ran
    expect(repo.getSectionForPeriodAsGroupPeer).not.toHaveBeenCalled();
  });

  it("closes the TOCTOU: refuses the read even when the pre-check's group snapshot is stale", async () => {
    // A group reassignment races the read: the separate assertHeadTargetInGroup
    // pre-check passes on the OLD group, but the atomic peer-read re-evaluates
    // membership in the same statement as the section load and fails closed.
    const repo = crossAuthorRepo({
      getUserReportingGroupId: vi.fn().mockResolvedValue(HEAD_GROUP_ID),
      getSectionForPeriodAsGroupPeer: vi.fn().mockResolvedValue(null),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.getByPeriod(REPORT_ID, AUTHOR_ID, "head", OTHER_USER_ID),
    ).rejects.toThrow(LeadFormAccessError);
    await expect(
      service.getByPeriod(REPORT_ID, AUTHOR_ID, "head", OTHER_USER_ID),
    ).rejects.toThrow("Cannot read a section outside your reporting group.");

    // the pre-check DID pass (same group, per the stale snapshot above) — the
    // rejection came from the atomic read itself, proving it re-checks the
    // group rather than trusting the pre-check's result.
    expect(repo.getSectionForPeriodAsGroupPeer).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
      AUTHOR_ID,
    );
  });

  it("lets an admin read a cross-group target (god-mode preserved)", async () => {
    const repo = crossAuthorRepo({
      getUserReportingGroupId: vi
        .fn()
        .mockImplementation((userId: string) =>
          Promise.resolve(
            userId === OTHER_USER_ID ? OTHER_GROUP_ID : HEAD_GROUP_ID,
          ),
        ),
    });
    const service = new LeadFormService(repo);

    const { section } = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "admin",
      OTHER_USER_ID,
    );

    expect(section.authorId).toBe(OTHER_USER_ID);
    expect(section.projects).toHaveLength(2);
    // admin is global — the group check is never consulted
    expect(repo.getUserReportingGroupId).not.toHaveBeenCalled();
  });

  it("denies the read for archived-only sharing instead of falling back to the own section", async () => {
    const repo = crossAuthorRepo({
      // archived-only co-ownership → empty non-archived set
      getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([]),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.getByPeriod(REPORT_ID, AUTHOR_ID, "lead", OTHER_USER_ID),
    ).rejects.toThrow(LeadFormAccessError);

    // the foreign section's status/metadata were never read
    expect(repo.getSectionForPeriod).not.toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
  });

  it("denies the read when the caller has no own section in the report", async () => {
    const repo = crossAuthorRepo({
      // co-ownership EXISTS, but the caller owns no section in this report
      getSectionForPeriod: vi
        .fn()
        .mockImplementation((_reportId: string, authorId: string) =>
          authorId === OTHER_USER_ID
            ? forPeriod(foreignSectionWithTwoProducts(), false)
            : null,
        ),
      getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([PROJECT_ID]),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.getByPeriod(REPORT_ID, AUTHOR_ID, "lead", OTHER_USER_ID),
    ).rejects.toThrow(LeadFormDomainError);

    // report-access precheck runs FIRST: co-ownership is never consulted and the
    // foreign section is never read.
    expect(repo.getSharedNonArchivedProductIds).not.toHaveBeenCalled();
    expect(repo.getSectionForPeriod).not.toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
  });
});
