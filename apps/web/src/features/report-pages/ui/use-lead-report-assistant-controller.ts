"use client";

import type {
  ClarificationOption,
  ReportAssistantOutcome,
  ReportAssistantRequest,
} from "@customreport/shared";
import { useMutation } from "@tanstack/react-query";
import type { SyntheticEvent } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { useLeadReportAssistantStore } from "./lead-report-assistant-store";

type AssistantProcedure = ReturnType<typeof useTRPC>["leadForm"]["assistant"];
type AssistantMutationOptions = Omit<
  ReturnType<AssistantProcedure["mutationOptions"]>,
  "mutationKey" | "trpc"
>;

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
  const trpc = useTRPC();
  const { exchange, setExchange } = useLeadReportAssistantStore();
  const {
    question,
    submittedQuestion,
    resolutionTokens,
    requestState,
    outcome,
  } = exchange;
  const updateExchange = (changes: Partial<typeof exchange>) =>
    setExchange({ ...exchange, ...changes });
  const setQuestion = (nextQuestion: string) =>
    updateExchange({ question: nextQuestion });
  const assistantProcedure = (
    trpc.leadForm as unknown as Readonly<{
      assistant?: AssistantProcedure;
    }>
  ).assistant;
  const onSuccess = (nextOutcome: ReportAssistantOutcome) =>
    updateExchange({ outcome: nextOutcome, requestState: "idle" });
  const onError = () => updateExchange({ requestState: "error" });
  const mutationOptions: AssistantMutationOptions =
    assistantProcedure?.mutationOptions({ onSuccess, onError }) ?? {
      mutationFn: (_input: ReportAssistantRequest) =>
        Promise.reject(new Error("Report assistant procedure is unavailable")),
      onSuccess,
      onError,
    };
  const mutation = useMutation(mutationOptions);

  const submitQuestion = (
    nextQuestion: string,
    nextTokens: readonly string[],
  ) => {
    const trimmedQuestion = nextQuestion.trim();
    if (trimmedQuestion.length === 0 || mutation.isPending) return;
    updateExchange({
      submittedQuestion: trimmedQuestion,
      resolutionTokens: nextTokens,
      requestState: "pending",
      outcome: null,
    });
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

  return {
    question,
    outcome,
    isBusy: requestState === "pending" || mutation.isPending,
    isError: requestState === "error" || mutation.isError,
    showResult:
      requestState !== "pending" &&
      !mutation.isPending &&
      (outcome !== null || requestState === "error" || mutation.isError),
    setQuestion,
    handleSubmit,
    handleClarification,
    handleRetry,
  };
}
