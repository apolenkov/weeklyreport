import type { LeadInfo } from "../model/dashboard";
import { primaryAction } from "../model/dashboard-leads";
import { RemindLeadButton } from "./remind-lead-button";
import { RequestChangesButton } from "./request-changes-button";
import { RevokeLeadButton } from "./revoke-lead-button";

interface SecondaryActionState {
  readonly showOpen: boolean;
  readonly showRemind: boolean;
  readonly requestChanges: {
    readonly reportSectionId: string;
    readonly version: number;
  } | null;
  readonly revokeSectionId: string | null;
}

interface LeadQueueActionsProps {
  readonly lead: LeadInfo;
  readonly reportId: string;
  readonly onMutated: () => void;
}

function reportHref(reportId: string, leadId: string): string {
  return `/head/report/${encodeURIComponent(reportId)}?authorId=${encodeURIComponent(leadId)}`;
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

/**
 * Lead Primary Action.
 * @param props - The props argument.
 */
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

function secondaryActionState(lead: LeadInfo): SecondaryActionState {
  const primary = primaryAction(lead);
  const requestChanges =
    lead.actions.canRequestChanges &&
    lead.reportSectionId !== undefined &&
    lead.version !== undefined
      ? { reportSectionId: lead.reportSectionId, version: lead.version }
      : null;
  return {
    showOpen: lead.actions.canOpen && primary !== "open",
    showRemind: lead.actions.canRemind && primary !== "remind",
    requestChanges,
    revokeSectionId:
      lead.actions.canRevoke && lead.reportSectionId !== undefined
        ? lead.reportSectionId
        : null,
  };
}

function hasSecondaryAction(actions: SecondaryActionState): boolean {
  return (
    actions.showOpen ||
    actions.showRemind ||
    actions.requestChanges !== null ||
    actions.revokeSectionId !== null
  );
}

function SecondaryActionSet({
  actions,
  lead,
  reportId,
  onMutated,
}: LeadQueueActionsProps & {
  readonly actions: SecondaryActionState;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Lead actions"
    >
      {actions.showOpen ? (
        <QueueLink
          href={reportHref(reportId, lead.id)}
          label="Open"
          leadName={lead.name}
        />
      ) : null}
      {actions.showRemind ? (
        <RemindLeadButton
          reportId={reportId}
          leadId={lead.id}
          leadName={lead.name}
          onMutated={onMutated}
        />
      ) : null}
      {actions.requestChanges ? (
        <RequestChangesButton
          reportSectionId={actions.requestChanges.reportSectionId}
          version={actions.requestChanges.version}
          leadName={lead.name}
          onMutated={onMutated}
        />
      ) : null}
      {actions.revokeSectionId ? (
        <RevokeLeadButton
          reportSectionId={actions.revokeSectionId}
          leadName={lead.name}
          onMutated={onMutated}
        />
      ) : null}
    </div>
  );
}

/**
 * Lead Secondary Actions.
 * @param props - The props argument.
 */
export function LeadSecondaryActions({
  lead,
  reportId,
  onMutated,
}: LeadQueueActionsProps) {
  const actions = secondaryActionState(lead);

  if (!hasSecondaryAction(actions)) {
    return (
      <span className="text-xs text-[var(--color-muted-foreground)]">
        No additional actions for this state.
      </span>
    );
  }

  return (
    <SecondaryActionSet
      actions={actions}
      lead={lead}
      reportId={reportId}
      onMutated={onMutated}
    />
  );
}
