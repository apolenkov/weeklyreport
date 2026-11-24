"use client";

import { useQuery } from "@tanstack/react-query";
import { AUTHORING_ROLES } from "@weeklyreport/shared";
import { Button } from "@weeklyreport/ui/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useQueryErrorHandler } from "../../../../../shared/hooks/query/use-query-error-handler";
import { useSession } from "../../../../../shared/lib/auth/session-provider";
import { formatPeriodRangeWithYear } from "../../../../../shared/lib/format/format-date";
import {
  readRetainedDraftCopy,
  type RetainedDraftCopySource,
  writeRetainedDraftCopy,
} from "../../../../../shared/lib/navigation/retained-draft-copy";
import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import { retainedDraftSourceReason } from "../../../../period";
import {
  ownedStagesForProject,
  type Parent,
  type StatusOverviewModel,
  type StatusOverviewRecordTarget,
} from "../../../../report-sections";
import {
  readRetainedRecordCopy,
  type RetainedRecordCopy,
} from "./retained-record-copy";
import { RetainedRecordCopyForm } from "./retained-record-copy-form";
import type { ReadyEditor } from "./use-overview-controller";

interface RequestProps {
  readonly editor: ReadyEditor | null;
  readonly model: StatusOverviewModel;
  readonly pendingInput: boolean;
  readonly onOpen: (
    copy: RetainedRecordCopy,
    target: StatusOverviewRecordTarget,
  ) => boolean;
}

function copyTargets(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
): readonly Parent[] {
  if (!editor || editor.view.viewModel.isReadOnly) return [];
  const section = editor.draft.section;
  return model.units
    .filter(
      (unit) =>
        !unit.historical &&
        (unit.kind === "product"
          ? ownedStagesForProject(section, unit.id).length > 0
          : section.activities.some(
              (activity) => activity.activityId === unit.id,
            )),
    )
    .map(({ kind, id, name }) => ({ kind, id, name }));
}

function CopySourceLoading({
  paused,
  onDismiss,
}: {
  readonly paused: boolean;
  readonly onDismiss: () => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      <p role="status">
        {paused
          ? "Reconnect to load the retained draft."
          : "Loading the retained draft…"}
      </p>
      <Button type="button" variant="outline" onClick={onDismiss}>
        Dismiss copy
      </Button>
    </div>
  );
}

function CopySourceRequest({
  source,
  onDismiss,
  ...props
}: RequestProps & {
  readonly source: RetainedDraftCopySource;
  readonly onDismiss: () => void;
}) {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.leadForm.retainedIncompleteRecords.queryOptions({
      reportId: source.reportId,
      reportSectionId: source.reportSectionId,
    }),
    refetchOnMount: "always",
  });
  useQueryErrorHandler(query, {
    component: "RetainedRecordCopyRequest",
    event: "lead_history.retained_copy.load_failed",
    procedure: "leadForm.retainedIncompleteRecords",
  });
  // Do not prefill from cached private text until this activation's read settles.
  if (query.isPending || !query.isFetchedAfterMount)
    return (
      <CopySourceLoading
        paused={query.fetchStatus === "paused"}
        onDismiss={onDismiss}
      />
    );
  if (query.isError)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>The source draft could not be loaded.</p>
        <Button
          type="button"
          onClick={() => {
            void query.refetch().catch(() => undefined);
          }}
        >
          Retry source
        </Button>
        <Button type="button" variant="outline" onClick={onDismiss}>
          Dismiss copy
        </Button>
      </div>
    );
  const copy = readRetainedRecordCopy(query.data, source);
  if (!copy || query.data.status !== "available")
    return (
      <div className="space-y-2 text-sm">
        <p role="status">This retained draft is no longer available.</p>
        <Button type="button" variant="outline" onClick={onDismiss}>
          Dismiss copy
        </Button>
      </div>
    );
  const blockedReason =
    query.fetchStatus !== "idle"
      ? "Checking the retained draft…"
      : !props.editor || props.editor.view.viewModel.isReadOnly
        ? "The current report is not editable."
        : props.pendingInput
          ? "Finish or close the open input first."
          : null;
  return (
    <RetainedRecordCopyForm
      copy={copy}
      sourceLabel={formatPeriodRangeWithYear(
        query.data.periodStart,
        query.data.periodEnd,
      )}
      sourceReason={retainedDraftSourceReason(query.data.readOnlyReason)}
      targets={copyTargets(props.editor, props.model)}
      blockedReason={blockedReason}
      onOpen={props.onOpen}
      onDismiss={onDismiss}
    />
  );
}

function EntitledCopyRequest(props: Parameters<typeof CopySourceRequest>[0]) {
  const { user } = useSession();
  if (!user || !AUTHORING_ROLES.includes(user.role)) return null;
  return <CopySourceRequest {...props} />;
}

export function RetainedRecordCopyRequest(props: RequestProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [consumed, setConsumed] = useState<string | null>(null);
  const source = readRetainedDraftCopy(params);
  const key = source ? JSON.stringify(source) : null;
  if (!source || key === consumed) return null;
  const dismiss = () => {
    setConsumed(key);
    const next = new URLSearchParams(params.toString());
    writeRetainedDraftCopy(next, null);
    const query = next.toString();
    const suffix = query ? `?${query}` : "";
    router.replace(`${pathname}${suffix}`, { scroll: false });
  };
  return (
    <EntitledCopyRequest
      key={key}
      {...props}
      source={source}
      onDismiss={dismiss}
    />
  );
}
