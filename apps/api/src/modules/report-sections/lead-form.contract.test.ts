import { describe, expect, it, vi } from "vitest";

import type {
  ReportSectionReadModel,
  VersionSnapshot,
} from "@customreport/shared";

import {
  LeadFormDomainError,
  LeadFormService,
  type LeadFormRepository,
} from "./lead-form.service";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_SECTION_ID = "11111111-1111-4111-8111-222222222222";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "33333333-3333-4333-8333-444444444444";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

const draftSection: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Lead 1",
  status: "draft",
  submittedAt: null,
  projects: [
    { projectId: PROJECT_ID, projectName: "Project Alpha", trafficLight: null },
  ],
  items: [
    {
      projectId: PROJECT_ID,
      type: "current",
      text: "Deliver feature X",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
    },
  ],
  risks: [],
  decisions: [],
  priorities: [{ rank: 1, text: "Priority 1" }],
};

const submittedSection: ReportSectionReadModel = {
  ...draftSection,
  status: "submitted",
  submittedAt: new Date("2026-04-06T12:00:00Z"),
  projects: [
    { ...expectDefined(draftSection.projects[0]), trafficLight: "green" },
  ],
};

const sampleVersions: VersionSnapshot[] = [
  {
    id: "aaaa1111-1111-4111-8111-111111111111",
    reportSectionId: SECTION_ID,
    version: 3,
    createdAt: new Date("2026-04-08T10:00:00Z"),
    itemCount: 0,
    riskCount: 0,
    decisionCount: 0,
  },
  {
    id: "aaaa2222-2222-4222-8222-222222222222",
    reportSectionId: SECTION_ID,
    version: 2,
    createdAt: new Date("2026-04-07T10:00:00Z"),
    itemCount: 0,
    riskCount: 0,
    decisionCount: 0,
  },
  {
    id: "aaaa3333-3333-4333-8333-333333333333",
    reportSectionId: SECTION_ID,
    version: 1,
    createdAt: new Date("2026-04-06T10:00:00Z"),
    itemCount: 0,
    riskCount: 0,
    decisionCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------

function createMockRepository(
  overrides: Partial<LeadFormRepository> = {},
): LeadFormRepository {
  return {
    getSectionById: vi.fn().mockResolvedValue(null),
    getSectionForPeriod: vi.fn().mockResolvedValue(null),
    revokeSectionSubmission: vi.fn().mockResolvedValue(undefined),
    fillFromSection: vi.fn().mockResolvedValue(5),
    listVersions: vi.fn().mockResolvedValue([]),
    restoreVersion: vi.fn().mockResolvedValue(1),
    createVersionSnapshot: vi.fn().mockResolvedValue(undefined),
    createReopenRequest: vi.fn().mockResolvedValue(undefined),
    hasSharedProduct: vi.fn().mockResolvedValue(false),
    getCrossAuthors: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// revokeSubmission (API-03)
// ---------------------------------------------------------------------------

describe("LeadFormService — revokeSubmission", () => {
  it("succeeds for a submitted section", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    const result = await service.revokeSubmission(SECTION_ID, OTHER_USER_ID);

    expect(result).toEqual({ success: true });
    expect(repo.revokeSectionSubmission).toHaveBeenCalledWith(
      SECTION_ID,
      OTHER_USER_ID,
    );
  });

  it("fails for a draft section", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow("Only submitted sections can be revoked.");
  });

  it("fails when section does not exist", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow(`Section ${SECTION_ID} not found.`);
  });
});

// ---------------------------------------------------------------------------
// fillFrom (API-07)
// ---------------------------------------------------------------------------

describe("LeadFormService — fillFrom", () => {
  it("creates a version snapshot before overwriting", async () => {
    const callOrder: string[] = [];

    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      createVersionSnapshot: vi.fn().mockImplementation(async () => {
        callOrder.push("snapshot");
      }),
      fillFromSection: vi.fn().mockImplementation(async () => {
        callOrder.push("fill");
        return 7;
      }),
    });
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(
      SECTION_ID,
      SOURCE_SECTION_ID,
      AUTHOR_ID,
    );

    expect(result).toEqual({ success: true, copiedItems: 7 });
    expect(callOrder).toEqual(["snapshot", "fill"]);
    expect(repo.createVersionSnapshot).toHaveBeenCalledWith(SECTION_ID);
    expect(repo.fillFromSection).toHaveBeenCalledWith(
      SECTION_ID,
      SOURCE_SECTION_ID,
    );
  });

  it("fails for another user's section", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow("Can only fill your own section.");
  });

  it("fails for a submitted section", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID),
    ).rejects.toThrow("Cannot fill a submitted section.");
  });

  it("fails when target section does not exist", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID),
    ).rejects.toThrow(`Target section ${SECTION_ID} not found.`);
  });
});

