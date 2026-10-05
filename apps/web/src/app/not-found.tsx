import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-svh items-center justify-center bg-[var(--color-background)] p-6"
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        <p className="font-[family-name:var(--font-sans)] text-5xl font-semibold tracking-tight text-[var(--color-starbucks-accent)]">
          404
        </p>
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Page not found
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          This page does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="btn-press inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-3 font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--color-primary-foreground)] shadow-sm transition-shadow hover:shadow-md"
          style={{ minHeight: "var(--touch-target-min)" }}
        >
          Go to home
        </Link>
      </div>
    </main>
  );
}
