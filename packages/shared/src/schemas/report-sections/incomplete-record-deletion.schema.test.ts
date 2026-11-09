import { describe, expect, it } from "vitest";

import { incompleteDraftSaveSchema } from "./incomplete-record.schema.js";
import { deletedIncompleteRecordsOf } from "./incomplete-record-deletion.schema.js";
import {
  retainedIncompleteRecordsInputSchema,
  retainedIncompleteRecordsOutputSchema,
} from "./retained-incomplete-records.schema.js";
import { draftSaveSchema, submitSectionSchema } from "./section.schema.js";

const SECTION_ID = "10000000-0000-4000-8000-000000000005";
const REPORT_ID = "10000000-0000-4000-8000-000000000006";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000003";
const RISK_ID = "10000000-0000-4000-8000-000000000011";
const DECISION_ID = "10000000-0000-4000-8000-000000000012";
const OTHER_ID = "10000000-0000-4000-8000-000000000013";

const risk = {
  stableId: RISK_ID,
  projectId: PRODUCT_ID,
  activityId: null,
  risk: "Vendor access is late",
  impact: "Analysis slips a week",
  mitigation: "Escalate to the vendor",
  severity: "at-risk",
  stageNames: ["Analysis"],
};

const decision = {
  stableId: DECISION_ID,
  productId: PRODUCT_ID,
  activityId: null,
  text: "Choose the storage engine",
  owner: "Head of platform",
  impact: "Unblocks design",
  stageNames: ["Design"],
};

const section = {
  reportSectionId: SECTION_ID,
  version: 1,
  projectStatuses: [],
  items: [],
  risks: [risk],
  decisions: [decision],
};

const submitted = { ...section, confirmed: true };

const saveSchemas = [
  ["draft save", draftSaveSchema, section],
  ["incomplete draft save", incompleteDraftSaveSchema, section],
  ["submit", submitSectionSchema, submitted],
] as const;

const deleting = (
  payload: object,
  intents: readonly { kind: string; stableId: string }[],
): object => ({ ...payload, deletedIncompleteRecords: intents });

describe.each(saveSchemas)("deletion intents on %s", (_name, schema, base) => {
  it("defaults to no deletions for a client that sends none", () => {
    expect(deletedIncompleteRecordsOf(schema.parse(base))).toEqual([]);
  });

  it("accepts intents for records the save leaves out", () => {
    const intents = [
      { kind: "risk", stableId: OTHER_ID },
      { kind: "decision", stableId: OTHER_ID },
    ];

    expect(
      schema.parse(deleting(base, intents)).deletedIncompleteRecords,
    ).toEqual(intents);
  });

  it("rejects a repeated intent", () => {
    const intent = { kind: "risk", stableId: OTHER_ID };
    const result = schema.safeParse(deleting(base, [intent, intent]));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([
      "deletedIncompleteRecords",
      1,
      "stableId",
    ]);
  });

  it.each([
    ["risk", RISK_ID],
    ["decision", DECISION_ID],
  ])("rejects deleting a %s the save also includes", (kind, stableId) => {
    expect(schema.safeParse(deleting(base, [{ kind, stableId }])).success).toBe(
      false,
    );
  });

  it("matches the included identity by kind", () => {
    const crossed = [
      { kind: "risk", stableId: DECISION_ID },
      { kind: "decision", stableId: RISK_ID },
    ];

    expect(schema.safeParse(deleting(base, crossed)).success).toBe(true);
  });

  it.each([
    ["an unknown kind", { kind: "item", stableId: OTHER_ID }],
    ["a malformed identity", { kind: "risk", stableId: "r-1" }],
    ["an extra key", { kind: "risk", stableId: OTHER_ID, id: OTHER_ID }],
  ])("rejects %s", (_label, intent) => {
    expect(schema.safeParse(deleting(base, [intent])).success).toBe(false);
  });
});

describe("strict submit with deletion intents", () => {
  it("still rejects incomplete content when another record is deleted", () => {
    const payload = deleting(
      { ...submitted, risks: [{ ...risk, mitigation: null }] },
      [{ kind: "risk", stableId: OTHER_ID }],
    );

    expect(submitSectionSchema.safeParse(payload).success).toBe(false);
    expect(draftSaveSchema.safeParse(payload).success).toBe(false);
    expect(incompleteDraftSaveSchema.safeParse(payload).success).toBe(true);
  });
});

describe("retained incomplete records read", () => {
  const input = { reportId: REPORT_ID, reportSectionId: SECTION_ID };
  const available = {
    status: "available",
    ...input,
    periodStart: "2026-11-02",
    periodEnd: "2026-11-08",
    readOnlyReason: "published",
    risks: [{ ...risk, impact: null }],
    decisions: [{ ...decision, impact: null }],
  };
  const accepts = (value: unknown): boolean =>
    retainedIncompleteRecordsOutputSchema.safeParse(value).success;

  it("selects the source by report and section only", () => {
    const parse = (value: unknown): { success: boolean } =>
      retainedIncompleteRecordsInputSchema.safeParse(value);

    expect(parse(input).success).toBe(true);
    expect(parse({ ...input, authorId: OTHER_ID }).success).toBe(false);
    expect(parse({ ...input, userId: OTHER_ID }).success).toBe(false);
    expect(parse({ reportId: REPORT_ID }).success).toBe(false);
  });

  it("returns the retained records with their source", () => {
    expect(accepts(available)).toBe(true);
    expect(accepts({ status: "unavailable" })).toBe(true);
  });

  it("carries no content when the source is unavailable", () => {
    expect(accepts({ status: "unavailable", risks: [] })).toBe(false);
    expect(accepts({ status: "unavailable", ...input })).toBe(false);
  });

  it.each(["canEdit", "canReopen", "canRestore", "version"])(
    "has no %s field",
    (field) => {
      expect(accepts({ ...available, [field]: true })).toBe(false);
    },
  );

  it("returns incomplete records only, without comments", () => {
    expect(accepts({ ...available, risks: [risk] })).toBe(false);
    expect(accepts({ ...available, decisions: [decision] })).toBe(false);
    expect(
      accepts({
        ...available,
        risks: [{ ...risk, impact: null, comments: [] }],
      }),
    ).toBe(false);
    expect(
      accepts({
        ...available,
        risks: [{ ...risk, impact: null, stableId: undefined }],
      }),
    ).toBe(false);
  });
});
