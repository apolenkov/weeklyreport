import { type InjectionToken } from "@nestjs/common";

export interface WeeklyReportLifecyclePort {
  getCurrentEditableId(): Promise<string | null>;
  getLatestPublishedNonArchivedId(): Promise<string | null>;
}

export const WEEKLY_REPORT_LIFECYCLE: InjectionToken<WeeklyReportLifecyclePort> =
  Symbol("WEEKLY_REPORT_LIFECYCLE");
