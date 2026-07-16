import type { AutosaveState } from "../../../hooks/use-lead-form-autosave";
import {
  computeCoupling,
  validateCoupling,
} from "../../../hooks/use-status-risk";
import type { DraftSaveContent } from "./lead-section-draft-payload";
import type { Product, RiskEntry } from "./types";

export interface LeadSubmitStatusIdentity {
  readonly id: string;
  readonly kind: "product" | "activity" | "stage";
  readonly label: string;
}

export interface LeadSubmitBlockingIssue {
  readonly id: string;
  readonly label: string;
}

export interface LeadSubmitReadinessInput {
  readonly draftPayload: DraftSaveContent | null;
  readonly products: readonly Product[];
  readonly activities: readonly { id: string; name: string }[];
  readonly stages: readonly {
    projectId: string;
    stageId: string;
    name: string;
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

const committedRisks = (risks: readonly RiskEntry[]) =>
  risks.filter(
    (risk) => risk.text.trim().length > 0 && risk.mitigation.trim().length > 0,
  );

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
    }));
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
): LeadSubmitStatusIdentity[] {
  const labels = statusLabelMaps(input).products;
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
): LeadSubmitStatusIdentity[] {
  const labels = statusLabelMaps(input).activities;
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
): LeadSubmitStatusIdentity[] {
  const labels = statusLabelMaps(input);
  return (input.draftPayload?.stageStatuses ?? []).flatMap((status) => {
    if (status.status === "green") return [];
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

function unsetStatuses(
  input: LeadSubmitReadinessInput,
  promotions: readonly LeadSubmitStatusIdentity[],
): LeadSubmitStatusIdentity[] {
  const unsetIds = new Set([
    ...(input.draftPayload?.projectStatuses ?? [])
      .filter((status) => status.status == null)
      .map((status) => `product:${status.projectId}`),
    ...(input.draftPayload?.activityStatuses ?? [])
      .filter((status) => status.status == null)
      .map((status) => `activity:${status.activityId}`),
    ...(input.draftPayload?.stageStatuses ?? [])
      .filter((status) => status.status == null)
      .map((status) => `stage:${status.projectId}:${status.stageId}`),
  ]);
  return promotions.filter((status) => unsetIds.has(status.id));
}

export function deriveLeadSubmitReadiness(
  input: LeadSubmitReadinessInput,
): LeadSubmitReadiness {
  const willAutoPromote = [
    ...projectPromotions(input),
    ...activityPromotions(input),
    ...stagePromotions(input),
  ];
  const blockingIssues = [
    ...(input.draftPayload
      ? []
      : [{ id: "missing-draft", label: "The report draft is not available." }]),
    ...couplingIssues(input.products, input.ownRisks),
  ];
  return {
    unsetStatuses: unsetStatuses(input, willAutoPromote),
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
    activityStatuses: (draftPayload.activityStatuses ?? []).map((status) => ({
      activityId: status.activityId,
      status: status.status ?? ("green" as const),
      note: status.note ?? null,
    })),
    stageStatuses: (draftPayload.stageStatuses ?? []).map((status) => ({
      ...status,
      status: status.status === "green" ? status.status : ("green" as const),
    })),
    confirmed: true as const,
  };
}
