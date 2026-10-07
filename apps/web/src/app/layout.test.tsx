// @vitest-environment jsdom

import type { OrganizationPublic } from "@customreport/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock server-side dependencies before importing the component.
// getOrgPublic is a server-only helper; the `server-only` guard is already
// stubbed out by the vitest alias in vitest.config.ts.
vi.mock("../shared/server/organization/get-org-public", () => ({
  getOrgPublic: vi.fn(),
}));
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-fraunces" }),
  Onest: () => ({ variable: "font-onest" }),
}));
// Stub client-only components that would fail in a jsdom render of the
// full RSC tree (they are not under test here).
vi.mock("../shared/ui/auth-runtime/error-boundary", () => ({
  QueryErrorBoundary: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));
vi.mock("../features/telemetry/ui/web-vitals-reporter", () => ({
  WebVitalsReporter: () => null,
}));
vi.mock("../shared/lib/trpc/trpc-provider", () => ({
  TRPCProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));
// Next.js CSS import — vitest cannot process it, stub it out.
vi.mock("../styles/app.css", () => ({}));

import { getOrgPublic } from "../shared/server/organization/get-org-public";
import RootLayout, { generateMetadata } from "./layout";

const STUB_ORG: OrganizationPublic = {
  shortName: "TST",
  fullName: "Test Organization",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderLayout(): Document {
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
    const doc = renderLayout();
    expect(doc.getElementById("__org_data")).toBeNull();
  });

  it("renders no inline script from layout-owned markup", () => {
    const doc = renderLayout();
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });

  it("applies self-hosted font variables without Google stylesheet links", () => {
    const doc = renderLayout();
    expect(doc.documentElement.className.split(" ")).toEqual([
      "font-fraunces",
      "font-onest",
    ]);
    expect(doc.querySelector('link[href*="fonts.googleapis.com"]')).toBeNull();
    expect(doc.querySelector('link[href*="fonts.gstatic.com"]')).toBeNull();
  });

  it("does not render a remote inspection script in the root layout", () => {
    const doc = renderLayout();
    expect(doc.querySelector("[data-next-script-src]")).toBeNull();
  });
});
