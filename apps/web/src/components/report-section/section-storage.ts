import {
  reportSectionReadModelSchema,
  type ReportSectionReadModel,
} from '@customreport/shared';

import { createDemoSection } from './demo-section';

export const LEAD_REPORT_STORAGE_KEY = 'customreport:lead-report-section';

export function readStoredLeadSection(): ReportSectionReadModel {
  if (typeof window === 'undefined') {
    return createDemoSection();
  }

  const rawValue = window.localStorage.getItem(LEAD_REPORT_STORAGE_KEY);

  if (!rawValue) {
    return createDemoSection();
  }

  return reportSectionReadModelSchema.parse(JSON.parse(rawValue));
}

export function persistLeadSection(section: ReportSectionReadModel): ReportSectionReadModel {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LEAD_REPORT_STORAGE_KEY, JSON.stringify(section));
  }

  return section;
}
