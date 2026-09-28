import { constants, createReadStream, open as openFile } from "node:fs";
import { resolve, sep } from "node:path";

import type { UserSession } from "@customreport/shared";
import type { Request, RequestHandler, Response } from "express";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../lib/human-session.js";
import type { AppLogger } from "../../lib/logger.js";

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
  // Absolute directory the BullMQ worker publishes `{jobId}-g{generation}.pdf` into.
  pdfDir: string;
  // Session-cookie name resolved once at boot from the validated env.
  sessionCookieName: string;
  verifySessionToken: HumanSessionDeps["verifySessionToken"];
  sessionRevocation: HumanSessionDeps["sessionRevocation"];
  logger: AppLogger;
}

// Same-origin URL (`/pdfs/{jobId}.pdf`) so the attachment request carries the
// session cookie. Streams only to callers with a valid human session and
// the immutable job owner.
export function createPdfDownloadHandler(
  deps: PdfDownloadDeps,
): RequestHandler {
  return (req: Request, res: Response) => handlePdfDownload(req, res, deps);
}

// cookie-parser types req.cookies as always-present, but the container is
// still untrusted input; validate the value at the boundary instead of casting.
function sessionTokenFromCookies(
  cookies: Record<string, unknown> | undefined,
  cookieName: string,
): string | undefined {
  const value = cookies?.[cookieName];
  return typeof value === "string" ? value : undefined;
}

// Single human-session chokepoint: rejects a missing, invalid, revoked, or
// deactivated token. The cookie-less short-circuit stays ahead of the resolver.
function resolveDownloadSession(
  req: Request,
  deps: PdfDownloadDeps,
): Promise<UserSession | null> {
  const token = sessionTokenFromCookies(req.cookies, deps.sessionCookieName);
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
// The physical artifact is generation-scoped — `${jobId}-g${generation}.pdf`
// from the durable row, never the legacy un-suffixed name. The open with
// O_NOFOLLOW is the atomic enforcement: a symlink planted at the artifact
// path is rejected (ELOOP) instead of followed outside pdfDir.
async function resolveArtifactPath(
  pdfDir: string,
  jobId: string,
  generation: number,
): Promise<{ filePath: string; fd: number } | null> {
  const baseDir = resolve(pdfDir);
  const filePath = resolve(baseDir, `${jobId}-g${generation}.pdf`);
  if (!filePath.startsWith(baseDir + sep)) {
    return null;
  }
  const fd = await openReadOnlyNoFollow(filePath);
  return fd === null ? null : { filePath, fd };
}

function openReadOnlyNoFollow(filePath: string): Promise<number | null> {
  return new Promise((resolveOpen) => {
    openFile(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
      (error: unknown, fd: number) => {
        resolveOpen(error ? null : fd);
      },
    );
  });
}

function streamArtifact(
  res: Response,
  artifact: { filePath: string; fd: number },
  deps: PdfDownloadDeps,
  jobId: string,
): void {
  const stream = createReadStream(artifact.filePath, {
    fd: artifact.fd,
    autoClose: true,
  });
  const stopReading = (): void => {
    stream.destroy();
  };
  res.once("close", stopReading);
  stream.once("close", () => res.off("close", stopReading));
  stream.on("error", (error: unknown) => {
    // A mid-stream read failure after the no-follow open is rare, but an
    // unhandled stream 'error' would crash the process: 500 if nothing was
    // sent yet, otherwise tear down the half-written response.
    deps.logger.error("pdf stream read failed", {
      phase: "pdf.download",
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(HTTP.serverError).end();
    }
  });
  if (res.destroyed) {
    stream.destroy();
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment");
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
    select: {
      status: true,
      filePath: true,
      reportId: true,
      requestedBy: true,
      generation: true,
    },
  });
  // The job row — not the filesystem — decides whether bytes may be served:
  // 404 when missing, not completed, or the persisted artifact URL is not the
  // canonical public one (a path-mismatched row or orphan same-named file).
  if (job?.status !== "completed" || job.filePath !== `/pdfs/${jobId}.pdf`) {
    res.status(HTTP.notFound).end();
    return;
  }

  // The artifact is requester-scoped at enqueue time. Current report/group
  // membership is mutable and must not broaden access to an old PDF.
  if (job.requestedBy !== session.userId) {
    res.status(HTTP.forbidden).end();
    return;
  }

  const artifact = await resolveArtifactPath(
    deps.pdfDir,
    jobId,
    job.generation,
  );
  if (artifact === null) {
    res.status(HTTP.notFound).end();
    return;
  }

  streamArtifact(res, artifact, deps, jobId);
}
