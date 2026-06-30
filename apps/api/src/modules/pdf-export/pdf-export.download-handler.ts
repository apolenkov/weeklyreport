import { createReadStream, existsSync } from "node:fs";
import { resolve, sep } from "node:path";

import type { UserSession } from "@customreport/shared";
import type { Request, RequestHandler, Response } from "express";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../infrastructure/trpc/trpc.context.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import { resolveSessionCookieName } from "../../lib/session-cookie.js";

const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PdfDownloadDeps {
  prisma: PrismaService;
  /** Absolute directory the BullMQ worker writes `{jobId}.pdf` into. */
  pdfDir: string;
  verifySessionToken: HumanSessionDeps["verifySessionToken"];
  sessionRevocation: HumanSessionDeps["sessionRevocation"];
}

/**
 * CURRENT report read access (D3): authorize on the same group-scope read the
 * report surfaces apply, re-evaluated per request — NOT the export job's
 * `requestedBy`, which is a permanent grant baked into the row and would let a
 * viewer keep pulling bytes after their `ViewerGroupAccess` is revoked.
 *
 * Reuses `groupScopeFilter`: a caller is authorized when the report has at
 * least one section authored within the caller's group scope. A viewer with no
 * (or revoked) access collapses to the `{ id: { in: [] } }` zero-row filter, so
 * no section matches and access is denied — mirroring the empty report the
 * read path serves such a viewer. `admin` reads any report (god mode).
 */
export async function canReadReport(
  session: UserSession,
  reportId: string,
  prisma: PrismaService,
): Promise<boolean> {
  if (session.role === "admin") {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    return report !== null;
  }

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      sections: { some: groupScopeFilter(session, "reportSection") },
    },
    select: { id: true },
  });
  return report !== null;
}

/**
 * Authenticated, authorized PDF artifact download. Replaces the unauthenticated
 * `express.static('/pdfs')` mount: the artifact is streamed only to a caller
 * with a valid human session who currently has read access to the bound report.
 *
 * The artifact URL is relative/same-origin (`/pdfs/{jobId}.pdf`), so the
 * browser's `window.open` GET carries the `customreport_session` cookie
 * automatically — this handler depends on that invariant for authentication.
 */
export function createPdfDownloadHandler(
  deps: PdfDownloadDeps,
): RequestHandler {
  return (req: Request, res: Response) => handlePdfDownload(req, res, deps);
}

export async function handlePdfDownload(
  req: Request,
  res: Response,
  deps: PdfDownloadDeps,
): Promise<void> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[resolveSessionCookieName(process.env)];
  if (!token) {
    res.status(401).end();
    return;
  }

  // Single human-session chokepoint: rejects an invalid/revoked/deactivated
  // token AND the PDF-worker / dev-mode fallbacks the full context chain honors.
  const session = await resolveHumanSession(token, {
    verifySessionToken: deps.verifySessionToken,
    sessionRevocation: deps.sessionRevocation,
    prisma: deps.prisma,
  });
  if (!session) {
    res.status(401).end();
    return;
  }

  // Parse the jobId from the `{jobId}.pdf` path param and require a UUID, so the
  // disk path is always derived from a validated id (never the persisted
  // string) and cannot traverse out of pdfDir.
  const fileParam: unknown = req.params.file;
  const file = typeof fileParam === "string" ? fileParam : "";
  const jobId = file.endsWith(".pdf") ? file.slice(0, -".pdf".length) : "";
  if (!JOB_ID_RE.test(jobId)) {
    res.status(404).end();
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
    res.status(404).end();
    return;
  }

  if (!(await canReadReport(session, job.reportId, deps.prisma))) {
    res.status(403).end();
    return;
  }

  const baseDir = resolve(deps.pdfDir);
  const filePath = resolve(baseDir, `${jobId}.pdf`);
  if (!filePath.startsWith(baseDir + sep) || !existsSync(filePath)) {
    res.status(404).end();
    return;
  }

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
      res.status(500).end();
    }
  });
  stream.pipe(res);
}
