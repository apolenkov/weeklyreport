import jwt from "jsonwebtoken";

// reportId binds the cookie to one resource; kind routes the verifier away
// from session JWTs. requestedBy rebuilds the worker session as the requester
// (legacy tokens without it fall back to a narrow viewer synthetic session).
export interface PdfExportTokenClaims {
  reportId: string;
  kind: "pdf-export";
  requestedBy?: string;
}

const PDF_EXPORT_JWT_TTL = "5m";
const PDF_EXPORT_KIND = "pdf-export" as const;
// Symmetric token; pin the verify algorithm so it cannot be coerced (see
// auth.controller.ts `SESSION_JWT_ALGORITHM`). Sign uses the jsonwebtoken
// default, which is the same HS256.
const PDF_EXPORT_JWT_ALGORITHM = "HS256" as const;
const MIN_PDF_EXPORT_JWT_SECRET_LENGTH = 32;

function requirePdfExportSecret(): string {
  const secret = process.env.PDF_EXPORT_JWT_SECRET;
  if (!secret || secret.length < MIN_PDF_EXPORT_JWT_SECRET_LENGTH) {
    throw new Error(
      "PDF_EXPORT_JWT_SECRET is missing or too short (must be >= 32 chars).",
    );
  }
  return secret;
}

// Deferred verifier for trpc.context after verifySessionToken fails.
/**
 * Verify Pdf Export Token.
 * @param token - The token argument.
 */
export function verifyPdfExportToken(token: string): PdfExportTokenClaims {
  const secret = requirePdfExportSecret();
  const decoded = jwt.verify(token, secret, {
    algorithms: [PDF_EXPORT_JWT_ALGORITHM],
  });
  if (typeof decoded !== "object") {
    throw new TypeError("Invalid PDF export token payload");
  }
  const claims = decoded as Record<string, unknown>;
  if (claims.kind !== PDF_EXPORT_KIND) {
    throw new Error("Token is not a PDF export token (kind mismatch)");
  }
  if (typeof claims.reportId !== "string" || !claims.reportId) {
    throw new Error("PDF export token missing reportId claim");
  }
  return {
    reportId: claims.reportId,
    kind: PDF_EXPORT_KIND,
    ...(typeof claims.requestedBy === "string" && claims.requestedBy
      ? { requestedBy: claims.requestedBy }
      : {}),
  };
}

/**
 * Sign Pdf Export Token.
 * @param reportId - The reportId argument.
 * @param requestedBy - The requestedBy argument.
 */
export function signPdfExportToken(
  reportId: string,
  requestedBy?: string,
): string {
  const secret = requirePdfExportSecret();
  const claims: PdfExportTokenClaims = {
    reportId,
    kind: PDF_EXPORT_KIND,
    // Bind the worker's render session to the requester so the export is
    // scoped exactly to their in-app view.
    ...(requestedBy ? { requestedBy } : {}),
  };
  return jwt.sign(claims, secret, { expiresIn: PDF_EXPORT_JWT_TTL });
}
