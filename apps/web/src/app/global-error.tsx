"use client";

import "../styles/app.css";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@customreport/ui/components/ui/alert";
import { Button } from "@customreport/ui/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-svh items-center justify-center p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              An unexpected error interrupted this page. Your data is safe.
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              className="mt-3"
            >
              Try again
            </Button>
          </Alert>
        </div>
      </body>
    </html>
  );
}
