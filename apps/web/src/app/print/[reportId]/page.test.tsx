// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { Role } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PrintRouteContext } from "../../../lib/server/get-print-route-context";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const getPrintRouteContextMock = vi.hoisted(() =>
  vi.fn<() => Promise<PrintRouteContext>>(),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));
vi.mock("../../../lib/server/get-print-route-context", () => ({
  getPrintRouteContext: getPrintRouteContextMock,
}));
vi.mock("./print-report-template", () => ({
  PrintReportTemplate: ({ reportId }: { readonly reportId: string }) => (
    <div data-testid="print-report-template">{reportId}</div>
  ),
}));

import PrintReportPage from "./page";

const REPORT_ID = "report-123";

function session(role: Role): NonNullable<PrintRouteContext["session"]> {
  return {
    userId: "user-123",
    email: `${role}@example.test`,
    name: `${role} user`,
    role,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

function renderPage() {
  return PrintReportPage({
    params: Promise.resolve({ reportId: REPORT_ID }),
  });
}

describe("PrintReportPage server gate", () => {
  it("renders only for a PDF worker bound to the requested report", async () => {
    getPrintRouteContextMock.mockResolvedValue({
      session: session("head"),
      isPdfExport: true,
      pdfReportId: REPORT_ID,
    });

    render(await renderPage());

    expect(screen.getByTestId("print-report-template")).toHaveTextContent(
      REPORT_ID,
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a worker token bound to another report", async () => {
    getPrintRouteContextMock.mockResolvedValue({
      session: session("head"),
      isPdfExport: true,
      pdfReportId: "other-report",
    });

    await expect(renderPage()).rejects.toThrow(
      `NEXT_REDIRECT:/head/report/${REPORT_ID}`,
    );
  });

  it.each([
    ["head", `/head/report/${REPORT_ID}`],
    ["admin", `/head/report/${REPORT_ID}`],
    ["viewer", `/reports/${REPORT_ID}`],
    ["lead", "/lead/report"],
  ] as const)("redirects an authenticated %s to %s", async (role, target) => {
    getPrintRouteContextMock.mockResolvedValue({
      session: session(role),
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(renderPage()).rejects.toThrow(`NEXT_REDIRECT:${target}`);
  });

  it("redirects an unauthenticated request to login with its return path", async () => {
    getPrintRouteContextMock.mockResolvedValue({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
    });

    const returnPath = encodeURIComponent(`/print/${REPORT_ID}`);
    await expect(renderPage()).rejects.toThrow(
      `NEXT_REDIRECT:/?next=${returnPath}`,
    );
  });
});
