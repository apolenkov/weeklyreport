import { useContext } from "react";

import { SessionContext } from "../../../shared/lib/auth/session-provider";

// Nullable read (no throw outside a provider): admin tables render in tests
// and stories without a session, and a missing id only means "no own row".
export function useCurrentUserId(): string | null {
  return useContext(SessionContext)?.user?.id ?? null;
}
