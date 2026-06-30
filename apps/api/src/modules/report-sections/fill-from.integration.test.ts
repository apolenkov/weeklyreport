import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { type LeadFormRepository, LeadFormService } from "./lead-form.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const targetSectionId = "aaaa1111-1111-4111-8111-111111111111";
const sourceSectionId = "bbbb2222-2222-4222-8222-222222222222";
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
    reportSectionId: targetSectionId,
    reportId,
    authorId: userId,
    authorName: "Lead A",
    version: 1,
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
/*  Mock repository                                                    */
/* ------------------------------------------------------------------ */

function createMockRepository(
  sections: Map<string, ReportSectionReadModel>,
  periodStatus = "open",
): LeadFormRepository & {
  fillFromSection: ReturnType<typeof vi.fn>;
} {
  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn mock implements the async fillFromSection repository contract (no awaitable work in the stub)
  const fillFromFn = vi.fn(async (_target: string, _source: string) => 5);

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSectionById(id: string) {
      return sections.get(id) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSectionByIdScoped(id: string) {
      return sections.get(id) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getReportPeriodStatusForSection() {
      return periodStatus;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSectionForPeriod() {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSectionReopenContext() {
      return null;
    },
    async revokeSectionSubmission() {
      /* intentionally empty: mock stub fulfils the LeadFormRepository contract; no awaitable work needed in this test */
    },
    fillFromSection: fillFromFn,
    async createReopenRequest() {
      /* intentionally empty: mock stub fulfils the LeadFormRepository contract; no awaitable work needed in this test */
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getSharedNonArchivedProductIds() {
      return [];
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getCrossAuthors() {
      return [];
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async getCrossAuthorContent() {
      return { coOwnsShared: false, rows: [] };
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async LeadFormRepository contract (no awaitable work in the stub)
    async revokeAllSubmitted() {
      return 0;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Fill-from integration tests                                        */
/* ------------------------------------------------------------------ */

describe("LeadFormService — fillFrom (integration)", () => {
  it("copies items from source section and returns count", async () => {
    const target = makeSection({ status: "draft" });
    const source = makeSection({
      reportSectionId: sourceSectionId,
      status: "submitted",
      submittedAt: new Date(),
    });
    const sections = new Map([
      [targetSectionId, target],
      [sourceSectionId, source],
    ]);
    const repo = createMockRepository(sections);
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(
      targetSectionId,
      sourceSectionId,
      userId,
      1,
    );

    expect(result.success).toBe(true);
    expect(result.copiedItems).toBe(5);
    expect(repo.fillFromSection).toHaveBeenCalledWith(
      targetSectionId,
      sourceSectionId,
      1,
    );
  });

  it("rejects fill on another user section (own sections only)", async () => {
    const target = makeSection({ authorId: otherUserId });
    const sections = new Map([[targetSectionId, target]]);
    const service = new LeadFormService(createMockRepository(sections));

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId, 1),
    ).rejects.toThrow("Can only fill your own section");
  });

  it("rejects fill when target section is submitted", async () => {
    const target = makeSection({
      status: "submitted",
      submittedAt: new Date(),
    });
    const sections = new Map([[targetSectionId, target]]);
    const service = new LeadFormService(createMockRepository(sections));

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId, 1),
    ).rejects.toThrow("Cannot fill a submitted section");
  });

  it("throws error when target section not found", async () => {
    const service = new LeadFormService(createMockRepository(new Map()));

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId, 1),
    ).rejects.toThrow(`Target section ${targetSectionId} not found`);
  });

  // viewer-report-surface-parity (review P1): a draft section can sit inside a
  // PUBLISHED report (publish needs only >=1 submitted section). fillFrom is the
  // one path that would rewrite that section's live rows post-publish, diverging
  // the viewer's live-row published search from the frozen-snapshot report read.
  it("rejects fill when the target's report is published (draft section, published period)", async () => {
    const target = makeSection({ status: "draft" });
    const sections = new Map([[targetSectionId, target]]);
    const repo = createMockRepository(sections, "published");
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId, 1),
    ).rejects.toThrow("Cannot fill a section of a published report");
    // The live-row mutation must never run.
    expect(repo.fillFromSection).not.toHaveBeenCalled();
  });

  // Source-section authorization: the fill-from picker only ever offers the
  // lead's OWN past sections, so a sourceSectionId authored by someone else is a
  // forged request that would copy another group's content into this draft.
  it("rejects fill when the SOURCE section is authored by another user", async () => {
    const target = makeSection({ status: "draft" });
    const source = makeSection({
      reportSectionId: sourceSectionId,
      authorId: otherUserId,
      status: "submitted",
      submittedAt: new Date(),
    });
    const sections = new Map([
      [targetSectionId, target],
      [sourceSectionId, source],
    ]);
    const repo = createMockRepository(sections);
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId, 1),
    ).rejects.toThrow("Can only fill from your own section");
    // The cross-group content copy must never run.
    expect(repo.fillFromSection).not.toHaveBeenCalled();
  });

  it("throws when the SOURCE section does not exist", async () => {
    const target = makeSection({ status: "draft" });
    const sections = new Map([[targetSectionId, target]]);
    const repo = createMockRepository(sections);
    const service = new LeadFormService(repo);

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId, 1),
    ).rejects.toThrow(`Source section ${sourceSectionId} not found`);
    expect(repo.fillFromSection).not.toHaveBeenCalled();
  });

  it("allows fill when the period is reopened (editable again, excluded from viewer search)", async () => {
    const target = makeSection({ status: "draft" });
    const source = makeSection({
      reportSectionId: sourceSectionId,
      status: "submitted",
      submittedAt: new Date(),
    });
    const sections = new Map([
      [targetSectionId, target],
      [sourceSectionId, source],
    ]);
    const repo = createMockRepository(sections, "reopened");
    const service = new LeadFormService(repo);

    const result = await service.fillFrom(
      targetSectionId,
      sourceSectionId,
      userId,
      1,
    );

    expect(result.success).toBe(true);
    expect(repo.fillFromSection).toHaveBeenCalled();
  });
});
