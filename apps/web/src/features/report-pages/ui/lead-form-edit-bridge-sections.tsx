"use client";

import type { ReportSectionReadModel } from "@customreport/shared";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import type { CrossAuthorEntry } from "../../period";
import { LeadFormBridgeAccordions } from "./lead-form-bridge-accordions";
import type {
  LeadFormEditSectionsActions,
  StagesForProduct,
} from "./lead-form-edit-sections";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormSyncBridge } from "./lead-form-sync-bridge";

interface LeadFormEditBridgeSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormEditSectionsActions;
  readonly draftSection: ReportSectionReadModel;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly visibilityHydrated: boolean;
  readonly crossAuthorEntries: CrossAuthorEntry[];
  readonly stagesForProduct: StagesForProduct;
}

// The accordions stay inside the Provider so `.Pipeline` / `.Risks` keep context.
/**
 * Lead Form Edit Bridge Sections.
 * @param props - The props argument.
 */
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
        unifiedView={unifiedView}
        stagesForProduct={stagesForProduct}
      />
    </LeadFormSyncBridge.Provider>
  );
}
