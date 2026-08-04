import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signPdfExportToken, verifyPdfExportToken } from "./pdf-export.token";

const TEST_SECRET = "test-pdf-export-secret-at-least-32-chars";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const REQUESTED_BY = "00000000-0000-4000-8000-000000000001";
const EXP_IN_SECONDS = Math.floor(Date.now() / 1000) + 300;

beforeEach(() => {
  vi.stubEnv("PDF_EXPORT_JWT_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function signWith(claims: Record<string, unknown>): string {
  return jwt.sign(claims, TEST_SECRET, { algorithm: "HS256" });
}

describe("verifyPdfExportToken — strict claim validation", () => {
  it("accepts a token carrying every canonical claim", () => {
    const token = signWith({
      reportId: REPORT_ID,
      kind: "pdf-export",
      requestedBy: REQUESTED_BY,
      exp: EXP_IN_SECONDS,
    });

    expect(verifyPdfExportToken(token)).toEqual({
      reportId: REPORT_ID,
      kind: "pdf-export",
      requestedBy: REQUESTED_BY,
    });
  });

  it("accepts a token without the optional requestedBy claim", () => {
    const token = signWith({
      reportId: REPORT_ID,
      kind: "pdf-export",
      exp: EXP_IN_SECONDS,
    });

    expect(verifyPdfExportToken(token)).toEqual({
      reportId: REPORT_ID,
      kind: "pdf-export",
    });
  });

  it("rejects a token missing the reportId claim", () => {
    const token = signWith({ kind: "pdf-export", exp: EXP_IN_SECONDS });

    expect(() => verifyPdfExportToken(token)).toThrow(
      /Invalid PDF export token claims: reportId/,
    );
  });

  it("rejects a token with an empty reportId claim", () => {
    const token = signWith({
      reportId: "",
      kind: "pdf-export",
      exp: EXP_IN_SECONDS,
    });

    expect(() => verifyPdfExportToken(token)).toThrow(
      /Invalid PDF export token claims: reportId/,
    );
  });

  it("rejects a token whose kind is not pdf-export", () => {
    const token = signWith({
      reportId: REPORT_ID,
      kind: "session",
      exp: EXP_IN_SECONDS,
    });

    expect(() => verifyPdfExportToken(token)).toThrow(
      /Invalid PDF export token claims: kind/,
    );
  });

  it("rejects a token with no exp claim (no lifetime bound)", () => {
    const token = signWith({ reportId: REPORT_ID, kind: "pdf-export" });

    expect(() => verifyPdfExportToken(token)).toThrow(
      /Invalid PDF export token claims: exp/,
    );
  });

  it("rejects a token with a non-string requestedBy claim", () => {
    const token = signWith({
      reportId: REPORT_ID,
      kind: "pdf-export",
      requestedBy: 42,
      exp: EXP_IN_SECONDS,
    });

    expect(() => verifyPdfExportToken(token)).toThrow(
      /Invalid PDF export token claims: requestedBy/,
    );
  });

  it("round-trips a token minted by signPdfExportToken", () => {
    const token = signPdfExportToken(REPORT_ID, REQUESTED_BY);

    expect(verifyPdfExportToken(token)).toEqual({
      reportId: REPORT_ID,
      kind: "pdf-export",
      requestedBy: REQUESTED_BY,
    });
  });
});
