"use client";

import { ErrorRecoveryContent } from "./error-recovery-content";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRecoveryContent error={error} reset={reset} />;
}
