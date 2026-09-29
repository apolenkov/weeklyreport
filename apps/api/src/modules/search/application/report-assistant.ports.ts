import type { GroundingBundle } from "../domain/context-builder.js";

type ReportAssistantResourceLease = Readonly<{
  signal: AbortSignal;
  release: () => Promise<void>;
}>;

export type ReportAssistantResourceDecision =
  | Readonly<{ kind: "granted"; lease: ReportAssistantResourceLease }>
  | Readonly<{
      kind: "denied";
      reason: "budget" | "concurrency" | "unavailable";
      retryAfterSeconds: number;
    }>;

export interface ReportAssistantResourceGuardPort {
  acquire(actorId: string): Promise<ReportAssistantResourceDecision>;
}

export type ReportAssistantProviderOperation =
  "planner" | "planner repair" | "answer" | "citation repair" | "embedding";

export class ReportAssistantProviderError extends Error {
  readonly operation: ReportAssistantProviderOperation;
  readonly statusCode: number | undefined;
  readonly retryable: boolean;
  readonly providerCode: string | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    operation: ReportAssistantProviderOperation,
    cause: unknown,
    statusCode: number | undefined,
    retryable: boolean,
    providerCode?: string,
    retryAfterMs?: number,
  ) {
    super(`Report assistant provider ${operation} request failed`, { cause });
    this.name = "ReportAssistantProviderError";
    this.operation = operation;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.providerCode = providerCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export type PlannerInput = Readonly<{
  question: string;
  now: Date;
  timeZone: string;
}>;

type PlannerValidationIssue = Readonly<{
  path: readonly (string | number)[];
  code: string;
}>;

export type PlannerRepairInput = Readonly<{
  original: PlannerInput;
  previousArguments: unknown;
  issues: readonly PlannerValidationIssue[];
}>;

export interface ReportAssistantPlannerPort {
  plan(input: PlannerInput, signal?: AbortSignal): Promise<unknown>;
}

export interface ReportAssistantPlannerRepairPort {
  repairPlan(input: PlannerRepairInput, signal?: AbortSignal): Promise<unknown>;
}

export type GroundedAnswerInput = Readonly<{
  question: string;
  grounding: GroundingBundle;
}>;

export type CitationRepairInput = Readonly<{
  original: GroundedAnswerInput;
  previousAnswer: GroundedAnswer;
  allowedSourceIds: readonly string[];
  issues: readonly string[];
}>;

export type ReportAssistantTokenUsage = Readonly<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}>;

export type GroundedAnswer = Readonly<{
  answerMarkdown: string;
  sourceIds: readonly string[];
  insufficientEvidence: boolean;
  usage: ReportAssistantTokenUsage;
}>;

export interface ReportAssistantAnswerPort {
  answer(
    input: GroundedAnswerInput,
    signal?: AbortSignal,
  ): Promise<GroundedAnswer>;
}

export interface ReportAssistantCitationRepairPort {
  repairAnswer(
    input: CitationRepairInput,
    signal?: AbortSignal,
  ): Promise<GroundedAnswer>;
}

export type EmbeddingVector = readonly number[];

export type EmbeddingDocument = Readonly<{
  contentHash: string;
  text: string;
}>;

export type EmbeddedDocument = Readonly<{
  contentHash: string;
  vector: EmbeddingVector;
}>;

export interface EmbeddingPort {
  embedQuery(text: string, signal?: AbortSignal): Promise<EmbeddingVector>;
  embedDocuments(
    documents: readonly EmbeddingDocument[],
    signal?: AbortSignal,
  ): Promise<readonly EmbeddedDocument[]>;
}
