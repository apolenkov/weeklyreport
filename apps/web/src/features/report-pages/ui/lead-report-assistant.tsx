"use client";

import type {
  ClarificationOption,
  ReportAssistantOutcome,
  ReportAssistantRequest,
} from "@customreport/shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Textarea,
} from "@customreport/ui";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  LoaderCircle,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { type SyntheticEvent, useId, useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";
import { LeadReportAssistantContent } from "./lead-report-assistant-content";
import { useLeadReportAssistantStore } from "./lead-report-assistant-store";

export function LeadReportAssistant() {
  const trpc = useTRPC();
  const questionId = useId();
  const { exchange, setExchange } = useLeadReportAssistantStore();
  const [open, setOpen] = useState(false);
  const { question, submittedQuestion, resolutionTokens, outcome } = exchange;
  const setQuestion = (question: string) =>
    setExchange({ ...exchange, question });
  const setSubmittedQuestion = (submittedQuestion: string) =>
    setExchange({ ...exchange, submittedQuestion });
  const setResolutionTokens = (resolutionTokens: readonly string[]) =>
    setExchange({ ...exchange, resolutionTokens });
  const setOutcome = (outcome: ReportAssistantOutcome | null) =>
    setExchange({ ...exchange, outcome });
  type AssistantProcedure = typeof trpc.leadForm.assistant;
  const assistantProcedure = (
    trpc.leadForm as unknown as Readonly<{
      assistant?: AssistantProcedure;
    }>
  ).assistant;
  const onSuccess = (nextOutcome: ReportAssistantOutcome) =>
    setOutcome(nextOutcome);
  type AssistantMutationOptions = Omit<
    ReturnType<typeof trpc.leadForm.assistant.mutationOptions>,
    "mutationKey" | "trpc"
  >;
  const mutationOptions: AssistantMutationOptions =
    assistantProcedure?.mutationOptions({ onSuccess }) ?? {
      mutationFn: (_input: ReportAssistantRequest) =>
        Promise.reject(new Error("Report assistant procedure is unavailable")),
      onSuccess,
    };
  const mutation = useMutation(mutationOptions);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  const submitQuestion = (
    nextQuestion: string,
    nextTokens: readonly string[],
  ) => {
    const trimmedQuestion = nextQuestion.trim();
    if (trimmedQuestion.length === 0 || mutation.isPending) return;
    setSubmittedQuestion(trimmedQuestion);
    setResolutionTokens(nextTokens);
    setOutcome(null);
    mutation.reset();
    mutation.mutate({
      question: trimmedQuestion,
      resolutionTokens: [...nextTokens],
    });
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(question, resolutionTokens);
  };

  const handleClarification = (option: ClarificationOption) => {
    submitQuestion(submittedQuestion || question, [
      ...resolutionTokens,
      option.token,
    ]);
  };

  const handleRetry = () => {
    submitQuestion(submittedQuestion || question, resolutionTokens);
  };

  const isBusy = mutation.isPending;
  const showResult = !isBusy && (outcome !== null || mutation.isError);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <ToolbarIconButton
          aria-label="Open report chat"
          data-testid="lead-report-assistant-trigger"
          className="border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
        </ToolbarIconButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="w-[min(100vw,34rem)] max-w-none gap-0 border-[var(--color-border)] bg-[var(--color-background)] p-0"
      >
        <SheetHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] px-5 py-5 pr-14">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <Sparkles className="size-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Lead workspace
            </span>
          </div>
          <SheetTitle className="text-xl tracking-tight">
            Report chat
          </SheetTitle>
          <SheetDescription>
            Ask one question about the reports you can access.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="space-y-5" aria-live="polite">
            {!showResult && !isBusy && (
              <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">
                Try “What changed this week?” or ask for a count, comparison,
                risk, or decision.
              </p>
            )}
            {isBusy && (
              <div
                className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-3 text-sm text-[var(--color-muted-foreground)]"
                role="status"
                data-testid="lead-report-assistant-busy"
              >
                <LoaderCircle
                  className="size-4 animate-spin text-[var(--color-primary)]"
                  aria-hidden="true"
                />
                Reviewing your report context…
              </div>
            )}
            {mutation.isError && !isBusy && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>
                    The assistant could not complete that search.
                  </AlertTitle>
                  <AlertDescription>
                    Check your connection and try the same question again.
                  </AlertDescription>
                </Alert>
                <Button type="button" variant="outline" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            )}
            <LeadReportAssistantContent
              outcome={outcome}
              onClarification={handleClarification}
              onRetry={handleRetry}
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
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
              onChange={(event) => setQuestion(event.target.value)}
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
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            Nothing from this chat is saved when you close the panel.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
