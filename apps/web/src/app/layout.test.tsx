// @vitest-environment jsdom

import type { OrganizationPublic } from "@customreport/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock server-side dependencies before importing the component.
// getOrgPublic is a server-only helper; the `server-only` guard is already
// stubbed out by the vitest alias in vitest.config.ts.
vi.mock("../lib/server/get-org-public", () => ({
  getOrgPublic: vi.fn(),
}));
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-fraunces" }),
  Lexend: () => ({ variable: "font-lexend" }),
  Source_Sans_3: () => ({ variable: "font-source-sans" }),
}));
vi.mock("next/script", () => ({
  default: ({
    src,
    integrity,
  }: {
    readonly src: string;
    readonly integrity: string;
  }) => <template data-next-script-src={src} data-integrity={integrity} />,
}));

// Stub client-only components that would fail in a jsdom render of the
// full RSC tree (they are not under test here).
vi.mock("../shared/ui/auth-runtime/agentation-devtools", () => ({
  AgentationDevtools: () => null,
}));
vi.mock("../shared/ui/auth-runtime/error-boundary", () => ({
  QueryErrorBoundary: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));
vi.mock("../features/telemetry/ui/web-vitals-reporter", () => ({
  WebVitalsReporter: () => null,
}));
vi.mock("../lib/trpc-provider", () => ({
  TRPCProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));
// Next.js CSS import — vitest cannot process it, stub it out.
vi.mock("../styles/app.css", () => ({}));

import { getOrgPublic } from "../lib/server/get-org-public";
import RootLayout, { generateMetadata } from "./layout";

const STUB_ORG: OrganizationPublic = {
  shortName: "TST",
  fullName: "Test Organization",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderLayout(org: OrganizationPublic): Document {
  // layout.tsx imports getOrgPublic at module scope (generateMetadata).
  vi.mocked(getOrgPublic).mockResolvedValue(org);

  const html = renderToStaticMarkup(RootLayout({ children: null }));
  return new DOMParser().parseFromString(html, "text/html");
}

describe("RootLayout metadata, fonts, and inline-script safety", () => {
  it("uses the required organization name for metadata", async () => {
    vi.mocked(getOrgPublic).mockResolvedValue(STUB_ORG);

    await expect(generateMetadata()).resolves.toEqual({
      title: {
        default: STUB_ORG.fullName,
        template: `%s · ${STUB_ORG.fullName}`,
      },
      description: "Weekly status reporting for the CoreDev department.",
    });
  });

  it("emits no inline __org_data script element", () => {
    const doc = renderLayout(STUB_ORG);
    expect(doc.getElementById("__org_data")).toBeNull();
  });

  it("embeds no raw org string in an inline script, even for a breakout fullName", () => {
    const doc = renderLayout({
      shortName: "x",
      fullName: "</script><img src=x onerror=alert(1)>",
    });
    expect(doc.querySelector("img")).toBeNull();
    for (const script of doc.querySelectorAll("script")) {
      expect(script.textContent).not.toContain("onerror");
    }
  });

  it("applies self-hosted font variables without Google stylesheet links", () => {
    const doc = renderLayout(STUB_ORG);
    expect(doc.documentElement.className.split(" ")).toEqual([
      "font-fraunces",
      "font-lexend",
      "font-source-sans",
    ]);
    expect(doc.querySelector('link[href*="fonts.googleapis.com"]')).toBeNull();
    expect(doc.querySelector('link[href*="fonts.gstatic.com"]')).toBeNull();
  });

  it("loads local-development inspection tools only when devtools are enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_DEVTOOLS", "false");

    const doc = renderLayout(STUB_ORG);
    expect(
      [...doc.querySelectorAll<HTMLElement>("[data-next-script-src]")].map(
        (script) => script.dataset.nextScriptSrc,
      ),
    ).toEqual([
      "https://unpkg.com/react-grab@0.1.50/dist/index.global.js",
      "https://unpkg.com/react-scan@0.5.7/dist/auto.global.js",
    ]);
    expect(
      [...doc.querySelectorAll<HTMLElement>("[data-integrity]")].map(
        (script) => script.dataset.integrity,
      ),
    ).toEqual([
      "sha384-toQcgpwBJRMq7yM03jNqi39gpDMk3ucx4bacWjjdtBovQupQx9xH1tyS8L0Pl/rw",
      "sha384-DDZCsimcjpG92OUulxf7DHi4rGS/fNIW7lC5DT8+5ftaTDiUKfzIq+pDTUbPjC86",
    ]);
  });

  it("keeps inspection tools out of disabled development sessions", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_DEVTOOLS", "true");

    const doc = renderLayout(STUB_ORG);
    expect(
      doc.querySelector('[data-next-script-src*="react-grab"]'),
    ).toBeNull();
    expect(
      doc.querySelector('[data-next-script-src*="react-scan"]'),
    ).toBeNull();
  });

  it("keeps inspection tools out of production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_DEVTOOLS", "false");

    const doc = renderLayout(STUB_ORG);
    expect(doc.querySelector("[data-next-script-src]")).toBeNull();
  });
});
