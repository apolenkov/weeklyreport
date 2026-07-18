import jwt from "jsonwebtoken";

/**
 * Claim shape carried in the 5-min PDF export JWT.
 *
 * The reportId claim binds the cookie to a single resource so a leaked
 * cookie cannot be reused to render arbitrary reports. The `kind` claim
 * disambiguates this token from regular session JWTs (which use a
 * different secret and a much wider claim shape) so the tRPC context
 * verifier can route it to the correct check path.
 *
 * The server-side verifier (`verifyPdfExportToken`) is wired into
 * `trpc.context.ts`; the synthetic session it produces is restricted to a
 * hard-coded allowlist of read procedures scoped to the JWT's reportId.
 */
export interface PdfExportTokenClaims {
  reportId: string;
  kind: "pdf-export";
  /**
   * The session userId of the requester. The PDF worker renders
   * `/print/<id>` under a session rebuilt for THIS user, so the exported
   * report is scoped exactly to what the requester sees in-app (head → full
   * report, lead/viewer → their slice). Optional for back-compat with legacy
   * tokens that predate the claim — those fall back to the narrow
   * viewer-synthetic session in `trpc.context.ts`.
   */
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

/**
 * Verify a token signed by `signPdfExportToken` against
 * `PDF_EXPORT_JWT_SECRET`. Returns the typed claim shape on success;
 * throws if the token is invalid, expired, missing the kind claim, or signed
 * with a different secret. This is the deferred verifier called from
 * `trpc.context.ts` after `verifySessionToken` fails.
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
 * Sign a 5-min scoped JWT with `{reportId}` claim.
 * Throws if the signing secret is missing or shorter than 32 chars.
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
