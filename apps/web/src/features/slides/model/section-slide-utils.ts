import type { TrafficLightStatus } from "@customreport/shared";
import type {
  ActivityLiveRow,
  ReportSectionReadModel,
} from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import { deriveEffectiveStageStatus } from "../../../lib/stage-status";
import type { CrossAuthorContentRow } from "../../report-sections/model/lead-cross-author";
import { riskCoversStage } from "../../report-sections/model/stage-tags";
import {
  stageStatusToTraffic,
  trafficToStageStatus,
} from "../../report-sections/model/traffic-light";
import { buildSlideGridModel, type SlideGridModel } from "./slide-grid-model";

const PERCENT_MAX = 100;
const DEFAULT_PRODUCTS_PER_PAGE = 9;
const CROSS_PRODUCT_ID = "cross-product";
const NEEDS_WORK_STATUS = "needs-work";

export type SlideTone = "ready" | "warning" | "blocked" | "empty";

export interface SlideReadinessItem {
  readonly id: string;
  readonly label: string;
  readonly status: "ready" | "needs-work" | "optional";
  readonly detail: string;
  readonly required: boolean;
}

export type SlideStageStatus = TrafficLightStatus | null;

export interface SlideStage {
  readonly id: string;
  readonly name: string;
  readonly status: SlideStageStatus;
}

export interface SlideProduct {
  readonly id: string;
  readonly name: string;
  readonly status: SlideStageStatus;
  readonly stages: SlideStage[];
  readonly currentItems: string[];
  readonly nextItems: string[];
  readonly risks: string[];
  readonly decisions: string[];
  readonly priorities: string[];
  /**
   * T-G3: map of item-text → priorityRank for THIS product, populated for
   * items whose priorityRank is non-null. Sparse — items without a rank
   * simply have no key. Lookup is used by the unified slide renderer to
   * stamp a P{N} chip next to bullets when the item carries a rank.
   *
   * Keyed by trimmed text because (text, productId) is unique within a
   * lead's section; rank can change between weeks so per-text lookup is
   * preferable to threading rank through every string array.
   */
  readonly itemRanks?: Readonly<Record<string, number>>;
}

/** One activity status pill on a section slide (name + traffic light). */
export interface SlideActivityPill {
  readonly id: string;
  readonly name: string;
  /** The risk/blocker-floored status (`derivedStatus ?? status`). */
  readonly status: SlideStageStatus;
  /** Label-only names of the products this activity reports against. */
  readonly linkedProducts: readonly string[];
}

export interface SectionSlideModel {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerRole: string;
  readonly status: ReportSectionReadModel["status"];
  readonly submittedAt: Date | null;
  readonly products: string[];
  readonly productSlides: SlideProduct[];
  readonly productCount: number;
  readonly currentCount: number;
  readonly nextCount: number;
  readonly riskCount: number;
  readonly decisionCount: number;
  readonly priorityCount: number;
  readonly blockedCount: number;
  readonly atRiskCount: number;
  readonly score: number;
  readonly tone: SlideTone;
  readonly readiness: SlideReadinessItem[];
  readonly currentItems: string[];
  readonly nextItems: string[];
  readonly risks: string[];
  readonly decisions: string[];
  readonly priorities: string[];
  /** Pagination: 0-based index of this page within the section. Undefined = no pagination. */
  readonly pageIndex?: number;
  /** Pagination: total number of pages for this section. Undefined = no pagination. */
  readonly pageTotal?: number;
  /**
   * The author's attached Project Activities as a minimal status-pill lane.
   * Optional so the activity-feed slide model (no section) omits it; copied
   * to every page by pagination (section-global, like the KPI counts).
   */
  readonly activities?: readonly SlideActivityPill[];
  /**
   * The by-product grid view model (redesign-lead-slide-by-product-grid).
   * Optional so the activity-feed slide model (no section) omits it; the
   * article falls back to a records-less header when missing. Pagination
   * slices `grid.products` in step with `productSlides`.
   */
  readonly grid?: SlideGridModel;
}

function nonEmpty(text: string | null | undefined): boolean {
  return typeof text === "string" && text.trim().length > 0;
}

/**
 * rethink-pipeline-state-vs-completeness (task 1.4): the slide stage status is
 * now a PURE derivation of the covering risks, via the shared
 * `deriveEffectiveStageStatus` — the same risk-derived path the live card uses
 * (`applyRiskSeverityFloor` also passes `items: []`), so the slide matches the
 * live card exactly. A non-empty risk that covers this stage (per the canonical
 * `riskCoversStage`, where empty or undefined stageIds cover every stage) sets
 * the rendered traffic light (blocked → red, at-risk → at least yellow). NOTE:
 * the read model (`buildStageGrid`) additionally floors on blocked workflow
 * items; the slide passes no items, so the two can differ only on a
 * blocked-item-without-risk stage.
 *
 * Behavior change vs. the old floor-only `floorSlideStageStatus`: an orphaned
 * persisted red/yellow with NO covering risk now collapses to on-track (green)
 * — matching the card's collapse-to-on-track — instead of surviving. on-track
 * and empty pass through untouched.
 */
