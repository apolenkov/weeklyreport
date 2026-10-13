"use client";

import * as Sentry from "@sentry/nextjs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@weeklyreport/ui/components/ui/alert";
import { Button } from "@weeklyreport/ui/components/ui/button";
import { useEffect } from "react";

interface ErrorRecoveryContentProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export function ErrorRecoveryContent({
  error,
  reset,
}: ErrorRecoveryContentProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          An unexpected error interrupted this page. Try again to continue.
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            className="mt-3"
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
