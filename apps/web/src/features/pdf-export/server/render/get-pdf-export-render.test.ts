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
import { getPdfExportRender } from "./get-pdf-export-render";

const JOB_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "11111111-1111-4111-8111-111111111111";

const READ_MODEL = {
  reportId: REPORT_ID,
  periodStart: "2026-06-01T00:00:00.000Z",
  periodEnd: "2026-06-07T00:00:00.000Z",
  deadline: null,
  periodState: "published",
  periodStatus: "published",
  archived: false,
  weekLabel: null,
  submissionCount: 1,
  totalLeads: 2,
  activeDeadlineReminderRuleId: null,
  portfolioOverview: [],
  leadSections: [],
  escalations: [],
};

function stubFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getPdfExportRender", () => {
  it("returns the decoded read model for a valid batched response", async () => {
    vi.stubEnv("API_URL", "http://api:3002");
    cookieGetMock.mockReturnValue({ value: "worker-jwt" });
    const fetchMock = stubFetch([{ result: { data: { json: READ_MODEL } } }]);

    const data = await getPdfExportRender(JOB_ID, REPORT_ID);

    expect(data?.reportId).toBe(REPORT_ID);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/trpc/pdfExport.render?batch=1&input=");
    expect(decodeURIComponent(url)).toContain(JOB_ID);
    expect(decodeURIComponent(url)).toContain(REPORT_ID);
    expect(init.headers).toEqual({
      cookie: "weeklyreport_session=worker-jwt",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails closed without a session cookie and never calls the API", async () => {
    vi.stubEnv("API_URL", "http://api:3002");
    cookieGetMock.mockReturnValue(undefined);
    const fetchMock = stubFetch([]);

    expect(await getPdfExportRender(JOB_ID, REPORT_ID)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["non-ok response", [{ result: { data: { json: READ_MODEL } } }], 500],
    ["tRPC error entry", [{ error: { message: "boom" } }], 200],
    ["malformed body", [{ unexpected: true }], 200],
    ["untransformed payload", [{ result: { data: READ_MODEL } }], 200],
  ])("fails closed on %s", async (_label, body, status) => {
    vi.stubEnv("API_URL", "http://api:3002");
    cookieGetMock.mockReturnValue({ value: "worker-jwt" });
    stubFetch(body, { status });

    expect(await getPdfExportRender(JOB_ID, REPORT_ID)).toBeNull();
  });

  it("fails closed when fetch rejects", async () => {
    vi.stubEnv("API_URL", "http://api:3002");
    cookieGetMock.mockReturnValue({ value: "worker-jwt" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );

    expect(await getPdfExportRender(JOB_ID, REPORT_ID)).toBeNull();
  });

  it("fails closed when the shared deadline aborts a stalled API call", async () => {
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
    await expect(getPdfExportRender(JOB_ID, REPORT_ID)).resolves.toBeNull();
    expect(timeoutSpy).toHaveBeenCalledWith(SERVER_FETCH_TIMEOUT_MS);
  });
});
