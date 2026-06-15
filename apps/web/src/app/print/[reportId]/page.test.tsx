/**
 * @vitest-environment jsdom
 *
 * Regression tests for the static <style dangerouslySetInnerHTML> block in
 * the print template — verify-a11y-recommended-flip catalog rows for
 * apps/web/src/app/print/[reportId]/print-report-template.tsx
 * (3 high unit-rtl + 1 snapshot).
 *
 * fix-report-surface-integrity W2 (task 3.3): page.tsx is now a thin async
 * server gate (worker-vs-human discriminator), so the CSS-safety assertions
 * target the extracted client `PrintReportTemplate` directly. The gate's
 * redirect/render branches are covered in
 * components/report-shell/agent-review-coming-soon.test.tsx.
 *
 * All assertions target the hardcoded print CSS string; no row in scope
 * involves keyboard, dialog, or focus behavior.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* ---- Module mocks (must be hoisted above imports) ---- */

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { status: "open" },
      isLoading: false,
      isError: false,
      error: null,
    })),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    weeklyReport: {
      get: { queryOptions: () => ({ queryKey: ["weeklyReport.get"] }) },
    },
  }),
}));

vi.mock("../../../lib/mappers", () => ({
  mapWeeklyReport: () => ({
    portfolio: [],
    products: [],
    submissionCount: 0,
    totalLeads: 0,
    period: {
      id: "p1",
      reportId: "r1",
      periodStatus: "open" as const,
      weekLabel: "W1",
      dateRange: "Jun 1 – Jun 7",
      isCurrent: true,
    },
  }),
}));

// joinPeriodLabel is a pure formatting helper — use the real implementation.
// No mock needed.

/* ---- Import under test (after mocks are registered) ---- */

import { PrintReportTemplate } from "./print-report-template";

/* ---- Helper ---- */

function renderPage(reportId: string) {
  return render(<PrintReportTemplate reportId={reportId} />);
}

/* ---- Tests ---- */

describe("PrintReportTemplate — <style dangerouslySetInnerHTML> static CSS safety", () => {
  it("style textContent contains only static CSS keywords — no user-supplied interpolations", () => {
    const { container } = renderPage("report-123");
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    const css = styleEl?.textContent ?? "";

    expect(css).toContain("@media print");
    expect(css).toContain("@page");
    expect(css).toContain("body nav");
    expect(css).toContain(".no-print");
    expect(css).toContain("page-break");
  });

  it("style innerHTML does not contain script-injectable patterns — no XSS vector", () => {
    const { container } = renderPage("report-456");
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    const css = styleEl?.innerHTML ?? "";

    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
    expect(css).not.toMatch(/javascript:/i);
    expect(css).not.toMatch(/expression\(/i);
  });

  it("__html value is identical regardless of reportId — confirms no prop-derived interpolation", () => {
    const { container: c1 } = renderPage("id-aaa");
    const { container: c2 } = renderPage("id-bbb");

    const css1 = c1.querySelector("style")?.innerHTML ?? "";
    const css2 = c2.querySelector("style")?.innerHTML ?? "";

    expect(css1).toBe(css2);
    // Sanity: the style must be non-empty (the invariant is only meaningful
    // if the block actually rendered).
    expect(css1.length).toBeGreaterThan(0);
  });

  it("style element innerHTML snapshot — any future user-data interpolation breaks this", () => {
    const { container } = renderPage("snapshot-test");
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.innerHTML).toMatchInlineSnapshot(`
      "
                  @media print {
                    body { margin: 0; padding: 0; }
                    body nav, body .no-print { display: none; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page-break-before { page-break-before: always; }
                    section { page-break-inside: avoid; }
                    table { page-break-inside: avoid; }
                  }
                  @page {
                    size: A4;
                    margin: 15mm;
                  }
                "
    `);
  });
});
