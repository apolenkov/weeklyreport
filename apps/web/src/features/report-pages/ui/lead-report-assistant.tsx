"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@weeklyreport/ui/components/ui/sheet";
import { TooltipProvider } from "@weeklyreport/ui/components/ui/tooltip";
import { LoaderCircle, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ReasonTooltip } from "../../../shared/ui/report-shell/reason-tooltip";
import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";
import { LeadReportAssistantBody } from "./lead-report-assistant-body";
import { LeadReportAssistantForm } from "./lead-report-assistant-form";
import { useLeadReportAssistantController } from "./use-lead-report-assistant-controller";

// Hover highlight is for actionable state only; aria-disabled stays neutral.
const ASSISTANT_TRIGGER_CLASS =
  "border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] not-aria-disabled:hover:border-[var(--color-primary)] not-aria-disabled:hover:text-[var(--color-primary)]";

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

function AssistantSheetHeader() {
  return (
    <SheetHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] px-5 py-5 pr-14">
      <div className="flex items-center gap-2 text-[var(--color-primary)]">
        <Sparkles className="size-4" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">
          Lead workspace
        </span>
      </div>
      <SheetTitle className="text-xl tracking-tight">Report chat</SheetTitle>
      <SheetDescription>
        Ask one question about the reports you can access.
      </SheetDescription>
    </SheetHeader>
  );
}

// A plain function, not a component: ReasonTooltip clones props onto this
// element, so it must be the SheetTrigger itself.
function renderAssistantTrigger({
  presentation,
  isChecking,
}: {
  readonly presentation: ReturnType<typeof getAvailabilityPresentation>;
  readonly isChecking: boolean;
}) {
  return (
    <SheetTrigger asChild>
      <ToolbarIconButton
        aria-label={presentation.ariaLabel}
        aria-busy={isChecking}
        aria-disabled={presentation.disabled || undefined}
        data-testid="lead-report-assistant-trigger"
        title={presentation.disabled ? "" : undefined}
        className={ASSISTANT_TRIGGER_CLASS}
      >
        {isChecking ? (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <MessageCircle className="size-4" aria-hidden="true" />
        )}
      </ToolbarIconButton>
    </SheetTrigger>
  );
}

function AvailabilityRetryButton({
  isFetching,
  onRetry,
}: {
  readonly isFetching: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <ToolbarIconButton
      aria-label="Retry report chat availability check"
      aria-busy={isFetching}
      disabled={isFetching}
      onClick={onRetry}
      title="Retry report chat availability check"
      className="border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      {isFetching ? (
        <LoaderCircle
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <RefreshCw className="size-4" aria-hidden="true" />
      )}
    </ToolbarIconButton>
  );
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

  // aria-disabled keeps the trigger focusable so its reason stays reachable;
  // the sheet therefore must not open while unavailable.
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && availabilityPresentation.disabled) return;
    setOpen(nextOpen);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <TooltipProvider>
          <ReasonTooltip
            reason={
              availabilityPresentation.disabled
                ? availabilityPresentation.title
                : undefined
            }
          >
            {renderAssistantTrigger({
              presentation: availabilityPresentation,
              isChecking: isCheckingAvailability,
            })}
          </ReasonTooltip>
        </TooltipProvider>
        <SheetContent
          side="right"
          showCloseButton
          className="w-[min(100vw,34rem)] max-w-none gap-0 border-[var(--color-border)] bg-[var(--color-background)] p-0"
        >
          <AssistantSheetHeader />

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
        <AvailabilityRetryButton
          isFetching={availability.isFetching}
          onRetry={() => void availability.refetch()}
        />
      )}
    </div>
  );
}
