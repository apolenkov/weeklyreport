"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@customreport/ui/components/ui/badge";

import { useTRPC } from "../../lib/trpc-context";

/**
 * NOTIF-06 (Phase 29-05): admin UI badge surfacing the BullMQ failed-jobs
 * count for the email-reminder queue. Renders nothing when count === 0 so
 * the admin shell stays clean during normal operation; turns into a
 * destructive Badge ("DLQ: N") when failures pile up.
 *
 * Data source: `admin.dlqCount` tRPC procedure (headProcedure — admin/head
 * only per D-AUTH-03). Polls every 30 seconds. Returns `{count}` even when
 * the API has no live BullMQ Queue handle (e.g. unit-test wiring) so the
 * badge is always renderable.
 */
export function DlqBadge() {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.admin.dlqCount.queryOptions(),
    refetchInterval: 30_000,
  });
  const count = data?.count ?? 0;
  if (count === 0) return null;
  return (
    <Badge
      variant="destructive"
      aria-label={`Email-reminder DLQ count: ${count}`}
    >
      DLQ: {count}
    </Badge>
  );
}
