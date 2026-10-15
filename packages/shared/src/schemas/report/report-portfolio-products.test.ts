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
