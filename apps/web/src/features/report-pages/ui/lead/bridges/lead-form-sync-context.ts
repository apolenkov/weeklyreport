"use client";

import { createContext, useContext } from "react";

import type { CrossAuthorEntry } from "../../../../period";
import type {
  Product,
  RiskEntry,
  RiskPrefillRequest,
  StageStatus,
} from "../../../../report-sections";

export type StagesForProduct = (productId: string) => readonly string[];

export interface BridgeContextValue {
  products: readonly Product[];
  risks: readonly RiskEntry[];
  readOnly: boolean;
  activities?: readonly { id: string; name: string }[];
  stagesForProduct?: StagesForProduct;
  sectionAuthorName?: string;
  risksAddSignal?: number;
  crossAuthors?: readonly CrossAuthorEntry[];
  visibilityMode?: "mine" | "everyone";
  displayRisks?: readonly RiskEntry[];
  riskPrefill: RiskPrefillRequest | null;
  handleStageStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  handleRisksChange: (next: readonly RiskEntry[]) => void;
}

export const BridgeContext = createContext<BridgeContextValue | null>(null);

export function useBridgeContext(componentName: string): BridgeContextValue {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error(
      `${componentName} must be rendered inside <LeadFormSyncBridge.Provider>.`,
    );
  }
  return context;
}
