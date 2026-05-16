"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Archive, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";

import { logClientError } from "../../lib/client-error-reporting";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import {
  buildLeadSlidePeriodOptions,
  resolveLeadSlideReportId,
  visibleLeadSlidePeriodOptions,
  type LeadSlidePeriodOption,
} from "./lead-slide-periods";
import { SlideSkeleton } from "./slide-skeleton";
import { StatusSlideDeck } from "./status-slide-deck";
import { buildSectionSlideModel } from "./section-slide-utils";

function SlideEmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {message}
      </p>
    </div>
  );
}

function SlidePeriodToolbar({
  options,
  selectedReportId,
  archiveVisible,
  onArchiveChange,
  onSelectReport,
  reportEditHref,
}: {
  readonly options: readonly LeadSlidePeriodOption[];
  readonly selectedReportId: string;
  readonly archiveVisible: boolean;
  readonly onArchiveChange: (visible: boolean) => void;
  readonly onSelectReport: (reportId: string) => void;
  readonly reportEditHref: string;
}) {
  const currentIndex = options.findIndex(
    (option) => option.reportId === selectedReportId,
  );
  const selected = currentIndex >= 0 ? options[currentIndex] : null;
  const selectedStatusLabel = selected
    ? selected.current
      ? "Current period"
      : selected.archived
        ? "Archived period"
        : "Historical period"
    : "Period not found";
  const selectedStatusClass = selected
    ? selected.current
      ? "border-[rgba(0,117,74,0.35)] text-[var(--color-starbucks-accent)]"
      : selected.archived
        ? "border-[rgba(0,0,0,0.18)] text-[var(--color-muted-foreground)]"
        : "border-[rgba(212,160,23,0.45)] text-[#725313]"
    : "border-[rgba(0,0,0,0.18)] text-[var(--color-muted-foreground)]";
  const older = currentIndex >= 0 ? options[currentIndex + 1] : undefined;
  const newer = currentIndex > 0 ? options[currentIndex - 1] : undefined;

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    onSelectReport(event.target.value);
  }

  const editModeClass =
    "bg-white border-[var(--color-border)] text-[var(--color-muted-foreground)]";
  const slidesModeClass =
    "bg-[var(--color-surface)] border-[var(--color-starbucks-accent)] text-[var(--color-foreground)]";

  return (
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-white/75 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white">
            <Link
              href={reportEditHref}
              className={[
                "inline-flex h-10 min-w-[84px] items-center justify-center gap-1 px-3 text-sm font-semibold border transition-colors",
                editModeClass,
              ].join(" ")}
              aria-label="Open report editing mode"
            >
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              Edit
            </Link>
            <button
              type="button"
              className={[
                "inline-flex h-10 min-w-[84px] items-center justify-center gap-1 px-3 text-sm font-semibold border",
                slidesModeClass,
              ].join(" ")}
              aria-label="Current mode: slides"
            >
              Slides
            </button>
          </div>
          <button
            type="button"
            onClick={() => older && onSelectReport(older.reportId)}
            disabled={!older}
            aria-label="Previous period"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <select
          value={selected?.reportId ?? ""}
          onChange={handleSelect}
          aria-label="Select slide period"
          className="min-h-10 min-w-[220px] flex-1 cursor-pointer rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,117,74,0.16)]"
        >
          {options.map((option) => (
            <option key={option.reportId} value={option.reportId}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          className={[
            "hidden min-w-0 items-center rounded-[var(--radius-pill)] border bg-white px-3 py-1 text-xs font-semibold sm:inline-flex",
            selectedStatusClass,
          ].join(" ")}
        >
          {selectedStatusLabel}
        </span>
        <button
          type="button"
          onClick={() => newer && onSelectReport(newer.reportId)}
          disabled={!newer}
          aria-label="Next period"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <label className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-foreground)]">
        <input
          type="checkbox"
          checked={archiveVisible}
          onChange={(event) => onArchiveChange(event.currentTarget.checked)}
          className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
        />
        <Archive className="h-4 w-4" aria-hidden="true" />
        Archive
      </label>
    </div>
  );
}

type LeadSlidesClientProps = {
  readonly initialReportId?: string | null;
  readonly chrome?: "full" | "content";
};

