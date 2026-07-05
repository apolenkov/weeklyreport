import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { CrossAuthorContentRow } from "../../lib/mappers/lead-cross-author";
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
  stageIds: [],
  ...over,
});

const risk = (over: Partial<Risk> = {}): Risk => ({
  risk: "own risk",
  impact: "",
  mitigation: "",
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
          item({ text: "blocked coerces", workflowStatus: "blocked" }),
          item({
            text: "planned",
            type: "next",
            workflowStatus: "in_progress",
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
    // Only done carries a mark; expected states (in progress / planned) don't.
    expect(cols.current.map((r) => r.completed)).toEqual([true, false]);
    expect(cols.next.map((r) => r.completed)).toEqual([false]);
    expect(cols.risks.map((r) => r.highlight)).toEqual(["at-risk", "blocked"]);
    expect(cols.decisions.map((r) => r.highlight)).toEqual([null]);
  });

  it("collects the slide's stage names once, in canonical order", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({ text: "test work", stageIds: ["Testing"] }),
          item({ text: "plan work", stageIds: ["Planning", "Testing"] }),
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
});

describe("buildSlideGridModel — sorting and author series", () => {
  it("sorts a cell by canonical stage order, stage-less rows last", () => {
    const model = buildSlideGridModel({
      section: section({
        items: [
          item({ text: "support", stageIds: ["Support"] }),
          item({ text: "no stage" }),
          item({ text: "planning", stageIds: ["Planning"] }),
          item({ text: "dev alias", stageIds: ["Dev"] }),
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
      section: section({ items: [item({ stageIds: ["Support"] })] }),
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
