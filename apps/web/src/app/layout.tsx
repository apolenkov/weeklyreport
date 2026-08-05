import "../styles/app.css";

import type { Metadata } from "next";
import { Fraunces, Lexend, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import { WebVitalsReporter } from "../features/telemetry/ui/web-vitals-reporter";
import { getOrgPublic } from "../lib/server/get-org-public";
import { TRPCProvider } from "../lib/trpc-provider";
import { webEnv } from "../lib/web-env";
import { AgentationDevtools } from "../shared/ui/auth-runtime/agentation-devtools";
import { QueryErrorBoundary } from "../shared/ui/auth-runtime/error-boundary";

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

const REACT_GRAB_SCRIPT = {
  src: "https://unpkg.com/react-grab@0.1.50/dist/index.global.js",
  integrity:
    "sha384-toQcgpwBJRMq7yM03jNqi39gpDMk3ucx4bacWjjdtBovQupQx9xH1tyS8L0Pl/rw",
} as const;
const REACT_SCAN_SCRIPT = {
  src: "https://unpkg.com/react-scan@0.5.7/dist/auto.global.js",
  integrity:
    "sha384-DDZCsimcjpG92OUulxf7DHi4rGS/fNIW7lC5DT8+5ftaTDiUKfzIq+pDTUbPjC86",
} as const;

// Titles resolve server-side through the Metadata API so the document title is
// correct on first paint and shareable links carry a real title.
export async function generateMetadata(): Promise<Metadata> {
  const { fullName: name } = await getOrgPublic();
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Weekly status reporting for the CoreDev department.",
  };
}

export default function RootLayout({ children }: RootLayoutProps) {
  const showReactDevtools =
    process.env.NODE_ENV === "development" && !webEnv.disableDevtools();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${lexend.variable} ${sourceSans.variable}`}
    >
      {showReactDevtools && (
        <head>
          <Script
            src={REACT_GRAB_SCRIPT.src}
            integrity={REACT_GRAB_SCRIPT.integrity}
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
          <Script
            src={REACT_SCAN_SCRIPT.src}
            integrity={REACT_SCAN_SCRIPT.integrity}
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        </head>
      )}
      <body className="min-h-svh bg-background font-sans antialiased tracking-[-0.01em]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-[var(--radius-pill)] focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-[var(--color-primary-foreground)] focus:outline-none"
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
