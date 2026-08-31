import type { z } from "zod";

import type { SearchPlanBase } from "./report-assistant-search-plan";

const semanticRecordKinds = new Set([
  "item",
  "risk",
  "decision",
  "activity_status",
]);
const statusRecordKinds = new Set([
  "product_status",
  "stage_status",
  "activity_status",
]);

const addIssue = (
  ctx: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
): void => {
  ctx.addIssue({ code: "custom", path: [...path], message });
};

const normalizedReference = (value: string): string =>
  value
    .normalize("NFKC")
    .replaceAll(/[‐‑‒–—―]/gu, "-")
    .trim()
    .replaceAll(/\s+/gu, " ")
    .toLocaleLowerCase();

const hasUniqueValues = (values: readonly unknown[]): boolean =>
  new Set(values).size === values.length;

const validatePublished = (
  plan: SearchPlanBase,
  ctx: z.RefinementCtx,
): void => {
  const { published } = plan.periods;
  if (!plan.periods.includeCurrent && published.mode === "none")
    addIssue(ctx, ["periods"], "Select at least one period source.");
  if (
    ["none", "all"].includes(published.mode) &&
    (published.count !== null || published.references.length > 0)
  )
    addIssue(
      ctx,
      ["periods", "published"],
      "This published mode cannot have a count or references.",
    );
  if (
    published.mode === "latest" &&
    (published.count === null || published.references.length > 0)
  )
    addIssue(
      ctx,
      ["periods", "published"],
      "Latest periods require a count and no references.",
    );
  if (
    published.mode === "named" &&
    (published.count !== null || published.references.length === 0)
  )
    addIssue(
      ctx,
      ["periods", "published"],
      "Named periods require references and no count.",
    );
};

const validateAuthorsAndSubjects = (
  plan: SearchPlanBase,
  ctx: z.RefinementCtx,
): void => {
  const { authors, subjects } = plan;
  if (
    authors.mode === "self" &&
    (authors.references.length > 0 || !authors.includeSelf)
  )
    addIssue(
      ctx,
      ["authors"],
      "Self mode requires no references and includeSelf.",
    );
  if (authors.mode === "all_visible" && authors.references.length > 0)
    addIssue(
      ctx,
      ["authors", "references"],
      "All-visible mode cannot have references.",
    );
  if (authors.mode === "selected" && authors.references.length === 0)
    addIssue(
      ctx,
      ["authors", "references"],
      "Selected mode requires references.",
    );
  if (
    subjects.linkedActivityMode !== "exclude" &&
    subjects.productReferences.length === 0
  )
    addIssue(
      ctx,
      ["subjects", "productReferences"],
      "Linked activity expansion requires a product reference.",
    );
};

const validateUniqueArrays = (
  plan: SearchPlanBase,
  ctx: z.RefinementCtx,
): void => {
  const references = [
    plan.periods.published.references,
    plan.authors.references,
    plan.subjects.productReferences,
    plan.subjects.activityReferences,
    plan.stages.references,
  ];
  references.forEach((values, index) => {
    if (!hasUniqueValues(values.map(normalizedReference)))
      addIssue(
        ctx,
        ["references", index],
        "References must be unique after normalization.",
      );
  });
  const arrays = [
    plan.subjects.parentKinds,
    plan.recordKinds,
    plan.filters.itemTypes,
    plan.filters.itemWorkflowStatuses,
    plan.filters.riskSeverities,
    plan.filters.decisionStates,
    plan.filters.decisionTiming,
    plan.filters.canonicalHealth,
    plan.filters.priorityRanks,
    plan.output.groupBy,
  ];
  arrays.forEach((values, index) => {
    if (!hasUniqueValues(values))
      addIssue(ctx, ["unique", index], "Values must be unique.");
  });
};

const permitsKind = (kinds: readonly string[], kind: string): boolean =>
  kinds.length === 0 || kinds.includes(kind);

const validateFilters = (plan: SearchPlanBase, ctx: z.RefinementCtx): void => {
  const { filters, recordKinds } = plan;
  const hasItemFilter =
    filters.itemTypes.length > 0 ||
    filters.itemWorkflowStatuses.length > 0 ||
    filters.carriedOver !== null;
  if (hasItemFilter && !permitsKind(recordKinds, "item"))
    addIssue(ctx, ["recordKinds"], "Item filters require item records.");
  if (filters.riskSeverities.length > 0 && !permitsKind(recordKinds, "risk"))
    addIssue(ctx, ["recordKinds"], "Risk filters require risk records.");
  if (
    (filters.decisionStates.length > 0 || filters.decisionTiming.length > 0) &&
    !permitsKind(recordKinds, "decision")
  )
    addIssue(
      ctx,
      ["recordKinds"],
      "Decision filters require decision records.",
    );
  if (
    filters.canonicalHealth.length > 0 &&
    recordKinds.length > 0 &&
    !recordKinds.some((kind) => statusRecordKinds.has(kind))
  )
    addIssue(
      ctx,
      ["recordKinds"],
      "Canonical health requires a status record kind.",
    );
  if (filters.priorityRanks.length > 0 && filters.hasPriority !== true)
    addIssue(
      ctx,
      ["filters", "hasPriority"],
      "Priority ranks require hasPriority true.",
    );
};

const validateRetrievalAndOutput = (
  plan: SearchPlanBase,
  ctx: z.RefinementCtx,
): void => {
  const { retrieval, output } = plan;
  if (retrieval.mode === "structured" && retrieval.semanticQuery !== null)
    addIssue(
      ctx,
      ["retrieval", "semanticQuery"],
      "Structured retrieval requires a null semantic query.",
    );
  if (
    retrieval.mode === "semantic_ranked" &&
    (retrieval.semanticQuery === null ||
      (!plan.recordKinds.some((kind) => semanticRecordKinds.has(kind)) &&
        plan.recordKinds.length > 0))
  )
    addIssue(
      ctx,
      ["retrieval"],
      "Semantic retrieval requires a query and a semantic-capable record kind.",
    );
  if (output.mode === "comparison" && output.groupBy.length === 0)
    addIssue(ctx, ["output", "groupBy"], "Comparison requires grouping.");
};

/** Public shared schema or contract constant for validate search plan. */
export const validateSearchPlan = (
  plan: SearchPlanBase,
  ctx: z.RefinementCtx,
): void => {
  validatePublished(plan, ctx);
  validateAuthorsAndSubjects(plan, ctx);
  validateUniqueArrays(plan, ctx);
  validateFilters(plan, ctx);
  validateRetrievalAndOutput(plan, ctx);
};
