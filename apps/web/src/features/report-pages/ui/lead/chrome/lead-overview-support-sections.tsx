"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useCallback, useMemo } from "react";

import type { CrossAuthorEntry } from "../../../../period";
import type {
  DraftPatch,
  LeadFormLoadedViewModel,
  RiskEntry,
} from "../../../../report-sections";
import {
  mapLeadReviewFeedback,
  ownedStagesForProject,
} from "../../../../report-sections";
import type { RecordVisibility } from "../../../../report-sections/client";
import { LeadReviewFeedback } from "../../../../review";
import { RisksAccordion } from "../bridges/lead-form-bridge-accordions";
import {
  LeadFormSyncBridge,
  type RiskPrefillRequest,
  type StagesForProduct,
} from "../bridges/lead-form-sync-bridge";
import {
  type LeadFormDecisionsActions,
  LeadFormDecisionsSection,
} from "./lead-form-decisions-section";

export interface LeadOverviewSupportActions extends LeadFormDecisionsActions {
  readonly onProductsChange: (
    next: Extract<DraftPatch, { readonly kind: "products" }>["products"],
  ) => void;
  readonly onRisksChange: (next: readonly RiskEntry[]) => void;
  readonly risksAddSignal: number;
  readonly riskPrefill: RiskPrefillRequest | null;
  readonly addRisk: () => void;
}

export interface LeadOverviewSupportSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadOverviewSupportActions;
  readonly draftSection: ReportSectionReadModel;
  readonly serverSection: ReportSectionReadModel;
  readonly groupExpanded: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly visibilityHydrated: boolean;
  readonly crossAuthorEntries: readonly CrossAuthorEntry[];
  readonly pendingInput: boolean;
}

// Overview parity surface: risks, decisions and reviewer feedback
// reuse the existing draft coordinator. Current/Next item sections deliberately
// stay with the Overview row composer and are never rendered here.
export function LeadOverviewSupportSections({
  viewModel,
  actions,
  draftSection,
  serverSection,
  groupExpanded,
  recordVisibility,
  visibilityHydrated,
  crossAuthorEntries,
  pendingInput,
}: LeadOverviewSupportSectionsProps) {
  const supportReadOnly = viewModel.isReadOnly || pendingInput;
  const reviewFeedback = useMemo(
    () => mapLeadReviewFeedback(serverSection),
    [serverSection],
  );
  const stagesForProduct = useCallback<StagesForProduct>(
    (productId) => ownedStagesForProject(draftSection, productId),
    [draftSection],
  );
  const risksOpenSignal = `${actions.risksAddSignal}:${actions.riskPrefill?.signal ?? 0}`;
  const decisionsViewModel =
    pendingInput && !viewModel.isReadOnly
      ? { ...viewModel, isReadOnly: true }
      : viewModel;
  const { activityOptions, ownRisks, products, risks } = viewModel;

  return (
    <div
      className="min-w-0 space-y-2"
      data-testid="lead-overview-support-sections"
      data-feedback-anchor="lead-overview-support-sections"
    >
      <LeadReviewFeedback
        records={reviewFeedback}
        reviews={serverSection.reviews}
      />
      <LeadFormSyncBridge.Provider
        products={products}
        activities={activityOptions}
        risks={ownRisks}
        onProductsChange={actions.onProductsChange}
        onRisksChange={actions.onRisksChange}
        readOnly={supportReadOnly}
        stagesForProduct={stagesForProduct}
        {...(draftSection.authorName
          ? { sectionAuthorName: draftSection.authorName }
          : {})}
        risksAddSignal={actions.risksAddSignal}
        crossAuthors={crossAuthorEntries}
        visibilityMode={visibilityHydrated ? recordVisibility : "everyone"}
        displayRisks={risks}
        externalRiskPrefill={actions.riskPrefill}
      >
        <RisksAccordion
          groupExpanded={groupExpanded}
          openSignal={risksOpenSignal}
          riskCount={risks.length}
          productCount={products.length}
          activityCount={activityOptions.length}
          readOnly={supportReadOnly}
          onAddRisk={actions.addRisk}
        />
      </LeadFormSyncBridge.Provider>
      <LeadFormDecisionsSection
        viewModel={decisionsViewModel}
        actions={actions}
        groupExpanded={groupExpanded}
        stagesForProduct={stagesForProduct}
      />
    </div>
  );
}
