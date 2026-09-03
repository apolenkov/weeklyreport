import type {
  DraftSavePayload,
  ReportSectionReadModel,
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
  readonly fillFrom: (
    input: LeadFormFillFromInput,
  ) => Promise<{ readonly success: true; readonly copiedItems: number }>;
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
