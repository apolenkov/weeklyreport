import type { SectionSlideModel, SlideTone } from "./section-slide-contracts";
import { CROSS_PRODUCT_ID } from "./section-slide-model-helpers";

const DEFAULT_PRODUCTS_PER_PAGE = 9;

function buildPage(
  model: SectionSlideModel,
  productSlides: SectionSlideModel["productSlides"],
  pageIndex: number,
  pageTotal: number,
): SectionSlideModel {
  const pageIds = new Set(productSlides.map((product) => product.id));
  return {
    ...model,
    productSlides,
    ...(model.grid === undefined
      ? {}
      : {
          grid: {
            ...model.grid,
            products: model.grid.products.filter((card) =>
              pageIds.has(card.id),
            ),
          },
        }),
    pageIndex,
    pageTotal,
  };
}

export function paginateSectionSlides(
  model: SectionSlideModel,
  productsPerPage = DEFAULT_PRODUCTS_PER_PAGE,
): SectionSlideModel[] {
  const crossProduct = model.productSlides.find(
    (product) => product.id === CROSS_PRODUCT_ID,
  );
  const products = model.productSlides.filter(
    (product) => product.id !== CROSS_PRODUCT_ID,
  );
  if (products.length <= productsPerPage && !crossProduct) return [model];
  const pageTotal = Math.max(1, Math.ceil(products.length / productsPerPage));
  if (pageTotal === 1) return [model];
  return Array.from({ length: pageTotal }, (_, pageIndex) => {
    const start = pageIndex * productsPerPage;
    const productPage = products.slice(start, start + productsPerPage);
    const slides =
      pageIndex === pageTotal - 1 && crossProduct
        ? [...productPage, crossProduct]
        : productPage;
    return buildPage(model, slides, pageIndex, pageTotal);
  });
}

export function sortSlidesForReview(
  slides: readonly SectionSlideModel[],
): SectionSlideModel[] {
  const toneWeight: Record<SlideTone, number> = {
    blocked: 0,
    warning: 1,
    empty: 2,
    ready: 3,
  };
  return [...slides].sort((left, right) => {
    const toneDiff = toneWeight[left.tone] - toneWeight[right.tone];
    if (toneDiff !== 0) return toneDiff;
    const scoreDiff = left.score - right.score;
    return scoreDiff !== 0
      ? scoreDiff
      : left.ownerName.localeCompare(right.ownerName);
  });
}
