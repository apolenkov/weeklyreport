import jwt from "jsonwebtoken";
import { z } from "zod";

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

// Every claim the signer mints is required on verify: exp is enforced because
// jwt.verify only checks an exp that is present, and sign always sets one — a
// token without it would otherwise be accepted with no lifetime bound.
const pdfExportTokenClaimsSchema = z.object({
  reportId: z.string().min(1),
  kind: z.literal(PDF_EXPORT_KIND),
  requestedBy: z.string().min(1).optional(),
  exp: z.number().int().positive(),
});

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
export function verifyPdfExportToken(token: string): PdfExportTokenClaims {
  const secret = requirePdfExportSecret();
  const decoded = jwt.verify(token, secret, {
    algorithms: [PDF_EXPORT_JWT_ALGORITHM],
  });
  if (typeof decoded !== "object") {
    throw new TypeError("Invalid PDF export token payload");
  }
  const parsed = pdfExportTokenClaimsSchema.safeParse(decoded);
  if (!parsed.success) {
    const paths = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid PDF export token claims: ${paths}`);
  }
  return {
    reportId: parsed.data.reportId,
    kind: parsed.data.kind,
    ...(parsed.data.requestedBy
      ? { requestedBy: parsed.data.requestedBy }
      : {}),
  };
}

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
