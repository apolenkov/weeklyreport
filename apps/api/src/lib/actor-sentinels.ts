// Fallback values for actor/request fields that can be legitimately absent.
// Centralized so a rename at one call site can't desync from the others.
export const NO_CORRELATION_ID = "no-context";
export const UNKNOWN_CLIENT_IP = "unknown";
export const ANONYMOUS_USER_ID = "anonymous";
export const SYSTEM_ACTOR_ID = "system";
