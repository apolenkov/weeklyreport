import "../styles/app.css";

import type { Metadata } from "next";
import { Fraunces, Lexend, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

import { WebVitalsReporter } from "../features/telemetry/ui/web-vitals-reporter";
import { getOrgPublic } from "../lib/server/get-org-public";
import { TRPCProvider } from "../lib/trpc-provider";
import { AgentationDevtools } from "../shared/ui/agentation-devtools";
import { QueryErrorBoundary } from "../shared/ui/error-boundary";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

const fraunces = Fraunces({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-fraunces",
});
const lexend = Lexend({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-lexend",
});
const sourceSans = Source_Sans_3({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["cyrillic", "latin"],
  variable: "--font-source-sans-3",
});

// Titles were blank on SSR (set later by a client effect). Set them
// server-side via the Metadata API so the document title is correct on
// first paint and shareable links resolve a real title.
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${lexend.variable} ${sourceSans.variable}`}
    >
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
