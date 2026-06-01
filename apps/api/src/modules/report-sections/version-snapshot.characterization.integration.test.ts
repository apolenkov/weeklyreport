/**
 * HOT ZONE characterization test (code-quality-modernization, Wave 3).
 *
 * Pins the CURRENT observable behavior of the report-sections version /
 * snapshot surface so the upcoming extraction of `VersionHistoryService`
 * and `SnapshotService` out of `LeadFormService` / `ReportSectionsService`
 * can be proven behavior-preserving. This test is written and proven GREEN
 * against the pre-extraction code, then re-run unchanged after the move.
 *
 * Covered observable behavior:
 *   - section submission (draft -> submitted) + the deadline/grace gate
 *     ("lifecycle-write-gate-allow" path: published report blocks edits,
 *     submitted section is read-only, past-deadline + !allowLate -> 403)
 *   - version history: list ordering, getVersion, restore (snapshot-before-
 *     restore ordering), ownership/role authorization
 *   - fill-from semantics: snapshot-before-overwrite, copied-item count,
 *     ownership + submitted guards
 *   - version retention / snapshot capture: 60s throttle, content dedup
 *     (no-change), and a real new version on changed content
 *
 * Intentionally exercised through the SERVICE surface (not internals) so the
 * assertions survive a structural move of the implementation.
 */
