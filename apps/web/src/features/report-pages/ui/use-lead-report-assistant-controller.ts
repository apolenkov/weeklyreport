"use client";

import type {
  ClarificationOption,
  ReportAssistantOutcome,
} from "@customreport/shared";
import type { SyntheticEvent } from "react";

import { useLeadReportAssistantStore } from "./lead-report-assistant-store";

export interface LeadReportAssistantController {
  readonly question: string;
  readonly outcome: ReportAssistantOutcome | null;
  readonly isBusy: boolean;
  readonly isError: boolean;
  readonly showResult: boolean;
  readonly setQuestion: (question: string) => void;
  readonly handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readonly handleClarification: (option: ClarificationOption) => void;
  readonly handleRetry: () => void;
}

export function useLeadReportAssistantController(): LeadReportAssistantController {
  const { exchange, setExchange, submitQuestion } =
    useLeadReportAssistantStore();
  const {
    question,
    submittedQuestion,
    resolutionTokens,
    requestState,
    outcome,
  } = exchange;
  const updateExchange = (changes: Partial<typeof exchange>) =>
    setExchange((currentExchange) => ({ ...currentExchange, ...changes }));
  const setQuestion = (nextQuestion: string) =>
    updateExchange({ question: nextQuestion });

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(question, []);
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

  return {
    question,
    outcome,
    isBusy: requestState === "pending",
    isError: requestState === "error",
    showResult:
      requestState !== "pending" &&
      (outcome !== null || requestState === "error"),
    setQuestion,
    handleSubmit,
    handleClarification,
    handleRetry,
  };
}
