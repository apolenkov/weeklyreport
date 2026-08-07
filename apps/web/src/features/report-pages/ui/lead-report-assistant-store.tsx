"use client";

import type { ReportAssistantOutcome } from "@customreport/shared";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSession } from "../../../lib/session-provider";

type AssistantExchange = Readonly<{
  question: string;
  submittedQuestion: string;
  resolutionTokens: readonly string[];
  requestState: "idle" | "pending" | "error";
  outcome: ReportAssistantOutcome | null;
}>;

type AssistantStore = Readonly<{
  exchange: AssistantExchange;
  setExchange: (exchange: AssistantExchange) => void;
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
  const [exchange, setExchange] = useState<AssistantExchange>(emptyExchange);
  const { user } = useSession();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== null && previousUserId.current !== userId) {
      setExchange(emptyExchange);
    }
    previousUserId.current = userId;
  }, [user?.id]);

  return (
    <LeadReportAssistantStoreContext.Provider value={{ exchange, setExchange }}>
      {children}
    </LeadReportAssistantStoreContext.Provider>
  );
}

export const useLeadReportAssistantStore = (): AssistantStore => {
  const store = useContext(LeadReportAssistantStoreContext);
  if (!store) throw new Error("LeadReportAssistantStore is unavailable.");
  return store;
};
