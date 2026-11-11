import {
  incompleteDraftSaveSchema,
  SAFE_TEXT_MAX_LENGTH,
  submitSectionSchema,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import {
  mergeDecisionDraft,
  mergeRiskDraft,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-helpers";
import { sectionToDraftPayload } from "../../../../report-sections/model/lead-section-draft-payload";
import {
  prepareContextualDecision,
  prepareContextualRisk,
} from "./overview-contextual-records";

const product = {
  kind: "product" as const,
  id: "10000000-0000-4000-8000-000000000004",
  name: "Product",
  product: {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Product",
    overallStatus: "on-track" as const,
    stages: [],
  },
};
const activity = {
  kind: "activity" as const,
  id: "10000000-0000-4000-8000-000000000005",
  name: "Activity",
};
const riskIdentity = {
  id: "10000000-0000-4000-8000-000000000010",
  stableId: "10000000-0000-4000-8000-000000000011",
};
const decisionIdentity = {
  id: "10000000-0000-4000-8000-000000000012",
  stableId: "10000000-0000-4000-8000-000000000013",
};

describe.each([product, activity])(
  "$kind contextual incomplete drafts",
  (parent) => {
    const stageNames = parent.kind === "product" ? ["Development"] : [];
    const context = {
      parent,
      eligibleParents: [parent],
      eligibleStages: stageNames,
    };
    const risk = {
      text: "Named risk",
      severity: "blocked" as const,
      stageNames,
    };
    const decision = { text: "Named decision", deadline: "", stageNames };

    it.each([null, "", " \t\n"])(
      "keeps identity and missing details through canonical payload (detail: %j)",
      (detail) => {
        const preparedRisk = prepareContextualRisk({
          ...context,
          identity: riskIdentity,
          input: { ...risk, impact: detail, mitigation: detail },
        });
        const preparedDecision = prepareContextualDecision({
          ...context,
          identity: decisionIdentity,
          input: { ...decision, impact: detail },
          authorName: "Test Lead",
        });
        expect(preparedRisk.ok).toBe(true);
        expect(preparedDecision.ok).toBe(true);
        if (!preparedRisk.ok || !preparedDecision.ok) return;
        const section = mergeDecisionDraft(
          mergeRiskDraft(makeReportSectionFixture(), [preparedRisk.record]),
          [preparedDecision.record],
        );
        const payload = { ...sectionToDraftPayload(section), version: 1 };
        const saved = incompleteDraftSaveSchema.parse(payload);
        expect(saved.risks).toEqual([
          expect.objectContaining({
            ...riskIdentity,
            impact: null,
            mitigation: null,
            stageNames,
            projectId: parent.kind === "product" ? parent.id : null,
            activityId: parent.kind === "activity" ? parent.id : null,
          }),
        ]);
        expect(saved.decisions).toEqual([
          expect.objectContaining({
            ...decisionIdentity,
            impact: null,
            owner: "Test Lead",
            deadline: null,
            stageNames,
            productId: parent.kind === "product" ? parent.id : null,
            activityId: parent.kind === "activity" ? parent.id : null,
          }),
        ]);
        const submitted = submitSectionSchema.safeParse({
          ...payload,
          confirmed: true,
        });
        expect(submitted.success).toBe(false);
        expect(
          expectDefined(submitted.error).issues.map((issue) => issue.path),
        ).toEqual(
          expect.arrayContaining([
            ["risks", 0, "impact"],
            ["risks", 0, "mitigation"],
            ["decisions", 0, "impact"],
          ]),
        );
      },
    );

    it.each(["\u200B", "x".repeat(SAFE_TEXT_MAX_LENGTH + 1)])(
      "rejects supplied invalid details instead of clearing them",
      (detail) => {
        expect(
          prepareContextualRisk({
            ...context,
            identity: riskIdentity,
            input: { ...risk, impact: detail, mitigation: detail },
          }),
        ).toMatchObject({
          ok: false,
          errors: {
            impact: expect.any(String) as string,
            mitigation: expect.any(String) as string,
          },
        });
        expect(
          prepareContextualDecision({
            ...context,
            identity: decisionIdentity,
            input: { ...decision, impact: detail },
            authorName: "Test Lead",
          }),
        ).toMatchObject({
          ok: false,
          errors: { impact: expect.any(String) as string },
        });
      },
    );
  },
);
