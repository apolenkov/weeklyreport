import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  createMockRepository,
  draftSection,
  forPeriod,
  HEAD_GROUP_ID,
  OTHER_USER_ID,
  PROJECT_ID,
  REPORT_ID,
  SECTION_ID,
  submittedSection,
} from "./__tests__/lead-form-contract-harness.js";
import { LeadFormDomainError, LeadFormService } from "./lead-form.service";

// ---------------------------------------------------------------------------
// getByPeriod
// ---------------------------------------------------------------------------

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
      // the head-cross read goes through the atomic group-scoped method, not
      // the unscoped getSectionForPeriod.
      getSectionForPeriodAsGroupPeer: vi
        .fn()
        .mockResolvedValue(forPeriod(otherAuthorSection, false)),
      // the head and its target share a reporting group → in-group read
      getUserReportingGroupId: vi.fn().mockResolvedValue(HEAD_GROUP_ID),
    });
    const service = new LeadFormService(repo);

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getSectionForPeriodAsGroupPeer).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
      AUTHOR_ID,
    );
    expect(result.section.authorId).toBe(OTHER_USER_ID);
    expect(result.readOnly).toBe(true);
    // canRequestReopen is a lead-self affordance: false when viewing another.
    expect(result.canRequestReopen).toBe(false);
  });

  it("lets lead view a requested author section as read-only when they share a non-archived product", async () => {
    const otherAuthorSection = {
      ...structuredClone(draftSection),
      authorId: OTHER_USER_ID,
      authorName: "Lead 2",
    };
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockImplementation((_reportId: string, authorId: string) =>
          forPeriod(
            authorId === OTHER_USER_ID
              ? otherAuthorSection
              : structuredClone(draftSection),
            false,
          ),
        ),
      getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([PROJECT_ID]),
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

  it("falls back to the caller's own section for a lead with no shared product", async () => {
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(draftSection), false)),
      getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([]),
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
