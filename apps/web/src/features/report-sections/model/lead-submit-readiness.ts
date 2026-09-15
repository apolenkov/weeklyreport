import {
  type ReportSectionReadModel,
  submitSectionSchema,
  validateSubmitInput,
} from "@customreport/shared";

import type { AutosaveState } from "./autosave/autosave-types";
import {
  type DraftSaveContent,
  toActivityStatusPayload,
} from "./lead-section-draft-payload";
import { computeCoupling, validateCoupling } from "./status-risk/coupling";
import type { Product, RiskEntry } from "./types";

interface LeadSubmitStatusIdentity {
  readonly id: string;
  readonly kind: "product" | "activity" | "stage";
  readonly label: string;
}

interface LeadSubmitBlockingIssue {
  readonly id: string;
  readonly label: string;
  readonly overviewFocus?: string | undefined;
}

export interface LeadSubmitReadinessInput {
  readonly draftSection: ReportSectionReadModel | null;
  readonly draftPayload: DraftSaveContent | null;
  readonly products: readonly Product[];
  readonly activities: readonly { id: string; name: string }[];
  readonly stages: readonly {
    projectId: string;
    stageId: string;
    // null = unresolved stage label; rendered as "Unnamed stage", never the raw id.
    name: string | null;
  }[];
  readonly ownRisks: readonly RiskEntry[];
  readonly autosaveState: AutosaveState;
  readonly submitPending: boolean;
}

export interface LeadSubmitReadiness {
  readonly unsetStatuses: readonly LeadSubmitStatusIdentity[];
  readonly willAutoPromote: readonly LeadSubmitStatusIdentity[];
  readonly blockingIssues: readonly LeadSubmitBlockingIssue[];
  readonly autosaveState: AutosaveState;
  readonly submitPending: boolean;
  readonly canOpenConfirmation: boolean;
}

export function committedRisks(
  risks: readonly RiskEntry[],
): readonly RiskEntry[] {
  return risks.filter(
    (risk) => risk.text.trim().length > 0 && risk.mitigation.trim().length > 0,
  );
}

function couplingIssues(
  products: readonly Product[],
  ownRisks: readonly RiskEntry[],
): LeadSubmitBlockingIssue[] {
  const coupling = computeCoupling(products, committedRisks(ownRisks));
  const missingIds = new Set(validateCoupling(coupling).missing);
  return coupling
    .filter((entry) => missingIds.has(entry.productId))
    .map((entry) => ({
      id: `risk-stage:${entry.productId}`,
      label: `${entry.productName}: specify stages for committed risks.`,
      overviewFocus: "report-details",
    }));
}

function submissionIssues(
  input: LeadSubmitReadinessInput,
): LeadSubmitBlockingIssue[] {
  const draftPayload = input.draftPayload;
  if (!input.draftSection || !draftPayload) return [];

  const submitInput = submitSectionSchema.safeParse(
    buildLeadSubmitPayload(draftPayload, input.draftSection.version),
  );
  if (!submitInput.success) {
    return submitInput.error.issues.map((issue, index) => {
      const itemIndex = issue.path[0] === "items" ? issue.path[1] : undefined;
      const item =
        typeof itemIndex === "number"
          ? draftPayload.items[itemIndex]
          : undefined;
      const identity = item?.stableId ?? item?.id;
      return {
        id: `submit-schema:${issue.path.join(".")}:${issue.code}:${index}`,
        label: issue.message,
        ...(item && identity
          ? { overviewFocus: `edit:${item.type}:${identity}` }
          : {}),
      };
    });
  }

  const validationIssues = validateSubmitInput(
    input.draftSection,
    submitInput.data,
  );
  const missingCurrentProjectIds = input.draftSection.projects
    .filter(
      (project) =>
        !submitInput.data.items.some(
          (item) =>
            item.projectId === project.projectId && item.type === "current",
        ),
    )
    .map((project) => project.projectId);
  return validationIssues.flatMap((issue, index) => {
    if (issue.code !== "UNCONFIRMED_CARRIED_ITEM") {
      const missingCurrentIndex = validationIssues
        .slice(0, index)
        .filter(
          (candidate) => candidate.code === "MISSING_CURRENT_ITEM",
        ).length;
      const missingCurrentProjectId =
        issue.code === "MISSING_CURRENT_ITEM"
          ? missingCurrentProjectIds[missingCurrentIndex]
          : undefined;
      return [
        {
          id: `submit-validation:${issue.code}:${index}`,
          label: issue.message,
          ...(missingCurrentProjectId
            ? {
                overviewFocus: `add:product:${missingCurrentProjectId}`,
              }
            : {}),
        },
      ];
    }
    return draftPayload.items
      .filter((item) => item.type === "current" && item.carriedOver)
      .map((item, itemIndex) => {
        const identity = item.stableId ?? item.id;
        return {
          id: `submit-validation:${issue.code}:${identity ?? String(itemIndex)}`,
          label: `Confirm "${item.text}" for this week.`,
          ...(identity ? { overviewFocus: `confirm:current:${identity}` } : {}),
        };
      });
  });
}

