import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { CrossAuthorContentRow } from "../../report-sections";
import {
  buildSlideGridModel,
  collectStageNames,
  type GridProductCard,
  type GridSubsection,
  SHARED_CARD_ID,
  SHARED_CARD_NAME,
} from "./slide-grid-model";

type Item = ReportSectionReadModel["items"][number];
type Risk = ReportSectionReadModel["risks"][number];
type Decision = ReportSectionReadModel["decisions"][number];
type Activity = ReportSectionReadModel["activities"][number];

const project = (projectId: string, projectName: string) => ({
  projectId,
  projectName,
  trafficLight: null,
});

const item = (over: Partial<Item> = {}): Item => ({
  type: "current",
  text: "own item",
  tag: "",
  workflowStatus: "in_progress",
  carriedOver: false,
  projectId: "p1",
  stageNames: [],
  ...over,
});

const risk = (over: Partial<Risk> = {}): Risk => ({
  risk: "own risk",
  impact: "",
  mitigation: "",
  severity: "at-risk",
  projectId: "p1",
  stageNames: [],
  ...over,
});

const decision = (over: Partial<Decision> = {}): Decision => ({
  text: "own decision",
  owner: "",
  impact: "",
  productId: "p1",
  stageNames: [],
  ...over,
});

const activity = (over: Partial<Activity> = {}): Activity => ({
  activityId: "a1",
  activityName: "Портал",
  status: "yellow",
  derivedStatus: null,
  linkedProducts: [{ productId: "p1", productName: "Alpha" }],
  ...over,
});

const section = (
  over: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel => ({
  reportSectionId: "sec-1",
  reportId: "rep-1",
  authorId: "lead-1",
  authorName: "Иванов В.П.",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [project("p1", "Alpha"), project("p2", "Beta")],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
  ...over,
});

const foreignRow = (
  over: Partial<CrossAuthorContentRow> = {},
): CrossAuthorContentRow => ({
  authorId: "co-1",
  authorName: "Смирнова А.С.",
  items: [],
  risks: [],
  decisions: [],
  ...over,
});

const cardOf = (
  model: ReturnType<typeof buildSlideGridModel>,
  id: string,
): GridProductCard => {
  const card = model.products.find((p) => p.id === id);
  if (!card) throw new Error(`card ${id} missing`);
  return card;
};

const productLevelOf = (card: GridProductCard): GridSubsection => {
  const sub = card.subsections.find((s) => s.kind === "product-level");
  if (!sub) throw new Error("product-level subsection missing");
  return sub;
};

describe("buildSlideGridModel — status marks and columns", () => {
  it("marks done items and plays risk severity via row highlight", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({ text: "done", workflowStatus: "done" }),
          item({ text: "paused", workflowStatus: "paused" }),
          item({
            text: "planned",
            type: "next",
            workflowStatus: "postponed",
          }),
        ],
        risks: [
          risk({ risk: "plain risk" }),
          risk({ risk: "hard blocker", severity: "blocked" }),
        ],
        decisions: [decision()],
      }),
    });
    const cols = productLevelOf(cardOf(model, "p1")).columns;
    // The frame tone IS the status: expected states stay neutral.
    expect(cols.current.map((r) => r.tone)).toEqual(["completed", "paused"]);
    expect(cols.next.map((r) => r.tone)).toEqual(["postponed"]);
    expect(cols.risks.map((r) => r.tone)).toEqual(["at-risk", "blocked"]);
    expect(cols.decisions.map((r) => r.tone)).toEqual(["note"]);
  });

  it("collects the slide's stage names once, in canonical order", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({ text: "test work", stageNames: ["Testing"] }),
          item({ text: "plan work", stageNames: ["Planning", "Testing"] }),
        ],
      }),
    });
    expect(collectStageNames(model)).toEqual(["Planning", "Testing"]);
  });

  it("drops rows with empty text and counts the rest", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [item(), item({ text: " ".repeat(3) })],
        risks: [risk({ risk: "" })],
      }),
    });
    expect(model.counters).toEqual({ current: 1, risks: 0, priorities: 0 });
  });

  it("adds editable refs only to own rows with stable lineage", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [item({ stableId: "item-stable-1" })],
        risks: [risk({ stableId: "risk-stable-1" })],
        decisions: [decision({ stableId: "decision-stable-1" })],
      }),
      foreign: [
        foreignRow({
          items: [
            {
              id: "foreign-item-1",
              projectId: "p1",
              type: "current",
              text: "foreign item",
              workflowStatus: "in_progress",
              stageNames: [],
            },
          ],
        }),
      ],
    });
    const cols = productLevelOf(cardOf(model, "p1")).columns;
    expect(cols.current[0]?.editableRef).toEqual({
      kind: "item",
      stableId: "item-stable-1",
    });
    expect(cols.risks[0]?.editableRef).toEqual({
      kind: "risk",
      stableId: "risk-stable-1",
    });
    expect(cols.decisions[0]?.editableRef).toEqual({
      kind: "decision",
      stableId: "decision-stable-1",
    });
    expect(cols.current[1]?.editableRef).toBeUndefined();
  });
});

