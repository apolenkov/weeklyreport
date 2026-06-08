/**
 * @vitest-environment jsdom
 */

import type { OrganizationPublic } from "@customreport/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock server-side dependencies before importing the component.
// getOrgPublic is a server-only helper; the `server-only` guard is already
// stubbed out by the vitest alias in vitest.config.ts.
vi.mock("../lib/server/get-org-public", () => ({
  getOrgPublic: vi.fn(),
}));

// Stub client-only components that would fail in a jsdom render of the
// full RSC tree (they are not under test here).
vi.mock("../components/agentation-devtools", () => ({
  AgentationDevtools: () => null,
}));
vi.mock("../components/error-boundary", () => ({
  QueryErrorBoundary: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));
vi.mock("../components/web-vitals-reporter", () => ({
  WebVitalsReporter: () => null,
}));
vi.mock("../lib/trpc-provider", () => ({
  TRPCProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));
// Next.js CSS import — vitest cannot process it, stub it out.
vi.mock("../styles/app.css", () => ({}));

import { getOrgPublic } from "../lib/server/get-org-public";
import RootLayout from "./layout";

const STUB_ORG: OrganizationPublic = {
  shortName: "TST",
  fullName: "Test Organization",
};

/** Render the layout RSC and parse the resulting HTML into a document. */
async function renderLayout(org: OrganizationPublic | null): Promise<Document> {
  vi.mocked(getOrgPublic).mockResolvedValue(
    org ?? { shortName: "ORG", fullName: "Organization" },
  );

  const element = await RootLayout({ children: null });
  const html = renderToStaticMarkup(element);
  return new DOMParser().parseFromString(html, "text/html");
}

describe("RootLayout — script#__org_data (UFB-070 dangerouslySetInnerHTML)", () => {
  it("script element has type='application/json' so the payload is never executed as JavaScript", async () => {
    const doc = await renderLayout(STUB_ORG);
    const script = doc.getElementById("__org_data");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("type")).toBe("application/json");
  });

  it("script textContent deep-equals the orgPublic value returned by getOrgPublic()", async () => {
    const doc = await renderLayout(STUB_ORG);
    const script = doc.getElementById("__org_data");
    expect(script).not.toBeNull();
    const parsed: unknown = JSON.parse(script?.textContent ?? "null");
    expect(parsed).toEqual(STUB_ORG);
  });
});
