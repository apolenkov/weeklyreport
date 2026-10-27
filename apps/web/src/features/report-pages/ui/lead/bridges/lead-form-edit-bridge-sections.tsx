"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import type { ComponentProps } from "react";

import type { CrossAuthorEntry } from "../../../../period";
import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import type { RecordVisibility } from "../../../../report-sections/client";
import type { LeadFormBridgeAccordionsActions } from "./lead-form-bridge-accordions";
import {
  LeadFormBridgeAccordions,
  risksOpenSignal,
} from "./lead-form-bridge-accordions";
import {
  LeadFormSyncBridge,
  type RiskPrefillRequest,
  type StagesForProduct,
} from "./lead-form-sync-bridge";

type SyncBridgeProviderProps = ComponentProps<
  typeof LeadFormSyncBridge.Provider
>;

export interface LeadFormEditBridgeSectionsActions extends LeadFormBridgeAccordionsActions {
  readonly onProductsChange: SyncBridgeProviderProps["onProductsChange"];
  readonly onRisksChange: SyncBridgeProviderProps["onRisksChange"];
  readonly risksAddSignal: number;
  readonly riskPrefill: RiskPrefillRequest | null;
}

interface LeadFormEditBridgeSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormEditBridgeSectionsActions;
  readonly draftSection: ReportSectionReadModel;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly visibilityHydrated: boolean;
  readonly crossAuthorEntries: CrossAuthorEntry[];
  readonly stagesForProduct: StagesForProduct;
}

// The accordions stay inside the Provider so `.Pipeline` / `.Risks` keep context.
export function LeadFormEditBridgeSections({
  viewModel,
  actions,
  draftSection,
  groupExpanded,
  unifiedView,
  recordVisibility,
  visibilityHydrated,
  crossAuthorEntries,
  stagesForProduct,
}: LeadFormEditBridgeSectionsProps) {
  const { activityOptions, isReadOnly, ownRisks, products, risks } = viewModel;
  const risksSectionOpenSignal = risksOpenSignal(actions);
  return (
    <LeadFormSyncBridge.Provider
      products={products}
      activities={activityOptions}
      risks={ownRisks}
      onProductsChange={actions.onProductsChange}
      onRisksChange={actions.onRisksChange}
      readOnly={isReadOnly}
      stagesForProduct={stagesForProduct}
      {...(draftSection.authorName
        ? { sectionAuthorName: draftSection.authorName }
        : {})}
      risksAddSignal={actions.risksAddSignal}
      crossAuthors={crossAuthorEntries}
      // Pre-hydration: full grid avoids a flash that hides foreign chips.
      visibilityMode={visibilityHydrated ? recordVisibility : "everyone"}
      displayRisks={risks}
      externalRiskPrefill={actions.riskPrefill}
    >
      <LeadFormBridgeAccordions
        viewModel={viewModel}
        actions={actions}
        draftSection={draftSection}
        groupExpanded={groupExpanded}
        risksOpenSignal={risksSectionOpenSignal}
        unifiedView={unifiedView}
        stagesForProduct={stagesForProduct}
      />
    </LeadFormSyncBridge.Provider>
  );
}
