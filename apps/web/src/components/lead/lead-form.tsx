'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';
import {
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateDashboard,
} from '../../lib/cache-keys';
import { mapLeadFormData } from '../../lib/mappers';
import { useLeadFormAutosave, stableStringify } from '../../hooks/use-lead-form-autosave';
import { LeadFormSkeleton } from './lead-form-skeleton';
import { LeadFormSyncBridge } from './lead-form-sync-bridge';
import { SdlcTooltipProvider } from '../ui/sdlc-tooltip';
import { PeriodNavigator } from './period-navigator';
import { FillFromButton } from './fill-from-button';
import { VersionHistoryNav } from './version-history-nav';
import { CurrentWeekSection } from './current-week-section';
import { NextWeekSection } from './next-week-section';
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

import type {
  ReportSectionReadModel,
  DraftSavePayload,
} from '@customreport/shared';

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

/**
 * Build a `draftSaveSchema`-compatible payload from the raw API section. The
 * raw shape carries every field the schema requires (owner/impact on
 * decisions, tag/workflowStatus on items, etc.) so this round-trips cleanly.
 */
function sectionToDraftPayload(section: ReportSectionReadModel): DraftSavePayload {
  // Drop rows whose required text fields are empty or whitespace-only. The
  // server's safeText({min:1}) Zod refinement rejects them, which would
  // otherwise produce "Save failed" toast every time the user clicks
  // "+ Add Risk/Decision/Item" before typing. Empty rows live only in
  // local UI state until the user fills them in; once any required field
  // becomes non-empty the row joins the autosave payload.
  const hasText = (s: string | null | undefined) => typeof s === 'string' && s.trim().length > 0;
  return {
    reportSectionId: section.reportSectionId,
    status: 'draft',
    projectStatuses: section.projects.map((p) => ({
      projectId: p.projectId,
      status: p.trafficLight ?? undefined,
    })),
    items: section.items
      .filter((it) => hasText(it.text))
      .map((it) => ({
        id: it.id,
        projectId: it.projectId,
        type: it.type,
        text: it.text,
        tag: it.tag,
        workflowStatus: it.workflowStatus,
        carriedOver: it.carriedOver ?? false,
        completed: it.completed ?? null,
      })),
    risks: section.risks
      .filter((r) => hasText(r.risk) && hasText(r.mitigation))
      .map((r) => ({
        id: r.id,
        projectId: r.projectId,
        risk: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
      })),
    decisions: section.decisions
      .filter((d) => hasText(d.text))
      .map((d) => ({
        id: d.id,
        text: d.text,
        owner: d.owner,
        deadline: d.deadline ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt ?? null,
      })),
    priorities: section.priorities
      .filter((p) => hasText(p.text))
      .map((p) => ({
        id: p.id,
        rank: p.rank,
        text: p.text,
      })),
  };
}

