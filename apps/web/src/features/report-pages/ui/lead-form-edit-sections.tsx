"use client";

import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";
import type { ComponentProps } from "react";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import { AccordionSection } from "../../../shared/ui/report-shell/accordion-section";
import type { CrossAuthorEntry } from "../../period";
import { ActivityStatusSection, DecisionsSection } from "../../period";
import {
  type DecisionEntry,
  mapLeadReviewFeedback,
  ownedStagesForProject,
} from "../../report-sections";
import { LeadReviewFeedback } from "../../review";
import { AlertIcon, ChatIcon, GridIcon } from "./lead-form-icons";
import {
  LeadFormItemSections,
  type LeadFormItemSectionsActions,
  NO_PRODUCTS_ASSIGNED_MESSAGE,
} from "./lead-form-item-sections";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import {
  LeadFormSyncBridge,
  type RiskPrefillRequest,
} from "./lead-form-sync-bridge";

type SyncBridgeProviderProps = ComponentProps<
  typeof LeadFormSyncBridge.Provider
>;

/** The draft actions the edit stack drives, plus the item-section slice it forwards. */
export interface LeadFormEditSectionsActions extends LeadFormItemSectionsActions {
  readonly onProductsChange: SyncBridgeProviderProps["onProductsChange"];
  readonly onRisksChange: SyncBridgeProviderProps["onRisksChange"];
  readonly onDecisionsChange: (next: DecisionEntry[]) => void;
  readonly onActivityStatusChange: (
    activityId: string,
    status: TrafficLightStatus,
  ) => void;
  readonly onActivityRaiseRequiresRisk: (
    activityId: string,
    severity: "at-risk" | "blocked",
  ) => void;
  readonly addRisk: () => void;
  readonly addDecision: () => void;
  readonly risksAddSignal: number;
  readonly decisionsAddSignal: number;
  readonly riskPrefill: RiskPrefillRequest | null;
}

interface LeadFormEditSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormEditSectionsActions;
  readonly draftSection: ReportSectionReadModel;
  /** The authoritative SERVER section — reviewer feedback derives from it. */
  readonly serverSection: ReportSectionReadModel;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly visibilityHydrated: boolean;
  readonly crossAuthorEntries: CrossAuthorEntry[];
}

/**
 * The lead form's edit-mode section stack: reviewer feedback, the sync-bridge
 * Provider with the Product Status / Activities / item / Risks accordions,
 * and the Decisions accordion. `LeadFormItemSections` stays a child INSIDE
 * the Provider so `.Pipeline` / `.Risks` keep their context.
 */
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
  const stagesForProduct: SyncBridgeProviderProps["stagesForProduct"] = (
    productId,
  ) => ownedStagesForProject(draftSection, productId);
  const {
    activityCards,
    activityOptions,
    currentUser,
    decisions,
    isReadOnly,
    ownRisks,
    products,
    publishedLockedDecisionIds,
    risks,
  } = viewModel;
  return (
    // Split-view: at xl the edit form (left) sits beside a live slide
    // preview (right) fed from the same draftSection — one source, no
    // extra fetch. Below xl it stays single-column; ?mode=slides handles
    // the standalone deck.
    <div className="min-w-0 space-y-6">
      {/* Reviewer feedback on a returned section surfaces read-only above
          the editable content, so the lead sees what to fix before
          resubmitting. Self-suppresses when there is none. */}
      <LeadReviewFeedback records={reviewFeedback} />
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
        // lead-mine-hide-unowned-stages: until the persisted visibility is
        // hydrated, render the full grid ("everyone") to avoid a flash that
        // briefly hides foreign/vacant chips when the restored value is
        // "everyone" (the gated content fetch is likewise hydration-guarded).
        visibilityMode={visibilityHydrated ? recordVisibility : "everyone"}
        displayRisks={risks}
        externalRiskPrefill={actions.riskPrefill}
      >
        <AccordionSection
          groupExpanded={groupExpanded}
          testId="lead-section-product-status"
          icon={<GridIcon />}
          title="Product Status"
          badge={`${products.length} assigned products`}
          subtitle="Assigned stages are highlighted. Blocked and at-risk stages link to the context you need to resolve them."
        >
          <LeadFormSyncBridge.Pipeline />
        </AccordionSection>

        {/* Project Activities — stage-less units beside products.
            Self-suppresses when the author has no attached activities
            (attachment is admin-provisioned, so there is no add here). */}
        {draftSection.activities.length > 0 && (
          <AccordionSection
            groupExpanded={groupExpanded}
            testId="lead-section-activities"
            icon={<GridIcon />}
            title="Project Activities"
            badge={`${draftSection.activities.length} attached activities`}
            subtitle="Weekly status for activities you are attached to. Activities carry no SDLC stage and never affect product health."
          >
            <ActivityStatusSection
              activities={activityCards}
              readOnly={isReadOnly}
              onStatusChange={actions.onActivityStatusChange}
              onRaiseRequiresRisk={actions.onActivityRaiseRequiresRisk}
            />
          </AccordionSection>
        )}

        {/* Items: classic Current/Next two-section format by default;
            the opt-in unified by-state view when the org flag is on
            (a pure projection — physical Item.type is untouched). */}
        <LeadFormItemSections
          viewModel={viewModel}
          actions={actions}
          groupExpanded={groupExpanded}
          unifiedView={unifiedView}
          stagesForProduct={stagesForProduct}
        />

        {/* Risks & Blockers */}
        <AccordionSection
          groupExpanded={groupExpanded}
          testId="lead-section-risks"
          icon={<AlertIcon />}
          title="Risks & Blockers"
          titleColor="var(--color-destructive)"
          badge={`${risks.length}`}
          badgeStyle={{
            background: "var(--color-status-blocked-bg)",
            color: "var(--color-destructive)",
          }}
          subtitle="Risks and blockers that need attention, with impact, mitigation, and affected stages."
          actions={
            !isReadOnly ? (
              <button
                type="button"
                className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={actions.addRisk}
                disabled={products.length === 0}
                title={
                  products.length > 0 ? undefined : NO_PRODUCTS_ASSIGNED_MESSAGE
                }
              >
                + Add Risk
              </button>
            ) : null
          }
        >
          <LeadFormSyncBridge.Risks />
        </AccordionSection>
      </LeadFormSyncBridge.Provider>

      {/* Decisions */}
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
            <button
              type="button"
              className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={actions.addDecision}
            >
              + Add Decision
            </button>
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
    </div>
  );
}
