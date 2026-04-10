'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ERROR_MESSAGES: Record<string, string> = {
  idp_unavailable:
    'The authentication service is currently unavailable. Please try again in a few minutes.',
  invalid_assertion:
    'Your login attempt could not be verified. Please try signing in again.',
  session_expired: 'Your session has expired. Please sign in again.',
};

const DEFAULT_MESSAGE = 'Something went wrong during sign-in. Please try again.';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? '';
  const message = ERROR_MESSAGES[reason] ?? DEFAULT_MESSAGE;

  return (
    <main>
      <h1>Authentication Error</h1>
      <p role="alert">{message}</p>
      <a href={`${API_URL}/auth/saml/login`}>Try signing in again</a>
      <br />
      <a href="/">Return to home</a>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <AuthErrorContent />
    </Suspense>
  );
}
