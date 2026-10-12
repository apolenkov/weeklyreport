import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { getClientErrorDetails } from "../../../shared/lib/errors/client-error-reporting";
import { getScalarSearchParam } from "../../../shared/lib/navigation/scalar-search-param";
import { REPORTS_LATEST_ROUTE } from "../../../shared/ui/navigation/nav-links";

const STATUS_ENTRY_SOURCE_PARAM = "source";
const RECOVERY_PARAM = "recovery";
const STATUS_SOURCE_VALUE = "status";
const RECOVERY_VALUE = "1";

// Module-scope so the reference is stable across renders. The viewer strips
// one-shot Status-entry markers on every in-shell navigation.
export const VIEWER_STRIP_PARAMS: readonly string[] = [
  STATUS_ENTRY_SOURCE_PARAM,
  RECOVERY_PARAM,
];

// Status-entry races recover once via /reports/latest; direct and History
// failures are terminal. The page fetch shares this query key, so recovering
// here is sufficient and avoids a duplicate redirect.
export function useStatusEntryRecovery(displayedQuery: {
  readonly isError: boolean;
  readonly error: unknown;
}): boolean {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isInvalidLink =
    displayedQuery.isError &&
    getClientErrorDetails(displayedQuery.error).isInvalidLink;
  const shouldRecover =
    isInvalidLink &&
    getScalarSearchParam(searchParams, STATUS_ENTRY_SOURCE_PARAM) ===
      STATUS_SOURCE_VALUE &&
    getScalarSearchParam(searchParams, RECOVERY_PARAM) !== RECOVERY_VALUE;

  useEffect(() => {
    if (shouldRecover) {
      router.replace(
        `${REPORTS_LATEST_ROUTE}?${RECOVERY_PARAM}=${RECOVERY_VALUE}`,
      );
    }
  }, [shouldRecover, router]);

  return shouldRecover;
}
