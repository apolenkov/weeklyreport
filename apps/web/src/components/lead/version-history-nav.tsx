'use client';

import { useState } from 'react';

import type { VersionSnapshot } from './mock-data';

type VersionHistoryNavProps = {
  readonly versions: VersionSnapshot[];
  readonly onRestore?: (version: number) => void;
};

// Curved "rewind" / "fast-forward" arrows — visually distinct from the
// straight chevrons used by PeriodNavigator. The two control groups
// (period vs version) sit on the same toolbar row, so swapping the icon
// shape is the cheapest disambiguation that avoids a redesign.
function RewindArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

function FastForwardArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.13-9.36L23 10" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" stroke="currentColor" fill="none" strokeWidth={2}>
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

// Default number of versions to show inside the history modal before revealing
// the rest via a "Show all" button. v5.0 has no server-side cursor for
// `leadForm.versions` (returns the full array in one call), so we paginate
// client-side. Tracked as a deferral in the plan SUMMARY.
const VERSIONS_INITIAL_VISIBLE = 5;

export function VersionHistoryNav({ versions, onRestore }: VersionHistoryNavProps) {
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
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted-foreground)]">Editing version</span>

        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
          onClick={handlePrev}
          disabled={!hasPrev}
          title={hasPrev ? `Previous version (v${versions[currentIndex + 1]?.version})` : 'No older version'}
          aria-label="Previous version"
        >
          <RewindArrow />
        </button>

        <button
          type="button"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-[var(--color-muted)] bg-transparent px-2.5 text-[11px] text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none"
          onClick={() => setShowModal(true)}
          title="View version history -- compare and roll back"
        >
          <HistoryIcon />
          v{currentVersion?.version}
        </button>

        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--color-muted)] bg-transparent p-0 text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
          onClick={handleNext}
          disabled={!hasNext}
          title={isLatest ? 'Latest version' : 'Next version'}
          aria-label="Next version"
        >
          <FastForwardArrow />
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
              ).map((v, idx) => (
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
              ))}
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
