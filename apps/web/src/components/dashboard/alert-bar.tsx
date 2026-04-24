'use client';

type AlertBarProps = {
  readonly pendingLeads: string[];
};

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: 'var(--color-starbucks-gold)' }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function AlertBar({ pendingLeads }: AlertBarProps) {
  if (pendingLeads.length === 0) return null;

  const pendingNames = pendingLeads.map((name, i) => {
    const isLast = i === pendingLeads.length - 1;
    const isDraft = i === 0;
    return (
      <span key={name}>
        <strong>{name}</strong> ({isDraft ? 'Draft' : 'Not started'})
        {!isLast && ' and '}
      </span>
    );
  });

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[#fffbeb] p-3 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      style={{ borderLeft: '3px solid var(--color-warning)' }}
    >
      <AlertIcon />
      <span className="flex-1 text-sm">
        {pendingNames} haven&apos;t submitted
      </span>
      <button
        type="button"
        className="btn-press ml-auto inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-3.5 py-1.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
      >
        Send Reminder
      </button>
    </div>
  );
}
