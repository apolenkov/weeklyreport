import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";

// Identifying period label for the report breadcrumb: the addressed period when
// present among the visible periods, else the newest visible one.
export function leadPeriodLabel(
  viewModel: LeadFormLoadedViewModel,
  reportId: string | null | undefined,
): string | undefined {
  const selected =
    viewModel.visiblePeriods.find((period) => period.id === reportId) ??
    viewModel.visiblePeriods[0];
  return selected ? `${selected.weekLabel}, ${selected.dateRange}` : undefined;
}
