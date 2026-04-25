'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';
import { mapLeadFormData } from '../../lib/mappers';
import { LeadFormSkeleton } from './lead-form-skeleton';
import { SdlcPipeline } from './sdlc-pipeline';
import { PeriodNavigator } from './period-navigator';
import { FillFromButton } from './fill-from-button';
import { VersionHistoryNav } from './version-history-nav';
import { CurrentWeekSection } from './current-week-section';
import { NextWeekSection } from './next-week-section';
import { RisksSection } from './risks-section';
import { DecisionsSection } from './decisions-section';
import { PrioritiesSection } from './priorities-section';

import type {
  Product,
  KanbanItem,
  RiskEntry,
  DecisionEntry,
  PriorityEntry,
  ReportPeriod,
  VersionSnapshot,
} from './mock-data';

type LeadFormProps = {
  readonly period?: string;
};

// SVG Icon components
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" stroke="var(--color-primary)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M3 14h7v7H3z" /><path d="M14 14h7v7h-7z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" stroke="var(--color-primary)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function NextWeekIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" stroke="var(--color-primary)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M12 16l3-3-3-3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" stroke="var(--color-destructive)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" stroke="var(--color-starbucks-accent)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" stroke="var(--color-starbucks-gold)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2}>
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

function ChevronDown({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

type AccordionSectionProps = {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly titleColor?: string;
  readonly badge?: string;
  readonly badgeStyle?: React.CSSProperties;
  readonly subtitle?: string;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
};

function AccordionSection({
  icon,
  title,
  titleColor = 'var(--color-primary)',
  badge,
  badgeStyle,
  subtitle,
  defaultOpen = true,
  children,
}: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_12px_26px_-18px_rgba(0,0,0,0.22),0_2px_4px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        className="flex w-full items-center justify-between p-5 transition-colors hover:bg-[#f8f6f2]"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div>
          <div className="flex items-center gap-3">
            {icon}
            <span
              className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em]"
              style={{ color: titleColor }}
            >
              {title}
            </span>
            {badge && (
              <span
                className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]"
                style={badgeStyle}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
              {subtitle}
            </span>
          )}
        </div>
        <ChevronDown expanded={expanded} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LeadForm({ period }: LeadFormProps) {
  const trpc = useTRPC();

  // Four queries compose the lead-form view. `byPeriod` and `versions` depend
  // on identifiers from `getActive`, so they're gated by `enabled`.
  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const activeReportId = activeQ.data?.reportId ?? '';
  const activeSectionId = activeQ.data?.reportSectionId ?? '';

  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({ reportId: activeReportId }),
    enabled: activeReportId !== '',
  });
  const versionsQ = useQuery({
    ...trpc.leadForm.versions.queryOptions({ reportSectionId: activeSectionId }),
    enabled: activeSectionId !== '',
  });
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());

  // Toast on per-query errors.
  useEffect(() => {
    if (activeQ.isError) {
      toast.error(
        activeQ.error instanceof Error
          ? `Failed to load active report: ${activeQ.error.message}`
          : 'Failed to load active report',
      );
    }
  }, [activeQ.isError, activeQ.error]);

  useEffect(() => {
    if (byPeriodQ.isError) {
      toast.error(
        byPeriodQ.error instanceof Error
          ? `Failed to load form: ${byPeriodQ.error.message}`
          : 'Failed to load form',
      );
    }
  }, [byPeriodQ.isError, byPeriodQ.error]);

  useEffect(() => {
    if (versionsQ.isError) {
      toast.error(
        versionsQ.error instanceof Error
          ? `Failed to load versions: ${versionsQ.error.message}`
          : 'Failed to load versions',
      );
    }
  }, [versionsQ.isError, versionsQ.error]);

  useEffect(() => {
    if (historyQ.isError) {
      toast.error(
        historyQ.error instanceof Error
          ? `Failed to load history: ${historyQ.error.message}`
          : 'Failed to load history',
      );
    }
  }, [historyQ.isError, historyQ.error]);

  // Local UI state (mutation handlers stay local-only in this plan).
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [autosaveStatus] = useState('Autosaved');

  // Re-seed isSubmitted from the API once data resolves.
  useEffect(() => {
    if (byPeriodQ.data?.section.status === 'submitted') {
      setIsSubmitted(true);
    }
  }, [byPeriodQ.data]);

  const isLoading =
    activeQ.isLoading ||
    byPeriodQ.isLoading ||
    versionsQ.isLoading ||
    historyQ.isLoading;

  // No active report bound to session — render skeleton (best effort) until
  // session populates a report. Active period auto-selection is a server-side
  // concern owned by middleware.
  if (
    isLoading ||
    !activeQ.data ||
    !byPeriodQ.data ||
    !versionsQ.data ||
    !historyQ.data
  ) {
    return <LeadFormSkeleton />;
  }

  const data = mapLeadFormData({
    active: activeQ.data,
    byPeriod: byPeriodQ.data,
    versions: versionsQ.data,
    history: historyQ.data,
  });

  // The mapper produces structurally compatible shapes but carries Lead*
  // type names; cast to mock-data presentation types so existing children
  // keep their imports unchanged.
  const products: Product[] = data.products as Product[];
  const currentWeekItems: KanbanItem[] = data.currentWeekItems as KanbanItem[];
  const nextWeekItems: KanbanItem[] = data.nextWeekItems as KanbanItem[];
  const risks: RiskEntry[] = data.risks as RiskEntry[];
  const decisions: DecisionEntry[] = data.decisions as DecisionEntry[];
  const priorities: PriorityEntry[] = data.priorities as PriorityEntry[];
  const periods: ReportPeriod[] = data.periods as ReportPeriod[];
  const versions: VersionSnapshot[] = data.versions as VersionSnapshot[];
  const currentUser = data.currentUser;

  const isReadOnly = data.readOnly || !!period || isSubmitted;

  function handleToggleAll() {
    // Toggle all is managed through individual accordion state;
    // for simplicity, this is a visual placeholder.
  }

  function handleSubmit() {
    // TODO(Phase 22): wire reports.submit mutation + invalidateLeadForm(qc, trpc) onSuccess
    setShowSubmitConfirm(true);
  }

  function handleConfirmSubmit() {
    // TODO(Phase 22): wire reports.submit mutation + invalidateLeadForm(qc, trpc) onSuccess
    setIsSubmitted(true);
    setShowSubmitConfirm(false);
  }

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              My Report
            </h1>
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white">
                Submitted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                {autosaveStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* TODO(Phase 22): wire leadForm.fillFrom mutation in onFillFrom */}
            <FillFromButton
              periods={periods}
              disabled={isReadOnly}
            />
            <button
              type="button"
              className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
              onClick={handleToggleAll}
              title="Toggle All"
            >
              <CollapseIcon />
              Toggle All
            </button>
            <button
              type="button"
              className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSubmit}
              disabled={isReadOnly}
            >
              Submit Report
            </button>
          </div>
        </header>

        {/* Context shell: Period nav + User info + Version history */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_10px_24px_-20px_rgba(0,0,0,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]">
          <PeriodNavigator periods={periods} />

          <div className="flex min-w-[220px] flex-1 items-center justify-center gap-2">
            <span className="text-sm text-[var(--color-muted-foreground)]">Development Department</span>
            <span className="text-[var(--color-muted-foreground)]">&middot;</span>
            <span className="text-sm text-[var(--color-muted-foreground)]">
              {currentUser.name} &middot; {currentUser.role}
            </span>
          </div>

          <div className="ml-auto">
            {/* TODO(Phase 22): wire leadForm.restoreVersion mutation in onRestore */}
            <VersionHistoryNav versions={versions} />
          </div>
        </div>

        {/* Submitted banner */}
        {isSubmitted && (
          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[var(--color-success)] p-4">
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0" stroke="var(--color-primary)" fill="none" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-sm font-medium text-[var(--color-primary)]">
              Report submitted. This form is now read-only.
            </span>
          </div>
        )}

        {/* Read-only banner for past periods */}
        {period && !isSubmitted && (
          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
            <span className="text-sm text-[var(--color-muted-foreground)]">
              Viewing past period &middot; {period}. This form is read-only.
            </span>
          </div>
        )}

        {/* Product Status (SDLC Pipeline) */}
        {/* TODO(Phase 22): wire reports.saveDraft on stage status change */}
        <AccordionSection
          icon={<GridIcon />}
          title="Product Status"
          badge={`${products.length} assigned products`}
          subtitle="Assigned stages are highlighted. Blocked and at-risk stages link to the context you need to resolve them."
        >
          <SdlcPipeline products={products} readOnly={isReadOnly} />
        </AccordionSection>

        {/* Current Week */}
        <AccordionSection
          icon={<CalendarIcon />}
          title="Current Week"
          badge={`${currentWeekItems.length} items`}
        >
          <CurrentWeekSection items={currentWeekItems} readOnly={isReadOnly} />
        </AccordionSection>

        {/* Next Week */}
        <AccordionSection
          icon={<NextWeekIcon />}
          title="Next Week"
          badge={`${nextWeekItems.length} items`}
        >
          <NextWeekSection items={nextWeekItems} readOnly={isReadOnly} />
        </AccordionSection>

        {/* Risks & Blockers */}
        {/* TODO(Phase 22): wire reports.saveDraft when risks change */}
        <AccordionSection
          icon={<AlertIcon />}
          title="Risks & Blockers"
          titleColor="var(--color-destructive)"
          badge={`${risks.length}`}
          badgeStyle={{ background: '#fee2e2', color: 'var(--color-destructive)' }}
        >
          <RisksSection risks={risks} readOnly={isReadOnly} />
        </AccordionSection>

        {/* Decisions */}
        {/* TODO(Phase 22): wire reports.saveDraft when decisions change */}
        <AccordionSection
          icon={<ChatIcon />}
          title="Decisions"
          titleColor="var(--color-starbucks-accent)"
          badge={`${decisions.length}`}
          badgeStyle={{ background: 'var(--color-success)', color: 'var(--color-starbucks-accent)' }}
        >
          <DecisionsSection decisions={decisions} readOnly={isReadOnly} />
        </AccordionSection>

        {/* Top 3 Priorities */}
        {/* TODO(Phase 22): wire reports.saveDraft when priorities change */}
        <AccordionSection
          icon={<StarIcon />}
          title="Top 3 Priorities"
          titleColor="var(--color-starbucks-gold)"
          badge={`${Math.min(priorities.length, 3)}/3`}
        >
          <PrioritiesSection priorities={priorities} readOnly={isReadOnly} />
        </AccordionSection>
      </div>

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm submission"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Submit Report?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Your report will be locked and visible to the department head.
              You will not be able to make changes after submission.
            </p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">current week items</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{nextWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">next week items</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{risks.length}</span>
                <span className="text-[var(--color-muted-foreground)]">risks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{decisions.length}</span>
                <span className="text-[var(--color-muted-foreground)]">decisions</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
                onClick={handleConfirmSubmit}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