function floorSlideStageStatus(
  status: SlideStageStatus,
  projectRisks: readonly ReportSectionReadModel["risks"][number][],
  stageName: string,
): SlideStageStatus {
  const covering = projectRisks.filter(
    (risk) => nonEmpty(risk.risk) && riskCoversStage(risk, stageName),
  );
  const derived = deriveEffectiveStageStatus(
    trafficToStageStatus(status),
    covering,
    [],
  );
  return stageStatusToTraffic(derived);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(nonEmpty))];
}

function statusTone(model: {
  readonly currentCount: number;
  readonly nextCount: number;
  readonly riskCount: number;
  readonly priorityCount: number;
  readonly blockedCount: number;
  readonly atRiskCount: number;
}): SlideTone {
  if (model.currentCount === 0 && model.nextCount === 0) return "empty";
  if (model.blockedCount > 0) return "blocked";
  if (
    model.atRiskCount > 0 ||
    model.riskCount > 0 ||
    model.priorityCount === 0
  ) {
    return "warning";
  }
  return "ready";
}

function readinessScore(items: readonly SlideReadinessItem[]): number {
  const required = items.filter((item) => item.required);
  if (required.length === 0) return PERCENT_MAX;
  const ready = required.filter((item) => item.status === "ready").length;
  return Math.round((ready / required.length) * PERCENT_MAX);
}

function describeCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function buildSectionSlideModel(
  section: ReportSectionReadModel,
  options: {
    /** Everyone-mode co-owner rows, folded into the grid WITH author identity. */
    readonly foreign?: readonly CrossAuthorContentRow[];
    /** Anonymized co-owner health fold (own deck only) — applied to product
     * statuses BEFORE the grid derives its cards, so both render paths agree. */
    readonly foreignHealth?: Parameters<typeof applyForeignProductHealth>[1];
  } = {},
): SectionSlideModel {
  const projectRows: ReportSectionReadModel["projects"] = [];
  const seenProjectIds = new Set<string>();
  for (const project of section.projects) {
    if (seenProjectIds.has(project.projectId)) continue;
    seenProjectIds.add(project.projectId);
    projectRows.push(project);
  }
  const products = unique(projectRows.map((project) => project.projectName));
  // activity-first-class: these product-slide aggregates (and the counts / score
  // / tone derived from them) exclude activity-parented records — those ride the
  // pills lane only. Items/risks are product-parented iff their product FK is
  // set; a decision is excluded only when parented to an activity (legacy
  // parentless "Group" decisions still count).
  const currentItems = section.items
    .filter(
      (item) =>
        item.type === "current" &&
        item.projectId != null &&
        nonEmpty(item.text),
    )
    .map((item) => item.text.trim());
  const nextItems = section.items
    .filter(
      (item) =>
        item.type === "next" && item.projectId != null && nonEmpty(item.text),
    )
    .map((item) => item.text.trim());
  const risks = section.risks
    .filter((risk) => risk.projectId != null && nonEmpty(risk.risk))
    .map((risk) => risk.risk.trim());
  const decisions = section.decisions
    .filter(
      (decision) => decision.activityId == null && nonEmpty(decision.text),
    )
    .map((decision) => decision.text.trim());
  const priorities = section.items
    .filter(
      (item) =>
        item.priorityRank != null &&
        item.projectId != null &&
        nonEmpty(item.text),
    )
    .map((item) => item.text.trim());

  const projectIds = new Set(projectRows.map((project) => project.projectId));
  const productSlides: SlideProduct[] = projectRows.map((project) => {
    const projectRisks = section.risks.filter(
      (risk) => risk.projectId === project.projectId,
    );
    const stages: SlideStage[] = [...(project.ownedStages ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stage) => ({
        id: stage.stageId,
        name: stage.stageName,
        // unify-risk-stage-status (D1): floor the persisted status by the
        // project's covering risks — same rule as the lead form / review.
        status: floorSlideStageStatus(
          stage.status ?? null,
          projectRisks,
          stage.stageName,
        ),
      }));
    return {
      id: project.projectId,
      name: project.projectName,
      // lead-live-walk-2026-06-14 (3.1, rethink-pipeline scope): the product
      // badge must reflect the same risk-derived health the live pipeline card
      // shows (`productHealthStatus` = worst floored stage). The old
      // `project.trafficLight` was the persisted, pre-floor traffic column that
      // rethink-pipeline demoted from source-of-truth, so a stale persisted
      // status with no covering risk (or a covering risk on an empty persisted
      // stage) drifted the badge away from the stages rendered right below it.
      // Deriving from the already-floored stages keeps the badge consistent with
      // the slide's own stages by construction and with the pipeline by shared
      // derivation.
      status: stages.reduce<SlideStageStatus>(
        (worst, stage) => worstTraffic(worst, stage.status),
        null,
      ),
      stages,
      currentItems: section.items
        .filter(
          (item) =>
            item.projectId === project.projectId &&
            item.type === "current" &&
            nonEmpty(item.text),
        )
        .map((item) => item.text.trim()),
      nextItems: section.items
        .filter(
          (item) =>
            item.projectId === project.projectId &&
            item.type === "next" &&
            nonEmpty(item.text),
        )
        .map((item) => item.text.trim()),
      risks: section.risks
        .filter(
          (risk) => risk.projectId === project.projectId && nonEmpty(risk.risk),
        )
        .map((risk) => risk.risk.trim()),
      decisions: section.decisions
        .filter(
          (decision) =>
            decision.productId === project.projectId && nonEmpty(decision.text),
        )
        .map((decision) => decision.text.trim()),
      priorities: section.items
        .filter(
          (item) =>
            item.projectId === project.projectId &&
            item.priorityRank != null &&
            nonEmpty(item.text),
        )
        .map((item) => item.text.trim()),
      // T-G3: capture per-text rank so the unified slide can render P{N}
      // chips on whichever bullet bucket the item lands in.
      itemRanks: section.items.reduce<Record<string, number>>((acc, item) => {
        if (
          item.projectId === project.projectId &&
          item.priorityRank != null &&
          nonEmpty(item.text)
        ) {
          acc[item.text.trim()] = item.priorityRank;
        }
        return acc;
      }, {}),
    };
  });

  // activity-first-class: a cross-product row references a project outside
  // section.projects; an activity-parented row is NOT one of those — exclude it
  // so it never leaks into the cross-product bucket.
  const crossProductDecisions = section.decisions
    .filter(
      (decision) =>
        decision.activityId == null &&
        (!decision.productId || !projectIds.has(decision.productId)) &&
        nonEmpty(decision.text),
    )
    .map((decision) => decision.text.trim());
  const crossProductPriorities = section.items
    .filter(
      (item) =>
        item.priorityRank != null &&
        item.activityId == null &&
        (!item.projectId || !projectIds.has(item.projectId)) &&
        nonEmpty(item.text),
    )
    .map((item) => item.text.trim());
  // Items / risks referencing a project outside section.projects (the
  // schema-anticipated referencedProjects case, section.schema.ts) must not
  // vanish from the slide while the section-level counts still include them:
  // route them into the cross-product pseudo-entry like decisions/priorities.
  // activity-first-class: exclude activity-parented rows from the cross-product
  // pseudo-entry — they render in the pills lane, not a product surface.
  const crossProductCurrentItems = section.items
    .filter(
      (item) =>
        item.type === "current" &&
        item.activityId == null &&
        (!item.projectId || !projectIds.has(item.projectId)) &&
        nonEmpty(item.text),
    )
    .map((item) => item.text.trim());
  const crossProductNextItems = section.items
    .filter(
      (item) =>
        item.type === "next" &&
        item.activityId == null &&
        (!item.projectId || !projectIds.has(item.projectId)) &&
        nonEmpty(item.text),
    )
    .map((item) => item.text.trim());
  const crossProductRisks = section.risks
    .filter(
      (risk) =>
        risk.activityId == null &&
        (!risk.projectId || !projectIds.has(risk.projectId)) &&
        nonEmpty(risk.risk),
    )
    .map((risk) => risk.risk.trim());
  if (
    crossProductCurrentItems.length > 0 ||
    crossProductNextItems.length > 0 ||
    crossProductRisks.length > 0 ||
    crossProductDecisions.length > 0 ||
    crossProductPriorities.length > 0
  ) {
    productSlides.push({
      id: CROSS_PRODUCT_ID,
      name: "Cross-product",
      status: null,
      stages: [],
      currentItems: crossProductCurrentItems,
      nextItems: crossProductNextItems,
      risks: crossProductRisks,
      decisions: crossProductDecisions,
      priorities: crossProductPriorities,
    });
  }

  const foldedProductSlides =
    options.foreignHealth === undefined || options.foreignHealth.length === 0
      ? productSlides
      : applyForeignProductHealth(productSlides, options.foreignHealth);

  const blockedProjectCount = section.projects.filter(
    (project) => project.trafficLight === "red",
  ).length;
  const atRiskProjectCount = section.projects.filter(
    (project) => project.trafficLight === "yellow",
  ).length;
  // activity-first-class (Decision 1): activity risks/blockers never feed product
  // health, so the slide's blocked/at-risk counts (which drive tone) count only
  // product-parented rows. Blocked-ness lives ONLY on risks now — items carry
  // progress, never an alarm (rework-item-status-model).
  const atRiskRiskCount = section.risks.filter(
    (risk) => risk.severity === "at-risk" && risk.projectId != null,
  ).length;
  const blockedRiskCount = section.risks.filter(
    (risk) => risk.severity === "blocked" && risk.projectId != null,
  ).length;

  const blockedCount = blockedProjectCount + blockedRiskCount;
  const atRiskCount = atRiskProjectCount + atRiskRiskCount;
  const hasProjectStatuses =
    section.projects.length > 0 &&
    section.projects.every((project) => project.trafficLight !== null);
  const hasRiskSignal = blockedCount > 0 || atRiskCount > 0;

  const readiness: SlideReadinessItem[] = [
    {
      id: "scope",
      label: "Scope",
      status: products.length > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        products.length > 0
          ? describeCount(products.length, "product")
          : "No product scope",
      required: true,
    },
    {
      id: "traffic",
      label: "Traffic lights",
      status: hasProjectStatuses ? "ready" : NEEDS_WORK_STATUS,
      detail: hasProjectStatuses
        ? "Every product has a status"
        : "Add status to every product",
      required: true,
    },
    {
      id: "current",
      label: "Current work",
      status: currentItems.length > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        currentItems.length > 0
          ? describeCount(currentItems.length, "item")
          : "Add at least one current item",
      required: true,
    },
    {
      id: "next",
      label: "Next focus",
      status: nextItems.length > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        nextItems.length > 0
          ? describeCount(nextItems.length, "item")
          : "Add next-period focus",
      required: true,
    },
    {
      id: "risks",
      label: "Risk story",
      status:
        risks.length > 0
          ? "ready"
          : hasRiskSignal
            ? NEEDS_WORK_STATUS
            : "optional",
      detail:
        risks.length > 0
          ? describeCount(risks.length, "risk")
          : hasRiskSignal
            ? "Explain the red or yellow signal"
            : "No active risk signal",
      required: hasRiskSignal,
    },
    {
      id: "priorities",
      label: "Top priorities",
      status: priorities.length > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        priorities.length > 0
          ? describeCount(priorities.length, "priority", "priorities")
          : "Add at least one priority",
      required: true,
    },
    {
      id: "decisions",
      label: "Decision context",
      status: decisions.length > 0 ? "ready" : "optional",
      detail:
        decisions.length > 0
          ? describeCount(decisions.length, "decision")
          : "No decision this period",
      required: false,
    },
  ];

  const score = readinessScore(readiness);
  const counts = {
    currentCount: currentItems.length,
    nextCount: nextItems.length,
    riskCount: risks.length,
    priorityCount: priorities.length,
    blockedCount,
    atRiskCount,
  };

  return {
    id: section.reportSectionId,
    ownerId: section.authorId,
    // Slide owner labels use the short form ("Иванов В.П."); full ФИО stays in
    // the top user badge only.
    ownerName: shortNameFromName(section.authorName),
    ownerRole: section.authorRole ?? "lead",
    status: section.status,
    submittedAt: section.submittedAt,
    products,
    productSlides: foldedProductSlides,
    productCount: products.length,
    currentCount: currentItems.length,
    nextCount: nextItems.length,
    riskCount: risks.length,
    decisionCount: decisions.length,
    priorityCount: priorities.length,
    blockedCount,
    atRiskCount,
    score,
    tone: statusTone(counts),
    readiness,
    currentItems,
    nextItems,
    risks,
    decisions,
    priorities,
    activities: section.activities.map((activity) => ({
      id: activity.activityId,
      name: activity.activityName,
      // Render the risk/blocker-derived floor, falling back to the stored status.
      status: activity.derivedStatus ?? activity.status,
      linkedProducts: activity.linkedProducts.map((p) => p.productName),
    })),
    grid: buildSlideGridModel({
      section,
      productStatuses: new Map(
        foldedProductSlides.map((p) => [p.id, p.status]),
      ),
      ...(options.foreign === undefined ? {} : { foreign: options.foreign }),
    }),
  };
}

