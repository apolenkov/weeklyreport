import type {
  ClarificationOption,
  ReportAssistantOutcome,
} from "@weeklyreport/shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@weeklyreport/ui/components/ui/alert";
import { Button } from "@weeklyreport/ui/components/ui/button";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { LeadReportAssistantContent } from "./lead-report-assistant-content";

interface LeadReportAssistantBodyProps {
  readonly outcome: ReportAssistantOutcome | null;
  readonly isBusy: boolean;
  readonly isError: boolean;
  readonly showResult: boolean;
  readonly onClarification: (option: ClarificationOption) => void;
  readonly onEditQuestion: () => void;
  readonly onRetry: () => void;
}

export function LeadReportAssistantBody({
  outcome,
  isBusy,
  isError,
  showResult,
  onClarification,
  onEditQuestion,
  onRetry,
}: LeadReportAssistantBodyProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
      <div className="space-y-5" aria-live="polite">
        {!showResult && !isBusy && (
          <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">
            Try “What changed this week?” or ask for a count, comparison, risk,
            or decision.
          </p>
        )}
        {isBusy && (
          <div
            className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-3 text-sm text-[var(--color-muted-foreground)]"
            role="status"
            data-testid="lead-report-assistant-busy"
          >
            <LoaderCircle
              className="size-4 animate-spin text-[var(--color-primary)] motion-reduce:animate-none"
              aria-hidden="true"
            />
            Reviewing your report context…
          </div>
        )}
        {isError && !isBusy && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                The assistant could not complete that search.
              </AlertTitle>
              <AlertDescription>
                Check your connection and try the same question again.
              </AlertDescription>
            </Alert>
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
        <LeadReportAssistantContent
          outcome={outcome}
          onClarification={onClarification}
          onEditQuestion={onEditQuestion}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}