describe("buildSlideGridModel — sorting and author series", () => {
  it("sorts a cell by canonical stage order, stage-less rows last", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({ text: "support", stageNames: ["Support"] }),
          item({ text: "no stage" }),
          item({ text: "planning", stageNames: ["Planning"] }),
          item({ text: "dev alias", stageNames: ["Dev"] }),
        ],
      }),
    });
    const texts = productLevelOf(cardOf(model, "p1")).columns.current.map(
      (r) => r.text,
    );
    expect(texts).toEqual(["planning", "dev alias", "support", "no stage"]);
  });

  it("collapses consecutive same-author rows to one badge", () => {
    const foreign = foreignRow({
      items: [
        {
          id: "f1",
          projectId: "p1",
          type: "current",
          text: "foreign a",
          workflowStatus: "in_progress",
          stageNames: ["Support"],
        },
        {
          id: "f2",
          projectId: "p1",
          type: "current",
          text: "foreign b",
          workflowStatus: "in_progress",
          stageNames: ["Support"],
        },
      ],
    });
    const model = buildSlideGridModel({
      section: section({ items: [item({ stageNames: ["Support"] })] }),
      foreign: [foreign],
    });
    const rows = productLevelOf(cardOf(model, "p1")).columns.current;
    // Same stage rank → owner first, then the foreign series collapses.
    expect(rows.map((r) => [r.authorId, r.showAuthorBadge])).toEqual([
      ["lead-1", true],
      ["co-1", true],
      ["co-1", false],
    ]);
  });
});

describe("buildSlideGridModel — priority strip", () => {
  it("collects only ranked own items, ascending", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({ text: "p2 item", priorityRank: 2 }),
          item({ text: "unranked" }),
          item({ text: "p1 item", priorityRank: 1, projectId: "p2" }),
        ],
      }),
    });
    expect(model.priorityStrip.map((c) => [c.rank, c.productName])).toEqual([
      [1, "Beta"],
      [2, "Alpha"],
    ]);
    expect(model.counters.priorities).toBe(2);
  });

  it("homes priorities for unknown products on the shared card", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({
            text: "orphan priority",
            projectId: "unknown-product",
            priorityRank: 1,
          }),
        ],
      }),
    });

    expect(model.priorityStrip).toEqual([
      expect.objectContaining({
        productId: SHARED_CARD_ID,
        productName: SHARED_CARD_NAME,
      }),
    ]);
    expect(
      productLevelOf(cardOf(model, SHARED_CARD_ID)).columns.current.map(
        (row) => row.text,
      ),
    ).toEqual(["orphan priority"]);
  });
});

