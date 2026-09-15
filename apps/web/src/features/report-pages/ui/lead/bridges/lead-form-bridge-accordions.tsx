"use client";

import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import {
  type AccordionOpenSignal,
  AccordionSection,
} from "../../../../../shared/ui/report-shell/accordion-section";
import { ActivityStatusSection } from "../../../../period";
import type {
  LeadActivityCard,
  LeadFormLoadedViewModel,
} from "../../../../report-sections";
import { LeadFormAddButton } from "../chrome/lead-form-add-button";
import { NO_RECORD_PARENTS_MESSAGE } from "../chrome/lead-form-add-item-button";
import { AlertIcon, GridIcon } from "../chrome/lead-form-icons";
import {
  LeadFormItemSections,
  type LeadFormItemSectionsActions,
} from "../chrome/lead-form-item-sections";
import {
  LeadFormSyncBridge,
  type StagesForProduct,
} from "./lead-form-sync-bridge";

export interface LeadFormBridgeAccordionsActions extends LeadFormItemSectionsActions {
  readonly onActivityStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
  readonly onActivityTitleChange: (
    activityId: string,
    titleOverride: string | null,
  ) => void;
  readonly onActivityDescriptionChange: (
    activityId: string,
    note: string | null,
  ) => void;
  readonly onActivityRaiseRequiresRisk: (
    activityId: string,
    severity: "at-risk" | "blocked",
  ) => void;
  readonly addRisk: () => void;
}

export function ProductStatusAccordion({
  groupExpanded,
  productCount,
}: {
  readonly groupExpanded: boolean;
  readonly productCount: number;
}) {
  return (
    <AccordionSection
      groupExpanded={groupExpanded}
      testId="lead-section-product-status"
      icon={<GridIcon />}
      title="Product Status"
      badge={`${productCount} assigned products`}
      subtitle="Assigned stages are highlighted. Blocked and at-risk stages link to the context you need to resolve them."
    >
      <LeadFormSyncBridge.Pipeline />
    </AccordionSection>
  );
}

// Stage-less units beside products. Attachment is admin-provisioned, so the
// section offers no add control.
export function ProjectActivitiesAccordion({
  groupExpanded,
  activities,
  attachedCount,
  readOnly,
  onStatusChange,
  onRaiseRequiresRisk,
  onTitleChange,
  onDescriptionChange,
}: {
  readonly groupExpanded: boolean;
  readonly activities: LeadActivityCard[];
  readonly attachedCount: number;
  readonly readOnly: boolean;
  readonly onStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
  readonly onRaiseRequiresRisk: (
    activityId: string,
    severity: "at-risk" | "blocked",
  ) => void;
  readonly onTitleChange: (
    activityId: string,
    titleOverride: string | null,
  ) => void;
  readonly onDescriptionChange: (
    activityId: string,
    note: string | null,
  ) => void;
}) {
  return (
    <AccordionSection
      groupExpanded={groupExpanded}
      testId="lead-section-activities"
      icon={<GridIcon />}
      title="Project Activities"
      badge={`${attachedCount} attached activities`}
      subtitle="Weekly status for activities you are attached to. Activities carry no SDLC stage and never affect product health."
    >
      <ActivityStatusSection
        activities={activities}
        readOnly={readOnly}
        onStatusChange={onStatusChange}
        onRaiseRequiresRisk={onRaiseRequiresRisk}
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
      />
    </AccordionSection>
  );
}

export function RisksAccordion({
  groupExpanded,
  openSignal,
  riskCount,
  productCount,
  activityCount,
  readOnly,
  onAddRisk,
}: {
  readonly groupExpanded: boolean;
  readonly openSignal?: AccordionOpenSignal;
  readonly riskCount: number;
  readonly productCount: number;
  readonly activityCount: number;
  readonly readOnly: boolean;
  readonly onAddRisk: () => void;
}) {
  return (
    <AccordionSection
      groupExpanded={groupExpanded}
      openSignal={openSignal}
      testId="lead-section-risks"
      icon={<AlertIcon />}
      title="Risks & Blockers"
      titleColor="var(--color-destructive)"
      badge={`${riskCount}`}
      badgeStyle={{
        background: "var(--color-status-blocked-bg)",
        color: "var(--color-destructive)",
      }}
      subtitle="Risks and blockers that need attention, with impact, mitigation, and affected stages."
      actions={
        !readOnly ? (
          <LeadFormAddButton
            onClick={onAddRisk}
            disabled={productCount + activityCount === 0}
            title={
              productCount + activityCount > 0
                ? undefined
                : NO_RECORD_PARENTS_MESSAGE
            }
          >
            + Add Risk
          </LeadFormAddButton>
        ) : null
      }
    >
      <LeadFormSyncBridge.Risks />
    </AccordionSection>
  );
}

interface LeadFormBridgeAccordionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormBridgeAccordionsActions;
  readonly draftSection: ReportSectionReadModel;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly stagesForProduct: StagesForProduct;
}

export function LeadFormBridgeAccordions({
  viewModel,
  actions,
  draftSection,
  groupExpanded,
  unifiedView,
  stagesForProduct,
}: LeadFormBridgeAccordionsProps) {
  const { activityCards, isReadOnly, products, risks } = viewModel;
  return (
    <>
      <ProductStatusAccordion
        groupExpanded={groupExpanded}
        productCount={products.length}
      />
      {draftSection.activities.length > 0 && (
        <ProjectActivitiesAccordion
          groupExpanded={groupExpanded}
          activities={activityCards}
          attachedCount={draftSection.activities.length}
          readOnly={isReadOnly}
          onStatusChange={actions.onActivityStatusChange}
          onRaiseRequiresRisk={actions.onActivityRaiseRequiresRisk}
          onTitleChange={actions.onActivityTitleChange}
          onDescriptionChange={actions.onActivityDescriptionChange}
        />
      )}
      {/* Classic Current/Next two-section format by default; the opt-in
          unified by-state view when the org flag is on (a pure projection —
          physical Item.type is untouched). */}
      <LeadFormItemSections
        viewModel={viewModel}
        actions={actions}
        groupExpanded={groupExpanded}
        unifiedView={unifiedView}
        stagesForProduct={stagesForProduct}
      />
      <RisksAccordion
        groupExpanded={groupExpanded}
        riskCount={risks.length}
        productCount={products.length}
        activityCount={viewModel.activityOptions.length}
        readOnly={isReadOnly}
        onAddRisk={actions.addRisk}
      />
    </>
  );
}
