/** Stable fallback when a thrown value carries no meaningful message. */
export const UNKNOWN_ERROR_MESSAGE = "Unknown error";

// Unwraps a caught `unknown` for log/telemetry and durable failure state.
// Normalization keeps terminal rows valid even when an adapter throws
// `new Error("")` or a whitespace-only message.
export const errorMessage = (error: unknown): string => {
  try {
    const message = error instanceof Error ? error.message : String(error);
    return message.trim() || UNKNOWN_ERROR_MESSAGE;
  } catch {
    return UNKNOWN_ERROR_MESSAGE;
  }
};
