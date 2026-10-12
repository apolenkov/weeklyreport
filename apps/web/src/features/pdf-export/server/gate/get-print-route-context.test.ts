import { describe, expect, it, vi } from "vitest";

// `server-only` throws if imported from a non-server module — under vitest we
// don't have a Next.js server context, so neutralise it.
vi.mock("server-only", () => ({}));

const cookieGetMock = vi.hoisted(() =>
  vi.fn<(name: string) => { value: string } | undefined>(),
);

// `next/headers` is server-only; mock keeps the module surface available
// without dragging the Next.js runtime.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGetMock }),
}));

import { SERVER_FETCH_TIMEOUT_MS } from "../../../../shared/server/transport/api-url";
import { decodePrintGateResponse } from "./decode-print-gate";
import { getPrintRouteContext } from "./get-print-route-context";

// Preserve the realistic batched printGate seam: route-gate mocks otherwise
// bypass decoding of session, export mode, and report id together.

const SESSION = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "head@weeklyreport.local",
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

describe("getPrintRouteContext", () => {
  it("returns the decoded context for a valid gate payload", async () => {
    vi.stubEnv("API_URL", "http://api:3002");
    cookieGetMock.mockReturnValue({ value: "worker-jwt" });
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
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const context = await getPrintRouteContext();

    expect(context).toEqual({
      session: null,
      isPdfExport: true,
      pdfReportId: REPORT_ID,
      pdfJobId: "22222222-2222-4222-8222-222222222222",
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails closed to no-context when the shared deadline aborts a stalled API call", async () => {
    vi.stubEnv("API_URL", "http://api:3002");
    cookieGetMock.mockReturnValue({ value: "worker-jwt" });
    // AbortSignal.timeout is the platform seam; the test owns when it fires.
    const deadline = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            const abort = () => reject(signal?.reason ?? new Error("aborted"));
            if (signal?.aborted) {
              abort();
              return;
            }
            signal?.addEventListener("abort", abort);
          }),
      ),
    );

    deadline.abort();
    await expect(getPrintRouteContext()).resolves.toEqual({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
    expect(timeoutSpy).toHaveBeenCalledWith(SERVER_FETCH_TIMEOUT_MS);
  });
});
