"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useMemo } from "react";

import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import type { ItemReplyPort } from "../../../../report-sections";

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

// Only a definite 4xx answer proves the reply was not stored; anything else
// (transport loss, 5xx) may have committed, so the Lead checks before resending.
function isDefiniteRejection(error: unknown): boolean {
  const status =
    error instanceof TRPCClientError
      ? (error.data as { httpStatus?: number } | undefined)?.httpStatus
      : undefined;
  return (
    status !== undefined &&
    status >= HTTP_CLIENT_ERROR_MIN &&
    status < HTTP_SERVER_ERROR_MIN
  );
}

/**
 * Lead replies on own items through the canonical `review.leadItemComment`
 * write. The server owns authorization; a confirmed reply re-reads the
 * Overview and the section so the draft merges the new comments in place.
 */
export function useLeadItemReplyPort(
  refreshOverview: () => Promise<unknown>,
): ItemReplyPort {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation(
    trpc.review.leadItemComment.mutationOptions(),
  );
  return useMemo(() => {
    const refresh = async () => {
      try {
        await Promise.all([
          refreshOverview(),
          queryClient.invalidateQueries(trpc.leadForm.byPeriod.pathFilter(), {
            throwOnError: true,
          }),
        ]);
        return true;
      } catch {
        return false;
      }
    };
    return {
      refresh,
      send: async (item, text) => {
        if (item.recordId === null) return "rejected";
        try {
          await mutateAsync({ itemId: item.recordId, text });
        } catch (error: unknown) {
          return isDefiniteRejection(error) ? "rejected" : "uncertain";
        }
        return (await refresh()) ? "sent" : "refresh-failed";
      },
    };
  }, [mutateAsync, queryClient, refreshOverview, trpc]);
}
