"use client";

import { AccordionSection } from "../../../shared/ui/report-shell/accordion-section";
import { DecisionsSection } from "../../period";
import { LeadFormAddButton } from "./lead-form-add-button";
import type {
  LeadFormEditSectionsActions,
  StagesForProduct,
} from "./lead-form-edit-sections";
import { ChatIcon } from "./lead-form-icons";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";

interface LeadFormDecisionsSectionProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormEditSectionsActions;
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
