'use client';

import type { LeadInfo } from './mock-data';

type LeadReportCardProps = {
  readonly lead: LeadInfo;
};

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; label: string; avatarBg: string; avatarText: string }
> = {
  submitted: {
    bg: 'var(--color-success)',
    text: 'var(--color-primary)',
    label: 'Submitted',
    avatarBg: 'var(--color-primary)',
    avatarText: '#fff',
  },
  draft: {
    bg: '#fef3c7',
    text: '#8a6d1b',
    label: 'Draft',
    avatarBg: '#fef3c7',
    avatarText: 'var(--color-starbucks-gold)',
  },
  pending: {
    bg: 'var(--color-muted)',
    text: 'var(--color-muted-foreground)',
    label: 'Pending',
    avatarBg: 'var(--color-border)',
    avatarText: 'var(--color-muted-foreground)',
  },
};

const TRAFFIC_BG: Record<string, string> = {
  'on-track': 'var(--color-success)',
  'at-risk': '#fef3c7',
  blocked: '#fee2e2',
};

const TRAFFIC_TEXT: Record<string, string> = {
  'on-track': 'var(--color-primary)',
  'at-risk': '#fff',
  blocked: 'var(--color-destructive)',
};

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 flex-shrink-0 opacity-50"
      stroke="var(--color-muted-foreground)"
      fill="none"
      strokeWidth={2}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export function LeadReportCard({ lead }: LeadReportCardProps) {
  const config = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.pending!;
  const isCurrentUser = lead.isCurrentUser;
  const isPending = lead.status === 'pending';

  const containerClasses = isCurrentUser
    ? 'flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-[border-color] duration-150'
    : 'flex items-center gap-3 rounded-lg p-3';

  const containerStyle: React.CSSProperties = isCurrentUser
    ? {
        background: 'var(--color-success)',
        border: '1.5px solid var(--color-starbucks-accent)',
        textDecoration: 'none',
        color: 'inherit',
      }
    : {
        background: lead.status === 'draft' ? '#fffbeb' : 'var(--color-background)',
        opacity: isPending ? 0.5 : 0.7,
        cursor: 'not-allowed',
        border: '1px solid transparent',
      };

  const content = (
    <>
      {/* Avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ background: isCurrentUser ? config.avatarBg : config.avatarBg, color: config.avatarText }}
      >
        {lead.initials}
      </div>

      {/* Name */}
      <span className="flex-1 text-sm font-semibold">
        {lead.name} &middot; {lead.role}
      </span>

      {/* Traffic lights */}
      {lead.trafficLights.length > 0 && (
        <div className="flex flex-shrink-0 gap-1">
          {lead.trafficLights.map((tl, i) => (
            <div
              key={i}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold"
              style={{
                background: TRAFFIC_BG[tl.status],
                color: TRAFFIC_TEXT[tl.status],
              }}
            >
              {tl.icon}
            </div>
          ))}
        </div>
      )}

      {/* Last activity */}
      <span className="text-xs text-[var(--color-muted-foreground)]">{lead.lastActivity}</span>

      {/* Status badge */}
      <span
        className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: config.bg, color: config.text }}
      >
        {config.label}
      </span>

      {/* Lock icon for non-current user */}
      {!isCurrentUser && <LockIcon />}
    </>
  );

  if (isCurrentUser) {
    return (
      <a
        href="/lead/report"
        className={containerClasses}
        style={containerStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={containerClasses}
      role="listitem"
      aria-disabled="true"
      style={containerStyle}
    >
      {content}
    </div>
  );
}