export function LeadSlidesClient({
  initialReportId = null,
  chrome = "full",
}: LeadSlidesClientProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useContext(SessionContext);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const showChrome = chrome === "full";

  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const activeReportId = activeQ.data?.reportId ?? null;
  const inReportMode = pathname?.startsWith("/lead/report/");
  const requestedReportId = inReportMode
    ? initialReportId
    : searchParams.get("reportId");
  const periodOptions = useMemo(
    () => buildLeadSlidePeriodOptions(historyQ.data ?? [], activeReportId),
    [historyQ.data, activeReportId],
  );
  const targetReportId = useMemo(
    () =>
      resolveLeadSlideReportId({
        options: periodOptions,
        requestedReportId,
        activeReportId,
      }),
    [periodOptions, requestedReportId, activeReportId],
  );
  const selectedPeriod =
    periodOptions.find((option) => option.reportId === targetReportId) ?? null;
  const archiveVisible =
    showArchive ||
    selectedPeriod?.archived === true ||
    (periodOptions.length > 0 &&
      periodOptions.every((option) => option.archived));
  const visiblePeriodOptions = useMemo(
    () =>
      visibleLeadSlidePeriodOptions({
        options: periodOptions,
        includeArchive: archiveVisible,
        selectedReportId: targetReportId,
      }),
    [archiveVisible, periodOptions, targetReportId],
  );
  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({ reportId: targetReportId }),
    enabled: targetReportId !== "",
  });

  const navigateToReport = useCallback(
    (reportId: string) => {
      if (inReportMode) {
        const normalized = "/lead/report/" + encodeURIComponent(reportId) + "?mode=slides";
        router.push(normalized);
        return;
      }
      const next = new URLSearchParams(searchParams.toString());
      if (activeReportId && reportId === activeReportId) {
        next.delete("reportId");
      } else {
        next.set("reportId", reportId);
      }
      const query = next.toString();
      router.push((pathname || "/lead/slides") + (query ? "?" + query : ""));
    },
    [activeReportId, inReportMode, pathname, router, searchParams],
  );

  function handleArchiveChange(visible: boolean) {
    setShowArchive(visible);
    if (!visible && selectedPeriod?.archived) {
      const fallback =
        periodOptions.find((option) => !option.archived) ?? periodOptions[0];
      if (fallback) navigateToReport(fallback.reportId);
    }
  }

  useEffect(() => {
    if (!activeQ.isError) return;
    logClientError("leadSlides.getActive.load_failed", activeQ.error, {
      component: "LeadSlidesClient",
      procedure: "reports.getActive",
    });
  }, [activeQ.isError, activeQ.error]);

  useEffect(() => {
    if (!byPeriodQ.isError) return;
    logClientError("leadSlides.byPeriod.load_failed", byPeriodQ.error, {
      component: "LeadSlidesClient",
      procedure: "leadForm.byPeriod",
      reportId: targetReportId || null,
    });
  }, [byPeriodQ.isError, byPeriodQ.error, targetReportId]);

  const slides = useMemo(() => {
    if (!byPeriodQ.data?.section) return [];
    return [buildSectionSlideModel(byPeriodQ.data.section)];
  }, [byPeriodQ.data]);

  if (activeQ.isLoading || byPeriodQ.isLoading || historyQ.isLoading) {
    return <SlideSkeleton />;
  }

  if (activeQ.isError || byPeriodQ.isError || historyQ.isError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the report data is available."
      />
    );
  }

  if (!targetReportId) {
    return (
      <SlideEmptyState
        title="No active slide"
        message="There is no report section available for this session."
      />
    );
  }

  return (
      <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      title={inReportMode ? "Report slides" : "My Status Slides"}
      subtitle={
        inReportMode
          ? "Report sections grouped by product and SDLC stage."
          : "Current section grouped by product and SDLC stage."
      }
      groupLabel={inReportMode ? null : session?.user?.reportingGroupName ?? null}
      sourceHref={"/lead/report/" + encodeURIComponent(targetReportId)}
      sourceLabel="Open source section"
      hideSourceLink={inReportMode}
      mode="lead"
      showChrome={showChrome}
      toolbar={showChrome ? (
        <SlidePeriodToolbar
          options={visiblePeriodOptions}
          selectedReportId={targetReportId}
          archiveVisible={archiveVisible}
          reportEditHref={targetReportId
            ? "/lead/report/" + encodeURIComponent(targetReportId)
            : "/lead/report"}
          onArchiveChange={handleArchiveChange}
          onSelectReport={navigateToReport}
        />
      ) : undefined}
    />
  );
}
