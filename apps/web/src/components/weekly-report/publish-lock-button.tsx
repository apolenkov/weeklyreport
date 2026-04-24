'use client';

import { useState } from 'react';

type PublishLockButtonProps = {
  readonly pendingCount: number;
  readonly totalLeads: number;
};

export function PublishLockButton({ pendingCount, totalLeads }: PublishLockButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  function handlePublish() {
    setIsPublished(true);
    setShowDialog(false);
  }

  if (isPublished) {
    return (
      <span className="inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        Published
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
        onClick={() => setShowDialog(true)}
      >
        Publish & Lock
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm publish"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Publish & Lock Report?
            </h3>

            {pendingCount > 0 ? (
              <div className="mt-3 rounded-lg border border-[rgba(212,160,23,0.2)] bg-[#fffbeb] p-3">
                <p className="text-sm font-medium text-[#8a6d1b]">
                  {pendingCount} of {totalLeads} leads haven&apos;t submitted yet.
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Their sections will appear empty in the published report.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                All {totalLeads} leads have submitted. The report is ready to publish.
              </p>
            )}

            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              Once published, all lead forms will be locked and no further edits can be made
              for this period.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
                onClick={handlePublish}
              >
                {pendingCount > 0 ? 'Publish Anyway' : 'Publish & Lock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
