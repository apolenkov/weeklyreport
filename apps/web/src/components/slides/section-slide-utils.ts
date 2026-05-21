import type {
  ActivityLiveRow,
  ReportSectionReadModel,
} from "@customreport/shared";

export type SlideTone = "ready" | "warning" | "blocked" | "empty";

export type SlideReadinessItem = {
  readonly id: string;
  readonly label: string;
  readonly status: "ready" | "needs-work" | "optional";
  readonly detail: string;
  readonly required: boolean;
};

export type SlideStageStatus = "green" | "yellow" | "red" | null;

export type SlideStage = {
  readonly id: string;
  readonly name: string;
  readonly status: SlideStageStatus;
};

export type SlideProduct = {
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
};

export type SectionSlideModel = {
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
};

function nonEmpty(text: string | null | undefined): boolean {
  return typeof text === "string" && text.trim().length > 0;
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
  if (required.length === 0) return 100;
  const ready = required.filter((item) => item.status === "ready").length;
  return Math.round((ready / required.length) * 100);
}

function describeCount(
  count: number,
  singular: string,
  plural = singular + "s",
) {
  return count === 1 ? "1 " + singular : count + " " + plural;
}

export function buildSectionSlideModel(
  section: ReportSectionReadModel,
): SectionSlideModel {
  const projectRows: ReportSectionReadModel["projects"] = [];
  const seenProjectIds = new Set<string>();
  for (const project of section.projects) {
    if (seenProjectIds.has(project.projectId)) continue;
    seenProjectIds.add(project.projectId);
    projectRows.push(project);
  }
  const products = unique(projectRows.map((project) => project.projectName));
  const currentItems = section.items
    .filter((item) => item.type === "current" && nonEmpty(item.text))
    .map((item) => item.text.trim());
  const nextItems = section.items
    .filter((item) => item.type === "next" && nonEmpty(item.text))
    .map((item) => item.text.trim());
  const risks = section.risks
    .filter((risk) => nonEmpty(risk.risk))
    .map((risk) => risk.risk.trim());
  const decisions = section.decisions
    .filter((decision) => nonEmpty(decision.text))
    .map((decision) => decision.text.trim());
  const priorities = section.items
    .filter((item) => item.priorityRank != null && nonEmpty(item.text))
    .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0))
    .map((item) => item.text.trim());

  const projectIds = new Set(projectRows.map((project) => project.projectId));
  const productSlides: SlideProduct[] = projectRows.map((project) => ({
    id: project.projectId,
    name: project.projectName,
    status: project.trafficLight,
    stages: [...(project.ownedStages ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stage) => ({
        id: stage.stageId,
        name: stage.stageName,
        status: stage.status ?? null,
      })),
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
      .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0))
      .map((item) => item.text.trim()),
    // T-G3: capture per-text rank so the unified slide can render P{N}
    // chips on whichever bullet bucket the item lands in.
    itemRanks: section.items.reduce<Record<string, number>>((acc, item) => {
      if (item.projectId === project.projectId && item.priorityRank != null && nonEmpty(item.text)) {
        acc[item.text.trim()] = item.priorityRank;
      }
      return acc;
    }, {}),
  }));

  const crossProductDecisions = section.decisions
    .filter(
      (decision) =>
        (!decision.productId || !projectIds.has(decision.productId)) &&
        nonEmpty(decision.text),
    )
    .map((decision) => decision.text.trim());
  const crossProductPriorities = section.items
    .filter(
      (item) =>
        item.priorityRank != null &&
        (!item.projectId || !projectIds.has(item.projectId)) &&
        nonEmpty(item.text),
    )
    .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0))
    .map((item) => item.text.trim());
  if (crossProductDecisions.length > 0 || crossProductPriorities.length > 0) {
    productSlides.push({
      id: "cross-product",
      name: "Cross-product",
      status: null,
      stages: [],
      currentItems: [],
      nextItems: [],
      risks: [],
      decisions: crossProductDecisions,
      priorities: crossProductPriorities,
    });
  }

  const blockedProjectCount = section.projects.filter(
    (project) => project.trafficLight === "red",
  ).length;
  const atRiskProjectCount = section.projects.filter(
    (project) => project.trafficLight === "yellow",
  ).length;
  const blockedItemCount = section.items.filter(
    (item) => item.workflowStatus === "blocked",
  ).length;
  const atRiskRiskCount = section.risks.filter(
    (risk) => risk.severity === "at-risk",
  ).length;
  const blockedRiskCount = section.risks.filter(
    (risk) => risk.severity === "blocked",
  ).length;

  const blockedCount =
    blockedProjectCount + blockedItemCount + blockedRiskCount;
  const atRiskCount = atRiskProjectCount + atRiskRiskCount;
  const hasProjectStatuses =
    section.projects.length > 0 &&
    section.projects.every((project) => project.trafficLight !== null);
  const hasRiskSignal = blockedCount > 0 || atRiskCount > 0;

  const readiness: SlideReadinessItem[] = [
    {
      id: "scope",
      label: "Scope",
      status: products.length > 0 ? "ready" : "needs-work",
      detail:
        products.length > 0
          ? describeCount(products.length, "product")
          : "No product scope",
      required: true,
    },
    {
      id: "traffic",
      label: "Traffic lights",
      status: hasProjectStatuses ? "ready" : "needs-work",
      detail: hasProjectStatuses
        ? "Every product has a status"
        : "Add status to every product",
      required: true,
    },
    {
      id: "current",
      label: "Current work",
      status: currentItems.length > 0 ? "ready" : "needs-work",
      detail:
        currentItems.length > 0
          ? describeCount(currentItems.length, "item")
          : "Add at least one current item",
      required: true,
    },
    {
      id: "next",
      label: "Next focus",
      status: nextItems.length > 0 ? "ready" : "needs-work",
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
        risks.length > 0 ? "ready" : hasRiskSignal ? "needs-work" : "optional",
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
      status: priorities.length > 0 ? "ready" : "needs-work",
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
    ownerName: section.authorName,
    ownerRole: section.authorRole ?? "lead",
    status: section.status,
    submittedAt: section.submittedAt,
    products,
    productSlides,
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
      status: hasSection ? "ready" : "needs-work",
      detail: hasSection ? "Section exists" : "Section not created yet",
      required: true,
    },
    {
      id: "traffic",
      label: "Traffic lights",
      status: hasSection ? "needs-work" : "optional",
      detail: hasSection ? "Review product statuses" : "Waiting for section",
      required: hasSection,
    },
    {
      id: "current",
      label: "Current work",
      status: row.itemCount > 0 ? "ready" : "needs-work",
      detail:
        row.itemCount > 0
          ? describeCount(row.itemCount, "item")
          : "No current items yet",
      required: true,
    },
    {
      id: "next",
      label: "Next focus",
      status: hasContent ? "needs-work" : "optional",
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
      status: row.priorityCount > 0 ? "ready" : "needs-work",
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
    ownerName: row.leadName,
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
  productsPerPage = 9,
): SectionSlideModel[] {
  // Separate real product slides from the synthetic cross-product entry.
  const crossProduct = model.productSlides.find(
    (p) => p.id === "cross-product",
  );
  const productOnly = model.productSlides.filter(
    (p) => p.id !== "cross-product",
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

  const pages: SectionSlideModel[] = [];
  for (let i = 0; i < productOnly.length; i += productsPerPage) {
    const chunk = productOnly.slice(i, i + productsPerPage);
    const isLast = i + productsPerPage >= productOnly.length;
    pages.push({
      ...model,
      productSlides: isLast && crossProduct ? [...chunk, crossProduct] : chunk,
      pageIndex: pages.length,
      pageTotal: pageCount,
    });
  }
  return pages;
}

// ---- Unified by-section slide model (W12) ----

export type UnifiedSectionRow = {
  readonly text: string;
  readonly productName: string;
  /** T-G3: present when the source item carries a priorityRank. */
  readonly priorityRank?: number;
};

export type UnifiedSlideModel = {
  readonly current: readonly UnifiedSectionRow[];
  readonly next: readonly UnifiedSectionRow[];
  readonly risks: readonly UnifiedSectionRow[];
  readonly priorities: readonly UnifiedSectionRow[];
  readonly decisions: readonly UnifiedSectionRow[];
  readonly emptyProducts: {
    readonly current: readonly string[];
    readonly next: readonly string[];
    readonly risks: readonly string[];
    readonly priorities: readonly string[];
    readonly decisions: readonly string[];
  };
};

export function buildUnifiedSlideModel(
  slide: SectionSlideModel,
): UnifiedSlideModel {
  const products = [...slide.productSlides].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const current: UnifiedSectionRow[] = [];
  const next: UnifiedSectionRow[] = [];
  const risks: UnifiedSectionRow[] = [];
  const priorities: UnifiedSectionRow[] = [];
  const decisions: UnifiedSectionRow[] = [];
  const emptyProducts = {
    current: [] as string[],
    next: [] as string[],
    risks: [] as string[],
    priorities: [] as string[],
    decisions: [] as string[],
  };

  for (const product of products) {
    const name =
      product.id === "cross-product" ? "Shared context" : product.name;
    const ranks = product.itemRanks ?? {};
    const withRank = (text: string): UnifiedSectionRow => {
      const rank = ranks[text];
      return rank != null
        ? { text, productName: name, priorityRank: rank }
        : { text, productName: name };
    };
    if (product.currentItems.length > 0) {
      product.currentItems.forEach((text) => current.push(withRank(text)));
    } else {
      emptyProducts.current.push(name);
    }
    if (product.nextItems.length > 0) {
      product.nextItems.forEach((text) => next.push(withRank(text)));
    } else {
      emptyProducts.next.push(name);
    }
    if (product.risks.length > 0) {
      // Risks don't carry priorityRank, but keep the row shape uniform.
      product.risks.forEach((text) => risks.push({ text, productName: name }));
    } else {
      emptyProducts.risks.push(name);
    }
    if (product.priorities.length > 0) {
      product.priorities.forEach((text) => priorities.push(withRank(text)));
    } else {
      emptyProducts.priorities.push(name);
    }
    if (product.decisions.length > 0) {
      product.decisions.forEach((text) =>
        decisions.push({ text, productName: name }),
      );
    } else {
      emptyProducts.decisions.push(name);
    }
  }

  return { current, next, risks, priorities, decisions, emptyProducts };
}

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
