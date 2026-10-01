import { UnrecoverableError } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { GotenbergPdfRenderer } from "./gotenberg-pdf-renderer.adapter.js";
import type { PdfRenderRequest } from "./pdf-export.ports.js";

const STUB_ENV = { GOTENBERG_URL: "http://gotenberg:3000" } as EnvConfig;

const COOKIE = {
  name: "auth",
  value: "jwt",
  domain: "web",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

const renderInput: PdfRenderRequest = {
  url: "http://web:3000/print/report-1?jobId=job-1",
  cookies: [COOKIE],
  traceId: "job-1",
};

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 fake-body\n%%EOF\n");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const okPdfResponse = () =>
  new Response(PDF_BYTES, {
    status: 200,
    headers: { "content-type": "application/pdf" },
  });

afterEach(() => {
  fetchMock.mockReset();
});

describe("GotenbergPdfRenderer", () => {
  it("posts the print URL conversion form with A4 bounds, readiness gate, cookies, and trace header", async () => {
    fetchMock.mockResolvedValue(okPdfResponse());
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    const pdf = await renderer.render(renderInput);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe("http://gotenberg:3000/forms/chromium/convert/url");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Gotenberg-Trace": "job-1" });
    const form = init.body as FormData;
    expect(form.get("url")).toBe("http://web:3000/print/report-1?jobId=job-1");
    expect(form.get("paperWidth")).toBe("8.27");
    expect(form.get("paperHeight")).toBe("11.7");
    expect(form.get("printBackground")).toBe("true");
    expect(form.get("waitForExpression")).toBe(
      "document.querySelector('[data-print-state=\"ready\"]') !== null && document.fonts.status === 'loaded'",
    );
    expect(JSON.parse(form.get("cookies") as string)).toEqual([COOKIE]);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("treats a renderer 403 as terminal without retry", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(renderer.render(renderInput)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it.each([400, 409, 503, 502])(
    "keeps renderer status %i retryable",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("nope", { status }));
      const renderer = new GotenbergPdfRenderer(STUB_ENV);

      await expect(renderer.render(renderInput)).rejects.toBeInstanceOf(Error);
      await expect(renderer.render(renderInput)).rejects.not.toBeInstanceOf(
        UnrecoverableError,
      );
    },
  );

  it("keeps transport failures retryable", async () => {
    fetchMock.mockRejectedValue(new TypeError("connect ECONNREFUSED"));
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(renderer.render(renderInput)).rejects.toBeInstanceOf(Error);
    await expect(renderer.render(renderInput)).rejects.not.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("keeps the transport error as the cause", async () => {
    const failure = new TypeError("connect ECONNREFUSED");
    fetchMock.mockRejectedValue(failure);
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(renderer.render(renderInput)).rejects.toMatchObject({
      cause: failure,
    });
  });

  it("keeps a client-side abort/timeout retryable", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out", "TimeoutError"),
    );
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(renderer.render(renderInput)).rejects.not.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("keeps a timeout while the PDF body is still streaming retryable", async () => {
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    fetchMock.mockImplementation((_target: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          stream.enqueue(PDF_BYTES.slice(0, 8));
          init.signal?.addEventListener("abort", () => {
            stream.error(init.signal?.reason);
          });
        },
      });
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      );
    });
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    const pending = renderer.render(renderInput);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });
    deadline.abort(new DOMException("The operation timed out", "TimeoutError"));

    await expect(pending).rejects.toBeInstanceOf(Error);
    await expect(pending).rejects.not.toBeInstanceOf(UnrecoverableError);
    timeout.mockRestore();
  });

  it("rejects an invalid print URL before any byte leaves as terminal", async () => {
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(
      renderer.render({ ...renderInput, url: "not a url" }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-http print URL as terminal", async () => {
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(
      renderer.render({ ...renderInput, url: "file:///etc/passwd" }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a 200 with a non-PDF body as retryable", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>oops</html>", { status: 200 }),
    );
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    const failure = renderer.render(renderInput);
    await expect(failure).rejects.toBeInstanceOf(Error);
    await expect(failure).rejects.not.toBeInstanceOf(UnrecoverableError);
  });

  it("treats a 200 missing the %%EOF marker as retryable", async () => {
    fetchMock.mockResolvedValue(
      new Response(new TextEncoder().encode("%PDF-1.7 truncated"), {
        status: 200,
      }),
    );
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    await expect(renderer.render(renderInput)).rejects.not.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it("bounds the response body at 64 MiB while streaming", async () => {
    const chunk = new Uint8Array(8 * 1024 * 1024).fill(0x20);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 9; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    fetchMock.mockResolvedValue(new Response(stream, { status: 200 }));
    const renderer = new GotenbergPdfRenderer(STUB_ENV);

    const failure = renderer.render(renderInput);
    await expect(failure).rejects.toBeInstanceOf(Error);
    await expect(failure).rejects.not.toBeInstanceOf(UnrecoverableError);
  });
});
