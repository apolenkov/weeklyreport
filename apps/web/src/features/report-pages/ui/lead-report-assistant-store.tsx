"use client";

import type { ReportAssistantOutcome } from "@customreport/shared";
import { useMutation } from "@tanstack/react-query";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

type AssistantExchange = Readonly<{
  question: string;
  submittedQuestion: string;
  resolutionTokens: readonly string[];
  requestState: "idle" | "pending" | "error";
  outcome: ReportAssistantOutcome | null;
}>;

type AssistantStore = Readonly<{
  exchange: AssistantExchange;
  setExchange: Dispatch<SetStateAction<AssistantExchange>>;
  submitQuestion: (
    question: string,
    resolutionTokens: readonly string[],
  ) => void;
}>;

const emptyExchange: AssistantExchange = {
  question: "",
  submittedQuestion: "",
  resolutionTokens: [],
  requestState: "idle",
  outcome: null,
};

const LeadReportAssistantStoreContext = createContext<AssistantStore | null>(
  null,
);

export function LeadReportAssistantStore({
  children,
}: Readonly<{ children: ReactNode }>) {
  const trpc = useTRPC();
  const [exchange, setExchange] = useState<AssistantExchange>(emptyExchange);
  const { user } = useSession();
  const previousUserId = useRef<string | null>(null);
  const latestRequestId = useRef(0);
  const requestInFlight = useRef(false);
  const mutation = useMutation(trpc.leadForm.assistant.mutationOptions());

  const submitQuestion = (
    nextQuestion: string,
    nextTokens: readonly string[],
  ) => {
    const trimmedQuestion = nextQuestion.trim();
    if (trimmedQuestion.length === 0 || requestInFlight.current) return;
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    requestInFlight.current = true;
    setExchange((currentExchange) => ({
      ...currentExchange,
      submittedQuestion: trimmedQuestion,
      resolutionTokens: nextTokens,
      requestState: "pending",
      outcome: null,
    }));
    mutation.reset();
    mutation.mutate(
      {
        question: trimmedQuestion,
        resolutionTokens: [...nextTokens],
      },
      {
        onSuccess: (nextOutcome) => {
          if (latestRequestId.current !== requestId) return;
          requestInFlight.current = false;
          setExchange((currentExchange) => ({
            ...currentExchange,
            outcome: nextOutcome,
            requestState: "idle",
          }));
        },
        onError: () => {
          if (latestRequestId.current !== requestId) return;
          requestInFlight.current = false;
          setExchange((currentExchange) => ({
            ...currentExchange,
            requestState: "error",
            outcome: null,
          }));
        },
      },
    );
  };

  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== null && previousUserId.current !== userId) {
      latestRequestId.current += 1;
      requestInFlight.current = false;
      setExchange(emptyExchange);
    }
    previousUserId.current = userId;
  }, [user?.id]);

  return (
    <LeadReportAssistantStoreContext.Provider
      value={{ exchange, setExchange, submitQuestion }}
    >
      {children}
    </LeadReportAssistantStoreContext.Provider>
  );
}

export const useLeadReportAssistantStore = (): AssistantStore => {
  const store = useContext(LeadReportAssistantStoreContext);
  if (!store) throw new Error("LeadReportAssistantStore is unavailable.");
  return store;
};
