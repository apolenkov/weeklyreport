"use client";

import type { ReportAssistantOutcome } from "@customreport/shared";
import { createContext, type ReactNode, useContext, useState } from "react";

type AssistantExchange = Readonly<{
  question: string;
  submittedQuestion: string;
  resolutionTokens: readonly string[];
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
  outcome: null,
};

const LeadReportAssistantStoreContext = createContext<AssistantStore | null>(
  null,
);

export function LeadReportAssistantStore({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [exchange, setExchange] = useState<AssistantExchange>(emptyExchange);
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
