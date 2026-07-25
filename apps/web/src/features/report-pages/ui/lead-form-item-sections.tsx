"use client";

import type { ComponentProps } from "react";

import { AccordionSection } from "../../../shared/ui/report-shell/accordion-section";
import { CurrentWeekSection } from "../../period";
import type { KanbanItem } from "../../report-sections";
import { LeadFormAddButton } from "./lead-form-add-button";
import { CalendarIcon, NextWeekIcon } from "./lead-form-icons";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { NextWeekSection } from "./next-week-section";
import { UnifiedActivitySection } from "./unified-activity-section";

export const NO_PRODUCTS_ASSIGNED_MESSAGE =
  "No products assigned — contact admin";

export interface LeadFormItemSectionsActions {
  readonly onCurrentWeekItemsChange: (items: KanbanItem[]) => void;
  readonly onNextWeekItemsChange: (items: KanbanItem[]) => void;
  readonly onMarkComplete: (itemId: string) => void;
  readonly onMoveToNextWeek: (itemId: string) => void;
  readonly onMoveToCurrentWeek: (itemId: string) => void;
  readonly onPauseItem: (itemId: string, reason: string) => void;
  readonly addCurrentWeekItem: () => void;
  readonly addNextWeekItem: () => void;
  readonly currentWeekAddSignal: number;
  readonly nextWeekAddSignal: number;
}

type StagesForProduct = ComponentProps<
  typeof CurrentWeekSection
>["stagesForProduct"];

interface LeadFormItemSectionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly actions: LeadFormItemSectionsActions;
  readonly groupExpanded: boolean;
  readonly unifiedView: boolean;
  readonly stagesForProduct: StagesForProduct;
}

// Each branch below renders the same view model; only the layout differs.
type WeekSectionProps = Omit<LeadFormItemSectionsProps, "unifiedView">;

// Disabled with an explanatory title when the lead owns no product, so the
// dead-end is legible instead of an inert button.
function AddItemButton({
  onClick,
  products,
}: {
  readonly onClick: () => void;
  readonly products: LeadFormLoadedViewModel["products"];
}) {
  const firstProduct = products[0];
  return (
    <LeadFormAddButton
      onClick={onClick}
      disabled={products.length === 0}
      title={
        firstProduct !== undefined
          ? `Add item to ${firstProduct.name}`
          : NO_PRODUCTS_ASSIGNED_MESSAGE
      }
    >
      + Add Item
    </LeadFormAddButton>
  );
}

function UnifiedActivityAccordion({
  viewModel,
  actions,
  groupExpanded,
  stagesForProduct,
}: WeekSectionProps) {
  const {
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
  return (
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
            ? actions.onCurrentWeekItemsChange(items)
            : actions.onNextWeekItemsChange(items)
        }
        currentUserName={currentUser.name}
        products={products}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        publishedLockedIds={publishedLockedItemIds}
        onMarkComplete={actions.onMarkComplete}
        onMoveToNextWeek={actions.onMoveToNextWeek}
      />
    </AccordionSection>
  );
}

function CurrentWeekAccordion({
  viewModel,
  actions,
  groupExpanded,
  stagesForProduct,
}: WeekSectionProps) {
  const {
    activityOptions,
    currentUser,
    currentWeekItems,
    isReadOnly,
    ownPeriodRanks,
    products,
    publishedLockedItemIds,
    risks,
  } = viewModel;
  return (
    <AccordionSection
      groupExpanded={groupExpanded}
      testId="lead-section-current-week"
      icon={<CalendarIcon />}
      title="Current Week"
      badge={`${currentWeekItems.length} items`}
      subtitle="Work completed or still in progress this week, grouped by product and SDLC stage."
      actions={
        !isReadOnly ? (
          <AddItemButton
            onClick={actions.addCurrentWeekItem}
            products={products}
          />
        ) : null
      }
    >
      <CurrentWeekSection
        items={currentWeekItems}
        risks={risks}
        readOnly={isReadOnly}
        onItemsChange={actions.onCurrentWeekItemsChange}
        currentUserName={currentUser.name}
        products={products}
        activities={activityOptions}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        addSignal={actions.currentWeekAddSignal}
        publishedLockedIds={publishedLockedItemIds}
        onMarkComplete={actions.onMarkComplete}
        onMoveToNextWeek={actions.onMoveToNextWeek}
        onPauseItem={actions.onPauseItem}
      />
    </AccordionSection>
  );
}

function NextWeekAccordion({
  viewModel,
  actions,
  groupExpanded,
  stagesForProduct,
}: WeekSectionProps) {
  const {
    activityOptions,
    currentUser,
    nextWeekItems,
    isReadOnly,
    ownPeriodRanks,
    products,
    publishedLockedItemIds,
    risks,
  } = viewModel;
  return (
    <AccordionSection
      groupExpanded={groupExpanded}
      testId="lead-section-next-week"
      icon={<NextWeekIcon />}
      title="Next Week"
      badge={`${nextWeekItems.length} items`}
      subtitle="Planned work for the next reporting week, scoped to product and SDLC stage."
      actions={
        !isReadOnly ? (
          <AddItemButton
            onClick={actions.addNextWeekItem}
            products={products}
          />
        ) : null
      }
    >
      <NextWeekSection
        items={nextWeekItems}
        risks={risks}
        readOnly={isReadOnly}
        onItemsChange={actions.onNextWeekItemsChange}
        currentUserName={currentUser.name}
        products={products}
        activities={activityOptions}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        addSignal={actions.nextWeekAddSignal}
        publishedLockedIds={publishedLockedItemIds}
        onMoveToCurrentWeek={actions.onMoveToCurrentWeek}
      />
    </AccordionSection>
  );
}

export function LeadFormItemSections({
  unifiedView,
  ...sectionProps
}: LeadFormItemSectionsProps) {
  if (unifiedView) {
    return <UnifiedActivityAccordion {...sectionProps} />;
  }
  return (
    <>
      <CurrentWeekAccordion {...sectionProps} />
      <NextWeekAccordion {...sectionProps} />
    </>
  );
}
