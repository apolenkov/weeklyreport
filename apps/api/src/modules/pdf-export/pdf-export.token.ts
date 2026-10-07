import jwt from "jsonwebtoken";
import { z } from "zod";

import {
  isStrongJwtSecret,
  MIN_JWT_SECRET_LENGTH,
} from "../../lib/jwt-secret.js";

// reportId binds the cookie to one resource; kind routes the verifier away
// from session JWTs. requestedBy rebuilds the worker session as the requester.
export interface PdfExportTokenClaims {
  reportId: string;
  jobId: string;
  kind: "pdf-export";
  requestedBy: string;
}

const PDF_EXPORT_JWT_TTL = "5m";
const PDF_EXPORT_KIND = "pdf-export" as const;
// Symmetric token; pin the verify algorithm so it cannot be coerced (see
// auth.controller.ts `SESSION_JWT_ALGORITHM`). Sign uses the jsonwebtoken
// default, which is the same HS256.
const PDF_EXPORT_JWT_ALGORITHM = "HS256" as const;

// Every claim the signer mints is required on verify: exp is enforced because
// jwt.verify only checks an exp that is present, and sign always sets one — a
// token without it would otherwise be accepted with no lifetime bound.
const pdfExportTokenClaimsSchema = z.object({
  reportId: z.string().min(1),
  jobId: z.uuid(),
  kind: z.literal(PDF_EXPORT_KIND),
  requestedBy: z.string().min(1),
  exp: z.number().int().positive(),
});

function requirePdfExportSecret(secret: string | undefined): string {
  if (!isStrongJwtSecret(secret)) {
    throw new Error(
      `PDF_EXPORT_JWT_SECRET is missing or too short ` +
        `(must be >= ${MIN_JWT_SECRET_LENGTH} characters).`,
    );
  }
  return secret;
}

// Fallback verifier for trpc.context after verifySessionToken fails.
export function verifyPdfExportToken(
  token: string,
  pdfExportJwtSecret: string | undefined,
): PdfExportTokenClaims {
  const secret = requirePdfExportSecret(pdfExportJwtSecret);
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
    jobId: parsed.data.jobId,
    kind: parsed.data.kind,
    requestedBy: parsed.data.requestedBy,
  };
}

export function signPdfExportToken(
  reportId: string,
  jobId: string,
  requestedBy: string,
  pdfExportJwtSecret: string | undefined,
): string {
  const secret = requirePdfExportSecret(pdfExportJwtSecret);
  const claims: PdfExportTokenClaims = {
    reportId,
    jobId,
    kind: PDF_EXPORT_KIND,
    // Bind the worker's render session to the requester so the export is
    // scoped exactly to their in-app view.
    requestedBy,
  };
  return jwt.sign(claims, secret, { expiresIn: PDF_EXPORT_JWT_TTL });
}