import type {
  ReportSectionReadModel,
  VersionSnapshot,
} from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  type LeadFormRepository,
  LeadFormService,
  type SnapshotLatestRow,
} from "./lead-form.service";
import {
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const sectionId = "aaaa1111-1111-4111-8111-111111111111";
const userId = "cccc3333-3333-4333-8333-333333333333";
const otherUserId = "dddd4444-4444-4444-8444-444444444444";
const reportId = "eeee5555-5555-4555-8555-555555555555";
const projectId = "ffff6666-6666-4666-8666-666666666666";

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: sectionId,
    reportId,
    authorId: userId,
    authorName: "Lead A",
    status: "draft",
    submittedAt: null,
    projects: [{ projectId, projectName: "CRM Platform", trafficLight: null }],
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Stateful in-memory LeadFormRepository                              */
/* ------------------------------------------------------------------ */

interface SnapshotRow {
  version: number;
  createdAt: Date;
  data: Record<string, unknown>;
}

function createLeadFormRepo(opts: {
  section: ReportSectionReadModel;
  snapshots?: SnapshotRow[];
  projection?: Record<string, unknown>;
}): LeadFormRepository & {
  createVersionSnapshot: ReturnType<typeof vi.fn>;
  fillFromSection: ReturnType<typeof vi.fn>;
  restoreVersion: ReturnType<typeof vi.fn>;
  snapshots: SnapshotRow[];
} {
  const snapshots: SnapshotRow[] = opts.snapshots ? [...opts.snapshots] : [];
  let projection: Record<string, unknown> = opts.projection ?? {};

  const createVersionSnapshot = vi.fn(async () => {
    const version = snapshots.length + 1;
    snapshots.push({
      version,
      createdAt: new Date(),
      data: structuredClone(projection),
    });
    return version;
  });
  const fillFromSection = vi.fn(async () => 3);
  const restoreVersion = vi.fn(async (_id: string, version: number) => version);

  return {
    snapshots,
    createVersionSnapshot,
    fillFromSection,
    restoreVersion,
    async getSectionById(id: string) {
      return id === opts.section.reportSectionId ? opts.section : null;
    },
    async getSectionForPeriod() {
      return null;
    },
    async revokeSectionSubmission() {},
    async listVersions(): Promise<VersionSnapshot[]> {
      return snapshots.map((s) => ({
        id: `vvvv${String(s.version).padStart(4, "0")}-0000-4000-8000-000000000000`,
        reportSectionId: sectionId,
        version: s.version,
        createdAt: s.createdAt,
        itemCount: 0,
        riskCount: 0,
        decisionCount: 0,
      }));
    },
    async getVersion(_id: string, version: number) {
      return snapshots.find((s) => s.version === version)?.data ?? null;
    },
    async getLatestSnapshot(): Promise<SnapshotLatestRow | null> {
      const last = snapshots[snapshots.length - 1];
      if (!last) return null;
      return {
        data: last.data,
        createdAt: last.createdAt,
        version: last.version,
      };
    },
    async buildSnapshotProjection() {
      return structuredClone(projection);
    },
    // Test-only seam to mutate the current projection between calls.
    setProjection(next: Record<string, unknown>) {
      projection = next;
    },
    async createReopenRequest() {},
    async hasSharedProduct() {
      return false;
    },
    async getCrossAuthors() {
      return [];
    },
    async getCrossAuthorSections() {
      return [];
    },
    async revokeAllSubmitted() {
      return 0;
    },
  } as LeadFormRepository & {
    createVersionSnapshot: ReturnType<typeof vi.fn>;
    fillFromSection: ReturnType<typeof vi.fn>;
    restoreVersion: ReturnType<typeof vi.fn>;
    snapshots: SnapshotRow[];
    setProjection: (next: Record<string, unknown>) => void;
  };
}

/* ------------------------------------------------------------------ */
/*  Stateful in-memory ReportSectionsRepository                        */
/* ------------------------------------------------------------------ */

function createReportSectionsRepo(opts: {
  section: ReportSectionReadModel;
  reportStatus?: string;
  meta?: { status: string; deadline: Date };
}): ReportSectionsRepository & { saveSection: ReturnType<typeof vi.fn> } {
  let current = opts.section;
  const saveSection = vi.fn(async (next: ReportSectionReadModel) => {
    current = next;
    return next;
  });
  return {
    saveSection,
    async getSectionById(id: string) {
      return id === current.reportSectionId ? current : null;
    },
    async getReportStatus() {
      return opts.reportStatus ?? "draft";
    },
    async getReportMeta() {
      return opts.meta ?? null;
    },
  } as ReportSectionsRepository & { saveSection: ReturnType<typeof vi.fn> };
}

/* ================================================================== */
/*  Submission + lifecycle-write-gate-allow                            */
/* ================================================================== */

describe("characterization: section submission + lifecycle gate", () => {
  const submitInput = {
    reportSectionId: sectionId,
    confirmed: true as const,
    status: "submitted" as const,
    projectStatuses: [{ projectId, status: "green" as const }],
    stageStatuses: [],
    items: [
      {
        projectId,
        type: "current" as const,
        text: "Did the thing",
        tag: "feat",
        workflowStatus: "done" as const,
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [],
  };

  it("draft -> submitted stamps status and submittedAt", async () => {
    const repo = createReportSectionsRepo({ section: makeSection() });
    const service = new ReportSectionsService(repo);

    const result = await service.submitSection(submitInput, userId);

    expect(result.status).toBe("submitted");
    expect(result.submittedAt).not.toBeNull();
    expect(result.late).toBe(false);
  });

  it("blocks editing a section whose report is published", async () => {
    const repo = createReportSectionsRepo({
      section: makeSection(),
      reportStatus: "published",
    });
    const service = new ReportSectionsService(repo);

    await expect(
      service.saveDraft(
        {
          reportSectionId: sectionId,
          status: "draft",
          projectStatuses: [],
          stageStatuses: [],
          items: [],
          risks: [],
          decisions: [],
        },
        userId,
      ),
    ).rejects.toThrow("Cannot edit sections of a published report");
  });

  it("treats an already-submitted section as read-only on saveDraft", async () => {
    const repo = createReportSectionsRepo({
      section: makeSection({ status: "submitted", submittedAt: new Date() }),
    });
    const service = new ReportSectionsService(repo);

    await expect(
      service.saveDraft(
        {
          reportSectionId: sectionId,
          status: "draft",
          projectStatuses: [],
          stageStatuses: [],
          items: [],
          risks: [],
          decisions: [],
        },
        userId,
      ),
    ).rejects.toThrow("Submitted sections are read-only");
  });

  it("past-deadline + !allowLateSubmissions closes submissions (403 path)", async () => {
    const pastDeadline = new Date(Date.now() - 48 * 3_600_000);
    const repo = createReportSectionsRepo({
      section: makeSection(),
      meta: { status: "open", deadline: pastDeadline },
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 1,
      allowLateSubmissions: false,
    }));

    await expect(service.submitSection(submitInput, userId)).rejects.toThrow(
      "Past deadline; submissions closed.",
    );
  });

  it("past-deadline within allowLate stamps late=true (lifecycle-write-gate-allow)", async () => {
    const pastDeadline = new Date(Date.now() - 48 * 3_600_000);
    const repo = createReportSectionsRepo({
      section: makeSection(),
      meta: { status: "open", deadline: pastDeadline },
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 1,
      allowLateSubmissions: true,
    }));

    const result = await service.submitSection(submitInput, userId);
    expect(result.status).toBe("submitted");
    expect(result.late).toBe(true);
  });

  it("rejects editing another author's section (OCC/ownership)", async () => {
    const repo = createReportSectionsRepo({ section: makeSection() });
    const service = new ReportSectionsService(repo);

    await expect(
      service.submitSection(submitInput, otherUserId),
    ).rejects.toThrow("Can only edit your own section.");
  });
});

/* ================================================================== */
/*  Version history: list / get / restore                             */
/* ================================================================== */

describe("characterization: version history", () => {
  it("lists versions in creation order", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [
        { version: 1, createdAt: new Date("2026-04-10T12:00:00Z"), data: {} },
        { version: 2, createdAt: new Date("2026-04-11T12:00:00Z"), data: {} },
      ],
    });
    const service = new LeadFormService(repo);

    const versions = await service.listVersions(sectionId, userId);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it("getVersion returns the stored payload for the owner", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [
        {
          version: 1,
          createdAt: new Date("2026-04-10T12:00:00Z"),
          data: { marker: "v1" },
        },
      ],
    });
    const service = new LeadFormService(repo);

    const payload = await service.getVersion(sectionId, 1, userId);
    expect(payload).toEqual({ marker: "v1" });
  });

  it("restoreVersion snapshots current state BEFORE restoring", async () => {
    const repo = createLeadFormRepo({ section: makeSection() });
    const service = new LeadFormService(repo);

    const result = await service.restoreVersion(sectionId, 2, userId);

    expect(result).toEqual({ success: true, restoredVersion: 2 });
    const snapshotOrder = expectDefined(
      repo.createVersionSnapshot.mock.invocationCallOrder[0],
    );
    const restoreOrder = expectDefined(
      repo.restoreVersion.mock.invocationCallOrder[0],
    );
    expect(snapshotOrder).toBeLessThan(restoreOrder);
  });

  it("rejects listing another user's section for a lead with no shared product", async () => {
    const repo = createLeadFormRepo({ section: makeSection() });
    const service = new LeadFormService(repo);

    await expect(
      service.listVersions(sectionId, otherUserId, "lead"),
    ).rejects.toThrow("Can only list versions for your own section");
  });

  it("allows a head to read a foreign section's versions", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [
        { version: 1, createdAt: new Date("2026-04-10T12:00:00Z"), data: {} },
      ],
    });
    const service = new LeadFormService(repo);

    const versions = await service.listVersions(sectionId, otherUserId, "head");
    expect(versions).toHaveLength(1);
  });

  it("rejects restore on a submitted section", async () => {
    const repo = createLeadFormRepo({
      section: makeSection({ status: "submitted", submittedAt: new Date() }),
    });
    const service = new LeadFormService(repo);

    await expect(service.restoreVersion(sectionId, 1, userId)).rejects.toThrow(
      "Cannot restore a submitted section",
    );
  });
});