describe("buildSlideGridModel — activity subsections", () => {
  it("homes a single-linked activity under its product with a status dot", () => {
    const model = buildSlideGridModel({
      section: section({
        activities: [activity({ derivedStatus: "red" })],
        items: [item({ projectId: null, activityId: "a1" })],
      }),
    });
    const card = cardOf(model, "p1");
    const sub = card.subsections.find((s) => s.kind === "project");
    expect(sub).toMatchObject({
      name: "Портал",
      status: "red",
      showStages: false,
    });
  });

  it("homes zero/multi-linked activities on the Shared context card", () => {
    const model = buildSlideGridModel({
      section: section({
        activities: [activity({ linkedProducts: [] })],
        items: [item({ projectId: null, activityId: "a1" })],
      }),
    });
    const shared = cardOf(model, SHARED_CARD_ID);
    expect(shared.name).toBe(SHARED_CARD_NAME);
    expect(shared.subsections.some((s) => s.kind === "project")).toBe(true);
  });

  it("renders a status-only activity (no records) as a project subsection", () => {
    const model = buildSlideGridModel({
      section: section({
        activities: [activity({ derivedStatus: "yellow" })],
      }),
    });
    const card = cardOf(model, "p1");
    const sub = card.subsections.find((s) => s.kind === "project");
    expect(sub).toMatchObject({ name: "Портал", status: "yellow" });
    expect(sub?.columns).toEqual({
      current: [],
      next: [],
      risks: [],
      decisions: [],
    });
    expect(card.noData).toBe(false);
  });

  it("keeps a record-less product collapsed when it has no activities either", () => {
    const model = buildSlideGridModel({
      section: section({
        activities: [activity()],
        items: [item({ projectId: null, activityId: "a1" })],
      }),
    });
    expect(cardOf(model, "p2").noData).toBe(true);
  });

  it("sorts multiple activity subsections under the same product by name", () => {
    const model = buildSlideGridModel({
      section: section({
        activities: [
          activity({
            activityId: "a-zebra",
            activityName: "Zebra work",
            derivedStatus: "green",
          }),
          activity({
            activityId: "a-apple",
            activityName: "Apple work",
            derivedStatus: "green",
          }),
        ],
      }),
    });
    const names = cardOf(model, "p1")
      .subsections.filter((s) => s.kind === "project")
      .map((s) => s.name);
    expect(names).toEqual(["Apple work", "Zebra work"]);
  });

  it("renders a record-only activity (known via activityCells but absent from section.activities) under the Shared card", () => {
    const model = buildSlideGridModel({
      section: section({
        // No `activities` entry for "ghost-activity" — only a record referencing it.
        items: [
          item({
            projectId: null,
            activityId: "ghost-activity",
            text: "orphan",
          }),
        ],
      }),
    });
    const shared = cardOf(model, SHARED_CARD_ID);
    const ghost = shared.subsections.find(
      (s) => s.kind === "project" && s.id === "ghost-activity",
    );
    expect(ghost).toMatchObject({ name: "Activity", status: null });
    expect(ghost?.columns.current.map((r) => r.text)).toEqual(["orphan"]);
  });

  it("shows the Shared context card for a status-only unlinked activity", () => {
    const model = buildSlideGridModel({
      section: section({
        activities: [activity({ linkedProducts: [] })],
      }),
    });
    const shared = cardOf(model, SHARED_CARD_ID);
    expect(shared.noData).toBe(false);
    expect(shared.subsections.some((s) => s.kind === "project")).toBe(true);
  });

  it("omits the Shared context card when nothing lands on it", () => {
    const model = buildSlideGridModel({
      section: section({ items: [item()] }),
    });
    expect(model.products.some((p) => p.id === SHARED_CARD_ID)).toBe(false);
  });
});

describe("buildSlideGridModel — authors and header stats", () => {
  it("builds the legend roster: owner first, foreign by name, initials derived", () => {
    const model = buildSlideGridModel({
      section: section(),
      foreign: [
        foreignRow({ authorId: "co-2", authorName: "Петров М.К." }),
        foreignRow(),
      ],
    });
    expect(
      model.authors.map((a) => [a.initials, a.colorIndex, a.isOwner]),
    ).toEqual([
      ["ИВ", 0, true],
      ["ПМ", 1, false],
      ["СА", 2, false],
    ]);
  });

  it("carries every author's role into the roster, foreign included", () => {
    const model = buildSlideGridModel({
      section: section(),
      foreign: [
        foreignRow({ authorId: "co-2", authorRole: "lead" }),
        foreignRow({ authorId: "co-3", authorName: "Юдина Т.Т." }),
      ],
    });
    expect(model.authors.map((a) => [a.isOwner, a.role])).toEqual([
      [true, "lead"],
      [false, "lead"],
      // A row predating the field (frozen snapshot) still renders, role-less.
      [false, undefined],
    ]);
  });

  it("derives worst status, on-track chip, and noData collapse", () => {
    const model = buildSlideGridModel({
      section: section({ items: [item()] }),
      productStatuses: new Map([
        ["p1", "red"],
        ["p2", "green"],
      ]),
    });
    expect(model.worstStatus).toBe("red");
    // p2 has a status but no rows → collapsed, excluded from the chip.
    expect(cardOf(model, "p2").noData).toBe(true);
    expect(model.onTrack).toEqual({ on: 0, total: 1 });
  });

  it("drops foreign rows on products the deck does not show", () => {
    const model = buildSlideGridModel({
      section: section(),
      foreign: [
        foreignRow({
          items: [
            {
              id: "f9",
              projectId: "unknown",
              type: "current",
              text: "lost",
              workflowStatus: "in_progress",
              stageNames: [],
            },
          ],
        }),
      ],
    });
    expect(model.counters.current).toBe(0);
  });
});
