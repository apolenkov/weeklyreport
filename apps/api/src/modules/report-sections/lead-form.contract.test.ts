import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportReopenRequestsTotal,
  metricsRegistry,
} from "../../infrastructure/metrics/metrics.registry.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  computeReopenEligibility,
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormRepository,
  LeadFormService,
  type ReopenEligibilityFacts,
  ReopenRequestError,
} from "./lead-form.service";

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
};

const submittedSection: ReportSectionReadModel = {
  ...draftSection,
  status: "submitted",
  submittedAt: new Date("2026-04-06T12:00:00Z"),
  projects: [
    { ...expectDefined(draftSection.projects[0]), trafficLight: "green" },
  ],
};

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------

function createMockRepository(
  overrides: Partial<LeadFormRepository> = {},
): LeadFormRepository {
  return {
    getSectionById: vi.fn().mockResolvedValue(null),
    getSectionForPeriod: vi.fn().mockResolvedValue(null),
    getSectionReopenContext: vi.fn().mockResolvedValue(null),
    getReportPeriodStatusForSection: vi.fn().mockResolvedValue("open"),
    revokeSectionSubmission: vi.fn().mockResolvedValue(undefined),
    fillFromSection: vi.fn().mockResolvedValue(5),
    createReopenRequest: vi.fn().mockResolvedValue(undefined),
    hasSharedProduct: vi.fn().mockResolvedValue(false),
    getCrossAuthors: vi.fn().mockResolvedValue([]),
    getCrossAuthorContent: vi
      .fn()
      .mockResolvedValue({ coOwnsShared: false, rows: [] }),
    revokeAllSubmitted: vi.fn().mockResolvedValue(0),
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
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
// getCrossAuthors — authorization guard
// (scope-lead-report-to-own-contribution, task 4.2 — D6 privacy bound)
// ---------------------------------------------------------------------------

describe("LeadFormService — getCrossAuthors authorization", () => {
  const crossAuthorRow = {
    projectId: PROJECT_ID,
    projectName: "Shared",
    authorId: OTHER_USER_ID,
    authorInitials: "AK",
    stageNames: ["Testing"],
    stages: [{ stageName: "Testing", status: "red" as const }],
  };

  it("returns [] for a non-privileged caller with no own section in the report", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue(null),
      getCrossAuthors: vi.fn().mockResolvedValue([crossAuthorRow]),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthors(REPORT_ID, AUTHOR_ID, "lead");

    expect(rows).toEqual([]);
    // The guard short-circuits BEFORE the repository read — no foreign context fetched.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getCrossAuthors).not.toHaveBeenCalled();
  });

  it("delegates to the repository when the caller owns a section in the report", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(structuredClone(draftSection)),
      getCrossAuthors: vi.fn().mockResolvedValue([crossAuthorRow]),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthors(REPORT_ID, AUTHOR_ID, "lead");

    expect(rows).toEqual([crossAuthorRow]);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getCrossAuthors).toHaveBeenCalledWith(REPORT_ID, AUTHOR_ID);
  });

  it("bypasses the own-section check for a head, even with no own section", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue(null),
      getCrossAuthors: vi.fn().mockResolvedValue([crossAuthorRow]),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthors(REPORT_ID, AUTHOR_ID, "head");

    expect(rows).toEqual([crossAuthorRow]);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getSectionForPeriod).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getCrossAuthors).toHaveBeenCalledWith(REPORT_ID, AUTHOR_ID);
  });
});

// ---------------------------------------------------------------------------
// getCrossAuthorContent — full-content authorization (two-tier) + metric
// (scope-lead-report-to-own-contribution, tasks 7b.1 / 7b.3 — D6 / D6b)
// ---------------------------------------------------------------------------

