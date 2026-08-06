import { Button, Textarea } from "@customreport/ui";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { type SyntheticEvent, useId } from "react";

interface LeadReportAssistantFormProps {
  readonly question: string;
  readonly isBusy: boolean;
  readonly onQuestionChange: (question: string) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function LeadReportAssistantForm({
  question,
  isBusy,
  onQuestionChange,
  onSubmit,
}: LeadReportAssistantFormProps) {
  const questionId = useId();

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-[var(--color-border)] bg-[var(--color-surface-hover)] px-5 py-4"
    >
      <label
        htmlFor={questionId}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]"
      >
        Your question
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id={questionId}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="Ask about your weekly reports…"
          rows={3}
          maxLength={2000}
          disabled={isBusy}
          aria-busy={isBusy}
          className="min-h-20 resize-none bg-[var(--color-background)]"
          data-testid="lead-report-assistant-question"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={isBusy ? "Searching reports" : "Ask report chat"}
          disabled={isBusy || question.trim().length === 0}
          data-testid="lead-report-assistant-submit"
        >
          {isBusy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
        Nothing from this chat is saved when you close the panel.
      </p>
    </form>
  );
}
