import type {
  ClarificationOption,
  ReportAssistantOutcome,
  SourceCitation,
} from "@customreport/shared";
import { Alert, AlertDescription, AlertTitle, Button } from "@customreport/ui";
import { AlertCircle, ArrowRight } from "lucide-react";

import { LeadReportAssistantMarkdown } from "./lead-report-assistant-markdown";

type AssistantOutcome = Exclude<ReportAssistantOutcome, { kind: "ok" }>;

const OUTCOME_RETRY_LABEL: Readonly<Record<AssistantOutcome["kind"], string>> =
  {
    invalid_plan: "Try again",
    no_results: "Ask another question",
    result_set_too_large: "Try a narrower question",
    semantic_index_pending: "Check again",
    provider_unavailable: "Try again",
    ai_not_configured: "Ask an administrator to configure AI",
    clarification_required: "Choose an option",
  };

const citationHref = (citation: SourceCitation): string =>
  `/lead/report/${encodeURIComponent(citation.reportId)}`;

const outcomeMessage = (outcome: AssistantOutcome): string => {
  if (outcome.kind === "invalid_plan") {
    return "I could not turn that into a safe report search. Try rephrasing the question.";
  }
  if (outcome.kind === "no_results") {
    return "No matching report records were found in the content you can access.";
  }
  if (outcome.kind === "result_set_too_large") {
    return "That question matches too many records. Add a period, person, product, or record type.";
  }
  if (outcome.kind === "provider_unavailable") {
    if (outcome.rateLimit) {
      const { retryAfterSeconds } = outcome.rateLimit;
      return `The AI provider reached its rate limit. Try again in about ${retryAfterSeconds} seconds.`;
    }
    return "The AI service is temporarily unavailable. Try the same question again in a moment.";
  }
  if (outcome.kind === "ai_not_configured") {
    return "The report assistant is not configured yet. Ask an administrator to configure an AI provider.";
  }
  return "The semantic index is still catching up. Try again in a moment.";
};

function AssistantOutcomeMessage({
  outcome,
}: {
  readonly outcome: AssistantOutcome;
}) {
  if (outcome.kind === "clarification_required") return null;
  return (
    <Alert className="border-[var(--color-border)] bg-[var(--color-surface-hover)]">
      <AlertCircle className="text-[var(--color-primary)]" aria-hidden="true" />
      <AlertTitle>{outcomeMessage(outcome)}</AlertTitle>
      <AlertDescription>
        <span className="text-[var(--color-muted-foreground)]">
          {OUTCOME_RETRY_LABEL[outcome.kind]} is available below.
        </span>
      </AlertDescription>
    </Alert>
  );
}

function ClarificationOptions({
  options,
  onSelect,
}: {
  readonly options: readonly ClarificationOption[];
  readonly onSelect: (option: ClarificationOption) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        I found more than one matching entity. Which one should I use?
      </p>
      <div className="grid gap-2">
        {options.map((option) => (
          <Button
            key={option.token}
            type="button"
            variant="outline"
            className="h-auto min-h-11 justify-between whitespace-normal px-3 py-2 text-left"
            onClick={() => onSelect(option)}
          >
            <span>{option.label}</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        ))}
      </div>
    </div>
  );
}

function AssistantSources({
  citations,
}: {
  readonly citations: readonly SourceCitation[];
}) {
  if (citations.length === 0) return null;
  return (
    <section aria-labelledby="report-assistant-sources" className="space-y-2">
      <h3
        id="report-assistant-sources"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]"
      >
        Sources
      </h3>
      <div className="grid gap-2">
        {citations.map((citation) => (
          <a
            key={citation.sourceId}
            href={citationHref(citation)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <span className="font-semibold text-[var(--color-primary)]">
              {citation.sourceId}
            </span>
            <span className="ml-2 text-[var(--color-foreground)]">
              {citation.periodLabel} · {citation.subjectName}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function AssistantAnswer({
  outcome,
}: {
  readonly outcome: Extract<ReportAssistantOutcome, { kind: "ok" }>;
}) {
  return (
    <div className="space-y-5">
      <LeadReportAssistantMarkdown markdown={outcome.answerMarkdown} />
      {(outcome.metadata.truncated ||
        outcome.metadata.insufficientEvidence) && (
        <Alert className="border-[var(--color-border)] bg-[var(--color-surface-hover)]">
          <AlertCircle
            className="text-[var(--color-primary)]"
            aria-hidden="true"
          />
          <AlertTitle>
            {outcome.metadata.insufficientEvidence
              ? "Some evidence is insufficient"
              : "Showing a bounded result"}
          </AlertTitle>
          <AlertDescription>
            {outcome.metadata.insufficientEvidence
              ? "The answer only uses the records that could be verified."
              : "The answer is based on a limited set of matching records."}
          </AlertDescription>
        </Alert>
      )}
      <AssistantSources citations={outcome.citations} />
    </div>
  );
}

export function LeadReportAssistantContent({
  outcome,
  onClarification,
  onRetry,
}: {
  readonly outcome: ReportAssistantOutcome | null;
  readonly onClarification: (option: ClarificationOption) => void;
  readonly onRetry: () => void;
}) {
  if (outcome?.kind === "ok") return <AssistantAnswer outcome={outcome} />;
  if (outcome?.kind === "clarification_required") {
    return (
      <ClarificationOptions
        options={outcome.options}
        onSelect={onClarification}
      />
    );
  }
  if (!outcome) return null;
  return (
    <div className="space-y-3">
      <AssistantOutcomeMessage outcome={outcome} />
      <Button type="button" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