describe("LeadFormService — getCrossAuthorContent authorization", () => {
  const contentRow = {
    authorId: OTHER_USER_ID,
    authorName: "Co Owner",
    sharedProductIds: [PROJECT_ID],
    stages: [
      { projectId: PROJECT_ID, stageName: "Testing", status: "red" as const },
    ],
    items: [],
    risks: [],
    decisions: [],
  };

  // Read a labelled `result` counter value from the shared registry so the
  // assertions are delta-based and order-independent.
  async function readResultCount(
    result: "allowed" | "denied" | "empty",
  ): Promise<number> {
    const text = await metricsRegistry.metrics();
    const match = new RegExp(
      String.raw`customreport_cross_author_content_reads_total\{result="${result}"\} (\d+)`,
    ).exec(text);
    return match ? Number(match[1]) : 0;
  }

  it("denies (returns [], result=denied) when the caller owns no section in the report", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue(null),
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: true, rows: [contentRow] }),
    });
    const service = new LeadFormService(repo);
    const before = await readResultCount("denied");

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([]);
    // The report-access gate short-circuits before the content read.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getCrossAuthorContent).not.toHaveBeenCalled();
    expect(await readResultCount("denied")).toBe(before + 1);
  });

  it("denies (returns [], result=denied) when the caller co-owns no shared product", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(structuredClone(draftSection)),
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: false, rows: [] }),
    });
    const service = new LeadFormService(repo);
    const before = await readResultCount("denied");

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([]);
    expect(await readResultCount("denied")).toBe(before + 1);
  });

  it("is empty (returns [], result=empty) when the caller co-owns but no foreign records exist", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(structuredClone(draftSection)),
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: true, rows: [] }),
    });
    const service = new LeadFormService(repo);
    const before = await readResultCount("empty");

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([]);
    expect(await readResultCount("empty")).toBe(before + 1);
  });

  it("allows (returns rows, result=allowed) for a co-owner with foreign records", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(structuredClone(draftSection)),
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: true, rows: [contentRow] }),
    });
    const service = new LeadFormService(repo);
    const before = await readResultCount("allowed");

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([contentRow]);
    expect(await readResultCount("allowed")).toBe(before + 1);
  });

  it("has NO head/admin bypass — a head who co-owns nothing is denied like any non-co-owner", async () => {
    // The service signature carries no role: getCrossAuthorContent(reportId,
    // userId). A head reaches the same gate as a lead — own section AND
    // co-ownership — with no role exception (D6).
    const repo = createMockRepository({
      // Head owns no section in this report → report-access gate denies.
      getSectionForPeriod: vi.fn().mockResolvedValue(null),
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: true, rows: [contentRow] }),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getCrossAuthorContent).not.toHaveBeenCalled();
  });

  // task 7d.9 — positive authz matrix (service layer). The service gate is
  // (a) report access AND (b) co-ownership, with NO role bypass. The five 7d.9
  // rows collapse onto these two gates at this layer:
  //   - own author (allowed)            ─┐ both pass both gates → result=allowed,
  //   - same-product co-owner (allowed) ─┘ proven by the "allows" test above.
  //   - report member NOT co-owning     → coOwnsShared:false → denied (above).
  //   - unrelated report                → no own section     → denied (above).
  //   - head/admin NOT co-owning        → no role bypass      → denied (above).
  // The "own author vs same-product co-owner" SPLIT is a repository concern (it
  // decides which rows `getCrossAuthorContent` returns + sets `coOwnsShared`),
  // exercised in the integration suite + live verify — the service treats both
  // as "passed both gates". This test pins that a passing caller threads the
  // repository rows straight through unfiltered (no role-dependent narrowing).
  it("threads the repository rows through unchanged once both gates pass (no role narrowing)", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(structuredClone(draftSection)),
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: true, rows: [contentRow] }),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    // No role argument exists on the signature, so the result cannot vary by
    // role — the same rows return for any caller that clears both gates.
    expect(rows).toEqual([contentRow]);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getCrossAuthorContent).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
    );
  });
});

// ---------------------------------------------------------------------------
// revokeAllSubmitted (SC-165)
// ---------------------------------------------------------------------------

