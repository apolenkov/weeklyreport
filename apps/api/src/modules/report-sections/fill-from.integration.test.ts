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
    async getSectionForPeriod() {
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
    );

    expect(result.success).toBe(true);
    expect(result.copiedItems).toBe(5);
    expect(repo.fillFromSection).toHaveBeenCalledWith(
      targetSectionId,
      sourceSectionId,
    );
  });

  it("rejects fill on another user section (own sections only)", async () => {
    const target = makeSection({ authorId: otherUserId });
    const sections = new Map([[targetSectionId, target]]);
    const service = new LeadFormService(createMockRepository(sections));

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId),
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
      service.fillFrom(targetSectionId, sourceSectionId, userId),
    ).rejects.toThrow("Cannot fill a submitted section");
  });

  it("throws error when target section not found", async () => {
    const service = new LeadFormService(createMockRepository(new Map()));

    await expect(
      service.fillFrom(targetSectionId, sourceSectionId, userId),
    ).rejects.toThrow(`Target section ${targetSectionId} not found`);
  });
});
