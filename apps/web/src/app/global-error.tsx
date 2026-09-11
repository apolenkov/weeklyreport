"use client";

import "../styles/app.css";

import { ErrorRecoveryContent } from "./error-recovery-content";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorRecoveryContent error={error} reset={reset} />
      </body>
    </html>
  );
}