describe("LeadFormService — revokeAllSubmitted", () => {
  it("returns success with revokedCount from repository", async () => {
    const repo = createMockRepository({
      revokeAllSubmitted: vi.fn().mockResolvedValue(3),
    });
    const service = new LeadFormService(repo);

    const result = await service.revokeAllSubmitted(REPORT_ID, OTHER_USER_ID);

    expect(result).toEqual({ success: true, revokedCount: 3 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.revokeAllSubmitted).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
  });

  it("returns revokedCount 0 when no submitted sections exist", async () => {
    const repo = createMockRepository({
      revokeAllSubmitted: vi.fn().mockResolvedValue(0),
    });
    const service = new LeadFormService(repo);

    const result = await service.revokeAllSubmitted(REPORT_ID, OTHER_USER_ID);

    expect(result).toEqual({ success: true, revokedCount: 0 });
  });
});

// ---------------------------------------------------------------------------
// fillFrom (API-07)
// ---------------------------------------------------------------------------

describe("LeadFormService — fillFrom", () => {
  it("copies items from the source section into the target", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      fillFromSection: vi.fn().mockResolvedValue(7),
    });
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(
      SECTION_ID,
      SOURCE_SECTION_ID,
      AUTHOR_ID,
    );

    expect(result).toEqual({ success: true, copiedItems: 7 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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

  // viewer-report-surface-parity (review P1): fillFrom must refuse a published
  // period — the only post-publish path that mutates live Item/Risk/Decision
  // rows. Published search reads live rows while the viewer read serves the
  // frozen snapshot; allowing the rewrite would leak content absent from the
  // report the viewer can open.
  it("fails for a section in a published report", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("published"),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID),
    ).rejects.toThrow("Cannot fill a section of a published report.");
    // The mutating repo call must never be reached.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.fillFromSection).not.toHaveBeenCalled();
  });

  it("allows a section in a reopened report (editable again, excluded from viewer search)", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("reopened"),
      fillFromSection: vi.fn().mockResolvedValue(3),
    });
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(
      SECTION_ID,
      SOURCE_SECTION_ID,
      AUTHOR_ID,
    );

    expect(result).toEqual({ success: true, copiedItems: 3 });
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
// getByPeriod (API-10)
// ---------------------------------------------------------------------------

// reopen-request-lifecycle helpers: build the repo return shapes that now
// carry the period-lifecycle facts.
function forPeriod(
  section: ReportSectionReadModel,
  readOnly: boolean,
  facts: Partial<ReopenEligibilityFacts> = {},
): {
  section: ReportSectionReadModel;
  readOnly: boolean;
  reopenFacts: ReopenEligibilityFacts;
} {
  return {
    section,
    readOnly,
    reopenFacts: {
      sectionStatus: section.status,
      periodStatus: "open",
      archived: false,
      hasPendingReopen: false,
      ...facts,
    },
  };
}

function reopenContext(
  facts: Partial<ReopenEligibilityFacts> = {},
  authorId = AUTHOR_ID,
): { authorId: string; facts: ReopenEligibilityFacts } {
  return {
    authorId,
    facts: {
      sectionStatus: "submitted",
      periodStatus: "open",
      archived: false,
      hasPendingReopen: false,
      ...facts,
    },
  };
}

describe("LeadFormService — getByPeriod", () => {
  it("returns readOnly=true and canRequestReopen=false for a published period", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue(
        forPeriod(structuredClone(submittedSection), true, {
          periodStatus: "published",
        }),
      ),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.readOnly).toBe(true);
    expect(result.section.reportSectionId).toBe(SECTION_ID);
    expect(result.canRequestReopen).toBe(false);
  });

  it("returns readOnly=false for an open period", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(draftSection), false)),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.readOnly).toBe(false);
    // A draft is not submitted, so a reopen request is meaningless.
    expect(result.canRequestReopen).toBe(false);
  });

  it("canRequestReopen=true for a submitted section on an open period", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(submittedSection), false)),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.canRequestReopen).toBe(true);
    expect(result.reopenBlockedReason).toBeNull();
  });

  it("canRequestReopen=true on a reopened period (and the section is editable)", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue(
        forPeriod(structuredClone(submittedSection), false, {
          periodStatus: "reopened",
        }),
      ),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.readOnly).toBe(false);
    expect(result.canRequestReopen).toBe(true);
  });

  it("canRequestReopen=false when a pending request already exists", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi.fn().mockResolvedValue(
        forPeriod(structuredClone(submittedSection), false, {
          hasPendingReopen: true,
        }),
      ),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result.canRequestReopen).toBe(false);
    expect(result.reopenBlockedReason).toBe("pending_request_exists");
  });

  it("lets head view a requested author section as read-only, no reopen affordance", async () => {
    const otherAuthorSection = {
      ...structuredClone(submittedSection),
      authorId: OTHER_USER_ID,
      authorName: "Lead 2",
    };
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(otherAuthorSection, false)),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getSectionForPeriod).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
    expect(result.section.authorId).toBe(OTHER_USER_ID);
    expect(result.readOnly).toBe(true);
    // canRequestReopen is a lead-self affordance: false when viewing another.
    expect(result.canRequestReopen).toBe(false);
  });

  it("lets lead view a requested author section as read-only when they share a product", async () => {
    const otherAuthorSection = {
      ...structuredClone(draftSection),
      authorId: OTHER_USER_ID,
      authorName: "Lead 2",
    };
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(otherAuthorSection, false)),
      hasSharedProduct: vi.fn().mockResolvedValue(true),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getSectionForPeriod).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
    );
    expect(result.section.authorId).toBe(OTHER_USER_ID);
    expect(result.readOnly).toBe(true);
  });

  it("ignores requestedAuthorId for lead with no shared product", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(draftSection), false)),
      hasSharedProduct: vi.fn().mockResolvedValue(false),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
