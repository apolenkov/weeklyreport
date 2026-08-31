"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@customreport/ui/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";
import { LeadReportAssistantBody } from "./lead-report-assistant-body";
import { LeadReportAssistantForm } from "./lead-report-assistant-form";
import { useLeadReportAssistantController } from "./use-lead-report-assistant-controller";

interface AssistantAvailabilityPresentation {
  readonly ariaLabel: string;
  readonly disabled: boolean;
  readonly title: string;
}

function getAvailabilityPresentation({
  isAvailable,
  isChecking,
  failed,
}: {
  readonly isAvailable: boolean;
  readonly isChecking: boolean;
  readonly failed: boolean;
}): AssistantAvailabilityPresentation {
  if (isChecking) {
    return {
      ariaLabel: "Checking report chat availability",
      disabled: true,
      title: "Checking report chat availability",
    };
  }
  if (failed) {
    return {
      ariaLabel: "Report chat unavailable",
      disabled: true,
      title:
        "Report chat availability could not be confirmed. Retry the check or ask an administrator to configure AI.",
    };
  }
  if (isAvailable) {
    return {
      ariaLabel: "Open report chat",
      disabled: false,
      title: "Open report chat",
    };
  }
  return {
    ariaLabel: "Report chat unavailable",
    disabled: true,
    title: "Report chat is unavailable until an administrator configures AI",
  };
}

export function LeadReportAssistant() {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const availability = useQuery(trpc.ai.availability.queryOptions());
  const isAvailable = availability.data?.availability === "available";
  const isCheckingAvailability = availability.isPending;
  const availabilityFailed = availability.isError;
  const availabilityPresentation = getAvailabilityPresentation({
    isAvailable,
    isChecking: isCheckingAvailability,
    failed: availabilityFailed,
  });
  const {
    question,
    outcome,
    isBusy,
    isError,
    showResult,
    setQuestion,
    handleSubmit,
    handleClarification,
    handleRetry,
  } = useLeadReportAssistantController();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <ToolbarIconButton
            aria-label={availabilityPresentation.ariaLabel}
            aria-busy={isCheckingAvailability}
            data-testid="lead-report-assistant-trigger"
            disabled={availabilityPresentation.disabled}
            title={availabilityPresentation.title}
            className="border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            {isCheckingAvailability ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <MessageCircle className="size-4" aria-hidden="true" />
            )}
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

          <LeadReportAssistantBody
            outcome={outcome}
            isBusy={isBusy}
            isError={isError}
            showResult={showResult}
            onClarification={handleClarification}
            onEditQuestion={() => questionRef.current?.focus()}
            onRetry={handleRetry}
          />
          <LeadReportAssistantForm
            question={question}
            questionRef={questionRef}
            isBusy={isBusy}
            onQuestionChange={setQuestion}
            onSubmit={handleSubmit}
          />
        </SheetContent>
      </Sheet>
      {availabilityFailed && (
        <ToolbarIconButton
          aria-label="Retry report chat availability check"
          aria-busy={availability.isFetching}
          disabled={availability.isFetching}
          onClick={() => void availability.refetch()}
          title="Retry report chat availability check"
          className="border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          {availability.isFetching ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
        </ToolbarIconButton>
      )}
    </div>
  );
}
