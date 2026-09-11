import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";
import type {
  SectionSlideModel,
  SlideProduct,
} from "./section-slide-contracts";
import type {
  GridColumnKey,
  GridPriorityCard,
  GridRow,
  SlideGridModel,
} from "./slide-grid-model";
import type { GridProductCard, GridSubsection } from "./slide-grid-products";
import { COLUMN_ORDER } from "./slide-grid-rows";

export type SlideDensity = "document" | "presentation";

const PRESENTATION_RECORDS_PER_PAGE = 12;

type LocatedRecord =
  | { readonly kind: "priority"; readonly card: GridPriorityCard }
  | {
      readonly kind: "row";
      readonly subsectionId: string;
      readonly column: GridColumnKey;
      readonly row: GridRow;
    };

function recordsForProduct(
  grid: SlideGridModel,
  product: GridProductCard,
): readonly LocatedRecord[] {
  const priorities = grid.priorityStrip
    .filter((card) => card.productId === product.id)
    .map((card) => ({ kind: "priority" as const, card }));
  const rows = product.subsections.flatMap((subsection) =>
    COLUMN_ORDER.flatMap((column) =>
      subsection.columns[column].map((row) => ({
        kind: "row" as const,
        subsectionId: subsection.id,
        column,
        row,
      })),
    ),
  );
  return [...priorities, ...rows];
}

function chunks<T>(values: readonly T[], limit: number): readonly T[][] {
  if (values.length === 0) return [[]];
  const count = Math.ceil(values.length / limit);
  return Array.from({ length: count }, (_, index) =>
    values.slice(index * limit, (index + 1) * limit),
  );
}

function pageSubsection(
  subsection: GridSubsection,
  records: readonly LocatedRecord[],
): GridSubsection | null {
  const rows = records.filter(
    (record) => record.kind === "row" && record.subsectionId === subsection.id,
  );
  const rowsFor = (column: GridColumnKey) =>
    rows.flatMap((record) =>
      record.kind === "row" && record.column === column ? [record.row] : [],
    );
  const columns: GridSubsection["columns"] = {
    current: rowsFor("current"),
    next: rowsFor("next"),
    risks: rowsFor("risks"),
    decisions: rowsFor("decisions"),
  };
  const statusOnly =
    subsection.kind === "project" &&
    COLUMN_ORDER.every((column) => subsection.columns[column].length === 0);
  return rows.length > 0 || statusOnly ? { ...subsection, columns } : null;
}

function pageProduct(
  product: GridProductCard,
  records: readonly LocatedRecord[],
): GridProductCard {
  return {
    ...product,
    subsections: product.subsections.flatMap((subsection) => {
      const page = pageSubsection(subsection, records);
      return page === null ? [] : [page];
    }),
  };
}

function rowsIn(
  records: readonly LocatedRecord[],
  column: GridColumnKey,
): readonly GridRow[] {
  return records.flatMap((record) =>
    record.kind === "row" && record.column === column ? [record.row] : [],
  );
}

interface PageRecords {
  readonly current: readonly GridRow[];
  readonly next: readonly GridRow[];
  readonly risks: readonly GridRow[];
  readonly decisions: readonly GridRow[];
  readonly priorities: readonly GridPriorityCard[];
}

function pageRecords(records: readonly LocatedRecord[]): PageRecords {
  return {
    current: rowsIn(records, "current"),
    next: rowsIn(records, "next"),
    risks: rowsIn(records, "risks"),
    decisions: rowsIn(records, "decisions"),
    priorities: records.flatMap((record) =>
      record.kind === "priority" ? [record.card] : [],
    ),
  };
}

function pageProductSlide(
  source: SlideProduct | undefined,
  page: PageRecords,
): SlideProduct[] {
  if (source === undefined) return [];
  const visibleItemTexts = new Set(
    [...page.current, ...page.next].map((row) => row.text),
  );
  const itemRanks =
    source.itemRanks === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(source.itemRanks).filter(([text]) =>
            visibleItemTexts.has(text),
          ),
        );
  return [
    {
      ...source,
      currentItems: page.current.map((row) => row.text),
      nextItems: page.next.map((row) => row.text),
      risks: page.risks.map((row) => row.text),
      decisions: page.decisions.map((row) => row.text),
      priorities: page.priorities.map((card) => card.text),
      ...(itemRanks === undefined ? {} : { itemRanks }),
    },
  ];
}

function pageGrid(
  source: SlideGridModel,
  product: GridProductCard,
  records: readonly LocatedRecord[],
  page: PageRecords,
): SlideGridModel {
  const scored = !product.noData && product.status !== null;
  return {
    ...source,
    worstStatus: worstTrafficStatus([
      product.status,
      ...page.risks.map((risk) =>
        risk.tone === "blocked" ? ("red" as const) : ("yellow" as const),
      ),
    ]),
    counters: {
      current: page.current.length,
      risks: page.risks.length,
      priorities: page.priorities.length,
    },
    onTrack: {
      on: scored && product.status === "green" ? 1 : 0,
      total: scored ? 1 : 0,
    },
    priorityStrip: page.priorities,
    products: [pageProduct(product, records)],
  };
}

function buildPage(
  model: SectionSlideModel,
  grid: SlideGridModel,
  product: GridProductCard,
  records: readonly LocatedRecord[],
  productPageIndex: number,
  productPageTotal: number,
): SectionSlideModel {
  const sourceProduct = model.productSlides.find(
    (candidate) => candidate.id === product.id,
  );
  const page = pageRecords(records);
  return {
    ...model,
    products: [product.name],
    productSlides: pageProductSlide(sourceProduct, page),
    productCount: 1,
    currentCount: page.current.length,
    nextCount: page.next.length,
    riskCount: page.risks.length,
    decisionCount: page.decisions.length,
    priorityCount: page.priorities.length,
    currentItems: page.current.map((row) => row.text),
    nextItems: page.next.map((row) => row.text),
    risks: page.risks.map((row) => row.text),
    decisions: page.decisions.map((row) => row.text),
    priorities: page.priorities.map((card) => card.text),
    pageLabel:
      productPageTotal === 1
        ? product.name
        : productPageIndex === 0
          ? `${product.name} — 1 of ${String(productPageTotal)}`
          : `${product.name} — continuation ${String(productPageIndex + 1)} of ${String(productPageTotal)}`,
    grid: pageGrid(grid, product, records, page),
  };
}

export function paginateSectionSlides(
  model: SectionSlideModel,
  recordsPerPage = PRESENTATION_RECORDS_PER_PAGE,
): SectionSlideModel[] {
  if (recordsPerPage < 1)
    throw new RangeError("recordsPerPage must be positive");
  const grid = model.grid;
  if (grid === undefined || grid.products.length === 0) return [model];
  const pages = grid.products.flatMap((product) => {
    const productPages = chunks(
      recordsForProduct(grid, product),
      recordsPerPage,
    );
    return productPages.map((records, index) =>
      buildPage(model, grid, product, records, index, productPages.length),
    );
  });
  return pages.map((page, pageIndex) => ({
    ...page,
    pageIndex,
    pageTotal: pages.length,
  }));
}

export function slidesForDensity(
  slides: readonly SectionSlideModel[],
  density: SlideDensity,
): SectionSlideModel[] {
  return density === "document"
    ? [...slides]
    : slides.flatMap((slide) => paginateSectionSlides(slide));
}