// ---------------------------------------------------------------------------
// listVersions (API-08)
// ---------------------------------------------------------------------------

describe("LeadFormService — listVersions", () => {
  it("returns ordered list from repository", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      listVersions: vi.fn().mockResolvedValue(structuredClone(sampleVersions)),
    });
    const service = new LeadFormService(repo);

    const versions = await service.listVersions(SECTION_ID, AUTHOR_ID);

    expect(versions).toHaveLength(3);
    expect(expectDefined(versions[0]).version).toBe(3);
    expect(expectDefined(versions[1]).version).toBe(2);
    expect(expectDefined(versions[2]).version).toBe(1);
    expect(repo.listVersions).toHaveBeenCalledWith(SECTION_ID);
  });

  it("returns empty array when no versions exist", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    const versions = await service.listVersions(SECTION_ID, AUTHOR_ID);

    expect(versions).toEqual([]);
  });

  it("fails for another user section", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.listVersions(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow("Can only list versions for your own section.");
  });
});

// ---------------------------------------------------------------------------
// restoreVersion (API-09)
// ---------------------------------------------------------------------------

describe("LeadFormService — restoreVersion", () => {
  it("creates snapshot before restoring and returns restored version", async () => {
    const callOrder: string[] = [];
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      createVersionSnapshot: vi.fn().mockImplementation(async () => {
        callOrder.push("snapshot");
      }),
      restoreVersion: vi.fn().mockImplementation(async () => {
        callOrder.push("restore");
        return 2;
      }),
    });
    const service = new LeadFormService(repo);

    const result = await service.restoreVersion(SECTION_ID, 2, AUTHOR_ID);

    expect(result).toEqual({ success: true, restoredVersion: 2 });
    expect(callOrder).toEqual(["snapshot", "restore"]);
  });

  it("fails for a submitted section", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.restoreVersion(SECTION_ID, 1, AUTHOR_ID),
    ).rejects.toThrow("Cannot restore a submitted section.");
  });

  it("fails for another user's section", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.restoreVersion(SECTION_ID, 1, OTHER_USER_ID),
    ).rejects.toThrow("Can only restore your own section.");
  });

  it("fails when section does not exist", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(
      service.restoreVersion(SECTION_ID, 1, AUTHOR_ID),
    ).rejects.toThrow(`Section ${SECTION_ID} not found.`);
  });
});

// ---------------------------------------------------------------------------
// getByPeriod (API-10)
// ---------------------------------------------------------------------------

describe("LeadFormService — getByPeriod", () => {
  it("returns readOnly=true for a published period", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue({
        section: structuredClone(submittedSection),
        readOnly: true,
      }),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.readOnly).toBe(true);
    expect(result.section.reportSectionId).toBe(SECTION_ID);
  });

  it("returns readOnly=false for an open period", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue({
        section: structuredClone(draftSection),
        readOnly: false,
      }),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.readOnly).toBe(false);
  });

  it("lets head view a requested author section as read-only", async () => {
    const otherAuthorSection = {
      ...structuredClone(draftSection),
      authorId: OTHER_USER_ID,
      authorName: "Lead 2",
    };
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue({
        section: otherAuthorSection,
        readOnly: false,
      }),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    expect(repo.getSectionForPeriod).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
    expect(result.section.authorId).toBe(OTHER_USER_ID);
    expect(result.readOnly).toBe(true);
  });

  it("lets lead view a requested author section as read-only when they share a product", async () => {
    const otherAuthorSection = {
      ...structuredClone(draftSection),
      authorId: OTHER_USER_ID,
      authorName: "Lead 2",
    };
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue({
        section: otherAuthorSection,
        readOnly: false,
      }),
      hasSharedProduct: vi.fn().mockResolvedValue(true),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    expect(repo.getSectionForPeriod).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
    expect(result.section.authorId).toBe(OTHER_USER_ID);
    expect(result.readOnly).toBe(true);
  });

  it("ignores requestedAuthorId for lead with no shared product", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue({
        section: structuredClone(draftSection),
        readOnly: false,
      }),
      hasSharedProduct: vi.fn().mockResolvedValue(false),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    expect(repo.getSectionForPeriod).toHaveBeenCalledWith(REPORT_ID, AUTHOR_ID);
    expect(result.section.authorId).toBe(AUTHOR_ID);
    expect(result.readOnly).toBe(false);
  });

  it("fails when no section found for user in report", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(service.getByPeriod(REPORT_ID, AUTHOR_ID)).rejects.toThrow(
      `No section found for user in report ${REPORT_ID}.`,
    );
    await expect(service.getByPeriod(REPORT_ID, AUTHOR_ID)).rejects.toThrow(
      LeadFormDomainError,
    );
  });
});

