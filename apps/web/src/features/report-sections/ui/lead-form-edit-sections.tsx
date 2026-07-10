"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { ComponentProps } from "react";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import { AccordionSection } from "../../../shared/ui/report-shell/accordion-section";
import { ActivityStatusSection } from "../../period/ui/activity-status-section";
import { DecisionsSection } from "../../period/ui/decisions-section";
import type { CrossAuthorEntry } from "../../period/ui/sdlc-pipeline";
import { LeadReviewFeedback } from "../../review/ui/lead-review-feedback";
import { AlertIcon, ChatIcon, GridIcon } from "./lead-form-icons";
import {
  LeadFormItemSections,
  NO_PRODUCTS_ASSIGNED_MESSAGE,
} from "./lead-form-item-sections";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormSyncBridge } from "./lead-form-sync-bridge";
import type { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";

type LeadFormDraftMerges = ReturnType<typeof useLeadFormDraftMerges>;
type SyncBridgeProviderProps = ComponentProps<
  typeof LeadFormSyncBridge.Provider
>;

interface LeadFormEditSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly merges: LeadFormDraftMerges;
  readonly draftSection: ReportSectionReadModel;
  readonly reviewFeedback: ComponentProps<typeof LeadReviewFeedback>["records"];
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly stagesForProduct: SyncBridgeProviderProps["stagesForProduct"];
  readonly recordVisibility: RecordVisibility;
  readonly visibilityHydrated: boolean;
  readonly crossAuthorEntries: CrossAuthorEntry[];
}

/**
 * The lead form's edit-mode section stack: reviewer feedback, the sync-bridge
 * Provider with the Product Status / Activities / item / Risks accordions,
 * and the Decisions accordion. Pure relocation from `LeadForm` — the markup,
 * testids, and handler wiring are unchanged; `LeadFormItemSections` stays a
 * child INSIDE the Provider so `.Pipeline` / `.Risks` keep their context.
 */
export function LeadFormEditSections({
  viewModel,
  merges,
  draftSection,
  reviewFeedback,
  groupExpanded,
  unifiedView,
  stagesForProduct,
  recordVisibility,
  visibilityHydrated,
  crossAuthorEntries,
}: LeadFormEditSectionsProps) {
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
      {/* review-acknowledgement (§8): reviewer feedback on a returned
          section surfaces read-only above the editable content, so the
          lead sees what to fix before resubmitting. Self-suppresses when
          there is none. */}
      <LeadReviewFeedback records={reviewFeedback} />
      <LeadFormSyncBridge.Provider
        products={products}
        activities={activityOptions}
        risks={ownRisks}
        onProductsChange={merges.handleProductsChange}
        onRisksChange={merges.handleRisksChange}
        readOnly={isReadOnly}
        stagesForProduct={stagesForProduct}
        {...(draftSection.authorName
          ? { sectionAuthorName: draftSection.authorName }
          : {})}
        risksAddSignal={merges.risksAddSignal}
        crossAuthors={crossAuthorEntries}
        // lead-mine-hide-unowned-stages: until the persisted visibility is
        // hydrated, render the full grid ("everyone") to avoid a flash that
        // briefly hides foreign/vacant chips when the restored value is
        // "everyone" (the gated content fetch is likewise hydration-guarded).
        visibilityMode={visibilityHydrated ? recordVisibility : "everyone"}
        displayRisks={risks}
        externalRiskPrefill={merges.riskPrefill}
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
              onStatusChange={merges.handleActivityStatusChange}
              onRaiseRequiresRisk={merges.handleActivityRaiseRequiresRisk}
            />
          </AccordionSection>
        )}

        {/* Items: classic Current/Next two-section format by default;
            the opt-in unified by-state view when the org flag is on
            (a pure projection — physical Item.type is untouched). */}
        <LeadFormItemSections
          viewModel={viewModel}
          merges={merges}
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
                onClick={merges.handleAddRisk}
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
              onClick={merges.handleAddDecision}
            >
              + Add Decision
            </button>
          ) : null
        }
      >
        <DecisionsSection
          decisions={decisions}
          readOnly={isReadOnly}
          onChange={merges.handleDecisionsChange}
          currentUserName={currentUser.name}
          stagesForProduct={stagesForProduct}
          products={products}
          activities={activityOptions}
          defaultProductId={products[0]?.id}
          addSignal={merges.decisionsAddSignal}
          publishedLockedIds={publishedLockedDecisionIds}
        />
      </AccordionSection>
    </div>
  );
}
