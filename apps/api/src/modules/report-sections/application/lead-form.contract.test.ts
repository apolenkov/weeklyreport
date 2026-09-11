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
      // Admission is owned by the repository's single RepeatableRead call.
      getCrossAuthors: vi.fn().mockResolvedValue([]),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthors(REPORT_ID, AUTHOR_ID, "lead");

    expect(rows).toEqual([]);
    expect(repo.getCrossAuthors).toHaveBeenCalledTimes(1);
    expect(repo.getCrossAuthors).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
    );
  });

  it("delegates to the repository when the caller owns a section in the report", async () => {
    const repo = createMockRepository({
      getCrossAuthors: vi.fn().mockResolvedValue([crossAuthorRow]),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthors(REPORT_ID, AUTHOR_ID, "lead");

    expect(rows).toEqual([crossAuthorRow]);
    expect(repo.getCrossAuthors).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
    );
  });

  it("bypasses the own-section check for a head, even with no own section", async () => {
    const repo = createMockRepository({
      getCrossAuthors: vi.fn().mockResolvedValue([crossAuthorRow]),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthors(REPORT_ID, AUTHOR_ID, "head");

    expect(rows).toEqual([crossAuthorRow]);
    expect(repo.getSectionForPeriod).not.toHaveBeenCalled();
    expect(repo.getCrossAuthors).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
      "head",
    );
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
    expect(repo.getCrossAuthorContent).toHaveBeenCalledTimes(1);
    expect(repo.getCrossAuthorContent).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
    );
    expect(await readResultCount("denied")).toBe(before + 1);
  });

  it("denies (returns [], result=denied) when the caller co-owns no shared product", async () => {
    const repo = createMockRepository({
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
    // Admission and co-ownership are decided atomically by the repository;
    // the service only maps the denied result and records telemetry.
    const repo = createMockRepository({
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: false, rows: [] }),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([]);
    expect(repo.getCrossAuthorContent).toHaveBeenCalledTimes(1);
    expect(repo.getCrossAuthorContent).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
    );
  });

  // The repository owns report admission and co-ownership in one transaction;
  // the service threads rows through unchanged once both gates pass.
  it("threads the repository rows through unchanged after one repository call", async () => {
    const repo = createMockRepository({
      getCrossAuthorContent: vi
        .fn()
        .mockResolvedValue({ coOwnsShared: true, rows: [contentRow] }),
    });
    const service = new LeadFormService(repo);

    const rows = await service.getCrossAuthorContent(REPORT_ID, AUTHOR_ID);

    expect(rows).toEqual([contentRow]);
    expect(repo.getCrossAuthorContent).toHaveBeenCalledTimes(1);
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

  // A closed published period must reject fillFrom so its live records cannot
  // diverge from the published snapshot. Reopened periods remain editable.
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

  it("fails when source section does not exist before copying", async () => {
    const repo = createMockRepository({
      getSectionById: vi.fn((id: string) =>
        Promise.resolve(
          id === SECTION_ID ? structuredClone(draftSection) : null,
        ),
      ),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(SECTION_ID, SOURCE_SECTION_ID, AUTHOR_ID, 1),
    ).rejects.toThrow(`Source section ${SOURCE_SECTION_ID} not found.`);
    expect(repo.fillFromSection).not.toHaveBeenCalled();
  });
});
