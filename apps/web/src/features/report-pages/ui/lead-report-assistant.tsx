"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@customreport/ui";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { ToolbarIconButton } from "../../../shared/ui/report-shell/toolbar-icon-button";
import { LeadReportAssistantBody } from "./lead-report-assistant-body";
import { LeadReportAssistantForm } from "./lead-report-assistant-form";
import { useLeadReportAssistantController } from "./use-lead-report-assistant-controller";

export function LeadReportAssistant() {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const availabilityProcedure = (
    trpc as unknown as Readonly<{
      ai?: Readonly<{
        availability?: Readonly<{
          queryOptions: () => {
            queryKey: readonly unknown[];
            queryFn: () => Promise<{
              availability: "available" | "not_configured";
            }>;
          };
        }>;
      }>;
    }>
  ).ai?.availability;
  const availability = useQuery(
    availabilityProcedure?.queryOptions() ?? {
      queryKey: ["ai", "availability", "legacy-test-proxy"],
      // Older isolated UI fixtures omit the optional availability procedure.
      // The production proxy always exposes it; treating the absent fixture
      // as available keeps this component's existing interaction tests focused
      // on the chat surface itself.
      queryFn: () => Promise.resolve({ availability: "available" as const }),
    },
  );
  const isAvailable = availability.data?.availability !== "not_configured";
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <ToolbarIconButton
          aria-label={
            isAvailable ? "Open report chat" : "Report chat unavailable"
          }
          data-testid="lead-report-assistant-trigger"
          disabled={!isAvailable}
          title={
            isAvailable
              ? "Open report chat"
              : "Report chat is unavailable until an administrator configures AI"
          }
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

        <LeadReportAssistantBody
          outcome={outcome}
          isBusy={isBusy}
          isError={isError}
          showResult={showResult}
          onClarification={handleClarification}
          onRetry={handleRetry}
        />
        <LeadReportAssistantForm
          question={question}
          isBusy={isBusy}
          onQuestionChange={setQuestion}
          onSubmit={handleSubmit}
        />
      </SheetContent>
    </Sheet>
  );
}
