import type {
  IncompleteDraftSavePayload,
  SubmitSectionPayload,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import {
  AUTHOR_ID,
  baseSection,
  createRepository,
  PROJECT_ID_1,
  SECTION_ID,
  validDraft,
} from "./report-sections.contract.fixtures";
import { ReportSectionsService } from "./report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

const STABLE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const STAGES = ["Development"];
const DRAFT_RISK = {
  projectId: PROJECT_ID_1,
  risk: "Vendor may slip",
  impact: null,
  mitigation: "  ",
  severity: "at-risk" as const,
  stageNames: STAGES,
};
const DRAFT_DECISION = {
  productId: PROJECT_ID_1,
  text: "Pick a vendor",
  owner: "Lead 1",
  impact: null,
  stageNames: STAGES,
};
const DELETIONS = [{ kind: "risk" as const, stableId: STABLE_ID }];

function setup() {
  const repository = createRepository(baseSection);
  const read = vi.spyOn(repository, "getSectionById");
  const save = vi.spyOn(repository, "saveSection");
  const service = new ReportSectionsService(
    repository,
    NOOP_REPORT_SECTIONS_TELEMETRY,
    createNullLogger(),
  );
  return { read, save, service };
}

const draftOf = (
  overrides: Partial<IncompleteDraftSavePayload> = {},
): IncompleteDraftSavePayload => ({ ...validDraft(), ...overrides });

const SUBMIT: SubmitSectionPayload = {
  reportSectionId: SECTION_ID,
  version: 1,
  status: "draft",
  projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" }],
  stageStatuses: [
    {
      projectId: PROJECT_ID_1,
      stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "green",
    },
  ],
  activityStatuses: [],
  items: baseSection.items,
  risks: [],
  decisions: [],
  confirmed: true,
};

describe("ReportSectionsService — incomplete risk and decision drafts", () => {
  it("saves a draft whose details are missing and returns them as null", async () => {
    const { save, service } = setup();

    const saved = await service.saveDraft(
      draftOf({ risks: [DRAFT_RISK], decisions: [DRAFT_DECISION] }),
      AUTHOR_ID,
    );

    expect(saved.risks).toMatchObject([{ impact: null, mitigation: null }]);
    expect(saved.decisions).toMatchObject([{ impact: null }]);
    expect(save).toHaveBeenCalledWith(expect.anything(), 1, []);
  });

  it("deletes nothing for a client that sends no deletion intents", async () => {
    const { save, service } = setup();

    await service.saveDraft(validDraft(), AUTHOR_ID);

    expect(save).toHaveBeenCalledWith(expect.anything(), 1, []);
  });

  it("hands explicit deletion intents to the save", async () => {
    const { save, service } = setup();

    await service.saveDraft(
      draftOf({ deletedIncompleteRecords: DELETIONS }),
      AUTHOR_ID,
    );

    expect(save).toHaveBeenCalledWith(expect.anything(), 1, DELETIONS);
  });

  it("rejects an intent to delete a record the same save keeps", async () => {
    const { save, service } = setup();

    await expect(
      service.saveDraft(
        draftOf({
          risks: [{ ...DRAFT_RISK, stableId: STABLE_ID }],
          deletedIncompleteRecords: DELETIONS,
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    { name: "risk", records: { risks: [{ ...DRAFT_RISK, risk: " " }] } },
    {
      name: "decision",
      records: { decisions: [{ ...DRAFT_DECISION, text: "" }] },
    },
  ])(
    "rejects a draft $name whose primary text is blank before any save",
    async ({ records }) => {
      const { save, service } = setup();

      await expect(
        service.saveDraft(draftOf(records), AUTHOR_ID),
      ).rejects.toThrow();
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("reads the author's own records for a write and complete ones otherwise", async () => {
    const { read, service } = setup();

    await service.saveDraft(validDraft(), AUTHOR_ID);
    await service.getActiveSection(SECTION_ID);

    expect(read.mock.calls).toEqual([[SECTION_ID, "author"], [SECTION_ID]]);
  });

  it.each([
    { name: "risk", records: { risks: [DRAFT_RISK] } },
    { name: "decision", records: { decisions: [DRAFT_DECISION] } },
  ])("never submits an incomplete $name", async ({ records }) => {
    const { save, service } = setup();

    await expect(
      service.submitSection(
        // The payload type forbids null details; a hostile client is untyped.
        { ...SUBMIT, ...records } as unknown as SubmitSectionPayload,
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  it("submits complete records and passes the deletion intents on", async () => {
    const { save, service } = setup();

    const submitted = await service.submitSection(
      { ...SUBMIT, deletedIncompleteRecords: DELETIONS },
      AUTHOR_ID,
    );

    expect(submitted.status).toBe("submitted");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted" }),
      1,
      DELETIONS,
    );
  });
});
