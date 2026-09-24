import { UnrecoverableError } from "bullmq";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { requireEnv } from "../../lib/env.js";
import type { PdfRenderer, PdfRenderRequest } from "./pdf-export.ports.js";

// A4 in inches and the print template's terminal readiness contract
// (print-report-template.tsx PRINT_STATE tokens). The expression must hold
// only on a ready page with loaded fonts; an "error" or never-ready page
// keeps it falsy until the renderer's own bounded wait expires.
const A4_PAPER_WIDTH_IN = "8.27";
const A4_PAPER_HEIGHT_IN = "11.7";
const PRINT_READY_EXPRESSION =
  "document.querySelector('[data-print-state=\"ready\"]') !== null && document.fonts.status === 'loaded'";

// API-side bound sits just above the renderer's API_TIMEOUT=150s so a wedged
// conversion fails instead of hanging the job attempt; it covers the whole
// request including response-body consumption.
const RENDER_REQUEST_TIMEOUT_MS = 160_000;

// Explicit initial safety bound on the byte stream — not measured capacity
// evidence. Enforced while streaming; overflow cancels and releases the body.
const KIBIBYTE_BYTES = 1024;
const MAX_RESPONSE_MEBIBYTES = 64;
const MAX_RENDER_RESPONSE_BYTES =
  MAX_RESPONSE_MEBIBYTES * KIBIBYTE_BYTES * KIBIBYTE_BYTES;

const RENDERER_REJECTED_STATUS = 403;

const PDF_MAGIC = new TextEncoder().encode("%PDF-");
const PDF_EOF = new TextEncoder().encode("%%EOF");
// `%%EOF` may be followed by trailing whitespace only.
const TAB_BYTE = 0x09;
const LINE_FEED_BYTE = 0x0a;
const CARRIAGE_RETURN_BYTE = 0x0d;
const SPACE_BYTE = 0x20;
const PDF_TRAILING_WHITESPACE = new Set([
  TAB_BYTE,
  LINE_FEED_BYTE,
  CARRIAGE_RETURN_BYTE,
  SPACE_BYTE,
]);

export class RenderResponseTooLargeError extends Error {
  constructor() {
    super("renderer response exceeds the 64 MiB bound");
    this.name = "RenderResponseTooLargeError";
  }
}

export class InvalidRenderResponseError extends Error {
  constructor() {
    super("renderer returned a body that is not a minimal PDF");
    this.name = "InvalidRenderResponseError";
  }
}

const readBoundedBody = async (
  body: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array> => {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line no-restricted-syntax -- streaming byte total is the response-size boundary
  let totalBytes = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      const nextTotal = totalBytes + result.value.byteLength;
      if (nextTotal > MAX_RENDER_RESPONSE_BYTES) {
        throw new RenderResponseTooLargeError();
      }
      chunks.push(result.value);
      totalBytes = nextTotal;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  // eslint-disable-next-line no-restricted-syntax -- write offset advances across chunks
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const hasPdfHeader = (bytes: Uint8Array): boolean =>
  PDF_MAGIC.every((byte, index) => bytes[index] === byte);

const pdfContentEnd = (bytes: Uint8Array): number =>
  bytes.findLastIndex((byte) => !PDF_TRAILING_WHITESPACE.has(byte)) + 1;

const hasPdfTrailer = (bytes: Uint8Array, contentEnd: number): boolean =>
  contentEnd >= PDF_EOF.byteLength &&
  PDF_EOF.every(
    (byte, index) => bytes[contentEnd - PDF_EOF.byteLength + index] === byte,
  );

const isMinimalPdf = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= PDF_MAGIC.byteLength + PDF_EOF.byteLength &&
  hasPdfHeader(bytes) &&
  hasPdfTrailer(bytes, pdfContentEnd(bytes));

// Locally proven construction failures never leave the process — they can
// never succeed on retry, so they are terminal before any byte is sent.
const parsePrintUrl = (raw: string): URL => {
  try {
    return new URL(raw);
  } catch {
    throw new UnrecoverableError(
      `pdf render request rejected locally: invalid print URL "${raw}"`,
    );
  }
};

const buildConvertForm = (printUrl: URL, cookies: string): FormData => {
  const form = new FormData();
  form.set("url", printUrl.toString());
  form.set("paperWidth", A4_PAPER_WIDTH_IN);
  form.set("paperHeight", A4_PAPER_HEIGHT_IN);
  form.set("printBackground", "true");
  form.set("waitForExpression", PRINT_READY_EXPRESSION);
  form.set("cookies", cookies);
  return form;
};

const releaseBody = async (response: Response): Promise<void> => {
  await response.body?.cancel().catch(() => undefined);
};

export class GotenbergPdfRenderer implements PdfRenderer {
  private readonly convertUrl: string;

  constructor(env: EnvConfig) {
    const base = requireEnv(env, "GOTENBERG_URL");
    this.convertUrl = `${base.replace(/\/$/, "")}/forms/chromium/convert/url`;
  }

  private async postConvert(
    form: FormData,
    traceId: string,
  ): Promise<Response> {
    try {
      // Transport failures and the client-side deadline are ambiguous — the
      // renderer may still be converting — so they consume the retry budget.
      return await fetch(this.convertUrl, {
        method: "POST",
        body: form,
        headers: { "Gotenberg-Trace": traceId },
        signal: AbortSignal.timeout(RENDER_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `pdf render request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private static async assertConvertStatus(response: Response): Promise<void> {
    if (response.status === RENDERER_REJECTED_STATUS) {
      // Deterministic allow-list/IP-class rejection — retrying can never pass.
      await releaseBody(response);
      throw new UnrecoverableError(
        `pdf render rejected by renderer outbound filtering (${RENDERER_REJECTED_STATUS})`,
      );
    }
    if (!response.ok) {
      await releaseBody(response);
      throw new Error(
        `pdf render failed with renderer status ${response.status}`,
      );
    }
  }

  private static async readPdfBody(response: Response): Promise<Uint8Array> {
    try {
      return await readBoundedBody(response.body);
    } catch (error) {
      if (error instanceof RenderResponseTooLargeError) throw error;
      throw new Error(
        `pdf render body read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  readonly render = async (input: PdfRenderRequest): Promise<Buffer> => {
    const printUrl = parsePrintUrl(input.url);
    if (printUrl.protocol !== "http:" && printUrl.protocol !== "https:") {
      throw new UnrecoverableError(
        `pdf render request rejected locally: unsupported print URL protocol "${printUrl.protocol}"`,
      );
    }
    const response = await this.postConvert(
      buildConvertForm(printUrl, JSON.stringify(input.cookies)),
      input.traceId,
    );
    await GotenbergPdfRenderer.assertConvertStatus(response);
    const bytes = await GotenbergPdfRenderer.readPdfBody(response);
    if (!isMinimalPdf(bytes)) throw new InvalidRenderResponseError();
    return Buffer.from(bytes);
  };
}
