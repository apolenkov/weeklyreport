"use client";

import type { ComponentProps } from "react";

import { AccordionSection } from "../../../shared/ui/report-shell/accordion-section";
import { CurrentWeekSection } from "../../period";
import { CalendarIcon, NextWeekIcon } from "./lead-form-icons";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { NextWeekSection } from "./next-week-section";
import { UnifiedActivitySection } from "./unified-activity-section";
import type { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";

export const NO_PRODUCTS_ASSIGNED_MESSAGE =
  "No products assigned — contact admin";

type LeadFormDraftMerges = ReturnType<typeof useLeadFormDraftMerges>;
type StagesForProduct = ComponentProps<
  typeof CurrentWeekSection
>["stagesForProduct"];

interface LeadFormItemSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly merges: LeadFormDraftMerges;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly stagesForProduct: StagesForProduct;
}

/**
 * The lead form's item sections: classic Current/Next two-section format by
 * default; the opt-in unified by-state view when the org flag is on (a pure
 * projection — physical Item.type is untouched). Rendered INSIDE
 * `LeadFormSyncBridge.Provider` by `LeadFormEditSections`.
 */
export function LeadFormItemSections({
  viewModel,
  merges,
  groupExpanded,
  unifiedView,
  stagesForProduct,
}: LeadFormItemSectionsProps) {
  const {
    activityOptions,
    currentUser,
    currentWeekItems,
    nextWeekItems,
    isReadOnly,
    ownPeriodRanks,
    products,
    publishedLockedItemIds,
    risks,
    unifiedEntries,
  } = viewModel;
  return unifiedView ? (
    <AccordionSection
      groupExpanded={groupExpanded}
      testId="lead-section-unified"
      icon={<CalendarIcon />}
      title="Activity"
      badge={`${currentWeekItems.length + nextWeekItems.length} items`}
      subtitle="Current and next week items in one list, grouped by state. Use + Add to create records."
    >
      <UnifiedActivitySection
        entries={unifiedEntries}
        risks={risks}
        readOnly={isReadOnly}
        onWeekItemsChange={(week, items) =>
          week === "current"
            ? merges.handleCurrentWeekItemsChange(items)
            : merges.handleNextWeekItemsChange(items)
        }
        currentUserName={currentUser.name}
        products={products}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        publishedLockedIds={publishedLockedItemIds}
        onMarkComplete={merges.handleMarkComplete}
        onMoveToNextWeek={merges.handleMoveToNextWeek}
      />
    </AccordionSection>
  ) : (
    <>
      {/* Current Week */}
      <AccordionSection
        groupExpanded={groupExpanded}
        testId="lead-section-current-week"
        icon={<CalendarIcon />}
        title="Current Week"
        badge={`${currentWeekItems.length} items`}
        subtitle="Work completed or still in progress this week, grouped by product and SDLC stage."
        actions={
          !isReadOnly ? (
            <button
              type="button"
              className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={merges.handleAddCurrentWeekItem}
              disabled={products.length === 0}
              title={
                products.length > 0
                  ? `Add item to ${products[0]?.name}`
                  : NO_PRODUCTS_ASSIGNED_MESSAGE
              }
            >
              + Add Item
            </button>
          ) : null
        }
      >
        <CurrentWeekSection
          items={currentWeekItems}
          risks={risks}
          readOnly={isReadOnly}
          onItemsChange={merges.handleCurrentWeekItemsChange}
          currentUserName={currentUser.name}
          products={products}
          activities={activityOptions}
          stagesForProduct={stagesForProduct}
          ownPeriodRanks={ownPeriodRanks}
          addSignal={merges.currentWeekAddSignal}
          publishedLockedIds={publishedLockedItemIds}
          onMarkComplete={merges.handleMarkComplete}
          onMoveToNextWeek={merges.handleMoveToNextWeek}
          onPauseItem={merges.handlePauseItem}
        />
      </AccordionSection>

      {/* Next Week */}
      <AccordionSection
        groupExpanded={groupExpanded}
        testId="lead-section-next-week"
        icon={<NextWeekIcon />}
        title="Next Week"
        badge={`${nextWeekItems.length} items`}
        subtitle="Planned work for the next reporting week, scoped to product and SDLC stage."
        actions={
          !isReadOnly ? (
            <button
              type="button"
              className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-10 min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={merges.handleAddNextWeekItem}
              disabled={products.length === 0}
              title={
                products.length > 0
                  ? `Add item to ${products[0]?.name}`
                  : NO_PRODUCTS_ASSIGNED_MESSAGE
              }
            >
              + Add Item
            </button>
          ) : null
        }
      >
        <NextWeekSection
          items={nextWeekItems}
          risks={risks}
          readOnly={isReadOnly}
          onItemsChange={merges.handleNextWeekItemsChange}
          currentUserName={currentUser.name}
          products={products}
          activities={activityOptions}
          stagesForProduct={stagesForProduct}
          ownPeriodRanks={ownPeriodRanks}
          addSignal={merges.nextWeekAddSignal}
          publishedLockedIds={publishedLockedItemIds}
          onMoveToCurrentWeek={merges.handleMoveToCurrentWeek}
        />
      </AccordionSection>
    </>
  );
}
