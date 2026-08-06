"use client";

import { AccordionSection } from "../../../../../shared/ui/report-shell/accordion-section";
import { DecisionsSection } from "../../../../period";
import type {
  DecisionEntry,
  LeadFormLoadedViewModel,
} from "../../../../report-sections";
import type { StagesForProduct } from "../bridges/lead-form-sync-bridge";
import { LeadFormAddButton } from "./lead-form-add-button";
import { ChatIcon } from "./lead-form-icons";

export interface LeadFormDecisionsActions {
  readonly onDecisionsChange: (next: readonly DecisionEntry[]) => void;
  readonly addDecision: () => void;
  readonly decisionsAddSignal: number;
}

interface LeadFormDecisionsSectionProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormDecisionsActions;
  readonly groupExpanded: boolean;
  readonly stagesForProduct: StagesForProduct;
}

// Outside the sync bridge: decisions carry their own change handler and never
// participate in the product/risk two-way sync.
export function LeadFormDecisionsSection({
  viewModel,
  actions,
  groupExpanded,
  stagesForProduct,
}: LeadFormDecisionsSectionProps) {
  const {
    activityOptions,
    currentUser,
    decisions,
    isReadOnly,
    products,
    publishedLockedDecisionIds,
  } = viewModel;
  return (
    <AccordionSection
      groupExpanded={groupExpanded}
      testId="lead-section-decisions"
      icon={<ChatIcon />}
      title="Decisions"
      titleColor="var(--color-starbucks-accent)"
      badge={`${decisions.length}`}
      badgeStyle={{
        background: "var(--color-success)",
        color: "var(--color-starbucks-accent)",
      }}
      subtitle="Decisions that need leadership attention, with owner, impact, and affected stages."
      actions={
        !isReadOnly ? (
          <LeadFormAddButton onClick={actions.addDecision}>
            + Add Decision
          </LeadFormAddButton>
        ) : null
      }
    >
      <DecisionsSection
        decisions={decisions}
        readOnly={isReadOnly}
        onChange={actions.onDecisionsChange}
        currentUserName={currentUser.name}
        stagesForProduct={stagesForProduct}
        products={products}
        activities={activityOptions}
        defaultProductId={products[0]?.id}
        addSignal={actions.decisionsAddSignal}
        publishedLockedIds={publishedLockedDecisionIds}
      />
    </AccordionSection>
  );
}
