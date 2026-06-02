import type {
  ReportSectionReadModel,
  VersionSnapshot,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { type LeadFormRepository, LeadFormService } from "./lead-form.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const sectionId = "aaaa1111-1111-4111-8111-111111111111";
const userId = "cccc3333-3333-4333-8333-333333333333";
const otherUserId = "dddd4444-4444-4444-8444-444444444444";
const reportId = "eeee5555-5555-4555-8555-555555555555";
const projectId = "ffff6666-6666-4666-8666-666666666666";

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

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

function makeVersions(count: number): VersionSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `vvvv${String(i + 1).padStart(4, "0")}-0000-4000-8000-000000000000`,
    reportSectionId: sectionId,
    version: i + 1,
    createdAt: new Date(
      `2026-04-${String(10 + i).padStart(2, "0")}T12:00:00.000Z`,
    ),
    // VersionSnapshot schema gained itemCount/riskCount/decisionCount when the
    // server started computing per-snapshot diffs (Phase 22+). Fixtures use
    // zero so these tests stay focused on ordering and persistence semantics.
    itemCount: 0,
    riskCount: 0,
    decisionCount: 0,
    pinned: false,
  }));
}

/* ------------------------------------------------------------------ */
/*  Mock repository                                                    */
/* ------------------------------------------------------------------ */

function createMockRepository(
  sections: Map<string, ReportSectionReadModel>,
  versions: VersionSnapshot[] = [],
): LeadFormRepository & {
  createVersionSnapshot: ReturnType<typeof vi.fn>;
  restoreVersion: ReturnType<typeof vi.fn>;
  listVersions: ReturnType<typeof vi.fn>;
} {
  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy returns Promise<> matching the repository contract
  const createSnapshotFn = vi.fn(async () => 1);
  const restoreVersionFn = vi.fn(
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy returns Promise<> matching the repository contract
    async (_id: string, version: number) => version,
  );
  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy returns Promise<> matching the repository contract
  const listVersionsFn = vi.fn(async () => structuredClone(versions));

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSectionById(id: string) {
      return sections.get(id) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSectionForPeriod() {
      return null;
    },
    async revokeSectionSubmission() {
      /* intentionally empty: stub fulfils LeadFormRepository contract; no awaitable work needed in this test */
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async fillFromSection() {
      return 0;
    },
    listVersions: listVersionsFn,
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getVersion() {
      return null;
    },
    restoreVersion: restoreVersionFn,
    createVersionSnapshot: createSnapshotFn,
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getLatestSnapshot() {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async buildSnapshotProjection() {
      return {};
    },
    async createReopenRequest() {
      /* intentionally empty: stub fulfils LeadFormRepository contract; no awaitable work needed in this test */
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async hasSharedProduct() {
      return false;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getCrossAuthors() {
      return [];
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getCrossAuthorSections() {
      return [];
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async revokeAllSubmitted() {
      return 0;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Version history integration tests                                  */
/* ------------------------------------------------------------------ */

describe("LeadFormService — listVersions (integration)", () => {
  it("returns ordered version snapshots", async () => {
    const section = makeSection();
    const versions = makeVersions(3);
    const sections = new Map([[sectionId, section]]);
    const repo = createMockRepository(sections, versions);
    const service = new LeadFormService(repo);

    const result = await service.listVersions(sectionId, userId);

    expect(result).toHaveLength(3);
    expect(expectDefined(result[0]).version).toBe(1);
    expect(expectDefined(result[1]).version).toBe(2);
    expect(expectDefined(result[2]).version).toBe(3);
  });

  it("returns empty array when no versions exist", async () => {
    const section = makeSection();
    const sections = new Map([[sectionId, section]]);
    const repo = createMockRepository(sections, []);
    const service = new LeadFormService(repo);

    const result = await service.listVersions(sectionId, userId);

    expect(result).toHaveLength(0);
  });

  it("rejects another user section", async () => {
    const section = makeSection();
    const sections = new Map([[sectionId, section]]);
    const service = new LeadFormService(createMockRepository(sections));

    await expect(service.listVersions(sectionId, otherUserId)).rejects.toThrow(
      "Can only list versions for your own section",
    );
  });

  it("allows head role to list versions for a foreign section", async () => {
    const section = makeSection();
    const versions = makeVersions(2);
    const sections = new Map([[sectionId, section]]);
    const repo = createMockRepository(sections, versions);
    const service = new LeadFormService(repo);

    const result = await service.listVersions(sectionId, otherUserId, "head");

    expect(result).toHaveLength(2);
  });
});

describe("LeadFormService — restoreVersion (integration)", () => {
  it("replaces current data with the specified version", async () => {
    const section = makeSection({ status: "draft" });
    const sections = new Map([[sectionId, section]]);
    const repo = createMockRepository(sections);
    const service = new LeadFormService(repo);

    const result = await service.restoreVersion(sectionId, 2, userId);

    expect(result.success).toBe(true);
    expect(result.restoredVersion).toBe(2);
    expect(repo.restoreVersion).toHaveBeenCalledWith(sectionId, 2);
  });

  it("creates snapshot of current state before restoring", async () => {
    const section = makeSection({ status: "draft" });
    const sections = new Map([[sectionId, section]]);
    const repo = createMockRepository(sections);
    const service = new LeadFormService(repo);

    await service.restoreVersion(sectionId, 1, userId);

    expect(repo.createVersionSnapshot).toHaveBeenCalledWith(sectionId);
    // Snapshot should be created BEFORE restore
    const snapshotOrder = expectDefined(
      repo.createVersionSnapshot.mock.invocationCallOrder[0],
    );
    const restoreOrder = expectDefined(
      repo.restoreVersion.mock.invocationCallOrder[0],
    );
    expect(snapshotOrder).toBeLessThan(restoreOrder);
  });

  it("rejects restore on another user section (own sections only)", async () => {
    const section = makeSection({ authorId: otherUserId });
    const sections = new Map([[sectionId, section]]);
    const service = new LeadFormService(createMockRepository(sections));

    await expect(service.restoreVersion(sectionId, 1, userId)).rejects.toThrow(
      "Can only restore your own section",
    );
  });

  it("rejects restore on submitted section", async () => {
    const section = makeSection({
      status: "submitted",
      submittedAt: new Date(),
    });
    const sections = new Map([[sectionId, section]]);
    const service = new LeadFormService(createMockRepository(sections));

    await expect(service.restoreVersion(sectionId, 1, userId)).rejects.toThrow(
      "Cannot restore a submitted section",
    );
  });

  it("throws error when section not found", async () => {
    const service = new LeadFormService(createMockRepository(new Map()));

    await expect(service.restoreVersion(sectionId, 1, userId)).rejects.toThrow(
      `Section ${sectionId} not found`,
    );
  });
});
