import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { metricsRegistry } from "../../../infrastructure/metrics/metrics.registry.js";
import { ReportSectionsPrometheusTelemetry } from "../infrastructure/report-sections-prometheus-telemetry.adapter.js";
import {
  AUTHOR_ID,
  createMockRepository,
  draftSection,
  OTHER_USER_ID,
  PROJECT_ID,
  REPORT_ID,
  SECTION_ID,
  SOURCE_SECTION_ID,
  submittedSection,
} from "./__tests__/lead-form-contract-harness.js";
import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormService,
} from "./lead-form.service";

describe("LeadFormService — revokeSubmission", () => {
  it("succeeds for a submitted section", async () => {
    const repo = createMockRepository({
      getSectionByIdScoped: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
    });
    const service = new LeadFormService(repo);

    const result = await service.revokeSubmission(
      SECTION_ID,
      OTHER_USER_ID,
      {},
    );

    expect(result).toEqual({ success: true });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.revokeSectionSubmission).toHaveBeenCalledWith(
      SECTION_ID,
      OTHER_USER_ID,
    );
  });

  it("fails for a draft section", async () => {
    const repo = createMockRepository({
      getSectionByIdScoped: vi
        .fn()
        .mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    // A state conflict on an existing section → typed LeadFormConstraintError
    // (→ BAD_REQUEST), not a bare Error (→ 500).
    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID, {}),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID, {}),
    ).rejects.toThrow("Only submitted sections can be revoked.");
  });

  it("rejects out-of-scope or missing section as not found", async () => {
    // getSectionByIdScoped returns null for both a genuinely missing id and an
    // out-of-group id (no existence oracle) → LeadFormDomainError → NOT_FOUND.
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID, {}),
    ).rejects.toThrow(`Section ${SECTION_ID} not found.`);
  });

  it("rejects a submitted section of a PUBLISHED period", async () => {
    // The dashboard only surfaces revoke for the current period, so this gate
    // is the sole protection for closed published reports — without it any
    // direct caller could flip published-snapshot-backed content to draft.
    const repo = createMockRepository({
      getSectionByIdScoped: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("published"),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID, {}),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID, {}),
    ).rejects.toThrow("Cannot revoke a submission in a published report.");
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.revokeSectionSubmission).not.toHaveBeenCalled();
  });

  it("allows revoke on a REOPENED period", async () => {
    // periodStatus='reopened' means the period is editable again — the gate
    // must not block it (mirrors the fillFrom published-only gate).
    const repo = createMockRepository({
      getSectionByIdScoped: vi
        .fn()
        .mockResolvedValue(structuredClone(submittedSection)),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("reopened"),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.revokeSubmission(SECTION_ID, OTHER_USER_ID, {}),
    ).resolves.toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// fillFrom — ownership guards
// ---------------------------------------------------------------------------

describe("LeadFormService — fillFrom authorization", () => {
  it("rejects a target section owned by another user with LeadFormAccessError (FORBIDDEN)", async () => {
    const foreignTarget: ReportSectionReadModel = {
      ...structuredClone(draftSection),
      authorId: OTHER_USER_ID,
    };
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(foreignTarget),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
    ).rejects.toBeInstanceOf(LeadFormAccessError);
  });

  it("rejects a forged cross-author source section with LeadFormAccessError (FORBIDDEN)", async () => {
    // Target owned by the caller (passes owner/submitted/published guards), but
    // the forged source belongs to someone else — the security-relevant guard.
    const ownTarget = structuredClone(draftSection);
    const foreignSource: ReportSectionReadModel = {
      ...structuredClone(draftSection),
      reportSectionId: SOURCE_SECTION_ID,
      authorId: OTHER_USER_ID,
    };
    const repo = createMockRepository({
      getSectionById: vi.fn((id: string) =>
        Promise.resolve(id === SECTION_ID ? ownTarget : foreignSource),
      ),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("open"),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
    ).rejects.toBeInstanceOf(LeadFormAccessError);
  });
});

// ---------------------------------------------------------------------------
// fillFrom — published-lineage lock (resolve-not-delete)
// ---------------------------------------------------------------------------

describe("LeadFormService — fillFrom published-lineage lock", () => {
  it("rejects when the target holds a published-lineage record, before any copy", async () => {
    const ownTarget = structuredClone(draftSection);
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(ownTarget),
      // A reopened period is editable, so it passes the published-period gate;
      // its frozen snapshot still pins the published lineage.
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("reopened"),
      getPublishedLineage: vi.fn().mockResolvedValue({
        itemStableIds: ["11111111-1111-4111-8111-aaaaaaaaaaaa"],
        decisionStableIds: [],
      }),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });
    // The reject happens before the delete-recreate — no copy is attempted.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.fillFromSection).not.toHaveBeenCalled();
  });

  it("allows filling a never-published draft target (empty lineage)", async () => {
    const ownTarget = structuredClone(draftSection);
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(ownTarget),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("open"),
      getPublishedLineage: vi.fn().mockResolvedValue({
        itemStableIds: [],
        decisionStableIds: [],
      }),
    });
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(
      SECTION_ID,
      SOURCE_SECTION_ID,
      AUTHOR_ID,
      1,
    );
    expect(result).toEqual({ success: true, copiedItems: 5 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.fillFromSection).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getCrossAuthors — authorization guard (privacy-bound cross-author list)
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
    const service = new LeadFormService(
      repo,
      new ReportSectionsPrometheusTelemetry(),
    );
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
    const service = new LeadFormService(
      repo,
      new ReportSectionsPrometheusTelemetry(),
    );
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
    const service = new LeadFormService(
      repo,
      new ReportSectionsPrometheusTelemetry(),
    );
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
    const service = new LeadFormService(
      repo,
      new ReportSectionsPrometheusTelemetry(),
    );
    const before = await readResultCount("allowed");

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([contentRow]);
    expect(await readResultCount("allowed")).toBe(before + 1);
  });

  it("has NO head/admin bypass — a head who co-owns nothing is denied like any non-co-owner", async () => {
    // The service signature carries no role: getCrossAuthorContent(reportId,
    // userId). A head reaches the same gate as a lead — own section AND
    // co-ownership — with no role exception.
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

  // Positive authz matrix (service layer). The service gate is (a) report
  // access AND (b) co-ownership, with NO role bypass. The five rows collapse
  // onto these two gates at this layer:
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
// revokeAllSubmitted
// ---------------------------------------------------------------------------

describe("LeadFormService — revokeAllSubmitted", () => {
  it("returns success with revokedCount from repository", async () => {
    const repo = createMockRepository({
      revokeAllSubmitted: vi.fn().mockResolvedValue(3),
    });
    const service = new LeadFormService(repo);

    const result = await service.revokeAllSubmitted(REPORT_ID, OTHER_USER_ID, {
      author: { reportingGroupId: { in: ["group-a"] } },
    });

    expect(result).toEqual({ success: true, revokedCount: 3 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.revokeAllSubmitted).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
      {
        author: { reportingGroupId: { in: ["group-a"] } },
      },
    );
  });

  it("returns revokedCount 0 when no submitted sections exist", async () => {
    const repo = createMockRepository({
      revokeAllSubmitted: vi.fn().mockResolvedValue(0),
    });
    const service = new LeadFormService(repo);

    const result = await service.revokeAllSubmitted(
      REPORT_ID,
      OTHER_USER_ID,
      {},
    );

    expect(result).toEqual({ success: true, revokedCount: 0 });
  });
});

// ---------------------------------------------------------------------------
// fillFrom
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
      1,
    );

    expect(result).toEqual({ success: true, copiedItems: 7 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.fillFromSection).toHaveBeenCalledWith(
      SECTION_ID,
      SOURCE_SECTION_ID,
      1,
    );
  });

  it("fails for another user's section", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, OTHER_USER_ID, 1),
    ).rejects.toThrow("Can only fill your own section.");
  });

  // fillFrom must refuse a published period — the only post-publish path that
  // mutates live Item/Risk/Decision rows. Published search reads live rows
  // while the viewer read serves the frozen snapshot; allowing the rewrite
  // would leak content absent from the report the viewer can open.
  it("fails for a section in a published report", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn().mockResolvedValue(structuredClone(draftSection)),
      getReportPeriodStatusForSection: vi.fn().mockResolvedValue("published"),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
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
      1,
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
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
    ).rejects.toThrow("Cannot fill a submitted section.");
  });

  it("fails when target section does not exist", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
    ).rejects.toThrow(`Target section ${SECTION_ID} not found.`);
  });
});
