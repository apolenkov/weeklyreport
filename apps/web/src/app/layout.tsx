import "../styles/app.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { WebVitalsReporter } from "../features/telemetry/ui/web-vitals-reporter";
import { getOrgPublic } from "../lib/server/get-org-public";
import { TRPCProvider } from "../lib/trpc-provider";
import { AgentationDevtools } from "../shared/ui/agentation-devtools";
import { QueryErrorBoundary } from "../shared/ui/error-boundary";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Vercel audit 2026-05-22: titles were blank on SSR (set later by a client
// effect). Set them server-side via the Metadata API so the document title is
// correct on first paint and shareable links resolve a real title.
export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgPublic();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getOrgPublic can resolve to no org (unseeded/early boot); the fallback brands metadata resiliently
  const name = org?.fullName ?? "CustomReport";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Weekly status reporting for a software department.",
  };
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* TODO(VERCEL-FONT): migrate the three Google families to
            next/font/google for self-hosting (drops the render-blocking
            external stylesheet + adds size-adjust fallback metrics for lower
            CLS). Deferred: touches the --font-* CSS token system and needs a
            visual sign-off pass, so it is held behind the theme/visual gate.
            Current preconnect + display=swap is an acceptable interim. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Lexend:wght@300;400;500;600;700&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-svh bg-background font-sans antialiased tracking-[-0.01em]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-[var(--radius-pill)] focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-white focus:outline-none"
        >
          Skip to content
        </a>
        <TRPCProvider>
          <QueryErrorBoundary>{children}</QueryErrorBoundary>
        </TRPCProvider>
        <WebVitalsReporter />
        <AgentationDevtools />
      </body>
    </html>
  );
}
