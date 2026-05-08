"use client";

import type { LeadInfo } from "./mock-data";
import { useSession } from "../../lib/session-provider";

type LeadReportCardProps = {
  readonly lead: LeadInfo;
};

type StatusConfig = {
  bg: string;
  text: string;
  label: string;
  avatarBg: string;
  avatarText: string;
};

// Typed as `satisfies` so each known key is provably non-undefined; lookups
// by `lead.status` (untyped string) still narrow to `StatusConfig | undefined`,
// which is what the `?? STATUS_CONFIG.pending` fallback was always for.
const STATUS_CONFIG = {
  submitted: {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    label: "Submitted",
    avatarBg: "var(--color-primary)",
    avatarText: "#fff",
  },
  draft: {
    bg: "#fef3c7",
    text: "#8a6d1b",
    label: "Draft",
    avatarBg: "#fef3c7",
    avatarText: "var(--color-starbucks-gold)",
  },
  pending: {
    bg: "var(--color-muted)",
    text: "var(--color-muted-foreground)",
    label: "Pending",
    avatarBg: "var(--color-border)",
    avatarText: "var(--color-muted-foreground)",
  },
} as const satisfies Record<string, StatusConfig>;

// DASH-3 (Phase 33-04): at-risk now uses saturated `#d4a017` (mockup `.td-y`)
// so the white text reads. The previous pastel `#fef3c7` made the dot literally
// invisible on the dashboard. Blocked stays `#fee2e2` because its text-color
// is `var(--color-destructive)` (red) on light pink — readable as-is.
const TRAFFIC_BG: Record<string, string> = {
  "on-track": "var(--color-success)",
  "at-risk": "#d4a017",
  blocked: "#fee2e2",
};

const TRAFFIC_TEXT: Record<string, string> = {
  "on-track": "var(--color-primary)",
  "at-risk": "#fff",
  blocked: "var(--color-destructive)",
};

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]"
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

// DASH-5 (Phase 33-04): lead-role viewers see a lock on non-own rows because
// the destination /head/report is gated for leads (they can read but not write
// other sections). Head/admin still get the chevron — drill-down is exactly
// what they need. The icon is purely an affordance hint; the SSR layout gate
// is the real boundary.
function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.5 }}
    >
      <rect x="4" y="11" width="16" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

/**
 * Row inside the Lead Reports grid on /head/dashboard. Earlier this card
 * showed a lock icon and was non-clickable for "other" leads — that read
 * as "you can't access this", which is wrong for Head/Admin viewing the
 * dashboard (drill-down is exactly what they need). The card now always
 * renders as a link: own row goes to /lead/report (the lead's editor),
 * other rows go to /head/report (the assembled view that surfaces every
 * lead's contribution by product).
 */
export function LeadReportCard({ lead }: LeadReportCardProps) {
  const { user } = useSession();
  const config =
    (STATUS_CONFIG as Record<string, StatusConfig>)[lead.status] ??
    STATUS_CONFIG.pending;
  const isCurrentUser = lead.isCurrentUser;
  const isPending = lead.status === "pending";
  const hasReportContent = (lead.reportContentCount ?? 0) > 0;
  // Lead-role viewer = lock on other rows; head/admin = chevron (drill-down).
  const showLockForViewer = user?.role === "lead" && !isCurrentUser;

  const reportPath = lead.reportId
    ? `/${encodeURIComponent(lead.reportId)}`
    : "";
  const authorQuery = `?authorId=${encodeURIComponent(lead.id)}`;
  const href = isCurrentUser
    ? `/lead/report${reportPath}${authorQuery}`
    : `/head/report${reportPath}${authorQuery}`;

  const containerStyle: React.CSSProperties = isCurrentUser
    ? {
        background: "var(--color-success)",
        border: "1.5px solid var(--color-starbucks-accent)",
        textDecoration: "none",
        color: "inherit",
      }
    : {
        background:
          lead.status === "draft" ? "#fffbeb" : "var(--color-background)",
        opacity: isPending ? 0.6 : 1,
        border: "1px solid var(--color-border)",
        textDecoration: "none",
        color: "inherit",
      };

  if (!hasReportContent) {
    return (
      <div
        className="flex cursor-default items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 opacity-70"
        aria-label={`${lead.name} has no report content yet`}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: config.avatarBg, color: config.avatarText }}
        >
          {lead.initials}
        </div>
        <span className="flex-1 text-sm font-semibold">
          {lead.name} &middot; {lead.role}
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          No content
        </span>
      </div>
    );
  }

  return (
    <a
      href={href}
      className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-[background-color,border-color,box-shadow] hover:border-[rgba(0,117,74,0.18)] hover:bg-[#f8f6f2] hover:shadow-[inset_3px_0_0_var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
      style={containerStyle}
      aria-label={
        isCurrentUser
          ? `Open my report — ${lead.name}`
          : `Open ${lead.name}'s contribution in the weekly report`
      }
    >
      {/* Avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ background: config.avatarBg, color: config.avatarText }}
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
      <span className="text-xs text-[var(--color-muted-foreground)]">
        {lead.lastActivity}
      </span>

      {/* Status badge */}
      <span
        className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: config.bg, color: config.text }}
      >
        {config.label}
      </span>

      {showLockForViewer ? <LockIcon /> : <ChevronRight />}
    </a>
  );
}
