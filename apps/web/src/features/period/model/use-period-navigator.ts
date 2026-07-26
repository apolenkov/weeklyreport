"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo } from "react";

import type { ReportPeriod } from "../../report-sections";
import { usePeriodListboxNav } from "./use-period-listbox-nav";

// Lead-form addressable URL base. Period nav emits path-segment
// URLs (`/lead/report/<reportId>`) so each week is bookmarkable.
const LEAD_REPORT_BASE = "/lead/report";

// The only routes that address a period as the trailing path segment.
const ADDRESSED_PERIOD_PATH = /^\/(?:lead|head)\/report\/([^/]+)$/;

// The listbox's own open/highlight/keyboard surface, re-exported so the
// navigator's presentational pieces name one type instead of 12 props.
export type PeriodListboxNav = ReturnType<typeof usePeriodListboxNav>;

// Structured option fields (not a flattened label string) so archived/current
// markers can render as badges inside the custom listbox.
interface PeriodListboxOption {
  readonly id: string;
  readonly dateRange: string;
  readonly isCurrent: boolean;
  readonly archived: boolean;
  readonly submitted: boolean;
}

export interface PeriodNavigatorSelection {
  readonly selectedPeriod: ReportPeriod | undefined;
  readonly options: readonly PeriodListboxOption[];
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly goPrev: () => void;
  readonly goNext: () => void;
}

interface PeriodNavigatorArgs {
  readonly periods: readonly ReportPeriod[];
  readonly currentPeriodId: string | undefined;
  readonly urlBuilder: ((periodId: string) => string) | undefined;
  readonly selectedSubmitted: boolean;
}

function toPeriodOptions(
  periods: readonly ReportPeriod[],
  selectedSubmitted: boolean,
  selectedPeriodId: string | undefined,
): PeriodListboxOption[] {
  return periods.map((p) => ({
    id: p.id,
    dateRange: p.dateRange,
    isCurrent: p.isCurrent,
    archived: p.archived ?? false,
    submitted: selectedSubmitted && p.id === selectedPeriodId,
  }));
}

// Path-based inference for lead and head callers that do not pass the
// addressed period id explicitly.
function usePathReportId(currentPeriodId: string | undefined): string | null {
  const pathname = usePathname();
  return useMemo(() => {
    if (currentPeriodId !== undefined || !pathname) return null;
    return ADDRESSED_PERIOD_PATH.exec(pathname)?.[1] ?? null;
  }, [currentPeriodId, pathname]);
}

function useNavigateTo(urlBuilder: ((periodId: string) => string) | undefined) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return useCallback(
    (periodId: string) => {
      if (urlBuilder) {
        router.push(urlBuilder(periodId));
        return;
      }
      // Default: lead path-segment URLs — bookmarkable, back-button-friendly.
      const next = new URLSearchParams(searchParams.toString());
      const query = next.toString();
      const suffix = query ? `?${query}` : "";
      router.push(`${LEAD_REPORT_BASE}/${periodId}${suffix}`);
    },
    [router, searchParams, urlBuilder],
  );
}

// Periods are ordered newest-first, so "previous" walks up the index.
function usePeriodSelection({
  periods,
  currentPeriodId,
  selectedSubmitted,
}: Omit<PeriodNavigatorArgs, "urlBuilder">) {
  const pathReportId = usePathReportId(currentPeriodId);

  const currentIndex = useMemo(() => {
    const resolvedPeriodId = currentPeriodId ?? pathReportId;
    if (!resolvedPeriodId) return 0; // default to first (current) period
    const index = periods.findIndex((period) => period.id === resolvedPeriodId);
    return index !== -1 ? index : 0;
  }, [currentPeriodId, pathReportId, periods]);

  const selectedPeriod = periods.at(currentIndex);
  const options = useMemo(
    () => toPeriodOptions(periods, selectedSubmitted, selectedPeriod?.id),
    [periods, selectedSubmitted, selectedPeriod?.id],
  );

  return {
    currentIndex,
    selectedPeriod,
    options,
    hasPrev: currentIndex < periods.length - 1,
    hasNext: currentIndex > 0,
  };
}

// Period state for PeriodNavigator: which period is addressed, the listbox
// option models, and the two ways a neighbouring period is reached.
export function usePeriodNavigator({
  periods,
  currentPeriodId,
  urlBuilder,
  selectedSubmitted,
}: PeriodNavigatorArgs): {
  selection: PeriodNavigatorSelection;
  listbox: PeriodListboxNav;
} {
  // per-instance scoped listbox/option ids, so two navigators on one page
  // never collide on the DOM ids that aria-controls / aria-activedescendant
  // reference (see usePeriodListboxNav).
  const instanceId = useId();
  const { currentIndex, selectedPeriod, options, hasPrev, hasNext } =
    usePeriodSelection({ periods, currentPeriodId, selectedSubmitted });
  const navigateTo = useNavigateTo(urlBuilder);

  function goPrev() {
    const prev = periods.at(currentIndex + 1);
    if (hasPrev && prev) navigateTo(prev.id);
  }

  function goNext() {
    const next = periods.at(currentIndex - 1);
    if (hasNext && next) navigateTo(next.id);
  }

  const listbox = usePeriodListboxNav({
    instanceId,
    currentIndex,
    periodOptionIds: useMemo(() => options.map((o) => o.id), [options]),
    selectedPeriodId: selectedPeriod?.id,
    navigateTo,
    onPrev: goPrev,
    onNext: goNext,
  });

  return {
    selection: { selectedPeriod, options, hasPrev, hasNext, goPrev, goNext },
    listbox,
  };
}