// computeReopenEligibility — the single source of truth (D4)
// ---------------------------------------------------------------------------

describe("computeReopenEligibility", () => {
  it("allows a submitted section on an open period with no pending request", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "open",
        archived: false,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: true, reason: null });
  });

  it("allows a reopened period", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "reopened",
        archived: false,
        hasPendingReopen: false,
      }).canRequestReopen,
    ).toBe(true);
  });

  it("blocks a non-submitted section", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "draft",
        periodStatus: "open",
        archived: false,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: false, reason: "not_submitted" });
  });

  it("blocks an archived report before checking periodStatus", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "published",
        archived: true,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: false, reason: "period_archived" });
  });

  it("blocks a published period", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "published",
        archived: false,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: false, reason: "period_closed" });
  });

  it("blocks when a pending request already exists", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "open",
        archived: false,
        hasPendingReopen: true,
      }),
    ).toEqual({ canRequestReopen: false, reason: "pending_request_exists" });
  });
});

// ---------------------------------------------------------------------------
// requestReopen (API-04) — period-lifecycle guard (D4)
// ---------------------------------------------------------------------------

describe("LeadFormService — requestReopen", () => {
  it("succeeds for a submitted section by the author on an open period", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi.fn().mockResolvedValue(reopenContext()),
    });
    const service = new LeadFormService(repo);

    const result = await service.requestReopen(
      SECTION_ID,
      AUTHOR_ID,
      "Need to fix a typo",
    );

    expect(result).toEqual({ success: true });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.createReopenRequest).toHaveBeenCalledWith(
      SECTION_ID,
      AUTHOR_ID,
      "Need to fix a typo",
    );
  });

  it("succeeds on a reopened period", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ periodStatus: "reopened" })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).resolves.toEqual(
      { success: true },
    );
  });

  it("rejects a published period with a BAD_REQUEST-mapped domain error", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ periodStatus: "published" })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.createReopenRequest).not.toHaveBeenCalled();
  });

  it("rejects an archived period", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(
          reopenContext({ periodStatus: "published", archived: true }),
        ),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
  });

  it("rejects when a pending request already exists", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ hasPendingReopen: true })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
  });

  it("rejects a non-submitted section", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ sectionStatus: "draft" })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
  });

  it("rejects when the caller is not the section author (FORBIDDEN)", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi.fn().mockResolvedValue(reopenContext()),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.requestReopen(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow(LeadFormAccessError);
  });

  it("rejects when the section does not exist (NOT_FOUND)", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      LeadFormDomainError,
    );
  });

  // The reopen-funnel counter's `requested` slice increments only on success.
  it('increments customreport_reopen_requests_total{state="requested"} on success', async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi.fn().mockResolvedValue(reopenContext()),
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

  it("does not increment the counter when the lifecycle guard rejects", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ periodStatus: "published" })),
    });
    const service = new LeadFormService(repo);

    const before = await getCounterValue(customreportReopenRequestsTotal, {
      state: "requested",
    });

    await expect(
      service.requestReopen(SECTION_ID, AUTHOR_ID),
    ).rejects.toThrow();

    expect(
      await getCounterValue(customreportReopenRequestsTotal, {
        state: "requested",
      }),
    ).toBe(before);
  });
});

async function getCounterValue(
  counter: {
    get(): Promise<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record (migrated from eslint-disable)
      values: { value: number; labels: Record<string, any> }[];
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
