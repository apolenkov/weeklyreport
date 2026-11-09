import {
  type DraftDecisionRecord,
  type DraftRiskRecord,
  isCompleteDecision,
  isCompleteRisk,
  type RetainedIncompleteRecordsInput,
  type RetainedIncompleteRecordsOutput,
  retainedIncompleteRecordsOutputSchema,
} from "@weeklyreport/shared";

import {
  recoveryReadOnlyReason,
  type RecoverySourceLifecycle,
} from "../domain/retained-recovery.js";

export const RETAINED_SOURCE_READER = Symbol("RetainedSourceReader");

/** One recovery read: the authenticated actor and the source they name. */
export interface RetainedSourceRequest extends RetainedIncompleteRecordsInput {
  readonly actorId: string;
}

/** An own source section as stored now, with its report's lifecycle. */
export interface RetainedSource {
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly lifecycle: RecoverySourceLifecycle;
  /** True when the lead form already shows this section for editing. */
  readonly onCurrentForm: boolean;
  readonly risks: readonly DraftRiskRecord[];
  readonly decisions: readonly DraftDecisionRecord[];
}

/** Returns the source only to its currently entitled author, else null. */
export interface RetainedSourceReader {
  readOwnSource(request: RetainedSourceRequest): Promise<RetainedSource | null>;
}

const UNAVAILABLE: RetainedIncompleteRecordsOutput = { status: "unavailable" };

// Recovery shows the text only; reviewer discussion stays with the source.
const withoutComments = <T extends { readonly comments?: unknown }>({
  comments: _comments,
  ...record
}: T): Omit<T, "comments"> => record;

/**
 * Private, read-only recovery of an author's retained incomplete risks and
 * decisions (openspec: lead-retained-incomplete-records). It reads what the
 * source holds now, never a frozen snapshot, and answers `unavailable` alike
 * for a missing, foreign or no-longer-entitled source.
 */
export class RetainedIncompleteRecordsService {
  constructor(private readonly reader: RetainedSourceReader) {}

  async read(
    input: RetainedIncompleteRecordsInput,
    actorId: string,
  ): Promise<RetainedIncompleteRecordsOutput> {
    const source = await this.reader.readOwnSource({ ...input, actorId });
    if (!source) return UNAVAILABLE;
    const reason = recoveryReadOnlyReason(
      source.lifecycle,
      source.onCurrentForm,
    );
    if (!reason) return UNAVAILABLE;

    const risks = source.risks.filter((risk) => !isCompleteRisk(risk));
    const decisions = source.decisions.filter(
      (decision) => !isCompleteDecision(decision),
    );
    if (risks.length === 0 && decisions.length === 0) return UNAVAILABLE;

    // Parsed here as well as at the route: the strict shape is what keeps
    // any other section field from leaving through this read.
    return retainedIncompleteRecordsOutputSchema.parse({
      status: "available",
      reportId: source.reportId,
      reportSectionId: source.reportSectionId,
      periodStart: source.periodStart,
      periodEnd: source.periodEnd,
      readOnlyReason: reason,
      risks: risks.map(withoutComments),
      decisions: decisions.map(withoutComments),
    });
  }
}
