'use client';

import { useEffect } from 'react';

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

  const heading = isNetworkError ? 'Connection Error' : 'Server Error';
  const body = isNetworkError
    ? 'Could not reach the server. Check your connection and try again.'
    : isForbidden
      ? 'You do not have permission to access this page. Contact your administrator for access.'
      : 'Something went wrong. Please refresh the page or try again later.';

  return (
    <div role="alert">
      <h2>{heading}</h2>
      <p>{body}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
