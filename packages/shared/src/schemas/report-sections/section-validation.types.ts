/** Stable codes returned when a section draft or submission violates domain rules. */
export type DraftSaveValidationErrorCode =
  | "SECTION_ALREADY_SUBMITTED"
  | "MISSING_TRAFFIC_LIGHT"
  | "MISSING_CURRENT_ITEM"
  | "DUPLICATE_CHILD_ROW"
  | "STAGE_NOT_OWNED"
  | "ACTIVITY_NOT_ATTACHED"
  | "PUBLISHED_RECORD_LOCKED"
  | "ITEM_RESOLUTION_LOCKED"
  | "INVALID_DECISION_PARENT"
  | "INVALID_HISTORY_CURSOR";

/** Domain validation failure safe to return to section clients. */
export interface DraftSaveValidationError {
  readonly code: DraftSaveValidationErrorCode;
  readonly message: string;
}