function statusLabelMaps(input: LeadSubmitReadinessInput) {
  return {
    products: new Map(input.products.map((item) => [item.id, item.name])),
    activities: new Map(input.activities.map((item) => [item.id, item.name])),
    stages: new Map(
      input.stages.map((item) => [
        `${item.projectId}:${item.stageId}`,
        item.name,
      ]),
    ),
  };
}
function projectPromotions(
  input: LeadSubmitReadinessInput,
  labels: ReadonlyMap<string, string>,
): LeadSubmitStatusIdentity[] {
  return (input.draftPayload?.projectStatuses ?? []).flatMap((status) =>
    status.status == null
      ? [
          {
            id: `product:${status.projectId}`,
            kind: "product" as const,
            label: labels.get(status.projectId) ?? "Unnamed product",
          },
        ]
      : [],
  );
}

function activityPromotions(
  input: LeadSubmitReadinessInput,
  labels: ReadonlyMap<string, string>,
): LeadSubmitStatusIdentity[] {
  return (input.draftPayload?.activityStatuses ?? []).flatMap((status) =>
    status.status == null
      ? [
          {
            id: `activity:${status.activityId}`,
            kind: "activity" as const,
            label: labels.get(status.activityId) ?? "Unnamed activity",
          },
        ]
      : [],
  );
}

function stagePromotions(
  input: LeadSubmitReadinessInput,
  labels: Pick<ReturnType<typeof statusLabelMaps>, "products" | "stages">,
): LeadSubmitStatusIdentity[] {
  return (input.draftPayload?.stageStatuses ?? []).flatMap((status) => {
    if (status.status != null) return [];
    const product = labels.products.get(status.projectId) ?? "Unnamed product";
    const stage =
      labels.stages.get(`${status.projectId}:${status.stageId}`) ??
      "Unnamed stage";
    return [
      {
        id: `stage:${status.projectId}:${status.stageId}`,
        kind: "stage" as const,
        label: `${product} / ${stage}`,
      },
    ];
  });
}

export function deriveLeadSubmitReadiness(
  input: LeadSubmitReadinessInput,
): LeadSubmitReadiness {
  const labels = statusLabelMaps(input);
  const willAutoPromote = [
    ...projectPromotions(input, labels.products),
    ...activityPromotions(input, labels.activities),
    ...stagePromotions(input, labels),
  ];
  const blockingIssues = [
    ...(input.draftPayload
      ? []
      : [{ id: "missing-draft", label: "The report draft is not available." }]),
    ...submissionIssues(input),
    ...couplingIssues(input.products, input.ownRisks),
  ];
  return {
    unsetStatuses: willAutoPromote,
    willAutoPromote,
    blockingIssues,
    autosaveState: input.autosaveState,
    submitPending: input.submitPending,
    canOpenConfirmation: blockingIssues.length === 0 && !input.submitPending,
  };
}

export function buildLeadSubmitPayload(
  draftPayload: DraftSaveContent,
  version: number,
) {
  return {
    ...draftPayload,
    version,
    projectStatuses: draftPayload.projectStatuses.map((status) => ({
      projectId: status.projectId,
      status: status.status ?? ("green" as const),
    })),
    activityStatuses: (draftPayload.activityStatuses ?? []).map((status) =>
      toActivityStatusPayload({ ...status, status: status.status ?? "green" }),
    ),
    stageStatuses: (draftPayload.stageStatuses ?? []).map((status) => ({
      ...status,
      status: status.status ?? ("green" as const),
    })),
    confirmed: true as const,
  };
}
