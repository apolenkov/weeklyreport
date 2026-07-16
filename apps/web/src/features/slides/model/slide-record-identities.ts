import type { SectionSlideModel } from "./section-slide-contracts";
import type {
  GridColumnKey,
  GridProductCard,
  GridSubsection,
  SlideGridModel,
} from "./slide-grid-model";

const COLUMN_ORDER: readonly GridColumnKey[] = [
  "current",
  "next",
  "risks",
  "decisions",
];

export function slideRecordIdentities(
  model: SectionSlideModel,
): readonly string[] {
  const grid = model.grid;
  if (grid === undefined) return [];
  return grid.products.flatMap((product) =>
    productRecordIdentities(grid, product),
  );
}

function subsectionRecordIdentities(
  productId: string,
  subsection: GridSubsection,
): readonly string[] {
  return COLUMN_ORDER.flatMap((column) =>
    subsection.columns[column].map(
      (row) => `row:${productId}:${subsection.id}:${column}:${row.id}`,
    ),
  );
}

function productRecordIdentities(
  grid: SlideGridModel,
  product: GridProductCard,
): readonly string[] {
  return [
    ...grid.priorityStrip
      .filter((card) => card.productId === product.id)
      .map((card) => `priority:${product.id}:${card.id}`),
    ...product.subsections.flatMap((subsection) =>
      subsectionRecordIdentities(product.id, subsection),
    ),
  ];
}
