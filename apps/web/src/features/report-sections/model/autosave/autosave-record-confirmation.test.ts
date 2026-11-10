import { describe, expect, it } from "vitest";

import { makeDraftMergeSection } from "../lead-form/draft/lead-form-draft-merge-test-fixtures";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { confirmSavedRecord } from "./autosave-record-confirmation";
import type { AutosaveSaveReceipt } from "./autosave-types";

const section = makeDraftMergeSection();
const firstRisk = section.risks[0];
if (!firstRisk) throw new Error("Missing risk fixture");
const risk = { ...firstRisk, stableId: "lineage" };
const saved = { ...section, risks: [{ ...risk, id: "reminted" }] };
const receipt: AutosaveSaveReceipt = {
  sequence: 1,
  scope: "scope",
  generation: `${section.reportId}:${section.reportSectionId}`,
  reportSectionId: section.reportSectionId,
  version: section.version + 1,
  expectedVersion: section.version,
  attemptToken: "attempt",
  itemIdentities: [],
  submittedPayload: sectionToDraftPayload({ ...section, risks: [risk] }),
  persistedRisks: saved.risks,
  persistedDecisions: saved.decisions,
};
const target = {
  kind: "risk" as const,
  stableId: "lineage",
  scope: "scope",
  generation: receipt.generation,
  reportSectionId: section.reportSectionId,
  attemptToken: "attempt",
};

describe("record confirmation", () => {
  it("confirms reminted physical ID only for the exact scoped dispatched lineage", () => {
    expect(confirmSavedRecord(receipt, target)).toBe(true);
    expect(confirmSavedRecord(receipt, { ...target, scope: "stale" })).toBe(
      false,
    );
    expect(
      confirmSavedRecord(receipt, { ...target, attemptToken: "old" }),
    ).toBe(false);
    expect(confirmSavedRecord(receipt, { ...target, stableId: "other" })).toBe(
      false,
    );
  });
  it("confirms an unfinished record whose missing detail the form shows blank", () => {
    const unfinished = { ...risk, impact: "" };
    expect(
      confirmSavedRecord(
        {
          ...receipt,
          submittedPayload: sectionToDraftPayload({
            ...section,
            risks: [unfinished],
          }),
          persistedRisks: [{ ...unfinished, id: "reminted" }],
        },
        target,
      ),
    ).toBe(true);
  });
  it("rejects changed fields, duplicate identities and locally filtered records", () => {
    expect(
      confirmSavedRecord(
        { ...receipt, persistedRisks: [{ ...risk, impact: "changed" }] },
        target,
      ),
    ).toBe(false);
    expect(
      confirmSavedRecord({ ...receipt, persistedRisks: [risk, risk] }, target),
    ).toBe(false);
    expect(
      confirmSavedRecord(
        {
          ...receipt,
          submittedPayload: { ...sectionToDraftPayload(section), risks: [] },
        },
        target,
      ),
    ).toBe(false);
    expect(
      confirmSavedRecord(
        { ...receipt, persistedRisks: [{ ...risk, projectId: "other" }] },
        target,
      ),
    ).toBe(false);
  });
});

it("compares decision lineage, canonical author, parent and fields", () => {
  const firstDecision = section.decisions[0];
  if (!firstDecision?.stableId) throw new Error("Missing decision fixture");
  const decision = { ...firstDecision, owner: section.authorName };
  const decisionReceipt: AutosaveSaveReceipt = {
    ...receipt,
    submittedPayload: sectionToDraftPayload({
      ...section,
      decisions: [decision],
    }),
    persistedDecisions: [{ ...decision, id: "new-physical-id" }],
  };
  const decisionTarget = {
    ...target,
    kind: "decision" as const,
    stableId: firstDecision.stableId,
  };
  expect(confirmSavedRecord(decisionReceipt, decisionTarget)).toBe(true);
  expect(
    confirmSavedRecord(
      {
        ...decisionReceipt,
        persistedDecisions: [{ ...decision, owner: "other" }],
      },
      decisionTarget,
    ),
  ).toBe(false);
  expect(
    confirmSavedRecord(
      { ...decisionReceipt, persistedDecisions: [decision, decision] },
      decisionTarget,
    ),
  ).toBe(false);
  expect(
    confirmSavedRecord(decisionReceipt, {
      ...decisionTarget,
      generation: `old:${section.reportSectionId}`,
    }),
  ).toBe(false);
});
