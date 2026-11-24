// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLeadFormRedirects } from "./use-lead-form-redirects";

const navigation = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
  query: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.query,
}));

const source = {
  copyReportId: "10000000-0000-4000-8000-000000000001",
  copySectionId: "10000000-0000-4000-8000-000000000002",
  copyKind: "risk",
  copyStableId: "10000000-0000-4000-8000-000000000003",
};

function redirect(head = false) {
  renderHook(() =>
    useLeadFormRedirects({
      pinnedReportId: undefined,
      redirectToCanonical: true,
      isSlidesMode: false,
      activeReportId: "current-report",
      shouldRouteHeadLikeAwayFromLeadForm: head,
    }),
  );
  const href = navigation.replace.mock.calls[0]?.[0];
  if (!href) throw new Error("Expected a redirect");
  return new URL(href, "http://localhost");
}

describe("retained draft copy through the canonical Lead route", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.query = new URLSearchParams(source);
  });

  it("preserves the explicit source without transferring private text", () => {
    navigation.query.set("text", "Private draft should not enter the URL");
    const destination = redirect();
    expect(destination.pathname).toBe("/lead/report/current-report");
    expect(Object.fromEntries(destination.searchParams)).toEqual(source);
  });

  it("does not forward an ambiguous source identifier", () => {
    navigation.query.append("copyStableId", source.copyStableId);
    expect(redirect().search).toBe("");
  });

  it("does not forward the private recovery intent to a Head route", () => {
    const destination = redirect(true);
    expect(destination.pathname).toBe("/head/dashboard");
    expect(destination.search).toBe("");
  });
});