export function buildActivitySlideModel(
  row: ActivityLiveRow,
): SectionSlideModel {
  const hasSection = row.reportSectionId !== null;
  const hasContent =
    row.itemCount > 0 ||
    row.riskCount > 0 ||
    row.decisionCount > 0 ||
    row.priorityCount > 0;
  const readiness: SlideReadinessItem[] = [
    {
      id: "scope",
      label: "Scope",
      status: hasSection ? "ready" : NEEDS_WORK_STATUS,
      detail: hasSection ? "Section exists" : "Section not created yet",
      required: true,
    },
    {
      id: "traffic",
      label: "Traffic lights",
      status: hasSection ? NEEDS_WORK_STATUS : "optional",
      detail: hasSection ? "Review product statuses" : "Waiting for section",
      required: hasSection,
    },
    {
      id: "current",
      label: "Current work",
      status: row.itemCount > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        row.itemCount > 0
          ? describeCount(row.itemCount, "item")
          : "No current items yet",
      required: true,
    },
    {
      id: "next",
      label: "Next focus",
      status: hasContent ? NEEDS_WORK_STATUS : "optional",
      detail: hasContent ? "Add next-period focus" : "Waiting for content",
      required: hasContent,
    },
    {
      id: "risks",
      label: "Risk story",
      status: row.riskCount > 0 ? "ready" : "optional",
      detail:
        row.riskCount > 0
          ? describeCount(row.riskCount, "risk")
          : "No risks raised",
      required: false,
    },
    {
      id: "priorities",
      label: "Top priorities",
      status: row.priorityCount > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        row.priorityCount > 0
          ? describeCount(row.priorityCount, "priority", "priorities")
          : "No priorities yet",
      required: true,
    },
    {
      id: "decisions",
      label: "Decision context",
      status: row.decisionCount > 0 ? "ready" : "optional",
      detail:
        row.decisionCount > 0
          ? describeCount(row.decisionCount, "decision")
          : "No decision this period",
      required: false,
    },
  ];
  const score = readinessScore(readiness);

  return {
    id: row.reportSectionId ?? row.leadId,
    ownerId: row.leadId,
    ownerName: shortNameFromName(row.leadName),
    ownerRole: "lead",
    status: row.status,
    submittedAt: row.submittedAt,
    products: [],
    productSlides: [],
    productCount: 0,
    currentCount: row.itemCount,
    nextCount: 0,
    riskCount: row.riskCount,
    decisionCount: row.decisionCount,
    priorityCount: row.priorityCount,
    blockedCount: 0,
    atRiskCount: row.riskCount > 0 ? 1 : 0,
    score,
    tone: hasContent ? "warning" : "empty",
    readiness,
    currentItems: [],
    nextItems: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

/**
 * Splits a section slide model into pages of `productsPerPage` products each.
 * The cross-product synthetic slide (id === "cross-product", if any) is placed
 * ONLY on the last page. KPI counts are copied to every page (section-global,
 * not per-page).
 */
export function paginateSectionSlides(
  model: SectionSlideModel,
  productsPerPage = DEFAULT_PRODUCTS_PER_PAGE,
): SectionSlideModel[] {
  // Separate real product slides from the synthetic cross-product entry.
  const crossProduct = model.productSlides.find(
    (p) => p.id === CROSS_PRODUCT_ID,
  );
  const productOnly = model.productSlides.filter(
    (p) => p.id !== CROSS_PRODUCT_ID,
  );

  if (productOnly.length <= productsPerPage && !crossProduct) {
    // No pagination needed — single page, no cross-product entry.
    return [model];
  }

  const pageCount = Math.max(
    1,
    Math.ceil(productOnly.length / productsPerPage),
  );

  if (pageCount === 1) {
    // All products fit on one page (with possible cross-product entry).
    return [model];
  }

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const start = pageIndex * productsPerPage;
    const chunk = productOnly.slice(start, start + productsPerPage);
    const isLast = pageIndex === pageCount - 1;
    const pageSlides =
      isLast && crossProduct ? [...chunk, crossProduct] : chunk;
    // The grid mirrors the page's product set so both render paths agree on
    // which products this page shows.
    const pageIds = new Set(pageSlides.map((p) => p.id));
    return {
      ...model,
      productSlides: pageSlides,
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
      pageTotal: pageCount,
    };
  });
}

