import { describe, expect, it } from "vitest";

import { reportSectionReadModelSchema } from "../report-sections/section.schema.js";
import { buildPortfolioProductsFromSnapshotSections } from "./report-portfolio-products.js";

const uuid = (kind: number, n: number) =>
  `${String(kind).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Light = "green" | "yellow" | "red";

const makeSection = (input: {
  readonly author: number;
  readonly projects?: readonly {
    readonly id: string;
    readonly name: string;
    readonly light: Light;
    readonly stages?: number;
  }[];
  readonly refs?: readonly { readonly id: string; readonly name: string }[];
}) =>
  reportSectionReadModelSchema.parse({
    reportSectionId: uuid(2, input.author),
    reportId: uuid(1, 1),
    authorId: uuid(3, input.author),
    authorName: `Lead ${input.author}`,
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: new Date("2026-10-14T09:00:00Z"),
    projects: (input.projects ?? []).map((project) => ({
      projectId: project.id,
      projectName: project.name,
      trafficLight: project.light,
      stageSet: Array.from({ length: project.stages ?? 0 }, (_, index) => ({
        stageId: uuid(5, index + 1),
        stageName: `Stage ${index + 1}`,
        sortOrder: index,
      })),
    })),
    referencedProjects: (input.refs ?? []).map((ref) => ({
      projectId: ref.id,
      projectName: ref.name,
    })),
    items: [],
    risks: [],
    decisions: [],
  });

describe("buildPortfolioProductsFromSnapshotSections referenced-only products", () => {
  it("lists a repeatedly referenced product once with its first-seen name", () => {
    const product = uuid(4, 2);
    const result = buildPortfolioProductsFromSnapshotSections([
      makeSection({ author: 1, refs: [{ id: product, name: "First" }] }),
      makeSection({ author: 2, refs: [{ id: product, name: "Second" }] }),
    ]);

    expect(result).toEqual([
      {
        productId: product,
        productName: "First",
        worstStatus: null,
        stageCount: 0,
        leadIds: [],
        leadNames: [],
      },
    ]);
  });

  it("sorts owned and referenced-only products together by name", () => {
    const result = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        author: 1,
        projects: [{ id: uuid(4, 3), name: "Бета", light: "green" }],
        refs: [
          { id: uuid(4, 4), name: "Яблоко" },
          { id: uuid(4, 5), name: "Альфа" },
        ],
      }),
    ]);

    expect(result.map(({ productName }) => productName)).toEqual([
      "Альфа",
      "Бета",
      "Яблоко",
    ]);
  });
});

describe("buildPortfolioProductsFromSnapshotSections occurrence bound (TASK-503.20 C3735)", () => {
  const product = uuid(4, 9);
  const owned = (author: number, stages: number) =>
    makeSection({
      author,
      projects: [{ id: product, name: "Wide", light: "green", stages }],
    });

  it("takes the largest stage set across occurrences, wherever it sits", () => {
    const [result] = buildPortfolioProductsFromSnapshotSections([
      owned(1, 2),
      owned(2, 3),
      owned(3, 1),
    ]);

    expect(result?.stageCount).toBe(3);
  });

  // RED probe: one product owned by more sections than Math.max(0, ...spread)
  // can pass as call arguments (~124k on Node 26.11.1, measured 15.10.2026).
  // ReportSection is unique per (reportId, authorId), so N = leads on one report.
  // 130 000 is a local probe size, not an admitted or universal workload.
  const OCCURRENCES_ABOVE_SPREAD_LIMIT = 130_000;

  it("computes the stage count without a call-stack RangeError", () => {
    const base = owned(1, 2);
    const widest = owned(2, 5);
    const sections = Array.from(
      { length: OCCURRENCES_ABOVE_SPREAD_LIMIT },
      (_, index) => ({
        ...(index === 1 ? widest : base),
        authorId: uuid(3, index + 1),
      }),
    );

    const [result] = buildPortfolioProductsFromSnapshotSections(sections);

    expect(result?.stageCount).toBe(5);
    expect(result?.leadIds).toHaveLength(OCCURRENCES_ABOVE_SPREAD_LIMIT);
  });
});
