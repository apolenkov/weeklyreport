import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import type { DecisionEntry, RiskEntry } from "../../types";
import {
  ACTIVITY_ID,
  makeDraftMergeSection,
  PROJECT_ID,
} from "./lead-form-draft-merge-test-fixtures";
import { applyDraftPatch } from "./lead-form-draft-patch";

const identity = {
  id: "10000000-0000-4000-8000-000000000001",
  stableId: "10000000-0000-4000-8000-000000000002",
};
const risk: RiskEntry = {
  ...identity,
  productId: PROJECT_ID,
  productName: "Test Product",
  stageNames: ["Development"],
  text: "New record",
  severity: "blocked",
  impact: "",
  mitigation: "",
};
const decision: DecisionEntry = {
  ...identity,
  productId: PROJECT_ID,
  productName: "Test Product",
  stageNames: ["Development"],
  text: "New record",
  owner: "Test Lead",
  impact: "",
  deadline: null,
};

const candidates = [
  { kind: "risk" as const, entry: risk },
  { kind: "decision" as const, entry: decision },
];

describe.each(candidates)("scoped $kind creation", (record) => {
  const withFields = (
    fields: Partial<Pick<RiskEntry, "id" | "stableId" | "text" | "foreign">>,
  ) =>
    record.kind === "risk"
      ? { kind: "risk" as const, entry: { ...record.entry, ...fields } }
      : { kind: "decision" as const, entry: { ...record.entry, ...fields } };
  const section = () => makeDraftMergeSection();
  const create = {
    kind: "create-record" as const,
    reportSectionId: section().reportSectionId,
    record,
  };
  const discard = { ...create, kind: "discard-created-record" as const };
  const rows = (value: ReturnType<typeof section>) =>
    record.kind === "risk" ? value.risks : value.decisions;

  it("appends to the latest raw list without losing unresolved or concurrent rows", () => {
    const latest = section();
    const unresolved = {
      ...expectDefined(latest.risks[0]),
      id: "unresolved-risk",
      stableId: "unresolved-lineage",
      projectId: null,
      activityId: null,
      risk: "",
      mitigation: "Keep this unsaved input",
    };
    const current = { ...latest, risks: [...latest.risks, unresolved] };
    const result = applyDraftPatch(current, create);
    expect(rows(result)).toHaveLength(rows(current).length + 1);
    expect(result.risks).toContain(unresolved);
    expect(result.items).toBe(current.items);
    expect(result.projects).toBe(current.projects);
    expect(rows(result).slice(0, -1)).toEqual(rows(current));
  });

  it("keeps same-text distinct identities and makes repeated creates idempotent", () => {
    const first = applyDraftPatch(section(), create);
    expect(applyDraftPatch(first, create)).toBe(first);
    const second = applyDraftPatch(first, {
      ...create,
      record: withFields({
        id: "10000000-0000-4000-8000-000000000003",
        stableId: "10000000-0000-4000-8000-000000000004",
      }),
    });
    expect(rows(second)).toHaveLength(rows(section()).length + 2);
  });

  it("never replaces a colliding physical id or an existing changed lineage", () => {
    const first = applyDraftPatch(section(), create);
    for (const fields of [
      { stableId: "another-lineage" },
      { id: "reminted-id", text: "Changed" },
    ]) {
      expect(
        applyDraftPatch(first, { ...create, record: withFields(fields) }),
      ).toBe(first);
    }
  });

  it("removes only the unchanged lineage after a server id remint", () => {
    const created = applyDraftPatch(section(), create);
    const current = {
      ...created,
      version: created.version + 1,
      risks: created.risks.map((row) =>
        row.stableId === identity.stableId ? { ...row, id: "server-id" } : row,
      ),
      decisions: created.decisions.map((row) =>
        row.stableId === identity.stableId ? { ...row, id: "server-id" } : row,
      ),
    };
    const result = applyDraftPatch(current, discard);
    expect(rows(result)).toEqual(rows(section()));
    expect(result.version).toBe(current.version);
    expect(result.items).toBe(current.items);
    expect(applyDraftPatch(result, discard)).toBe(result);
  });

  it("does not remove an ambiguous lineage containing a local-only duplicate", () => {
    const created = applyDraftPatch(section(), create);
    const current = {
      ...created,
      risks:
        record.kind === "risk"
          ? [
              ...created.risks,
              {
                ...expectDefined(created.risks.at(-1)),
                id: "duplicate",
                risk: "",
              },
            ]
          : created.risks,
      decisions:
        record.kind === "decision"
          ? [
              ...created.decisions,
              {
                ...expectDefined(created.decisions.at(-1)),
                id: "duplicate",
                text: "",
              },
            ]
          : created.decisions,
    };
    expect(applyDraftPatch(current, discard)).toBe(current);
  });

  it("saves typing after acknowledgement only over its unchanged own baseline", () => {
    const created = applyDraftPatch(section(), create);
    const current = {
      ...created,
      risks: created.risks.map((row) =>
        row.stableId === identity.stableId ? { ...row, id: "server-id" } : row,
      ),
      decisions: created.decisions.map((row) =>
        row.stableId === identity.stableId ? { ...row, id: "server-id" } : row,
      ),
    };
    const next = withFields({ text: "Typed after dispatch" });
    const replace = {
      ...create,
      kind: "replace-created-record" as const,
      previous: record,
      record: next,
    };
    const result = applyDraftPatch(current, replace);
    expect(rows(result)).toHaveLength(rows(current).length);
    expect(rows(result).at(-1)).toMatchObject({
      id: "server-id",
      stableId: identity.stableId,
    });
    expect(
      record.kind === "risk"
        ? result.risks.at(-1)?.risk
        : result.decisions.at(-1)?.text,
    ).toBe("Typed after dispatch");
    expect(rows(result).slice(0, -1)).toEqual(rows(current).slice(0, -1));
    expect(applyDraftPatch(result, replace)).toBe(result);
    expect(applyDraftPatch(result, discard)).toBe(result);
    expect(rows(applyDraftPatch(result, { ...discard, record: next }))).toEqual(
      rows(section()),
    );
  });

  it.each(["text", "impact", "parent", "stages", "specific"])(
    "retains a later change to %s instead of compensating it away",
    (field) => {
      const created = applyDraftPatch(section(), create);
      const current = {
        ...created,
        risks: created.risks.map((row) => {
          if (row.stableId !== identity.stableId) return row;
          switch (field) {
            case "text":
              return { ...row, risk: "Later text" };
            case "impact":
              return { ...row, impact: "Later impact" };
            case "parent":
              return { ...row, projectId: null, activityId: ACTIVITY_ID };
            case "stages":
              return { ...row, stageNames: ["Testing"] };
            default:
              return { ...row, mitigation: "Later mitigation" };
          }
        }),
        decisions: created.decisions.map((row) => {
          if (row.stableId !== identity.stableId) return row;
          switch (field) {
            case "text":
              return { ...row, text: "Later text" };
            case "impact":
              return { ...row, impact: "Later impact" };
            case "parent":
              return { ...row, productId: null, activityId: ACTIVITY_ID };
            case "stages":
              return { ...row, stageNames: ["Testing"] };
            default:
              return { ...row, resolvedAt: new Date("2026-11-11T00:00:00Z") };
          }
        }),
      };
      expect(applyDraftPatch(current, discard)).toBe(current);
    },
  );

  it("denies foreign, missing-lineage, old-section and submitted writes", () => {
    const current = section();
    for (const kind of ["create-record", "discard-created-record"] as const) {
      expect(
        applyDraftPatch(current, { ...create, kind, reportSectionId: "old" }),
      ).toBe(current);
      for (const fields of [{ foreign: true }, { stableId: undefined }]) {
        expect(
          applyDraftPatch(current, {
            ...create,
            kind,
            record: withFields(fields),
          }),
        ).toBe(current);
      }
      const submitted = { ...current, status: "submitted" as const };
      expect(applyDraftPatch(submitted, { ...create, kind })).toBe(submitted);
    }
  });
});
