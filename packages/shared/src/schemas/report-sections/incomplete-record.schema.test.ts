import { describe, expect, it } from "vitest";

import { SAFE_TEXT_MAX_LENGTH } from "../primitives/report-primitives.schema.js";
import {
  draftDecisionReadModelSchema,
  draftDecisionWriteSchema,
  draftRiskReadModelSchema,
  draftRiskWriteSchema,
  incompleteDraftSaveSchema,
  isCompleteDecision,
  isCompleteRisk,
  partitionByCompleteness,
} from "./incomplete-record.schema.js";
import {
  publishedDecisionReadModelSchema,
  publishedRiskReadModelSchema,
} from "./published-section-record.schema.js";
import { draftSaveSchema, submitSectionSchema } from "./section.schema.js";
import {
  decisionReadModelSchema,
  decisionWriteSchema,
  riskReadModelSchema,
  riskWriteSchema,
} from "./section-record.schema.js";

const ID = "10000000-0000-4000-8000-000000000001";
const STABLE_ID = "10000000-0000-4000-8000-000000000002";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000003";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000004";
const SECTION_ID = "10000000-0000-4000-8000-000000000005";
const ZERO_WIDTH_ONLY = "​​";

const risk = {
  projectId: PRODUCT_ID,
  activityId: null,
  risk: "Vendor access is late",
  impact: "Analysis slips a week",
  mitigation: "Escalate to the vendor",
  severity: "at-risk",
  stageNames: ["Analysis"],
};

const decision = {
  productId: PRODUCT_ID,
  activityId: null,
  text: "Choose the storage engine",
  owner: "Head of platform",
  impact: "Unblocks design",
  deadline: "2026-11-20",
  stageNames: ["Design"],
};

const section = {
  reportSectionId: SECTION_ID,
  version: 1,
  projectStatuses: [],
  items: [],
};

const accepts =
  (schema: { safeParse: (v: unknown) => { success: boolean } }) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

describe("nullable draft records", () => {
  it("round-trips null risk details on draft write and author read", () => {
    const incomplete = { ...risk, impact: null, mitigation: null };

    expect(draftRiskWriteSchema.parse(incomplete)).toMatchObject({
      impact: null,
      mitigation: null,
      risk: risk.risk,
    });
    expect(draftRiskReadModelSchema.parse(incomplete)).toMatchObject({
      impact: null,
      mitigation: null,
    });
  });

  it("round-trips a null decision impact on draft write and author read", () => {
    const incomplete = { ...decision, impact: null };

    expect(draftDecisionWriteSchema.parse(incomplete).impact).toBeNull();
    expect(draftDecisionReadModelSchema.parse(incomplete).impact).toBeNull();
  });

  it("normalises a cleared detail control to null", () => {
    const parsed = draftRiskWriteSchema.parse({
      ...risk,
      impact: "",
      mitigation: " ".repeat(3),
    });

    expect(parsed.impact).toBeNull();
    expect(parsed.mitigation).toBeNull();
    expect(
      draftDecisionWriteSchema.parse({ ...decision, impact: "\n" }).impact,
    ).toBeNull();
  });

  it("keeps a complete draft unchanged", () => {
    expect(draftRiskWriteSchema.parse(risk)).toMatchObject(risk);
    expect(draftDecisionWriteSchema.parse(decision).impact).toBe(
      decision.impact,
    );
  });

  it.each([
    ["a null byte", "bad\u0000text"],
    ["invisible-only text", ZERO_WIDTH_ONLY],
    ["overlong text", "x".repeat(SAFE_TEXT_MAX_LENGTH + 1)],
  ])("denies %s in a draft detail", (_label, value) => {
    expect(accepts(draftRiskWriteSchema)({ ...risk, impact: value })).toBe(
      false,
    );
    expect(accepts(draftRiskWriteSchema)({ ...risk, mitigation: value })).toBe(
      false,
    );
    expect(
      accepts(draftDecisionWriteSchema)({ ...decision, impact: value }),
    ).toBe(false);
  });

  it.each([
    ["null", null],
    ["blank", "  "],
    ["invisible-only", ZERO_WIDTH_ONLY],
    ["overlong", "x".repeat(SAFE_TEXT_MAX_LENGTH + 1)],
  ])("keeps the primary text required: %s is denied", (_label, value) => {
    expect(accepts(draftRiskWriteSchema)({ ...risk, risk: value })).toBe(false);
    expect(
      accepts(draftDecisionWriteSchema)({ ...decision, text: value }),
    ).toBe(false);
  });

  it("keeps severity, owner, stages and dates as strict as before", () => {
    const riskOk = accepts(draftRiskWriteSchema);
    const decisionOk = accepts(draftDecisionWriteSchema);

    expect(riskOk({ ...risk, impact: null, severity: undefined })).toBe(false);
    expect(riskOk({ ...risk, impact: null, severity: "unknown" })).toBe(false);
    expect(riskOk({ ...risk, impact: null, stageNames: [] })).toBe(false);
    expect(decisionOk({ ...decision, impact: null, owner: "" })).toBe(false);
    expect(decisionOk({ ...decision, impact: null, deadline: "soon" })).toBe(
      false,
    );
    expect(
      draftDecisionWriteSchema.parse({ ...decision, impact: null }).deadline,
    ).toEqual(new Date("2026-11-20"));
  });

  it("keeps the Product-or-Activity parent rule on incomplete drafts", () => {
    const riskOk = accepts(draftRiskWriteSchema);
    const decisionOk = accepts(draftDecisionWriteSchema);
    const both = { activityId: ACTIVITY_ID };
    const activity = { activityId: ACTIVITY_ID, stageNames: [] };

    expect(riskOk({ ...risk, impact: null, ...both })).toBe(false);
    expect(riskOk({ ...risk, impact: null, projectId: null })).toBe(false);
    expect(
      riskOk({ ...risk, impact: null, projectId: null, ...activity }),
    ).toBe(true);
    expect(
      riskOk({
        ...risk,
        impact: null,
        projectId: null,
        activityId: ACTIVITY_ID,
      }),
    ).toBe(false);
    expect(decisionOk({ ...decision, impact: null, ...both })).toBe(false);
    expect(
      decisionOk({ ...decision, impact: null, productId: null, ...activity }),
    ).toBe(true);
    expect(
      accepts(draftRiskReadModelSchema)({ ...risk, impact: null, ...both }),
    ).toBe(false);
  });

  it("reads previously stored detail text that today's writes would refuse", () => {
    const stored = { ...risk, impact: ZERO_WIDTH_ONLY, mitigation: " kept " };

    expect(draftRiskReadModelSchema.parse(stored)).toMatchObject({
      impact: ZERO_WIDTH_ONLY,
      mitigation: " kept ",
    });
    expect(
      draftDecisionReadModelSchema.parse({ ...decision, impact: " kept " })
        .impact,
    ).toBe(" kept ");
    expect(accepts(riskReadModelSchema)(stored)).toBe(true);
  });
});

