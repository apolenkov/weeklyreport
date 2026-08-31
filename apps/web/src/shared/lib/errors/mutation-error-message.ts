const TRANSPORT_FAILURE_MESSAGES = new Set([
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
]);

export function mutationErrorMessage(
  error: unknown,
  actionFailure: string,
): string {
  if (!(error instanceof Error)) return actionFailure;
  return TRANSPORT_FAILURE_MESSAGES.has(error.message)
    ? actionFailure
    : error.message;
}

export function toastMutationError(fallbackMessage: string) {
  return (error: unknown): void => {
    toast.error(mutationErrorMessage(error, fallbackMessage));
  };
}
import { toast } from "sonner";
