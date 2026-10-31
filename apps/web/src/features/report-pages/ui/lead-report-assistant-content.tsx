import type {
  ClarificationOption,
  ReportAssistantOutcome,
  SourceCitation,
} from "@weeklyreport/shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@weeklyreport/ui/components/ui/alert";
import { Button } from "@weeklyreport/ui/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

import { LEAD_REPORT_ROUTE } from "../../../shared/ui/navigation/nav-links";
import { LeadReportAssistantMarkdown } from "./lead-report-assistant-markdown";

type AssistantOutcome = Exclude<ReportAssistantOutcome, { kind: "ok" }>;

type OutcomeAction = Readonly<{
  kind: "edit" | "retry";
  label: string;
}>;

const outcomeAction = (
  kind: AssistantOutcome["kind"],
): OutcomeAction | null => {
  if (kind === "invalid_plan") return { kind: "edit", label: "Edit question" };
  if (kind === "no_results")
    return { kind: "edit", label: "Ask another question" };
  if (kind === "result_set_too_large")
    return { kind: "edit", label: "Narrow question" };
  if (kind === "ai_not_configured")
    return { kind: "edit", label: "Edit question" };
  if (kind === "semantic_index_pending")
    return { kind: "retry", label: "Check again" };
  if (
    kind === "provider_unavailable" ||
    kind === "provider_response_incomplete" ||
    kind === "resource_limited"
  ) {
    return { kind: "retry", label: "Try again" };
  }
  return null;
};

const outcomeGuidance = (kind: AssistantOutcome["kind"]): string => {
  if (kind === "invalid_plan") return "Edit the question and submit it again.";
  if (kind === "no_results") return "Ask another question below.";
  if (kind === "result_set_too_large") return "Narrow the question below.";
  if (kind === "semantic_index_pending") return "Check again below.";
  if (kind === "provider_unavailable") return "Try again below.";
  if (kind === "provider_response_incomplete") {
    return "Try again below. If it keeps happening, tell an administrator the AI provider cuts answers short.";
  }
  if (kind === "resource_limited") return "Try again shortly below.";
  return "An administrator must configure AI before the assistant can work.";
};

const citationHref = (citation: SourceCitation): string =>
  `${LEAD_REPORT_ROUTE}/${encodeURIComponent(citation.reportId)}`;

const retryAfterLabel = (seconds: number): string =>
  `${seconds} ${seconds === 1 ? "second" : "seconds"}`;

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
      return `The AI provider reached its rate limit. Try again in about ${retryAfterLabel(retryAfterSeconds)}.`;
    }
    return "The AI service is temporarily unavailable. Try the same question again in a moment.";
  }
  if (outcome.kind === "provider_response_incomplete") {
    return "The AI service stopped before it finished the answer.";
  }
  if (outcome.kind === "ai_not_configured") {
    return "The report assistant is not configured yet. Ask an administrator to configure an AI provider.";
  }
  if (outcome.kind === "resource_limited") {
    return `The report assistant is busy. Try again in about ${retryAfterLabel(outcome.retryAfterSeconds)}.`;
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
      <AlertTitle className="line-clamp-none">
        {outcomeMessage(outcome)}
      </AlertTitle>
      <AlertDescription>
        <span className="text-[var(--color-muted-foreground)]">
          {outcomeGuidance(outcome.kind)}
        </span>
      </AlertDescription>
    </Alert>
  );
}

function ClarificationOptions({
  options,
  total,
  truncated,
  onSelect,
}: {
  readonly options: readonly ClarificationOption[];
  readonly total: number;
  readonly truncated: boolean;
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
      {truncated && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Showing {options.length} of {total} matches. Refine your question to
          narrow them down.
        </p>
      )}
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
          <Link
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
          </Link>
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
  onEditQuestion,
  onRetry,
}: {
  readonly outcome: ReportAssistantOutcome | null;
  readonly onClarification: (option: ClarificationOption) => void;
  readonly onEditQuestion: () => void;
  readonly onRetry: () => void;
}) {
  if (outcome?.kind === "ok") return <AssistantAnswer outcome={outcome} />;
  if (outcome?.kind === "clarification_required") {
    return (
      <ClarificationOptions
        options={outcome.options}
        total={outcome.total}
        truncated={outcome.truncated}
        onSelect={onClarification}
      />
    );
  }
  if (!outcome) return null;
  const action = outcomeAction(outcome.kind);
  return (
    <div className="space-y-3">
      <AssistantOutcomeMessage outcome={outcome} />
      {action && (
        <Button
          type="button"
          variant="outline"
          onClick={action.kind === "retry" ? onRetry : onEditQuestion}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