// ---------------------------------------------------------------------------
// requestReopen (API-04)
// ---------------------------------------------------------------------------

describe("LeadFormService — requestReopen", () => {
  it("succeeds for a submitted section by the author", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    const result = await service.requestReopen(
      SECTION_ID,
      AUTHOR_ID,
      "Need to fix a typo",
    );

    expect(result).toEqual({ success: true });
    expect(repo.createReopenRequest).toHaveBeenCalledWith(
      SECTION_ID,
      AUTHOR_ID,
      "Need to fix a typo",
    );
  });

  it("fails when caller is not the section author", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.requestReopen(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow("Can only request reopen for your own section.");
  });

  // Phase 52-A (UFB-054): the `requested` slice of the reopen-funnel
  // counter increments only on the success path. An unauthorized caller
  // (different author) MUST NOT bump the counter — that would let any
  // role inflate the funnel by hammering the endpoint.
  it('increments customreport_reopen_requests_total{state="requested"} on success', async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    const before = await getCounterValue(customreportReopenRequestsTotal, {
      state: "requested",
    });

    await service.requestReopen(SECTION_ID, AUTHOR_ID, "typo");

    expect(
      await getCounterValue(customreportReopenRequestsTotal, {
        state: "requested",
      }),
    ).toBe(before + 1);
  });

  it("does not increment the counter when authorization fails", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    const before = await getCounterValue(customreportReopenRequestsTotal, {
      state: "requested",
    });

    await expect(
      service.requestReopen(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow();

    expect(
      await getCounterValue(customreportReopenRequestsTotal, {
        state: "requested",
      }),
    ).toBe(before);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getCounterValue(
  counter: {
    get(): Promise<{
      values: Array<{ value: number; labels: Record<string, any> }>;
    }>;
  },
  labels: Record<string, string>,
): Promise<number> {
  const snapshot = await counter.get();
  const match = snapshot.values.find((entry) =>
    Object.entries(labels).every(([k, v]) => String(entry.labels[k]) === v),
  );
  return match?.value ?? 0;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// createSnapshot (Save Version)
// ---------------------------------------------------------------------------

describe("LeadFormService — createSnapshot", () => {
  it("snapshots a draft section owned by the caller", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    const result = await service.createSnapshot(SECTION_ID, AUTHOR_ID);

    expect(result).toEqual({ success: true });
    expect(repo.createVersionSnapshot).toHaveBeenCalledWith(SECTION_ID);
  });

  it("rejects when caller is not the author", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.createSnapshot(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow("Can only snapshot your own section.");
    expect(repo.createVersionSnapshot).not.toHaveBeenCalled();
  });

  it("rejects when section is submitted (locked)", async () => {
    const repo = createMockRepository({
      getSectionById: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    await expect(service.createSnapshot(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      "Cannot snapshot a submitted section.",
    );
    expect(repo.createVersionSnapshot).not.toHaveBeenCalled();
  });

  it("rejects when section does not exist", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(service.createSnapshot(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      `Section ${SECTION_ID} not found.`,
    );
    expect(repo.createVersionSnapshot).not.toHaveBeenCalled();
  });
});
