'use client';

import { useState } from 'react';

import type { VersionSnapshot } from './mock-data';

type VersionHistoryNavProps = {
  readonly versions: VersionSnapshot[];
  readonly onRestore?: (version: number) => void;
  /**
   * When provided, renders a "Save Version" button next to the v# pill.
   * Clicking creates an explicit checkpoint via leadForm.createSnapshot
   * (parent-owned mutation, surfaced as a toast). Hidden in read-only /
   * submitted contexts where snapshots are meaningless.
   */
  readonly onSaveVersion?: () => void;
  /** Set false to gray out the Save Version button (e.g. mid-mutation). */
  readonly canSaveVersion?: boolean;
};

// Chevron icons — same family used by PeriodNavigator. The two control
// groups (period vs version) sit on the same toolbar row, so the same
// chevron + the same button shell makes them feel like one consistent
// nav system. Disambiguation comes from the labels next to each group
// (Calendar+Week for period, version pill for version), not from
// invented icon shapes that confused more than they helped.
function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

function SaveIcon() {
  // Floppy-disk save icon — leans into the "checkpoint" mental model that
  // sits well next to the v# pill. Same stroke-width as the rest of the
  // toolbar icons so the row feels uniform.
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

// Default number of versions to show inside the history modal before revealing
// the rest via a "Show all" button. v5.0 has no server-side cursor for
// `leadForm.versions` (returns the full array in one call), so we paginate
// client-side. Tracked as a deferral in the plan SUMMARY.
const VERSIONS_INITIAL_VISIBLE = 5;

/**
 * Compute the count delta of `v` relative to its parent (`prev`).
 * Returns null when both are zero — nothing to show.
 *
 * Versions arrive newest-first, so `prev` is the next item in the
 * array (i.e. the older sibling). For the very oldest version `prev`
 * is undefined; we treat it as a clean baseline (no diff line).
 */
function diffSummary(
  v: VersionSnapshot,
  prev: VersionSnapshot | undefined,
): { items: number; risks: number; decisions: number } | null {
  if (!prev) return null;
  const items = v.itemCount - prev.itemCount;
  const risks = v.riskCount - prev.riskCount;
  const decisions = v.decisionCount - prev.decisionCount;
  if (items === 0 && risks === 0 && decisions === 0) return null;
  return { items, risks, decisions };
}

function formatDiff(delta: number, label: string): string | null {
  if (delta === 0) return null;
  const sign = delta > 0 ? '+' : '−';
  const verb = delta > 0 ? 'added' : 'removed';
  return `${sign}${Math.abs(delta)} ${label} ${verb}`;
}

export function VersionHistoryNav({
  versions,
  onRestore,
  onSaveVersion,
  canSaveVersion = true,
}: VersionHistoryNavProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const currentVersion = versions[currentIndex];
  const hasPrev = currentIndex < versions.length - 1;
  const hasNext = currentIndex > 0;
  const isLatest = currentIndex === 0;

  function handlePrev() {
    if (hasPrev) setCurrentIndex((i) => i + 1);
  }

  function handleNext() {
    if (hasNext) setCurrentIndex((i) => i - 1);
  }

  function handleRestore(version: number) {
    onRestore?.(version);
    setShowModal(false);
    setCurrentIndex(0);
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span className="truncate text-xs text-[var(--color-muted-foreground)]">Editing version</span>

        <button
          type="button"
          className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
          onClick={handlePrev}
          disabled={!hasPrev}
          title={hasPrev ? `Previous version (v${versions[currentIndex + 1]?.version})` : 'No older version'}
          aria-label="Previous version"
        >
          <ChevronLeft />
        </button>

        <button
          type="button"
          className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-lg border border-[var(--color-muted)] bg-[var(--color-background)] px-2.5 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none"
          onClick={() => setShowModal(true)}
          title="View version history — compare and roll back"
        >
          <HistoryIcon />
          v{currentVersion?.version}
        </button>

        <button
          type="button"
          className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
          onClick={handleNext}
          disabled={!hasNext}
          title={isLatest ? 'Latest version' : 'Next version'}
          aria-label="Next version"
        >
          <ChevronRight />
        </button>

        {/* Save Version — manual checkpoint. Hidden in read-only / submitted
            contexts where snapshots can't change anything. Auto-snapshots
            (every 10 successful autosaves) come from the autosave hook;
            this button is purely user-initiated. */}
        {onSaveVersion && (
          <button
            type="button"
            className="flex min-h-[var(--touch-target-min)] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
            onClick={onSaveVersion}
            disabled={!canSaveVersion}
            title="Save Version — checkpoint the current draft"
            aria-label="Save Version"
          >
            <SaveIcon />
          </button>
        )}
      </div>

      {/* Version History Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-lg rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Version history"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
                Version History
              </h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)]"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              {(showAllVersions
                ? versions
                : versions.slice(0, VERSIONS_INITIAL_VISIBLE)
              ).map((v, idx, arr) => {
                // Diff against the preceding (older) sibling. Versions
                // arrive newest-first so `arr[idx + 1]` is the parent.
                const diff = diffSummary(v, arr[idx + 1]);
                const diffParts = diff
                  ? [
                      formatDiff(diff.items, 'items'),
                      formatDiff(diff.risks, 'risks'),
                      formatDiff(diff.decisions, 'decisions'),
                    ].filter((s): s is string => s !== null)
                  : [];
                return (
                  <div
                    key={v.version}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{
                      background: idx === currentIndex ? 'var(--color-success)' : 'var(--color-background)',
                      border: idx === currentIndex ? '1.5px solid var(--color-starbucks-accent)' : '1.5px solid transparent',
                    }}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold">
                        Version {v.version}
                        {idx === 0 && (
                          <span className="ml-2 text-[10px] font-medium text-[var(--color-starbucks-accent)]">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--color-muted-foreground)]">
                        {v.timestamp} &middot; {v.itemCount} items &middot; {v.riskCount} risks &middot; {v.decisionCount} decisions
                      </div>
                      {diffParts.length > 0 && (
                        // Diff vs previous version — count-level only (no
                        // content compare; needs a server-side history
                        // store to do that). Renders coloured by direction:
                        // adds in green, removes in red, mixed in muted.
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                          {diffParts.map((part) => {
                            const isAdd = part.startsWith('+');
                            return (
                              <span
                                key={part}
                                className="font-medium"
                                style={{
                                  color: isAdd
                                    ? 'var(--color-starbucks-accent)'
                                    : 'var(--color-destructive)',
                                }}
                              >
                                {part}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {idx !== 0 && (
                      <button
                        type="button"
                        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-3 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
                        onClick={() => handleRestore(v.version)}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {versions.length > VERSIONS_INITIAL_VISIBLE && !showAllVersions && (
              <button
                type="button"
                className="mt-3 w-full rounded-md border border-[var(--color-border)] bg-transparent py-2 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
                onClick={() => setShowAllVersions(true)}
                aria-label={`Show all ${versions.length} versions`}
              >
                Show all ({versions.length})
              </button>
            )}

            <p className="mt-4 text-[11px] text-[var(--color-muted-foreground)]">
              Editing from a past version will discard all newer versions. This action cannot be undone.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
