import { describe, expect, it, vi } from "vitest";

// `server-only` throws if imported from a non-server module — under vitest we
// don't have a Next.js server context, so neutralise it.
vi.mock("server-only", () => ({}));

// `next/headers` is server-only; mock keeps the module surface available
// without dragging the Next.js runtime.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: vi.fn() }),
}));

import { decodePrintGateResponse } from "./get-print-route-context";

/**
 * fix-report-surface-integrity W2 (task 3.3): `printGate` returns an OBJECT
 * (`{ session, isPdfExport, pdfReportId }`), not the bare session `auth.me`
 * returns. The decoder was adapted from `get-server-session`'s bare-session
 * shape, so prove it pulls the three fields out of the realistic
 * superjson-batched body — the one real-integration seam the gate's mocks
 * bypass.
 */

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
            json: { session: null, isPdfExport: true, pdfReportId: REPORT_ID },
          },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: null,
      isPdfExport: true,
      pdfReportId: REPORT_ID,
    });
  });

  it("decodes an authenticated human context (flags false, session populated)", () => {
    const body = [
      {
        result: {
          data: {
            json: { session: SESSION, isPdfExport: false, pdfReportId: null },
          },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: SESSION,
      isPdfExport: false,
      pdfReportId: null,
    });
  });

  it("decodes the un-transformed payload shape (config-drift fallback)", () => {
    const body = [
      {
        result: {
          data: { session: SESSION, isPdfExport: false, pdfReportId: null },
        },
      },
    ];
    expect(decodePrintGateResponse(body)).toEqual({
      session: SESSION,
      isPdfExport: false,
      pdfReportId: null,
    });
  });

  it("fails closed to no-context on an error entry", () => {
    expect(decodePrintGateResponse([{ error: { message: "boom" } }])).toEqual({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
    });
  });

  it("fails closed to no-context on an empty / malformed body", () => {
    const closed = { session: null, isPdfExport: false, pdfReportId: null };
    expect(decodePrintGateResponse([])).toEqual(closed);
    expect(decodePrintGateResponse(null)).toEqual(closed);
    expect(decodePrintGateResponse([{ result: { data: null } }])).toEqual(
      closed,
    );
  });
});
