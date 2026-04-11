'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertCircle } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@customreport/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ERROR_MESSAGES: Record<string, string> = {
  idp_unavailable:
    'The authentication service is currently unavailable. Please try again in a few minutes.',
  invalid_assertion:
    'Your login attempt could not be verified. Please try signing in again.',
  session_expired: 'Your session has expired. Please sign in again.',
};

const ERROR_TITLES: Record<string, string> = {
  idp_unavailable: 'Service Unavailable',
  invalid_assertion: 'Verification Failed',
  session_expired: 'Session Expired',
};

const DEFAULT_MESSAGE =
  'Something went wrong during sign-in. Please try again.';
const DEFAULT_TITLE = 'Sign-in Error';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? '';
  const message = ERROR_MESSAGES[reason] ?? DEFAULT_MESSAGE;
  const errorTitle = ERROR_TITLES[reason] ?? DEFAULT_TITLE;

  return (
    <main className="flex min-h-svh items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-[20px] font-semibold leading-[1.3]">
            Authentication Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{errorTitle}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <div className="flex flex-col gap-3 pt-2">
            <Button variant="default" asChild>
              <a href={`${API_URL}/auth/saml/login`}>
                Try signing in again
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="/">Return to home</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function AuthErrorFallback() {
  return (
    <main className="flex min-h-svh items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthErrorFallback />}>
      <AuthErrorContent />
    </Suspense>
  );
}
