'use client';

import { useEffect } from 'react';

import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle, Button } from '@customreport/ui';

// Toast usage: import { toast } from 'sonner';
// toast.success("Section submitted", { description: "Your report section has been locked." });
// toast.error("Connection error", { description: "Could not reach the server. Try again." });

type QueryErrorProps = {
  readonly error: { readonly message: string };
  readonly onRetry?: () => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function QueryError({ error, onRetry }: QueryErrorProps) {
  const isUnauthorized = error.message.includes('UNAUTHORIZED');

  useEffect(() => {
    if (isUnauthorized) {
      window.location.href = `${API_URL}/auth/saml/login`;
    }
  }, [isUnauthorized]);

  if (isUnauthorized) {
    return null;
  }

  const isNetworkError =
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('network');

  const isForbidden = error.message.includes('FORBIDDEN');

  const heading = isNetworkError
    ? 'Connection error'
    : 'Something went wrong';

  const body = isNetworkError
    ? 'Could not reach the server. Check your connection and try again.'
    : isForbidden
      ? 'You do not have permission to access this page. Contact your administrator.'
      : 'An unexpected error occurred. Please refresh the page or try again later.';

  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-[480px]">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{heading}</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{body}</p>
            {onRetry ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-4"
              >
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