/** Display label of the cross-product pseudo-entry; never part of the legend. */
export const CROSS_PRODUCT_LABEL = "Shared context";

export function sortSlidesForReview(
  slides: readonly SectionSlideModel[],
): SectionSlideModel[] {
  return [...slides].sort((a, b) => {
    const toneWeight: Record<SlideTone, number> = {
      blocked: 0,
      warning: 1,
      empty: 2,
      ready: 3,
    };
    const toneDiff = toneWeight[a.tone] - toneWeight[b.tone];
    if (toneDiff !== 0) return toneDiff;
    const scoreDiff = a.score - b.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.ownerName.localeCompare(b.ownerName);
  });
}

// ---- Product-scoped slide transposition (UAT 2026-05-22, done-condition 3/10) ----
//
// The default head deck is per-lead: one slide per lead's report section.
// "By product" scope transposes that into one slide per product, aggregating
// every lead's items / risks / decisions for that product into a single
// product-centric slide. Cross-product content (items/decisions with no
// product, or referencing a product the author does not own in their section)
// is collected into a synthetic "Shared context" slide, mirroring the
// per-section cross-product entry that buildSectionSlideModel already emits.
//
// Implementation reuses buildSectionSlideModel by synthesising one pseudo
// ReportSectionReadModel per product, so tone / score / readiness / counts are
// computed by the exact same logic as the per-lead path.

