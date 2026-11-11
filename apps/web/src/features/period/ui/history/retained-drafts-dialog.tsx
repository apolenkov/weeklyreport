"use client";

import { useQuery } from "@tanstack/react-query";
import type { RetainedIncompleteRecordsOutput } from "@weeklyreport/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@weeklyreport/ui/components/ui/dialog";
import Link from "next/link";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../../shared/hooks/query/use-query-error-handler";
import {
  type RetainedDraftCopySource,
  writeRetainedDraftCopy,
} from "../../../../shared/lib/navigation/retained-draft-copy";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { LEAD_REPORT_ROUTE } from "../../../../shared/ui/navigation/nav-links";
import { retainedDraftSourceReason } from "../../model/retained-draft-source";

/** The history entry whose kept drafts the dialog reads. */
export interface RetainedDraftsSource {
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly periodLabel: string;
}

interface RetainedDraftsDialogProps {
  readonly source: RetainedDraftsSource;
  readonly onClose: () => void;
}

type AvailableDrafts = Extract<
  RetainedIncompleteRecordsOutput,
  { status: "available" }
>;

const BUTTON_CLASS =
  "btn-press inline-flex min-h-[var(--touch-target-min)] shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] sm:min-h-0";

interface DraftText {
  readonly key: string;
  readonly kind: "Risk" | "Decision";
  readonly text: string;
  readonly details: readonly (readonly [label: string, value: string])[];
  readonly copySource: RetainedDraftCopySource;
}

const present = (
  pairs: readonly (readonly [string, string | null | undefined])[],
): DraftText["details"] =>
  pairs.flatMap(([label, value]) => (value ? [[label, value] as const] : []));

function toDraftTexts(drafts: AvailableDrafts): readonly DraftText[] {
  return [
    ...drafts.risks.map((risk) => ({
      key: `risk-${risk.stableId}`,
      kind: "Risk" as const,
      copySource: {
        reportId: drafts.reportId,
        reportSectionId: drafts.reportSectionId,
        kind: "risk" as const,
        stableId: risk.stableId,
      },
      text: risk.risk,
      details: present([
        ["Impact", risk.impact],
        ["Mitigation", risk.mitigation],
        ["Stages", risk.stageNames.join(", ")],
      ]),
    })),
    ...drafts.decisions.map((decision) => ({
      key: `decision-${decision.stableId}`,
      kind: "Decision" as const,
      copySource: {
        reportId: drafts.reportId,
        reportSectionId: drafts.reportSectionId,
        kind: "decision" as const,
        stableId: decision.stableId,
      },
      text: decision.text,
      details: present([
        ["Owner", decision.owner],
        ["Impact", decision.impact],
        ["Stages", decision.stageNames.join(", ")],
      ]),
    })),
  ];
}

const clipboardText = (draft: DraftText): string =>
  [draft.text, ...draft.details.map(([label, value]) => `${label}: ${value}`)]
    .join("\n")
    .trim();

async function copyDraft(draft: DraftText): Promise<void> {
  try {
    await navigator.clipboard.writeText(clipboardText(draft));
    toast.success(`${draft.kind} text copied`);
  } catch {
    toast.error("Could not copy. Select the text and copy it yourself.");
  }
}

function DraftRow({ draft }: { readonly draft: DraftText }) {
  const query = new URLSearchParams();
  writeRetainedDraftCopy(query, draft.copySource);
  return (
    <li className="grid gap-3 border-t border-[var(--color-border-subtle)] py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">
          {draft.kind}
        </p>
        <p className="mt-0.5 text-sm break-words text-[var(--color-foreground)]">
          {draft.text}
        </p>
        {draft.details.length > 0 && (
          <dl className="mt-1.5 space-y-0.5 text-[13px] text-[var(--color-muted-foreground)]">
            {draft.details.map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <dt className="shrink-0">{label}:</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${LEAD_REPORT_ROUTE}?${query.toString()}`}
          className={BUTTON_CLASS}
          aria-label={`Copy ${draft.kind.toLowerCase()} to current report: ${draft.text}`}
        >
          Copy to current report
        </Link>
        <button
          type="button"
          className={BUTTON_CLASS}
          aria-label={`Copy ${draft.kind.toLowerCase()} text: ${draft.text}`}
          onClick={() => void copyDraft(draft)}
        >
          Copy text
        </button>
      </div>
    </li>
  );
}

function AvailableBody({ drafts }: { readonly drafts: AvailableDrafts }) {
  return (
    <>
      <p className="text-sm text-[var(--color-foreground)]">
        {retainedDraftSourceReason(drafts.readOnlyReason)}
      </p>
      <ul className="max-h-[50vh] overflow-y-auto">
        {toDraftTexts(drafts).map((draft) => (
          <DraftRow key={draft.key} draft={draft} />
        ))}
      </ul>
      <p className="text-[13px] text-[var(--color-muted-foreground)]">
        Copy to your current report to choose an eligible context and review the
        details. Nothing is added until you save. These source drafts stay
        unchanged and are available only as long as the report keeps them.
      </p>
    </>
  );
}

function DialogBody({ source }: { readonly source: RetainedDraftsSource }) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.leadForm.retainedIncompleteRecords.queryOptions({
      reportId: source.reportId,
      reportSectionId: source.reportSectionId,
    }),
  );
  useQueryErrorHandler(query, {
    component: "RetainedDraftsDialog",
    context: { reportId: source.reportId },
    event: "lead_history.retained_drafts.load_failed",
    procedure: "leadForm.retainedIncompleteRecords",
  });

  if (query.isError) {
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>The drafts could not be loaded.</p>
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={query.isFetching}
          onClick={() => void query.refetch().catch(() => undefined)}
        >
          {query.isFetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }
  if (!query.data) {
    return (
      <p role="status" className="text-sm text-[var(--color-muted-foreground)]">
        Loading drafts…
      </p>
    );
  }
  if (query.data.status === "unavailable") {
    return (
      <p className="text-sm text-[var(--color-foreground)]">
        These drafts are no longer available.
      </p>
    );
  }
  return <AvailableBody drafts={query.data} />;
}

/**
 * Private, read-only view of the unfinished risks and decisions one of the
 * author's own past sections still keeps. Copying is explicit and goes through
 * a separate create composer: opening the view never creates or changes a record.
 */
export function RetainedDraftsDialog({
  source,
  onClose,
}: RetainedDraftsDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent restoreFocusToPrevious>
        <DialogTitle>Unfinished drafts</DialogTitle>
        <DialogDescription>
          {source.periodLabel}. Only you can see them.
        </DialogDescription>
        <DialogBody source={source} />
        <div className="flex justify-end">
          <Link href={LEAD_REPORT_ROUTE} className={BUTTON_CLASS}>
            Open current report
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
