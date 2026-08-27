"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryErrorHandler } from "../../../../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../../../../shared/lib/trpc/trpc-context";
import { crossAuthorContentFetchEnabled } from "../../../../../report-sections";
import type { RecordVisibility } from "../../../../../report-sections/client";
import { useRecordVisibility } from "../../../../../report-sections/client";
import { deriveDeckVisibility } from "../use-lead-form-data-helpers";

export function useDeckVisibility({
  currentUserId,
  targetReportId,
  isSlidesMode,
  slidesAuthorId,
}: {
  readonly currentUserId: string | null;
  readonly targetReportId: string | null;
  readonly isSlidesMode: boolean;
  readonly slidesAuthorId: string | null;
}): {
  recordVisibility: RecordVisibility;
  visibilityHydrated: boolean;
  setRecordVisibility: (next: RecordVisibility) => void;
  isEveryone: boolean;
  isForeignSlidesDeck: boolean;
  toolbarVisibility: RecordVisibility;
} {
  const {
    visibility: recordVisibility,
    hydrated: visibilityHydrated,
    setVisibility: setRecordVisibility,
  } = useRecordVisibility(currentUserId, targetReportId);

  return {
    recordVisibility,
    visibilityHydrated,
    setRecordVisibility,
    isEveryone: recordVisibility === "everyone",
    ...deriveDeckVisibility({
      isSlidesMode,
      slidesAuthorId,
      currentUserId,
      recordVisibility,
    }),
  };
}

// Full-content only after hydrated Everyone; foreign slides never fetch.
export function useCrossAuthorContent({
  targetReportId,
  visibilityHydrated,
  isEveryone,
  isForeignSlidesDeck,
}: {
  readonly targetReportId: string | null;
  readonly visibilityHydrated: boolean;
  readonly isEveryone: boolean;
  readonly isForeignSlidesDeck: boolean;
}) {
  const trpc = useTRPC();
  const enabled = crossAuthorContentFetchEnabled({
    hasReport: targetReportId !== null,
    visibilityHydrated,
    isEveryone,
    isOwnDeck: !isForeignSlidesDeck,
  });
  const query = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled,
  });
  useQueryErrorHandler(query, {
    event: "leadForm.crossAuthorContent.load_failed",
    component: "LeadForm",
    procedure: "leadForm.crossAuthorContent",
    context: { reportId: targetReportId || null },
    toastPrefix: "Failed to load co-owner content",
  });
  return {
    data: query.data,
    isPending: enabled && query.isPending,
  };
}
