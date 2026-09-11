import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { getClientErrorDetails } from "../../../shared/lib/errors/client-error-reporting";
import { getScalarSearchParam } from "../../../shared/lib/navigation/scalar-search-param";

// Module-scope so the reference is stable across renders. The viewer strips
// one-shot Status-entry markers on every in-shell navigation.
export const VIEWER_STRIP_PARAMS: readonly string[] = ["source", "recovery"];

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
    getScalarSearchParam(searchParams, "source") === "status" &&
    getScalarSearchParam(searchParams, "recovery") !== "1";

  useEffect(() => {
    if (shouldRecover) {
      router.replace("/reports/latest?recovery=1");
    }
  }, [shouldRecover, router]);

  return shouldRecover;
}