/* ================================================================== */
/*  Fill-from semantics                                                */
/* ================================================================== */

describe("characterization: fill-from", () => {
  it("snapshots before overwrite and returns copied count", async () => {
    const repo = createLeadFormRepo({ section: makeSection() });
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(sectionId, "source-id", userId);

    expect(result).toEqual({ success: true, copiedItems: 3 });
    const snapshotOrder = expectDefined(
      repo.createVersionSnapshot.mock.invocationCallOrder[0],
    );
    const fillOrder = expectDefined(
      repo.fillFromSection.mock.invocationCallOrder[0],
    );
    expect(snapshotOrder).toBeLessThan(fillOrder);
  });

  it("rejects fill on another user's section", async () => {
    const repo = createLeadFormRepo({
      section: makeSection({ authorId: otherUserId }),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(sectionId, "source-id", userId),
    ).rejects.toThrow("Can only fill your own section");
  });

  it("rejects fill on a submitted section", async () => {
    const repo = createLeadFormRepo({
      section: makeSection({ status: "submitted", submittedAt: new Date() }),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(sectionId, "source-id", userId),
    ).rejects.toThrow("Cannot fill a submitted section");
  });
});

/* ================================================================== */
/*  Snapshot capture: throttle / dedup / retention                    */
/* ================================================================== */

describe("characterization: snapshot capture (throttle + dedup)", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("throttles a second snapshot within 60s of the last", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [
        {
          version: 7,
          createdAt: new Date(), // just now
          data: { content: "a" },
        },
      ],
      projection: { content: "changed" },
    });
    const service = new LeadFormService(repo);

    const result = await service.createSnapshot(sectionId, userId);

    expect(result).toEqual({ version: 7, skipped: true, reason: "throttled" });
    expect(repo.createVersionSnapshot).not.toHaveBeenCalled();
  });

  it("dedupes when content is unchanged vs the last snapshot", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [
        {
          version: 3,
          createdAt: new Date(Date.now() - 5 * 60_000), // 5 min ago (past throttle)
          data: { content: "same" },
        },
      ],
      projection: { content: "same" },
    });
    const service = new LeadFormService(repo);

    const result = await service.createSnapshot(sectionId, userId);

    expect(result).toEqual({ version: 3, skipped: true, reason: "no-change" });
    expect(repo.createVersionSnapshot).not.toHaveBeenCalled();
  });

  it("creates a new version when past throttle and content changed", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [
        {
          version: 3,
          createdAt: new Date(Date.now() - 5 * 60_000),
          data: { content: "old" },
        },
      ],
      projection: { content: "new" },
    });
    const service = new LeadFormService(repo);

    const result = await service.createSnapshot(sectionId, userId);

    // The mock assigns the next version as (snapshots.length + 1); the
    // characterization point is that a real new version is written (not
    // skipped) and the service returns the repository's version verbatim.
    expect(result).toEqual({ version: 2 });
    expect(result).not.toHaveProperty("skipped");
    expect(repo.createVersionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("creates the first snapshot when none exist yet", async () => {
    const repo = createLeadFormRepo({
      section: makeSection(),
      snapshots: [],
      projection: { content: "first" },
    });
    const service = new LeadFormService(repo);

    const result = await service.createSnapshot(sectionId, userId);

    expect(result).toEqual({ version: 1 });
    expect(repo.createVersionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects snapshot on a submitted section", async () => {
    const repo = createLeadFormRepo({
      section: makeSection({ status: "submitted", submittedAt: new Date() }),
    });
    const service = new LeadFormService(repo);

    await expect(service.createSnapshot(sectionId, userId)).rejects.toThrow(
      "Cannot snapshot a submitted section",
    );
  });
});
