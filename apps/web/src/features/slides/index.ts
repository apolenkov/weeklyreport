export type { GridRowEditableRef } from "./model/slide-grid-rows";
export {
  applySlideInlineDecisionEdit,
  applySlideInlineItemEdit,
  applySlideInlineRiskEdit,
  deleteSlideInlineRecord,
} from "./model/slide-inline-draft";
export {
  ownedStagesForProduct,
  ownPeriodRanks,
  resolveSlideInlineRecord,
  toDialogActivities,
  toDialogProducts,
  toDialogRisks,
} from "./model/slide-inline-edit";
export { HeadSlidesClient } from "./ui/head-slides-client";
export { LeadSlidesClient } from "./ui/lead-slides-client";
export { SlideFullscreenButton } from "./ui/slide-fullscreen-button";
export { SlideSkeleton } from "./ui/slide-skeleton";
