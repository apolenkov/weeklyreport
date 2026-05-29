"use client";

import { useEffect, useState } from "react";

import type { VersionSnapshot } from "./mock-data";
import { PERIOD_NAV_ARROW_BUTTON_CLASS } from "./period-navigator";

type VersionHistoryNavProps = {
  readonly versions: VersionSnapshot[];
  readonly onRestore?: (version: number) => void;
  /**
   * F3.4: Called when the user navigates to a historical version (version
   * number) or back to the latest (null). Used by lead-form.tsx to switch
   * into snapshot read-only view mode.
   */
  readonly onViewVersion?: (version: number | null) => void;
  /**
   * F3.4: When the parent resets the snapshot view (e.g. "Back to current"
   * button), pass null here so the nav pill syncs back to the latest version.
   * Pass the current version number to keep the nav in sync after a restore.
   */
  readonly viewedVersion?: number | null;
  // TODO(v8.5-B-pin): add `onPin?: (version: number, pinned: boolean) => void`
  // prop + ★ button in nav row — pin/unpin reverted in a95681f5/6d4726fe,
  // requires VersionSnapshot.kind enum change (plan section 15.4, cluster B).
};

// Chevron icons — same family used by PeriodNavigator. The two control
// groups (period vs version) sit on the same toolbar row, so the same
// chevron + the same button shell makes them feel like one consistent
// nav system. Disambiguation comes from the labels next to each group
// (Calendar+Week for period, version pill for version), not from
// invented icon shapes that confused more than they helped.
function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
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
  const sign = delta > 0 ? "+" : "−";
  const verb = delta > 0 ? "added" : "removed";
  return `${sign}${Math.abs(delta)} ${label} ${verb}`;
}

export function VersionHistoryNav({
  versions,
  onRestore,
  onViewVersion,
  viewedVersion,
}: VersionHistoryNavProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // F3.4: when the parent resets viewedVersion to null (e.g. "Back to current"
  // button), sync the nav pill back to the latest version (index 0).
  useEffect(() => {
    if (viewedVersion == null && currentIndex !== 0) {
      setCurrentIndex(0);
    }
  }, [viewedVersion, currentIndex]);
  const [showModal, setShowModal] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const currentVersion = versions[currentIndex];
  const hasPrev = currentIndex < versions.length - 1;
  const hasNext = currentIndex > 0;
  const isLatest = currentIndex === 0;

  function handlePrev() {
    if (!hasPrev) return;
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    // F3.4: notify parent — navigating away from latest → snapshot view mode.
    onViewVersion?.(versions[nextIndex]?.version ?? null);
  }

  function handleNext() {
    if (!hasNext) return;
    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
    // F3.4: notify parent — nextIndex 0 = latest (exit snapshot mode).
    onViewVersion?.(
      nextIndex === 0 ? null : (versions[nextIndex]?.version ?? null),
    );
  }

  function handleRestore(version: number) {
    if (
      !window.confirm(
        `Restore version v${version}? This will replace the current draft with the selected snapshot.`,
      )
    ) {
      return;
    }
    onRestore?.(version);
    setShowModal(false);
    setCurrentIndex(0);
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <button
          type="button"
          className={PERIOD_NAV_ARROW_BUTTON_CLASS}
          onClick={handlePrev}
          disabled={!hasPrev}
          title={
            hasPrev
              ? `Previous version (v${versions[currentIndex + 1]?.version})`
              : "No older version"
          }
          aria-label="Previous version"
        >
          <ChevronLeft />
          <span className="text-xs font-medium xl:hidden">Previous</span>
        </button>

        <button
          type="button"
          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--color-muted)] bg-[var(--color-background)] px-2 font-[family-name:var(--font-sans)] text-[12px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none"
          onClick={() => setShowModal(true)}
          title="Snapshots and edits within this report"
          aria-label={`Version ${currentVersion?.version ?? "—"} — open history`}
        >
          <span className="inline-block w-[36px] text-center text-xs font-medium tabular-nums">
            v{currentVersion?.version}
          </span>
        </button>

        <button
          type="button"
          className={PERIOD_NAV_ARROW_BUTTON_CLASS}
          onClick={handleNext}
          disabled={!hasNext}
          title={isLatest ? "Latest version" : "Next version"}
          aria-label="Next version"
        >
          <span className="text-xs font-medium xl:hidden">Next</span>
          <ChevronRight />
        </button>
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
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
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
                      formatDiff(diff.items, "items"),
                      formatDiff(diff.risks, "risks"),
                      formatDiff(diff.decisions, "decisions"),
                    ].filter((s): s is string => s !== null)
                  : [];
                return (
                  <div
                    key={v.version}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{
                      background:
                        idx === currentIndex
                          ? "var(--color-success)"
                          : "var(--color-background)",
                      border:
                        idx === currentIndex
                          ? "1.5px solid var(--color-starbucks-accent)"
                          : "1.5px solid transparent",
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
                        {v.timestamp} &middot; {v.itemCount} items &middot;{" "}
                        {v.riskCount} risks &middot; {v.decisionCount} decisions
                      </div>
                      {diffParts.length > 0 && (
                        // Diff vs previous version — count-level only (no
                        // content compare; needs a server-side history
                        // store to do that). Renders coloured by direction:
                        // adds in green, removes in red, mixed in muted.
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                          {diffParts.map((part) => {
                            const isAdd = part.startsWith("+");
                            return (
                              <span
                                key={part}
                                className="font-medium"
                                style={{
                                  color: isAdd
                                    ? "var(--color-starbucks-accent)"
                                    : "var(--color-destructive)",
                                }}
                              >
                                {part}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {onRestore && idx !== 0 && (
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
              Editing from a past version will discard all newer versions. This
              action cannot be undone.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
