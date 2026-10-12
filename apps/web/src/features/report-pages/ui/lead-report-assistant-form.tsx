import { Button } from "@weeklyreport/ui/components/ui/button";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { type RefObject, type SyntheticEvent, useId } from "react";

interface LeadReportAssistantFormProps {
  readonly question: string;
  readonly questionRef: RefObject<HTMLTextAreaElement | null>;
  readonly isBusy: boolean;
  readonly onQuestionChange: (question: string) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function LeadReportAssistantForm({
  question,
  questionRef,
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
        <textarea
          name="question"
          ref={questionRef}
          id={questionId}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="Ask about your weekly reports…"
          rows={3}
          maxLength={2000}
          disabled={isBusy}
          aria-busy={isBusy}
          className="flex min-h-20 w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none transition-[color,box-shadow] placeholder:text-[var(--color-muted-foreground)] focus-visible:border-[var(--color-ring)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-ring)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="lead-report-assistant-question"
        />
        <Button
          type="submit"
          size="touch"
          aria-label={isBusy ? "Searching reports" : "Ask report chat"}
          disabled={isBusy || question.trim().length === 0}
          data-testid="lead-report-assistant-submit"
        >
          {isBusy ? (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
        This exchange stays in memory while you use the app. Reloading, signing
        out, or switching accounts clears it.
      </p>
    </form>
  );
}