type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];
type OwnedStage = NonNullable<
  ReportSectionReadModel["projects"][number]["ownedStages"]
>[number];

const SHARED_PRODUCT_ID = "shared-context";
const SHARED_PRODUCT_NAME = CROSS_PRODUCT_LABEL;

const TRAFFIC_RANK: Record<TrafficLightStatus, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

function worstTraffic(
  a: SlideStageStatus,
  b: SlideStageStatus,
): SlideStageStatus {
  if (a == null) return b;
  if (b == null) return a;
  return TRAFFIC_RANK[a] >= TRAFFIC_RANK[b] ? a : b;
}

/**
 * scope-lead-report-to-own-contribution: raise each lead-slide product's health
 * by the worst foreign (co-lead) stage status for that product, mirroring the
 * live card's `productHealthStatus` (= worst of own + foreign). Foreign records
 * never appear on the slide; only the anonymized, risk-derived per-stage status
 * colour from `crossAuthors` lifts the product badge, so a co-owned product
 * reads at-risk/blocked on slides when a co-lead's stage is — never falsely
 * green. The foreign status is already risk-derived server-side; this only folds
 * the worst traffic value, carrying no foreign text/counts/names.
 */
export function applyForeignProductHealth(
  productSlides: readonly SlideProduct[],
  crossAuthors: readonly {
    projectId: string;
    stages: readonly { status: SlideStageStatus }[];
  }[],
): SlideProduct[] {
  if (crossAuthors.length === 0) return [...productSlides];
  return productSlides.map((product) => {
    const foreignWorst = crossAuthors
      .filter((ca) => ca.projectId === product.id)
      .flatMap((ca) => ca.stages)
      .reduce<SlideStageStatus>(
        (worst, stage) => worstTraffic(worst, stage.status),
        null,
      );
    return { ...product, status: worstTraffic(product.status, foreignWorst) };
  });
}

// ---- slides-record-visibility: Everyone foreign-content merge (view-only) ----

/**
 * Foreign co-owner content folded into the Everyone slide deck, PRE-CLASSIFIED
 * so the merge needs no presentation mapper (Codex A-2). It carries exactly the
 * fields `buildSectionSlideModel` derives from own rows — text + product +
 * blocked/severity — with `workflowStatus`/`severity` resolved up front, and NO
 * `priorityRank` (design Decision 8: foreign rows fold into grids + blocked/
 * at-risk counters but are excluded from priority ranking).
 */
export interface SlideForeignContent {
  readonly currentItems: readonly {
    projectId: string;
    text: string;
    blocked: boolean;
  }[];
  readonly nextItems: readonly {
    projectId: string;
    text: string;
    blocked: boolean;
  }[];
  readonly risks: readonly {
    projectId: string;
    text: string;
    blocked: boolean;
  }[];
  readonly decisions: readonly { projectId: string; text: string }[];
}

export const EMPTY_SLIDE_FOREIGN_CONTENT: SlideForeignContent = {
  currentItems: [],
  nextItems: [],
  risks: [],
  decisions: [],
};

/**
 * Adapt the gated `crossAuthorContent` rows into {@link SlideForeignContent}.
 * Reads `workflowStatus` / `severity` DIRECTLY (not the presentation `status`
 * the `mapForeign*` family emits), so the blocked/at-risk classification is
 * explicit and cannot silently undercount (Codex A-2).
 */
export function crossAuthorContentToSlideForeign(
  rows: readonly CrossAuthorContentRow[],
): SlideForeignContent {
  const currentItems: { projectId: string; text: string; blocked: boolean }[] =
    [];
  const nextItems: { projectId: string; text: string; blocked: boolean }[] = [];
  const risks: { projectId: string; text: string; blocked: boolean }[] = [];
  const decisions: { projectId: string; text: string }[] = [];
  for (const ca of rows) {
    for (const item of ca.items) {
      const row = {
        projectId: item.projectId,
        text: item.text,
        blocked: item.workflowStatus === "blocked",
      };
      if (item.type === "current") currentItems.push(row);
      else if (item.type === "next") nextItems.push(row);
    }
    for (const risk of ca.risks) {
      risks.push({
        projectId: risk.projectId,
        text: risk.risk,
        blocked: risk.severity === "blocked",
      });
    }
    for (const decision of ca.decisions) {
      decisions.push({ projectId: decision.productId, text: decision.text });
    }
  }
  return { currentItems, nextItems, risks, decisions };
}

