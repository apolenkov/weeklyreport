"use client";

import { useMutation } from "@tanstack/react-query";
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
 * write; the server owns authorization. The discussion itself is re-read by
 * its own uncached query, never by reloading the section editor.
 */
export function useLeadItemReplyPort(
  reportSectionId: string | null,
): ItemReplyPort {
  const trpc = useTRPC();
  const { mutateAsync } = useMutation(
    trpc.review.leadItemComment.mutationOptions(),
  );
  return useMemo(
    () => ({
      reportSectionId,
      send: async (item, text) => {
        if (item.recordId === null) return "rejected";
        try {
          await mutateAsync({ itemId: item.recordId, text });
          return "sent";
        } catch (error: unknown) {
          return isDefiniteRejection(error) ? "rejected" : "uncertain";
        }
      },
    }),
    [mutateAsync, reportSectionId],
  );
}
