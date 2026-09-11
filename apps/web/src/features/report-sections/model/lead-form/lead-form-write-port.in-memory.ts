import type {
  DraftSavePayload,
  ReportSectionReadModel,
  ResolvePlanInput,
  RestorePlanInput,
  SubmitSectionPayload,
} from "@customreport/shared";

import type {
  LeadFormFillFromInput,
  LeadFormReopenInput,
  LeadFormWritePending,
  LeadFormWritePort,
} from "./lead-form-write-port";

export interface InMemoryLeadFormWriteHandlers {
  readonly saveDraft: (
    input: DraftSavePayload,
  ) => Promise<ReportSectionReadModel>;
  readonly submit: (
    input: SubmitSectionPayload,
  ) => Promise<ReportSectionReadModel>;
  readonly resolvePlan?: LeadFormWritePort["resolvePlan"];
  readonly restorePlan?: LeadFormWritePort["restorePlan"];
  readonly fillFrom?: LeadFormWritePort["fillFrom"];
  readonly revoke?: LeadFormWritePort["revoke"];
  readonly requestReopen?: LeadFormWritePort["requestReopen"];
}

export interface InMemoryLeadFormWriteCalls {
  readonly saveDraft: DraftSavePayload[];
  readonly submit: SubmitSectionPayload[];
  readonly resolvePlan: ResolvePlanInput[];
  readonly restorePlan: RestorePlanInput[];
  readonly fillFrom: LeadFormFillFromInput[];
  readonly revoke: { readonly reportSectionId: string }[];
  readonly requestReopen: LeadFormReopenInput[];
}

const IDLE: LeadFormWritePending = {
  saveDraft: false,
  submit: false,
  resolvePlan: false,
  restorePlan: false,
  fillFrom: false,
  revoke: false,
  reopen: false,
};

// Deterministic adapter for tests at the editor's external seam.
export class InMemoryLeadFormWriteAdapter implements LeadFormWritePort {
  readonly pending: LeadFormWritePending;
  readonly calls: InMemoryLeadFormWriteCalls = {
    saveDraft: [],
    submit: [],
    resolvePlan: [],
    restorePlan: [],
    fillFrom: [],
    revoke: [],
    requestReopen: [],
  };

  constructor(
    private readonly handlers: InMemoryLeadFormWriteHandlers,
    pending: Partial<LeadFormWritePending> = {},
  ) {
    this.pending = { ...IDLE, ...pending };
  }

  saveDraft = async (input: DraftSavePayload) => {
    this.calls.saveDraft.push(input);
    return this.handlers.saveDraft(input);
  };

  submit = async (input: SubmitSectionPayload) => {
    this.calls.submit.push(input);
    return this.handlers.submit(input);
  };

  resolvePlan = async (input: ResolvePlanInput) => {
    this.calls.resolvePlan.push(input);
    if (!this.handlers.resolvePlan) {
      throw new Error("In-memory resolvePlan handler is not configured");
    }
    return this.handlers.resolvePlan(input);
  };

  restorePlan = async (input: RestorePlanInput) => {
    this.calls.restorePlan.push(input);
    if (!this.handlers.restorePlan) {
      throw new Error("In-memory restorePlan handler is not configured");
    }
    return this.handlers.restorePlan(input);
  };

  fillFrom = async (input: LeadFormFillFromInput) => {
    this.calls.fillFrom.push(input);
    return this.handlers.fillFrom
      ? this.handlers.fillFrom(input)
      : { success: true as const, copiedItems: 0 };
  };

  revoke = async (input: { readonly reportSectionId: string }) => {
    this.calls.revoke.push(input);
    return this.handlers.revoke
      ? this.handlers.revoke(input)
      : { success: true as const };
  };

  requestReopen = async (input: LeadFormReopenInput) => {
    this.calls.requestReopen.push(input);
    return this.handlers.requestReopen
      ? this.handlers.requestReopen(input)
      : { success: true as const };
  };
}
