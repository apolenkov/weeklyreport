import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AgentationDevtools } from "../components/agentation-devtools";
import { QueryErrorBoundary } from "../components/error-boundary";
import { TRPCProvider } from "../lib/trpc-provider";
import { getOrgPublic } from "../lib/server/get-org-public";
import "../styles/app.css";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Vercel audit 2026-05-22: titles were blank on SSR (set later by a client
// effect). Set them server-side via the Metadata API so the document title is
// correct on first paint and shareable links resolve a real title.
export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgPublic();
  const name = org?.fullName ?? "CustomReport";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Weekly status reporting for the CoreDev department.",
  };
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // UFB-070: pre-fetch org identity server-side so the landing page can read
  // it from a <script> tag on first paint — eliminates the "ORG" flash.
  const orgPublic = await getOrgPublic();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        {/* UFB-070: org identity injected server-side for zero-flash first paint */}
        <script
          id="__org_data"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgPublic) }}
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
        <AgentationDevtools />
      </body>
    </html>
  );
}
