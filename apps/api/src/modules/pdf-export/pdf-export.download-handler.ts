import { createReadStream, existsSync } from "node:fs";
import { resolve, sep } from "node:path";

import type { UserSession } from "@customreport/shared";
import type { Request, RequestHandler, Response } from "express";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../lib/human-session.js";
import { canReadReport } from "../../lib/report-read-access.js";
import { resolveSessionCookieName } from "../../lib/session-cookie.js";

export { canReadReport } from "../../lib/report-read-access.js";

const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HTTP = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  serverError: 500,
} as const;

export interface PdfDownloadDeps {
  prisma: PrismaService;
  /** Absolute directory the BullMQ worker writes `{jobId}.pdf` into. */
  pdfDir: string;
  verifySessionToken: HumanSessionDeps["verifySessionToken"];
  sessionRevocation: HumanSessionDeps["sessionRevocation"];
}

// Same-origin URL (`/pdfs/{jobId}.pdf`) so window.open carries the session
// cookie; streams only to callers with a valid human session and report read.
export function createPdfDownloadHandler(
  deps: PdfDownloadDeps,
): RequestHandler {
  return (req: Request, res: Response) => handlePdfDownload(req, res, deps);
}

// Single human-session chokepoint: rejects a missing/invalid/revoked/deactivated
// token AND the PDF-worker / dev-mode fallbacks the full context chain honors.
// The cookie-less short-circuit stays ahead of `resolveHumanSession` so an
// anonymous request never reaches token verification.
function resolveDownloadSession(
  req: Request,
  deps: PdfDownloadDeps,
): Promise<UserSession | null> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[resolveSessionCookieName(process.env)];
  if (!token) {
    return Promise.resolve(null);
  }
  return resolveHumanSession(token, {
    verifySessionToken: deps.verifySessionToken,
    sessionRevocation: deps.sessionRevocation,
    prisma: deps.prisma,
  });
}

// Parse the jobId from the `{jobId}.pdf` path param and require a UUID, so the
// disk path is always derived from a validated id (never the persisted
// string) and cannot traverse out of pdfDir.
function parseJobId(req: Request): string | null {
  const fileParam: unknown = req.params.file;
  const file = typeof fileParam === "string" ? fileParam : "";
  const jobId = file.endsWith(".pdf") ? file.slice(0, -".pdf".length) : "";
  return JOB_ID_RE.test(jobId) ? jobId : null;
}

// Containment check against the resolved pdfDir; `null` means "do not serve".
function resolveArtifactPath(pdfDir: string, jobId: string): string | null {
  const baseDir = resolve(pdfDir);
  const filePath = resolve(baseDir, `${jobId}.pdf`);
  if (!filePath.startsWith(baseDir + sep) || !existsSync(filePath)) {
    return null;
  }
  return filePath;
}

function streamArtifact(res: Response, filePath: string): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment");
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    // A mid-stream read failure after `existsSync` passed is rare, but an
    // unhandled stream 'error' would crash the process: 500 if nothing was
    // sent yet, otherwise tear down the half-written response.
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(HTTP.serverError).end();
    }
  });
  stream.pipe(res);
}

export async function handlePdfDownload(
  req: Request,
  res: Response,
  deps: PdfDownloadDeps,
): Promise<void> {
  const session = await resolveDownloadSession(req, deps);
  if (!session) {
    res.status(HTTP.unauthorized).end();
    return;
  }

  const jobId = parseJobId(req);
  if (!jobId) {
    res.status(HTTP.notFound).end();
    return;
  }

  const job = await deps.prisma.pdfExportJob.findUnique({
    where: { id: jobId },
    select: { status: true, filePath: true, reportId: true },
  });
  // The job row — not the filesystem — decides whether bytes may be served:
  // 404 when missing, not completed, or the persisted artifact path does not
  // match the requested path (a path-mismatched row or orphan same-named file).
  if (job?.status !== "completed" || job.filePath !== `/pdfs/${jobId}.pdf`) {
    res.status(HTTP.notFound).end();
    return;
  }

  if (!(await canReadReport(session, job.reportId, deps.prisma))) {
    res.status(HTTP.forbidden).end();
    return;
  }

  const filePath = resolveArtifactPath(deps.pdfDir, jobId);
  if (!filePath) {
    res.status(HTTP.notFound).end();
    return;
  }

  streamArtifact(res, filePath);
}