/**
 * Everyone merge: fold foreign co-owner content into a base slide model,
 * producing NEW SlideProduct / SectionSlideModel objects (design Decision 3).
 * It NEVER mutates `model` (or the `ReportSectionReadModel` it derived from), so
 * the cached section the lead-form draft serializes stays own-only — the merge
 * is render-only. Foreign rows land only on products already in the deck (the
 * lead's shared, co-owned products); a row on a product the deck does not show
 * is dropped, never double-counted. Priorities are untouched (foreign excluded).
 */
export function mergeForeignSlideContent(
  model: SectionSlideModel,
  foreign: SlideForeignContent,
): SectionSlideModel {
  const deckIds = new Set(model.productSlides.map((product) => product.id));
  const landed = <T extends { projectId: string; text: string }>(
    rows: readonly T[],
  ): T[] =>
    rows.filter((row) => deckIds.has(row.projectId) && nonEmpty(row.text));
  const fCurrent = landed(foreign.currentItems);
  const fNext = landed(foreign.nextItems);
  const fRisks = landed(foreign.risks);
  const fDecisions = landed(foreign.decisions);
  if (
    fCurrent.length + fNext.length + fRisks.length + fDecisions.length ===
    0
  ) {
    return model;
  }

  const textFor = (
    rows: readonly { projectId: string; text: string }[],
    productId: string,
  ): string[] =>
    rows
      .filter((row) => row.projectId === productId)
      .map((row) => row.text.trim());

  const productSlides = model.productSlides.map((product) => {
    const current = textFor(fCurrent, product.id);
    const next = textFor(fNext, product.id);
    const risks = textFor(fRisks, product.id);
    const decisions = textFor(fDecisions, product.id);
    if (current.length + next.length + risks.length + decisions.length === 0) {
      return product;
    }
    return {
      ...product,
      currentItems: [...product.currentItems, ...current],
      nextItems: [...product.nextItems, ...next],
      risks: [...product.risks, ...risks],
      decisions: [...product.decisions, ...decisions],
    };
  });

  const blockedAdd =
    fCurrent.filter((r) => r.blocked).length +
    fNext.filter((r) => r.blocked).length +
    fRisks.filter((r) => r.blocked).length;
  const atRiskAdd = fRisks.filter((r) => !r.blocked).length;
  const counts = {
    currentCount: model.currentCount + fCurrent.length,
    nextCount: model.nextCount + fNext.length,
    riskCount: model.riskCount + fRisks.length,
    priorityCount: model.priorityCount,
    blockedCount: model.blockedCount + blockedAdd,
    atRiskCount: model.atRiskCount + atRiskAdd,
  };
  const trimText = (rows: readonly { text: string }[]): string[] =>
    rows.map((row) => row.text.trim());

  return {
    ...model,
    productSlides,
    currentItems: [...model.currentItems, ...trimText(fCurrent)],
    nextItems: [...model.nextItems, ...trimText(fNext)],
    risks: [...model.risks, ...trimText(fRisks)],
    decisions: [...model.decisions, ...trimText(fDecisions)],
    currentCount: counts.currentCount,
    nextCount: counts.nextCount,
    riskCount: counts.riskCount,
    decisionCount: model.decisionCount + fDecisions.length,
    blockedCount: counts.blockedCount,
    atRiskCount: counts.atRiskCount,
    // readiness/score stay OWN-only: they measure the author's own input
    // completeness, not the shared picture. Only the KPI counters + tone reflect
    // own + foreign (spec: "grids and KPI counters").
    tone: statusTone(counts),
  };
}

interface ProductAcc {
  projectId: string;
  projectName: string;
  trafficLight: SlideStageStatus;
  ownedStages: Map<string, OwnedStage>;
  items: SectionItem[];
  risks: SectionRisk[];
  decisions: SectionDecision[];
  contributors: string[];
  contributorSet: Set<string>;
  seenSections: Set<string>;
  anySubmitted: boolean;
  allSubmitted: boolean;
  latestSubmittedAt: Date | null;
}

