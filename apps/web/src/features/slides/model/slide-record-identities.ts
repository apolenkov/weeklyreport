import type { SectionSlideModel } from "./section-slide-contracts";
import type {
  GridProductCard,
  GridSubsection,
  SlideGridModel,
} from "./slide-grid-model";
import { COLUMN_ORDER } from "./slide-grid-rows";

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
