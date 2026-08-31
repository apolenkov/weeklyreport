import { describe, expect, it, vi } from "vitest";

// `server-only` throws if imported from a non-server module — under vitest we
// don't have a Next.js server context, so neutralise it.
vi.mock("server-only", () => ({}));

// `next/headers` is server-only; mock keeps the module surface available
// without dragging the Next.js runtime.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: vi.fn() }),
}));

import { decodePrintGateResponse } from "./decode-print-gate";

// Preserve the realistic batched printGate seam: route-gate mocks otherwise
// bypass decoding of session, export mode, and report id together.

const SESSION = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Head User",
  role: "head" as const,
  activeReportId: null,
  activeReportSectionId: null,
};

const REPORT_ID = "11111111-1111-4111-8111-111111111111";

describe("decodePrintGateResponse", () => {
  it("decodes the PDF-worker context (superjson-wrapped)", () => {
    const body = [
      {
        result: {
          data: {
            json: {
              session: null,
              isPdfExport: true,
              pdfReportId: REPORT_ID,
              pdfJobId: "22222222-2222-4222-8222-222222222222",
            },
          },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: null,
      isPdfExport: true,
      pdfReportId: REPORT_ID,
      pdfJobId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("decodes an authenticated human context (flags false, session populated)", () => {
    const body = [
      {
        result: {
          data: {
            json: {
              session: SESSION,
              isPdfExport: false,
              pdfReportId: null,
              pdfJobId: null,
            },
          },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: SESSION,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
  });

  it("fails closed for the un-transformed payload shape", () => {
    const body = [
      {
        result: {
          data: {
            session: SESSION,
            isPdfExport: false,
            pdfReportId: null,
            pdfJobId: null,
          },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
  });

  it("fails closed to no-context on an error entry", () => {
    expect(decodePrintGateResponse([{ error: { message: "boom" } }])).toEqual({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
  });

  it("fails closed to no-context on an empty / malformed body", () => {
    const closed = {
      session: null,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    };
    expect(decodePrintGateResponse([])).toEqual(closed);
    expect(decodePrintGateResponse(null)).toEqual(closed);
    expect(decodePrintGateResponse([{ result: { data: null } }])).toEqual(
      closed,
    );
  });

  it("rejects a malformed truthy session at the server boundary", () => {
    const body = [
      {
        result: {
          data: {
            json: {
              session: { role: "head" },
              isPdfExport: false,
              pdfReportId: null,
              pdfJobId: null,
            },
          },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
  });
});