export function buildProductScopedSlides(
  sections: readonly ReportSectionReadModel[],
): SectionSlideModel[] {
  const products = new Map<string, ProductAcc>();

  const ensure = (id: string, name: string): ProductAcc => {
    const existing = products.get(id);
    if (existing) return existing;
    const created: ProductAcc = {
      projectId: id,
      projectName: name,
      trafficLight: null,
      ownedStages: new Map(),
      items: [],
      risks: [],
      decisions: [],
      contributors: [],
      contributorSet: new Set(),
      seenSections: new Set(),
      anySubmitted: false,
      allSubmitted: true,
      latestSubmittedAt: null,
    };
    products.set(id, created);
    return created;
  };

  // Register a (product, section) contribution exactly once: tracks the
  // contributing lead name and folds the section's submitted state into the
  // product's aggregate status.
  const register = (acc: ProductAcc, section: ReportSectionReadModel) => {
    if (acc.seenSections.has(section.reportSectionId)) return;
    acc.seenSections.add(section.reportSectionId);
    if (!acc.contributorSet.has(section.authorName)) {
      // Dedup on the full name (collision-safe), display the short form.
      acc.contributorSet.add(section.authorName);
      acc.contributors.push(shortNameFromName(section.authorName));
    }
    const submitted = section.status === "submitted";
    acc.anySubmitted = acc.anySubmitted || submitted;
    acc.allSubmitted = acc.allSubmitted && submitted;
    if (
      submitted &&
      section.submittedAt &&
      (!acc.latestSubmittedAt || section.submittedAt > acc.latestSubmittedAt)
    ) {
      acc.latestSubmittedAt = section.submittedAt;
    }
  };

  for (const section of sections) {
    // A product is "owned" by the section iff it appears in section.projects.
    // Items/risks/decisions pointing elsewhere fall through to Shared context,
    // matching buildSectionSlideModel's per-section cross-product handling.
    const owned = new Set(section.projects.map((p) => p.projectId));

    for (const project of section.projects) {
      const acc = ensure(project.projectId, project.projectName);
      acc.trafficLight = worstTraffic(acc.trafficLight, project.trafficLight);
      for (const stage of project.ownedStages ?? []) {
        const prev = acc.ownedStages.get(stage.stageId);
        acc.ownedStages.set(
          stage.stageId,
          prev
            ? {
                ...prev,
                status: worstTraffic(prev.status ?? null, stage.status ?? null),
              }
            : stage,
        );
      }
      register(acc, section);
    }

    const bucketFor = (productId: string | null | undefined): ProductAcc =>
      productId && owned.has(productId)
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- membership just checked by owned.has(productId)
          products.get(productId)!
        : ensure(SHARED_PRODUCT_ID, SHARED_PRODUCT_NAME);

    for (const item of section.items) {
      const acc = bucketFor(item.projectId);
      acc.items.push(item);
      register(acc, section);
    }
    for (const risk of section.risks) {
      const acc = bucketFor(risk.projectId);
      acc.risks.push(risk);
      register(acc, section);
    }
    for (const decision of section.decisions) {
      const acc = bucketFor(decision.productId);
      acc.decisions.push(decision);
      register(acc, section);
    }
  }

  const fallbackReportId = sections[0]?.reportId ?? SHARED_PRODUCT_ID;

  return [...products.values()].map((acc) => {
    const pseudoSection: ReportSectionReadModel = {
      reportSectionId: `product-${acc.projectId}`,
      reportId: fallbackReportId,
      authorId: acc.projectId,
      authorName: acc.projectName,
      // Synthetic render-only aggregate — never written back, so the
      // optimistic-lock version is inert; a constant satisfies the type.
      version: 1,
      // authorRole intentionally omitted (no "product" role exists); the
      // resulting ownerRole is overridden below to label the slide source.
      status: acc.anySubmitted && acc.allSubmitted ? "submitted" : "draft",
      submittedAt: acc.latestSubmittedAt,
      projects: [
        {
          projectId: acc.projectId,
          projectName: acc.projectName,
          trafficLight: acc.trafficLight,
          ownedStages: [...acc.ownedStages.values()],
        },
      ],
      items: acc.items,
      risks: acc.risks,
      decisions: acc.decisions,
      // Product-scoped pseudo-section: activities are author-scoped, not
      // product-scoped, so the aggregate carries none.
      activities: [],
    };
    const model = buildSectionSlideModel(pseudoSection);
    return {
      ...model,
      // The product-scoped slide's owner heading is the PRODUCT name — restore it
      // in full (buildSectionSlideModel shortened it via the person-name path,
      // which does not apply to a product label).
      ownerName: acc.projectName,
      ownerRole: "product",
      // Subtitle / nav rail show contributing leads instead of the (single)
      // product name, which the h2 owner heading already displays.
      products:
        acc.contributors.length > 0 ? [...acc.contributors] : model.products,
    };
  });
}
