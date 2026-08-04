import type { SectionSlideModel } from "./section-slide-contracts";
import type { SlideGridModel } from "./slide-grid-model";
import type { GridProductCard, GridSubsection } from "./slide-grid-products";
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
      // A null id has no stable record identity (the render key falls back to
      // array position locally); only cards with an id produce a priority key.
      .filter(
        (card): card is typeof card & { id: string } =>
          card.id !== null && card.productId === product.id,
      )
      .map((card) => `priority:${product.id}:${card.id}`),
    ...product.subsections.flatMap((subsection) =>
      subsectionRecordIdentities(product.id, subsection),
    ),
  ];
}
