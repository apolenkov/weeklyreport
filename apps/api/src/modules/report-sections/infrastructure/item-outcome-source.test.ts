import type { ResolvePlanInput } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeadFormConstraintError } from "../domain/lead-form-shared.js";
import {
  AUTHOR_ID,
  baseRow,
  fullItem,
  mapRow,
  OWNED_PROJECT,
  SECTION_ID,
} from "./__tests__/report-sections-prisma-harness.js";
import { resolveOutcomeSource } from "./item-outcome-source.js";
import {
  assertLatestOutcomeSource,
  resolveEligibleOutcomeSourceSection,
} from "./item-outcome-source-freshness.js";

vi.mock("./item-outcome-source-freshness.js", () => ({
  assertLatestOutcomeSource: vi.fn(),
  resolveEligibleOutcomeSourceSection: vi.fn(),
}));
const priorId = "99999999-9999-4999-8999-999999999999";
const sourceItem = fullItem({
  projectId: OWNED_PROJECT,
  project: { name: "Owned" },
  stageNames: ["Development"],
});
const target = mapRow(baseRow());
const priorSection = {
  ...mapRow(baseRow({ items: [sourceItem] })),
  status: "submitted" as const,
};
const command: ResolvePlanInput = {
  reportSectionId: SECTION_ID,
  commandId: priorId,
  version: 1,
  source: { kind: "prior", reportId: priorId, recordId: sourceItem.id },
  outcome: "done",
};

function transaction() {
  const prior = {
    id: priorId,
    periodStart: new Date("2026-08-01T00:00:00Z"),
    periodEnd: new Date("2026-08-07T00:00:00Z"),
    createdAt: new Date("2026-08-01T08:00:00Z"),
    status: "draft" as const,
    periodStatus: "open" as const,
    publishedSnapshot: null,
    publishedSectionScopes: [],
  };
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: priorId }]),
    report: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ periodStart: new Date("2026-09-01T00:00:00Z") }),
      findFirst: vi.fn().mockResolvedValue(prior),
    },
  };
}

beforeEach(() => {
  vi.mocked(resolveEligibleOutcomeSourceSection)
    .mockReset()
    .mockResolvedValue(priorSection);
  vi.mocked(assertLatestOutcomeSource).mockReset().mockResolvedValue();
});

describe("server-resolved item source", () => {
  it("binds the prior lookup to older periods and the target author", async () => {
    const tx = transaction();
    const source = await resolveOutcomeSource(tx as never, target, command);
    expect(source.stableId).toBe(sourceItem.stableId);
    expect(tx.report.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: priorId,
          periodStart: { lt: new Date("2026-09-01T00:00:00Z") },
        },
      }),
    );
    expect(resolveEligibleOutcomeSourceSection).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: priorId }),
      AUTHOR_ID,
    );
    expect(assertLatestOutcomeSource).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        authorId: AUTHOR_ID,
        stableId: sourceItem.stableId,
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });
  it("rejects absent or non-older source reports before predecessor resolution", async () => {
    const tx = transaction();
    tx.report.findFirst.mockResolvedValue(null);
    await expect(
      resolveOutcomeSource(tx as never, target, command),
    ).rejects.toThrow("not available");
    expect(resolveEligibleOutcomeSourceSection).not.toHaveBeenCalled();
  });
  it("rejects unavailable submitted or frozen source content", async () => {
    vi.mocked(resolveEligibleOutcomeSourceSection).mockResolvedValue(null);
    await expect(
      resolveOutcomeSource(transaction() as never, target, command),
    ).rejects.toThrow("not available");
  });
  it("rejects an existing occurrence rather than overwriting it or duplicating lineage", async () => {
    await expect(
      resolveOutcomeSource(transaction() as never, priorSection, command),
    ).rejects.toThrow("already has a current occurrence");
    expect(assertLatestOutcomeSource).not.toHaveBeenCalled();
  });
  it("rejects a stale prior source before returning it to the transaction writer", async () => {
    vi.mocked(assertLatestOutcomeSource).mockRejectedValue(
      new LeadFormConstraintError(
        "This plan has a newer historical occurrence. Reload the report.",
      ),
    );

    await expect(
      resolveOutcomeSource(transaction() as never, target, command),
    ).rejects.toThrow("newer historical occurrence");
  });
  it("allows an explicit action sourced from the latest terminal occurrence", async () => {
    const terminal = { ...sourceItem, workflowStatus: "done" as const };
    vi.mocked(resolveEligibleOutcomeSourceSection).mockResolvedValue({
      ...priorSection,
      items: [terminal],
    });

    await expect(
      resolveOutcomeSource(transaction() as never, target, {
        ...command,
        outcome: "plan_next",
      }),
    ).resolves.toMatchObject({
      stableId: sourceItem.stableId,
      workflowStatus: "done",
    });
    expect(assertLatestOutcomeSource).toHaveBeenCalledOnce();
  });
  it("resolves current records only inside the authoritative target section", async () => {
    const current = {
      ...command,
      source: { kind: "current" as const, recordId: sourceItem.id },
    };
    await expect(
      resolveOutcomeSource(transaction() as never, target, current),
    ).rejects.toThrow("no longer available");
    await expect(
      resolveOutcomeSource(transaction() as never, priorSection, current),
    ).resolves.toMatchObject({ stableId: sourceItem.stableId });
  });
});
