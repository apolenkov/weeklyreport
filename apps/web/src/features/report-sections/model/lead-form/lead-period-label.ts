import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";

// Identifying period label for the report breadcrumb: the addressed period when
// present among the visible periods. Only an absent address falls back to the
// newest visible one — a provided-but-missing id returns undefined so callers
// render their neutral fallback instead of another period's label.
export function leadPeriodLabel(
  viewModel: LeadFormLoadedViewModel,
  reportId: string | null | undefined,
): string | undefined {
  const selected =
    reportId == null
      ? viewModel.visiblePeriods[0]
      : viewModel.visiblePeriods.find((period) => period.id === reportId);
  return selected ? `${selected.weekLabel}, ${selected.dateRange}` : undefined;
}
