import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportReopenRequestsTotal,
  metricsRegistry,
} from "../../infrastructure/metrics/metrics.registry.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  LeadFormDomainError,
  type LeadFormRepository,
  LeadFormService,
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

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
