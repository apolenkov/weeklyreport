import type { LeadInfo } from "../model/dashboard";
import { RemindLeadButton } from "./remind-lead-button";
import { RequestChangesButton } from "./request-changes-button";
import { RevokeSectionButton } from "./revoke-lead-button";

type PrimaryAction = "open" | "remind" | "review" | "none";

interface LeadQueueActionsProps {
  readonly lead: LeadInfo;
  readonly reportId: string;
  readonly onMutated: () => void;
}

function reportHref(reportId: string, leadId: string): string {
  return `/head/report/${encodeURIComponent(reportId)}?authorId=${encodeURIComponent(leadId)}`;
}

function primaryAction(lead: LeadInfo): PrimaryAction {
  if (lead.actions.canReview) return "review";
  if (lead.actions.canOpen) return "open";
  if (lead.actions.canRemind) return "remind";
  return "none";
}

function QueueLink({
  href,
  label,
  leadName,
}: {
  readonly href: string;
  readonly label: "Open" | "Review";
  readonly leadName: string;
}) {
  return (
    <a
      href={href}
      aria-label={`${label} ${leadName} report section`}
      className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
    >
      {label}
    </a>
  );
}

export function LeadPrimaryAction({
  lead,
  reportId,
  onMutated,
}: LeadQueueActionsProps) {
  const action = primaryAction(lead);
  if (action === "review" || action === "open") {
    return (
      <QueueLink
        href={reportHref(reportId, lead.id)}
        label={action === "review" ? "Review" : "Open"}
        leadName={lead.name}
      />
    );
  }
  if (action === "remind") {
    return (
      <RemindLeadButton
        reportId={reportId}
        leadId={lead.id}
        leadName={lead.name}
        onMutated={onMutated}
      />
    );
  }
  return (
    <span className="text-xs text-[var(--color-muted-foreground)]">
      Read only
    </span>
  );
}

export function LeadSecondaryActions({
  lead,
  reportId,
  onMutated,
}: LeadQueueActionsProps) {
  const primary = primaryAction(lead);
  const showOpen = lead.actions.canOpen && primary !== "open";
  const showRemind = lead.actions.canRemind && primary !== "remind";
  const requestChanges =
    lead.actions.canRequestChanges &&
    lead.reportSectionId !== undefined &&
    lead.version !== undefined
      ? { reportSectionId: lead.reportSectionId, version: lead.version }
      : null;
  const revokeSectionId =
    lead.actions.canRevoke && lead.reportSectionId !== undefined
      ? lead.reportSectionId
      : null;
  const hasAction =
    showOpen ||
    showRemind ||
    requestChanges !== null ||
    revokeSectionId !== null;

  if (!hasAction) {
    return (
      <span className="text-xs text-[var(--color-muted-foreground)]">
        No additional actions for this state.
      </span>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Lead actions"
    >
      {showOpen ? (
        <QueueLink
          href={reportHref(reportId, lead.id)}
          label="Open"
          leadName={lead.name}
        />
      ) : null}
      {showRemind ? (
        <RemindLeadButton
          reportId={reportId}
          leadId={lead.id}
          leadName={lead.name}
          onMutated={onMutated}
        />
      ) : null}
      {requestChanges ? (
        <RequestChangesButton
          reportSectionId={requestChanges.reportSectionId}
          version={requestChanges.version}
          leadName={lead.name}
          onMutated={onMutated}
        />
      ) : null}
      {revokeSectionId ? (
        <RevokeSectionButton
          reportSectionId={revokeSectionId}
          leadName={lead.name}
          onMutated={onMutated}
        />
      ) : null}
    </div>
  );
}
