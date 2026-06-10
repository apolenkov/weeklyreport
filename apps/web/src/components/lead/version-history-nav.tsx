"use client";

import { useEffect, useState } from "react";

import type { VersionSnapshot } from "./mock-data";
import { PERIOD_NAV_ARROW_BUTTON_CLASS } from "./period-navigator";
import { VersionRow } from "./version-row";

interface VersionHistoryNavProps {
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
  /**
   * add-version-pin: Called when the user pins or unpins a version.
   * Any version can be toggled — not gated on isLatest (D4).
   */
  readonly onTogglePin?: (version: number, pinned: boolean) => void;
}

// Chevron icons — same family used by PeriodNavigator.
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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// Default number of versions to show before the "Show all" button.
const VERSIONS_INITIAL_VISIBLE = 5;

/**
 * Sort versions into pinned-first order (D4). Within each group the original
 * version order is preserved (stable — versions arrive newest-first).
 */
function sortPinnedFirst(versions: VersionSnapshot[]): VersionSnapshot[] {
  return [
    ...versions.filter((v) => v.pinned),
    ...versions.filter((v) => !v.pinned),
  ];
}

export function VersionHistoryNav({
  versions,
  onRestore,
  onViewVersion,
  viewedVersion,
  onTogglePin,
}: VersionHistoryNavProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // F3.4: sync nav pill back to latest when parent resets viewedVersion.
  useEffect(() => {
    if (viewedVersion == null && currentIndex !== 0) {
      setCurrentIndex(0);
    }
  }, [viewedVersion, currentIndex]);

  const [showModal, setShowModal] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const currentVersion = versions.at(currentIndex);
  const hasPrev = currentIndex < versions.length - 1;
  const hasNext = currentIndex > 0;
  const isLatest = currentIndex === 0;

  function handlePrev() {
    if (!hasPrev) return;
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    onViewVersion?.(versions[nextIndex]?.version ?? null);
  }

  function handleNext() {
    if (!hasNext) return;
    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
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

  const sortedForModal = sortPinnedFirst(versions);
  const visibleInModal = showAllVersions
    ? sortedForModal
    : sortedForModal.slice(0, VERSIONS_INITIAL_VISIBLE);
  const viewedVersionNumber = versions[currentIndex]?.version;
  const hasPinnedVersions = sortedForModal.some((v) => v.pinned);

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

            {hasPinnedVersions && (
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-starbucks-accent)]">
                Pinned
              </p>
            )}

            <div className="space-y-2">
              {visibleInModal.map((v, idx, arr) => {
                const prevWasPinned =
                  idx > 0 && (arr[idx - 1]?.pinned ?? false);
                const showGroupSeparator = prevWasPinned && !v.pinned;
                const originalIdx = versions.findIndex(
                  (ov) => ov.version === v.version,
                );
                return (
                  <div key={v.version}>
                    {showGroupSeparator && (
                      <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        History
                      </p>
                    )}
                    <VersionRow
                      v={v}
                      isViewed={v.version === viewedVersionNumber}
                      isLatestVersion={v.version === versions[0]?.version}
                      prevInOrder={versions[originalIdx + 1]}
                      onRestore={onRestore ? handleRestore : undefined}
                      onTogglePin={onTogglePin}
                    />
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
