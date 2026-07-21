import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { CrossAuthorContentRow } from "../../report-sections";
import { collectCells } from "./slide-grid-cells";
import type { ForeignGridRow } from "./slide-grid-foreign";
import type { GridAuthor } from "./slide-grid-rows";

type Item = ReportSectionReadModel["items"][number];
type Risk = ReportSectionReadModel["risks"][number];
type Decision = ReportSectionReadModel["decisions"][number];

const owner: GridAuthor = {
  id: "lead-1",
  name: "Lead One",
  initials: "LO",
  colorIndex: 0,
  isOwner: true,
};

const item = (over: Partial<Item> = {}): Item => ({
  type: "current",
  text: "own item",
  tag: "",
  workflowStatus: "in_progress",
  carriedOver: false,
  projectId: "p1",
  stageIds: [],
  ...over,
});

const risk = (over: Partial<Risk> = {}): Risk => ({
  risk: "own risk",
  impact: "",
  mitigation: "",
  severity: "at-risk",
  projectId: "p1",
  stageIds: [],
  ...over,
});

const decision = (over: Partial<Decision> = {}): Decision => ({
  text: "own decision",
  owner: "",
  impact: "",
  productId: "p1",
  stageIds: [],
  ...over,
});

const section = (
  over: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel => ({
  reportSectionId: "sec-1",
  reportId: "rep-1",
  authorId: "lead-1",
  authorName: "Lead One",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
  ...over,
});

const knownProductIds = new Set(["p1", "p2"]);

describe("collectCells — grouping and folding", () => {
  it("groups own items/risks/decisions by product into productLevel buckets, in encounter order", () => {
    const { productLevel } = collectCells({
      section: section({
        items: [
          item({ text: "current a" }),
          item({ text: "current b", projectId: "p2" }),
          item({ text: "next a", type: "next" }),
        ],
        risks: [risk({ risk: "risk a" })],
        decisions: [decision({ text: "decision a" })],
      }),
      owner,
      foreignRows: [],
      knownProductIds,
      sharedCardId: "shared",
    });
    const p1 = productLevel.get("p1");
    expect(p1?.current.map((r) => r.text)).toEqual(["current a"]);
    expect(p1?.next.map((r) => r.text)).toEqual(["next a"]);
    expect(p1?.risks.map((r) => r.text)).toEqual(["risk a"]);
    expect(p1?.decisions.map((r) => r.text)).toEqual(["decision a"]);
    expect(productLevel.get("p2")?.current.map((r) => r.text)).toEqual([
      "current b",
    ]);
  });

  it("folds a null/unknown product onto the shared card", () => {
    const { productLevel } = collectCells({
      section: section({
        items: [
          item({ text: "no product", projectId: null }),
          item({ text: "unknown product", projectId: "does-not-exist" }),
        ],
      }),
      owner,
      foreignRows: [],
      knownProductIds,
      sharedCardId: "shared",
    });
    expect(productLevel.get("shared")?.current.map((r) => r.text)).toEqual([
      "no product",
      "unknown product",
    ]);
    expect(productLevel.has("does-not-exist")).toBe(false);
  });

  it("routes a record with an activity parent to activityCells, ignoring its product field", () => {
    const { productLevel, activityCells } = collectCells({
      section: section({
        items: [
          item({
            text: "activity item",
            projectId: "p1",
            activityId: "act-1",
          }),
        ],
        risks: [
          risk({ risk: "activity risk", projectId: "p1", activityId: "act-1" }),
        ],
      }),
      owner,
      foreignRows: [],
      knownProductIds,
      sharedCardId: "shared",
    });
    expect(activityCells.get("act-1")?.current.map((r) => r.text)).toEqual([
      "activity item",
    ]);
    expect(activityCells.get("act-1")?.risks.map((r) => r.text)).toEqual([
      "activity risk",
    ]);
    // Never leaks into the product-level bucket even though projectId is set.
    expect(productLevel.has("p1")).toBe(false);
  });

  it("drops empty-text rows entirely", () => {
    const { productLevel } = collectCells({
      section: section({
        items: [item({ text: "  " })],
        risks: [risk({ risk: "" })],
      }),
      owner,
      foreignRows: [],
      knownProductIds,
      sharedCardId: "shared",
    });
    expect(productLevel.size).toBe(0);
  });

  it("places a foreign row only on a known product and never folds it to the shared card", () => {
    const knownRow: ForeignGridRow = {
      row: {
        id: "f1",
        text: "foreign current",
        authorId: "co-1",
        showAuthorBadge: true,
        tone: "neutral",
        hoverLabel: "In progress",
        stageNames: [],
      },
      productId: "p1",
      column: "current",
    };
    const unknownRow: ForeignGridRow = {
      row: {
        id: "f2",
        text: "foreign lost",
        authorId: "co-1",
        showAuthorBadge: true,
        tone: "neutral",
        hoverLabel: "In progress",
        stageNames: [],
      },
      productId: "unknown-product",
      column: "current",
    };
    const foreign: readonly CrossAuthorContentRow[] = [];
    const { productLevel } = collectCells({
      section: section(),
      owner,
      foreignRows: [knownRow, unknownRow],
      knownProductIds,
      sharedCardId: "shared",
    });
    expect(productLevel.get("p1")?.current.map((r) => r.text)).toEqual([
      "foreign current",
    ]);
    expect(productLevel.has("shared")).toBe(false);
    expect(foreign).toEqual([]);
  });

  it("does not mutate a previously-returned bucket when a later row lands on the same key", () => {
    const { productLevel: first } = collectCells({
      section: section({ items: [item({ text: "one" })] }),
      owner,
      foreignRows: [],
      knownProductIds,
      sharedCardId: "shared",
    });
    const firstBucket = first.get("p1");
    const { productLevel: second } = collectCells({
      section: section({
        items: [item({ text: "one" }), item({ text: "two" })],
      }),
      owner,
      foreignRows: [],
      knownProductIds,
      sharedCardId: "shared",
    });
    // The bucket object from the first call is untouched by the second call
    // (no shared mutable array under the hood).
    expect(firstBucket?.current.map((r) => r.text)).toEqual(["one"]);
    expect(second.get("p1")?.current.map((r) => r.text)).toEqual([
      "one",
      "two",
    ]);
  });
});
