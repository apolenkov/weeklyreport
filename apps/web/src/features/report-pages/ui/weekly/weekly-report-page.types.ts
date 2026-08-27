import type { ReactNode } from "react";

import type { WeeklyReportPageState } from "./use-weekly-report-page";

export type ReadyWeeklyReportPage = Extract<
  WeeklyReportPageState,
  { kind: "ready" }
>;

export interface WeeklyReportPageProps {
  readonly reportId?: string | undefined;
  readonly redirectToCanonical?: boolean | undefined;
  readonly canonicalBasePath?: string | undefined;
  readonly authorId?: string | undefined;
  readonly scope?: "product" | "lead" | undefined;
  readonly documentActionsLeading?: ReactNode | undefined;
  readonly contextControls?: ReactNode | undefined;
  readonly contextControlsLeading?: ReactNode | undefined;
  readonly headerContextLabel?: ReactNode | undefined;
  readonly loadingAudience?: "head" | "viewer" | undefined;
}
