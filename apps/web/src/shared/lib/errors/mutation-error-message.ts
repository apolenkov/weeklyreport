import { toast } from "sonner";

import { getClientErrorDetails } from "./client-error-reporting";

const TRANSPORT_FAILURE_MESSAGES = new Set([
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
]);

// A tRPC input-validation rejection reaches the client as the ZodError's own
// `.message` — a JSON issues array like `[{"code":"too_big",...}]`. Domain
// BAD_REQUESTs carry curated messages, so only the JSON shape is replaced.
function isRawValidationIssues(message: string): boolean {
  if (!message.trimStart().startsWith("[")) return false;
  try {
    return Array.isArray(JSON.parse(message));
  } catch {
    return false;
  }
}

export function mutationErrorMessage(
  error: unknown,
  actionFailure: string,
): string {
  // An empty message names nothing, so the action stands alone.
  if (!(error instanceof Error) || !error.message.trim()) return actionFailure;
  if (
    TRANSPORT_FAILURE_MESSAGES.has(error.message) ||
    isRawValidationIssues(error.message) ||
    // Internal server errors carry technical text (stack fragments, Prisma
    // codes) that is never curated for display.
    getClientErrorDetails(error).isInternal
  ) {
    return actionFailure;
  }
  return error.message;
}

export function toastMutationError(fallbackMessage: string) {
  return (error: unknown): void => {
    toast.error(mutationErrorMessage(error, fallbackMessage));
  };
}
