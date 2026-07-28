"use client";

import type { ReportSectionReadModel } from "@customreport/shared";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import type { CrossAuthorEntry } from "../../period";
import {
  mapLeadReviewFeedback,
  ownedStagesForProject,
} from "../../report-sections";
import { LeadReviewFeedback } from "../../review";
import {
  type LeadFormDecisionsActions,
  LeadFormDecisionsSection,
} from "./lead-form-decisions-section";
import {
  LeadFormEditBridgeSections,
  type LeadFormEditBridgeSectionsActions,
} from "./lead-form-edit-bridge-sections";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import type { StagesForProduct } from "./lead-form-sync-bridge";

export type LeadFormEditSectionsActions = LeadFormEditBridgeSectionsActions &
  LeadFormDecisionsActions;

interface LeadFormEditSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormEditSectionsActions;
  readonly draftSection: ReportSectionReadModel;
  // Authoritative server section — reviewer feedback derives from it.
  readonly serverSection: ReportSectionReadModel;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly visibilityHydrated: boolean;
  readonly crossAuthorEntries: CrossAuthorEntry[];
}

export function LeadFormEditSections({
  viewModel,
  actions,
  draftSection,
  serverSection,
  groupExpanded,
  unifiedView,
  recordVisibility,
  visibilityHydrated,
  crossAuthorEntries,
}: LeadFormEditSectionsProps) {
  // Reviewer comments on this lead's OWN records, read from the authoritative
  // SERVER section (not the editable draft, whose in-place edits could drop
  // the joined comments).
  const reviewFeedback = mapLeadReviewFeedback(serverSection);
  // Per-project stages-the-lead-owns selector, forwarded into the record
  // dialogs so the SDLC stage dropdown is scoped per project.
  const stagesForProduct: StagesForProduct = (productId) =>
    ownedStagesForProject(draftSection, productId);
  return (
    <div className="min-w-0 space-y-6">
      {/* Reviewer feedback on a returned section surfaces read-only above
          the editable content, so the lead sees what to fix before
          resubmitting. Self-suppresses when there is none. */}
      <LeadReviewFeedback records={reviewFeedback} />
      <LeadFormEditBridgeSections
        viewModel={viewModel}
        actions={actions}
        draftSection={draftSection}
        groupExpanded={groupExpanded}
        unifiedView={unifiedView}
        recordVisibility={recordVisibility}
        visibilityHydrated={visibilityHydrated}
        crossAuthorEntries={crossAuthorEntries}
        stagesForProduct={stagesForProduct}
      />
      <LeadFormDecisionsSection
        viewModel={viewModel}
        actions={actions}
        groupExpanded={groupExpanded}
        stagesForProduct={stagesForProduct}
      />
    </div>
  );
}
