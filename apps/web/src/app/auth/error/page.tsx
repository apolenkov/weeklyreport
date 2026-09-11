import Link from "next/link";

interface Props {
  searchParams: Promise<{ reason?: string | string[] }>;
}

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_assertion: "The SSO response was invalid. Please try again.",
  session_expired: "Your session has expired. Please sign in again.",
  unauthorized: "You do not have access to this resource.",
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const resolvedReason = typeof reason === "string" ? reason : "";

  const message =
    AUTH_ERROR_MESSAGES[resolvedReason] ?? "An authentication error occurred.";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-svh items-center justify-center bg-[var(--color-background)]"
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-destructive)]"
          aria-hidden="true"
        >
          <span className="text-2xl text-[var(--color-destructive-foreground)]">
            !
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Authentication Error
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {message}
        </p>
        <Link
          href="/"
          className="btn-press inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-3 font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--color-primary-foreground)] shadow-sm transition-shadow hover:shadow-md"
          style={{ minHeight: "var(--touch-target-min)" }}
          aria-label="Return to login page"
        >
          Return to Login
        </Link>
      </div>
    </main>
  );
}
