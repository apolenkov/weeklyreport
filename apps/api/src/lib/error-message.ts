// Unwraps a caught `unknown` for log/telemetry text. Non-Error throws keep
// String() coercion so a thrown string or object still surfaces something.
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