export function LeadForm({ period }: LeadFormProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

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

  // ---- Local UI + draft state ----
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Draft mirror of the raw API section. Saving + submitting use this; child
  // edits merge field-level changes back by id while preserving every required
  // schema field that the lossy Lead* mappers drop (owner/impact/etc).
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);

  // Re-seed local state whenever the server-side section changes (initial load
  // or post-mutation invalidation).
  useEffect(() => {
    if (byPeriodQ.data?.section) {
      setDraftSection(byPeriodQ.data.section);
      setIsSubmitted(byPeriodQ.data.section.status === 'submitted');
    }
  }, [byPeriodQ.data]);

  // ---- Mutations ----
  const submitMut = useMutation(
    trpc.reports.submit.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(true);
        setShowSubmitConfirm(false);
        toast.success('Report submitted');
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Submit failed';
        toast.error(msg);
      },
    }),
  );

  const revokeMut = useMutation(
    trpc.leadForm.revoke.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        setIsSubmitted(false);
        toast.success('Section unlocked');
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Revoke failed';
        toast.error(msg);
      },
    }),
  );

  const fillFromMut = useMutation(
    trpc.leadForm.fillFrom.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        toast.success('Form filled from selected period');
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Fill from failed';
        toast.error(msg);
      },
    }),
  );

  const restoreMut = useMutation(
    trpc.leadForm.restoreVersion.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        toast.success('Version restored');
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Restore failed';
        toast.error(msg);
      },
    }),
  );

  // ---- Build draft payload ----
  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );

  const isLoading =
    activeQ.isLoading ||
    byPeriodQ.isLoading ||
    versionsQ.isLoading ||
    historyQ.isLoading;

  // Compute readOnly early (before hook; the autosave hook needs it). When
  // data isn't ready, treat as readOnly (autosave disabled).
  const isReadOnlyEarly =
    !!period ||
    isSubmitted ||
    (byPeriodQ.data ? byPeriodQ.data.readOnly : true);

  // Compute the baseline key from the *server-side* section so the autosave
  // hook treats freshly-loaded data as already-saved (no dirty flicker).
  const initialSavedKey = useMemo(() => {
    if (!byPeriodQ.data?.section) return null;
    return stableStringify(sectionToDraftPayload(byPeriodQ.data.section));
  }, [byPeriodQ.data]);

  // Autosave wiring — runs unconditionally to keep hook order stable.
  const autosave = useLeadFormAutosave({
    reportSectionId: activeSectionId || null,
    payload: draftPayload,
    enabled: !isReadOnlyEarly && !isSubmitted && draftSection !== null,
    initialSavedKey,
  });

  // Skeleton until all queries settle.
  if (
    isLoading ||
    !activeQ.data ||
    !byPeriodQ.data ||
    !versionsQ.data ||
    !historyQ.data ||
    !draftSection
  ) {
    return <LeadFormSkeleton />;
  }

  // Map raw draft state -> Lead* presentation shapes for existing children.
  const data = mapLeadFormData({
    active: activeQ.data,
    byPeriod: { section: draftSection, readOnly: byPeriodQ.data.readOnly },
    versions: versionsQ.data,
    history: historyQ.data,
  });

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

  // ---- onChange merge handlers ----
  // Decisions: merge text edits / additions / deletions back into raw section
  // by id, preserving owner/impact/deadline/resolvedAt fields the mapper drops
  // for existing rows. Newly-added rows (ids unseen in `prev`) are appended
  // with safe schema defaults (owner/impact default to '' — the safeText
  // helper accepts empty strings).
  function handleDecisionsChange(next: DecisionEntry[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      const existingById = new Map(
        prev.decisions.filter((d) => d.id).map((d) => [d.id!, d] as const),
      );
      const merged = next.map((d) => {
        const existing = existingById.get(d.id);
        if (existing) {
          return { ...existing, text: d.text };
        }
        return {
          id: d.id,
          text: d.text,
          owner: '',
          deadline: null,
          impact: '',
          resolvedAt: null,
        };
      });
      return { ...prev, decisions: merged };
    });
  }

  function handleProductsChange(next: Product[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      // Map presentation Product[] (with stage statuses) back onto raw projects.
      // Mirror the *worst* status across stages onto the report-level traffic light.
      const worstByProduct = new Map<string, 'green' | 'yellow' | 'red'>();
      for (const p of next) {
        let worst: 'green' | 'yellow' | 'red' = 'green';
        for (const s of p.stages) {
          if (s.status === 'blocked') worst = 'red';
          else if (s.status === 'at-risk' && worst !== 'red') worst = 'yellow';
        }
        worstByProduct.set(p.id, worst);
      }
      const merged = prev.projects.map((ps) =>
        worstByProduct.has(ps.projectId)
          ? { ...ps, trafficLight: worstByProduct.get(ps.projectId)! }
          : ps,
      );
      return { ...prev, projects: merged };
    });
  }

  function handleRisksChange(next: RiskEntry[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      // Merge presentation risks back into raw section. RiskEntry has
      // { id, productId, productName, stageName, severity, text }.
      // Raw section.risks has { id, projectId, risk, impact, mitigation }.
      const existingById = new Map(prev.risks.filter((r) => r.id).map((r) => [r.id!, r] as const));
      const merged = next.map((r) => {
        const existing = r.id ? existingById.get(r.id) : undefined;
        if (existing) {
          return { ...existing, risk: r.text };
        }
        return {
          id: r.id ?? `tmp-${crypto.randomUUID()}`,
          projectId: r.productId,
          risk: r.text,
          impact: r.severity === 'blocked' ? 'high' : 'medium',
          mitigation: '',
        };
      });
      return { ...prev, risks: merged };
    });
  }

  function handlePrioritiesChange(next: PriorityEntry[]) {
    setDraftSection((prev) => {
      if (!prev) return prev;
      // Upsert by rank: ranks 1/2/3 are the stable identity in the UI. For
      // each rank in the next array, update the existing raw priority if
      // present, otherwise insert a new one (preserving any other ranks the
      // user hasn't touched). Newly-inserted rows omit `id` so the server
      // assigns one on save.
      const existingByRank = new Map(prev.priorities.map((p) => [p.rank, p] as const));
      const merged = next.map((p) => {
        const existing = existingByRank.get(p.rank);
        if (existing) {
          return { ...existing, text: p.text };
        }
        return { rank: p.rank, text: p.text };
      });
      // Preserve any ranks the UI does not own (defensive — current UI emits
      // 1/2/3 only).
      const presentRanks = new Set(merged.map((p) => p.rank));
      const preserved = prev.priorities.filter((p) => !presentRanks.has(p.rank));
      const all = [...preserved, ...merged].sort((a, b) => a.rank - b.rank);
      return { ...prev, priorities: all };
    });
  }

  // Items: the section emits a presentation `KanbanItem[]` for one type
  // (current or next). Merge it back into raw `draftSection.items` while
  // preserving cross-type entries. For existing ids we keep the raw item's
  // tag/workflowStatus/carriedOver/completed; for new ids we fill schema
  // defaults so the row round-trips through `draftSaveSchema`.
  function makeItemsChangeHandler(itemType: 'current' | 'next') {
    return (next: KanbanItem[]) => {
      setDraftSection((prev) => {
        if (!prev) return prev;
        const existingById = new Map(
          prev.items
            .filter((it) => it.type === itemType && it.id)
            .map((it) => [it.id!, it] as const),
        );
        const mergedTyped = next.map((kb) => {
          const existing = existingById.get(kb.id);
          if (existing) {
            return { ...existing, text: kb.text };
          }
          return {
            id: kb.id,
            projectId: kb.productId,
            type: itemType,
            text: kb.text,
            tag: '',
            workflowStatus: 'in_progress' as const,
            carriedOver: false,
            completed: null,
          };
        });
        // Keep all items of the OTHER type unchanged; replace this type with
        // the merged set.
        const others = prev.items.filter((it) => it.type !== itemType);
        return { ...prev, items: [...others, ...mergedTyped] };
      });
    };
  }

  const handleCurrentWeekItemsChange = makeItemsChangeHandler('current');
  const handleNextWeekItemsChange = makeItemsChangeHandler('next');

  // ---- Action handlers ----
  function handleSubmit() {
    setShowSubmitConfirm(true);
  }

  function handleConfirmSubmit() {
    if (!draftPayload) return;
    // submitSectionSchema requires every projectStatus to have a non-null
    // status. Coerce undefined -> green optimistically; the server will
    // reject if any are still invalid and toast the error.
    const projectStatuses = draftPayload.projectStatuses.map((p) => ({
      projectId: p.projectId,
      status: p.status ?? ('green' as const),
    }));
    submitMut.mutate({
      ...draftPayload,
      projectStatuses,
      confirmed: true,
    });
  }

  function handleRevoke() {
    if (!activeSectionId) return;
    revokeMut.mutate({ reportSectionId: activeSectionId });
  }

  function handleFillFrom(sourceSectionId: string) {
    if (!activeSectionId) return;
    if (
      autosave.dirty &&
      !window.confirm('You have unsaved changes. Continue and overwrite?')
    ) {
      return;
    }
    fillFromMut.mutate({ targetSectionId: activeSectionId, sourceSectionId });
  }

  function handleRestoreVersion(version: number) {
    if (!activeSectionId) return;
    if (
      autosave.dirty &&
      !window.confirm('You have unsaved changes. Continue and overwrite?')
    ) {
      return;
    }
    restoreMut.mutate({ reportSectionId: activeSectionId, version });
  }

  function handleToggleAll() {
    // Visual placeholder; individual accordion state owns its own toggle.
  }

  // Autosave indicator label.
  const autosaveLabel =
    autosave.state === 'saving'
      ? 'Saving...'
      : autosave.state === 'pending'
        ? 'Pending...'
        : autosave.state === 'saved' && autosave.lastSavedAt
          ? `Saved at ${autosave.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : autosave.state === 'error'
            ? 'Save failed'
            : 'Autosaved';

  return (
    <SdlcTooltipProvider>
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
                {autosaveLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <FillFromButton
              periods={periods}
              disabled={isReadOnly || fillFromMut.isPending}
              onFillFrom={handleFillFrom}
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
            {isSubmitted && (
              <button
                type="button"
                className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleRevoke}
                disabled={revokeMut.isPending}
                title="Revoke submission and unlock the section"
              >
                Revoke
              </button>
            )}
            <button
              type="button"
              className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSubmit}
              disabled={isReadOnly || submitMut.isPending}
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
            <VersionHistoryNav versions={versions} onRestore={handleRestoreVersion} />
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

        <LeadFormSyncBridge.Provider
          products={products}
          risks={risks}
          onProductsChange={handleProductsChange}
          onRisksChange={handleRisksChange}
          readOnly={isReadOnly}
          {...(activeSectionId ? { sectionId: activeSectionId } : {})}
        >
          {/* Product Status (SDLC Pipeline) */}
          <AccordionSection
            icon={<GridIcon />}
            title="Product Status"
            badge={`${products.length} assigned products`}
            subtitle="Assigned stages are highlighted. Blocked and at-risk stages link to the context you need to resolve them."
          >
            <LeadFormSyncBridge.Pipeline />
          </AccordionSection>

          {/* Current Week */}
          <AccordionSection
            icon={<CalendarIcon />}
            title="Current Week"
            badge={`${currentWeekItems.length} items`}
          >
            <CurrentWeekSection
              items={currentWeekItems}
              readOnly={isReadOnly}
              onItemsChange={handleCurrentWeekItemsChange}
              currentUserName={currentUser.name}
            />
          </AccordionSection>

          {/* Next Week */}
          <AccordionSection
            icon={<NextWeekIcon />}
            title="Next Week"
            badge={`${nextWeekItems.length} items`}
          >
            <NextWeekSection
              items={nextWeekItems}
              readOnly={isReadOnly}
              onItemsChange={handleNextWeekItemsChange}
              currentUserName={currentUser.name}
            />
          </AccordionSection>

          {/* Risks & Blockers */}
          <AccordionSection
            icon={<AlertIcon />}
            title="Risks & Blockers"
            titleColor="var(--color-destructive)"
            badge={`${risks.length}`}
            badgeStyle={{ background: '#fee2e2', color: 'var(--color-destructive)' }}
          >
            <LeadFormSyncBridge.Risks />
          </AccordionSection>
        </LeadFormSyncBridge.Provider>

        {/* Decisions */}
        <AccordionSection
          icon={<ChatIcon />}
          title="Decisions"
          titleColor="var(--color-starbucks-accent)"
          badge={`${decisions.length}`}
          badgeStyle={{ background: 'var(--color-success)', color: 'var(--color-starbucks-accent)' }}
        >
          <DecisionsSection
            decisions={decisions}
            readOnly={isReadOnly}
            onChange={handleDecisionsChange}
          />
        </AccordionSection>

        {/* Top 3 Priorities */}
        <AccordionSection
          icon={<StarIcon />}
          title="Top 3 Priorities"
          titleColor="var(--color-starbucks-gold)"
          badge={`${Math.min(priorities.length, 3)}/3`}
        >
          <PrioritiesSection
            priorities={priorities}
            readOnly={isReadOnly}
            onChange={handlePrioritiesChange}
          />
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
                className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleConfirmSubmit}
                disabled={submitMut.isPending}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </SdlcTooltipProvider>
  );
}
