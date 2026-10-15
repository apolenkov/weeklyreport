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
  it("keeps the owned product and ignores a reference to it from another section", () => {
    const product = uuid(4, 1);
    const result = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        author: 1,
        projects: [{ id: product, name: "Alpha", light: "red" }],
      }),
      makeSection({ author: 2, refs: [{ id: product, name: "Stale name" }] }),
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        productId: product,
        productName: "Alpha",
        worstStatus: "red",
        leadNames: ["Lead 1"],
      }),
    ]);
  });

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

  it("builds ten thousand referenced-only products in linear time", () => {
    const sections = Array.from({ length: 100 }, (_, sectionIndex) =>
      makeSection({
        author: sectionIndex + 1,
        refs: Array.from({ length: 100 }, (_, refIndex) => ({
          id: uuid(5, sectionIndex * 100 + refIndex + 1),
          name: `Ref ${sectionIndex}-${refIndex}`,
        })),
      }),
    );
    buildPortfolioProductsFromSnapshotSections(sections.slice(0, 5));

    const durations = Array.from({ length: 3 }, () => {
      const started = performance.now();
      const result = buildPortfolioProductsFromSnapshotSections(sections);
      expect(result).toHaveLength(10_000);
      return performance.now() - started;
    });

    // Measured before the fix: ~2000 ms for this input (TASK-498); the linear
    // index takes a few ms, so 50 ms leaves a wide margin for a loaded machine.
    expect(Math.min(...durations)).toBeLessThan(50);
  }, 60_000);
});
