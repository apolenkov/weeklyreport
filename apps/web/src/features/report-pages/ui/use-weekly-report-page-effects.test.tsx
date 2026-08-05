// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import {
  useCanonicalReportRedirect,
  useReportDocumentTitle,
} from "./use-weekly-report-page-effects";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function sessionProvider(orgName: string | null) {
  return {
    user: { id: "u1", name: "Head", email: "head@example.test", role: "head" },
    organization: orgName ? { shortName: "ORG", fullName: orgName } : null,
    isLoading: false,
    isAuthenticated: true,
  } as const;
}

function renderWithSession(hook: () => void, orgName: string | null) {
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <SessionContext.Provider value={sessionProvider(orgName)}>
        {children}
      </SessionContext.Provider>
    ),
  });
}

describe("useCanonicalReportRedirect", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  const args = {
    enabled: true,
    reportId: undefined,
    resolvedReportId: "report-1",
    focusedAuthorId: "user name/кто",
    canonicalBasePath: "/head/report",
  };

  it("skips the redirect while the report id is already canonical", () => {
    renderHook(() =>
      useCanonicalReportRedirect({ ...args, reportId: "report-9" }),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("skips the redirect while the resolved id is unknown", () => {
    renderHook(() =>
      useCanonicalReportRedirect({ ...args, resolvedReportId: null }),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to the canonical report with the focused author id encoded", () => {
    renderHook(() => useCanonicalReportRedirect(args));
    expect(replace).toHaveBeenCalledWith(
      "/head/report/report-1?authorId=user%20name%2F%D0%BA%D1%82%D0%BE",
    );
  });

  it("omits the author query when no author is focused", () => {
    renderHook(() =>
      useCanonicalReportRedirect({ ...args, focusedAuthorId: null }),
    );
    expect(replace).toHaveBeenCalledWith("/head/report/report-1");
  });

  it("does nothing while disabled", () => {
    renderHook(() => useCanonicalReportRedirect({ ...args, enabled: false }));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("useReportDocumentTitle", () => {
  afterEach(() => {
    document.title = "";
  });

  it("writes the UTC period label with the session organization brand", () => {
    renderWithSession(
      () =>
        useReportDocumentTitle({
          periodStart: new Date("2026-04-14T00:00:00.000Z"),
          periodEnd: new Date("2026-04-20T00:00:00.000Z"),
        }),
      "Example Software Department",
    );
    expect(document.title).toContain("Week 16");
    expect(document.title).toContain("Example Software Department");
    expect(document.title).not.toContain("CustomReport");
  });

  it("falls back to the neutral placeholder brand when organization is absent", () => {
    renderWithSession(
      () =>
        useReportDocumentTitle({
          periodStart: new Date("2026-04-14T00:00:00.000Z"),
          periodEnd: new Date("2026-04-20T00:00:00.000Z"),
        }),
      null,
    );
    expect(document.title).toContain("· Organization");
  });

  it("leaves the title untouched when the period bounds are not real Dates", () => {
    document.title = "Existing title";
    renderWithSession(
      () => useReportDocumentTitle({ periodStart: "2026-04-14", periodEnd: 5 }),
      "Example Software Department",
    );
    expect(document.title).toBe("Existing title");
  });

  it("restores the previous title on cleanup", () => {
    document.title = "Previous title";
    const { unmount } = renderWithSession(
      () =>
        useReportDocumentTitle({
          periodStart: new Date("2026-04-14T00:00:00.000Z"),
          periodEnd: new Date("2026-04-20T00:00:00.000Z"),
        }),
      "Example Software Department",
    );
    expect(document.title).toContain("Week 16");
    unmount();
    expect(document.title).toBe("Previous title");
  });
});