describe("strict submit and published records", () => {
  it.each(["impact", "mitigation"] as const)(
    "rejects a risk without %s",
    (detail) => {
      const incomplete = { ...risk, [detail]: null };
      const published = { ...incomplete, id: ID, stableId: STABLE_ID };

      expect(accepts(riskWriteSchema)(incomplete)).toBe(false);
      expect(accepts(riskWriteSchema)({ ...risk, [detail]: "" })).toBe(false);
      expect(accepts(riskReadModelSchema)(incomplete)).toBe(false);
      expect(accepts(publishedRiskReadModelSchema)(published)).toBe(false);
    },
  );

  it("rejects a decision without impact", () => {
    const incomplete = { ...decision, impact: null };
    const published = { ...incomplete, id: ID, stableId: STABLE_ID };

    expect(accepts(decisionWriteSchema)(incomplete)).toBe(false);
    expect(accepts(decisionWriteSchema)({ ...decision, impact: "" })).toBe(
      false,
    );
    expect(accepts(decisionReadModelSchema)(incomplete)).toBe(false);
    expect(accepts(publishedDecisionReadModelSchema)(published)).toBe(false);
  });

  it("accepts incomplete records only through the incomplete draft save", () => {
    const payload = {
      ...section,
      risks: [{ ...risk, mitigation: null }],
      decisions: [{ ...decision, impact: null }],
    };

    expect(accepts(incompleteDraftSaveSchema)(payload)).toBe(true);
    expect(accepts(draftSaveSchema)(payload)).toBe(false);
    expect(accepts(submitSectionSchema)({ ...payload, confirmed: true })).toBe(
      false,
    );
  });

  it("still accepts a complete section on every save path", () => {
    const payload = { ...section, risks: [risk], decisions: [decision] };

    expect(accepts(incompleteDraftSaveSchema)(payload)).toBe(true);
    expect(accepts(draftSaveSchema)(payload)).toBe(true);
    expect(accepts(submitSectionSchema)({ ...payload, confirmed: true })).toBe(
      true,
    );
  });
});

describe("completeness helpers", () => {
  it("derives risk completeness from both details", () => {
    expect(isCompleteRisk({ impact: "a", mitigation: "b" })).toBe(true);
    expect(isCompleteRisk({ impact: null, mitigation: "b" })).toBe(false);
    expect(isCompleteRisk({ impact: "a", mitigation: null })).toBe(false);
  });

  it("derives decision completeness from impact", () => {
    expect(isCompleteDecision({ impact: "a" })).toBe(true);
    expect(isCompleteDecision({ impact: null })).toBe(false);
  });

  it("partitions records without reordering them", () => {
    const first = { impact: "a", mitigation: "b" };
    const second = { impact: null, mitigation: null };
    const third = { impact: "c", mitigation: "d" };

    expect(
      partitionByCompleteness([first, second, third], isCompleteRisk),
    ).toEqual({ complete: [first, third], incomplete: [second] });
  });
});
