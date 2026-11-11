import {
  incompleteDraftSaveSchema,
  type ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import {
  captureUnfinishedRecords,
  overlayUnfinishedRecords,
} from "./conflict-retained-records";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const ACTIVITY_A = "33333333-3333-4333-8333-333333333333";
const ACTIVITY_B = "44444444-4444-4444-8444-444444444444";
const RISK_ID = "55555555-5555-4555-8555-555555555555";
const DECISION_ID = "66666666-6666-4666-8666-666666666666";

interface Context {
  readonly product: string | null;
  readonly activity: string | null;
  readonly stages: readonly string[];
}
const initialContext: Context = {
  product: PRODUCT_A,
  activity: null,
  stages: ["Development"],
};

function sectionAt(context: Context, version = 1): ReportSectionReadModel {
  return {
    ...makeReportSectionFixture({ version }),
    risks: [
      {
        id: RISK_ID,
        stableId: RISK_ID,
        projectId: context.product,
        activityId: context.activity,
        stageNames: context.stages,
        severity: "at-risk",
        risk: "Private risk",
        impact: "",
        mitigation: "",
      },
    ],
    decisions: [
      {
        id: DECISION_ID,
        stableId: DECISION_ID,
        productId: context.product,
        activityId: context.activity,
        stageNames: context.stages,
        text: "Private decision",
        owner: "Test Lead",
        impact: "",
      },
    ],
  };
}

describe("unfinished conflict context", () => {
  it.each([
    {
      name: "local Product move against server Activity move",
      local: { product: PRODUCT_B, activity: null, stages: ["Development"] },
      server: { product: null, activity: ACTIVITY_A, stages: [] },
    },
    {
      name: "local Activity move against server Product move",
      local: { product: null, activity: ACTIVITY_A, stages: [] },
      server: { product: PRODUCT_B, activity: null, stages: ["Testing"] },
    },
    {
      name: "local stage selection against server Activity move",
      local: { product: PRODUCT_A, activity: null, stages: ["Testing"] },
      server: { product: null, activity: ACTIVITY_B, stages: [] },
    },
  ])("keeps one valid parent and its stages for $name", ({ local, server }) => {
    const base = sectionAt(initialContext);
    const current = sectionToDraftPayload(sectionAt(local));
    const retained = captureUnfinishedRecords(current, base, current);
    const recovered = overlayUnfinishedRecords(sectionAt(server, 3), retained);
    const payload = { ...sectionToDraftPayload(recovered), version: 3 };
    expect(incompleteDraftSaveSchema.safeParse(payload).success).toBe(true);
    expect(payload.risks).toEqual([
      expect.objectContaining({
        projectId: local.product,
        activityId: local.activity,
        stageNames: local.stages,
      }),
    ]);
    expect(payload.decisions).toEqual([
      expect.objectContaining({
        productId: local.product,
        activityId: local.activity,
        stageNames: local.stages,
      }),
    ]);
  });

  it("keeps a server context change when the author changed only text", () => {
    const base = sectionAt(initialContext);
    const local = {
      ...base,
      risks: base.risks.map((row) => ({ ...row, risk: "Local risk text" })),
      decisions: base.decisions.map((row) => ({
        ...row,
        text: "Local decision text",
      })),
    };
    const current = sectionToDraftPayload(local);
    const server = sectionAt(
      { product: null, activity: ACTIVITY_A, stages: [] },
      3,
    );
    const recovered = overlayUnfinishedRecords(
      server,
      captureUnfinishedRecords(current, base, current),
    );
    expect(recovered.risks).toEqual([
      expect.objectContaining({
        projectId: null,
        activityId: ACTIVITY_A,
        stageNames: [],
        risk: "Local risk text",
      }),
    ]);
    expect(recovered.decisions).toEqual([
      expect.objectContaining({
        productId: null,
        activityId: ACTIVITY_A,
        stageNames: [],
        text: "Local decision text",
      }),
    ]);
    expect(
      incompleteDraftSaveSchema.safeParse({
        ...sectionToDraftPayload(recovered),
        version: 3,
      }).success,
    ).toBe(true);
  });
});
