import type {
  DraftSavePayload,
  ItemOutcomeResult,
  PromotePlanInput,
  ReportSectionReadModel,
  ResolvePlanInput,
  RestorePlanInput,
  SubmitSectionPayload,
} from "@customreport/shared";

export interface LeadFormFillFromInput {
  readonly targetSectionId: string;
  readonly sourceSectionId: string;
  readonly version: number;
}

export interface LeadFormReopenInput {
  readonly reportSectionId: string;
  readonly reason?: string | undefined;
}

export interface LeadFormWritePending {
  readonly saveDraft: boolean;
  readonly submit: boolean;
  readonly resolvePlan: boolean;
  readonly restorePlan: boolean;
  readonly promotePlan: boolean;
  readonly fillFrom: boolean;
  readonly revoke: boolean;
  readonly reopen: boolean;
}

export type LeadFormWriteErrorKind = "conflict" | "error";

export class LeadFormWriteError extends Error {
  constructor(
    readonly kind: LeadFormWriteErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "LeadFormWriteError";
  }
}

export interface LeadFormWritePort {
  readonly pending: LeadFormWritePending;
  readonly saveDraft: (
    input: DraftSavePayload,
  ) => Promise<ReportSectionReadModel>;
  readonly submit: (
    input: SubmitSectionPayload,
  ) => Promise<ReportSectionReadModel>;
  readonly resolvePlan: (input: ResolvePlanInput) => Promise<ItemOutcomeResult>;
  readonly restorePlan: (input: RestorePlanInput) => Promise<ItemOutcomeResult>;
  readonly promotePlan: (input: PromotePlanInput) => Promise<ItemOutcomeResult>;
  readonly fillFrom: (input: LeadFormFillFromInput) => Promise<{
    readonly success: true;
    readonly copiedItems: number;
    // Authoritative post-fill section, so the caller can adopt it as a
    // self-write baseline instead of reporting a spurious external conflict.
    readonly section?: ReportSectionReadModel;
  }>;
  readonly revoke: (input: {
    readonly reportSectionId: string;
  }) => Promise<{ readonly success: true }>;
  readonly requestReopen: (
    input: LeadFormReopenInput,
  ) => Promise<{ readonly success: true }>;
}

export function isLeadFormWriteConflict(error: unknown): boolean {
  return error instanceof LeadFormWriteError && error.kind === "conflict";
}
