import {
  createReadStream,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";

import type { UserSession } from "@customreport/shared";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { createAuthController } from "../auth/index.js";
import {
  canReadReport,
  handlePdfDownload,
  type PdfDownloadDeps,
} from "./pdf-export.download-handler";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    createReadStream: vi.fn(actual.createReadStream),
  };
});

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_SECRET = "pdf-download-handler-session-secret-32ch";
const PDF_SECRET = "pdf-download-handler-pdf-secret-32-chars";

const headSession: UserSession = {
  userId: "a0000000-0000-4000-8000-0000000000h1",
  email: "head@test.local",
  name: "Head One",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: "group-1",
  reportingGroupName: "Group 1",
};

const viewerSession: UserSession = {
  userId: "a0000000-0000-4000-8000-0000000000v1",
  email: "viewer@test.local",
  name: "Viewer One",
  role: "viewer",
  activeReportId: null,
  activeReportSectionId: null,
};

// Express Response stand-in: a Writable that records status, headers, body.
class MockResponse extends Writable {
  statusCode = 200;
  headersSent = false;
  readonly headers: Record<string, string> = {};
  private readonly chunks: Buffer[] = [];

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  override _write(
    chunk: Buffer,
    _enc: BufferEncoding,
    cb: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.from(chunk));
    cb();
  }

  get body(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function asResponse(res: MockResponse): Response {
  return res as unknown as Response;
}

function makeReq(opts: { cookie?: string; file?: string }): Request {
  return {
    cookies: opts.cookie ? { customreport_session: opts.cookie } : {},
    params: { file: opts.file ?? `${JOB_ID}.pdf` },
  } as unknown as Request;
}

interface PrismaStubOptions {
  job?: { status: string; filePath: string; reportId: string } | null;
  reportAuthorized?: boolean;
  isActive?: boolean;
  viewerGroups?: string[];
}

function makePrisma(opts: PrismaStubOptions = {}): PrismaService {
  const stub = {
    user: {
      findUnique: () => Promise.resolve({ isActive: opts.isActive ?? true }),
    },
    viewerGroupAccess: {
      findMany: () =>
        Promise.resolve(
          (opts.viewerGroups ?? []).map((groupId) => ({ groupId })),
        ),
    },
    reportSection: { findFirst: () => Promise.resolve(null) },
    reportingGroup: { findUnique: () => Promise.resolve(null) },
    organization: {
      findUnique: () =>
        Promise.resolve({ shortName: "PEO", fullName: "Product Team" }),
      upsert: () =>
        Promise.resolve({ shortName: "PEO", fullName: "Product Team" }),
    },
    pdfExportJob: {
      findUnique: () => Promise.resolve(opts.job ?? null),
    },
    report: {
      findFirst: () =>
        Promise.resolve(
          (opts.reportAuthorized ?? false) ? { id: REPORT_ID } : null,
        ),
      findUnique: () =>
        Promise.resolve(
          (opts.reportAuthorized ?? false) ? { id: REPORT_ID } : null,
        ),
    },
  };
  return stub as unknown as PrismaService;
}

function completedJob() {
  return {
    status: "completed",
    filePath: `/pdfs/${JOB_ID}.pdf`,
    reportId: REPORT_ID,
  };
}

let pdfDir: string;

function makeDeps(overrides: Partial<PdfDownloadDeps> = {}): PdfDownloadDeps {
  return {
    prisma: makePrisma(),
    pdfDir,
    // Matches the cookie name makeReq stamps; supplied explicitly so the
    // handler never reads process.env.AUTH_JWT_COOKIE_NAME per request.
    sessionCookieName: "customreport_session",
    verifySessionToken: () => headSession,
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    logger: createNullLogger(),
    ...overrides,
  };
}

beforeEach(() => {
  pdfDir = mkdtempSync(join(tmpdir(), "pdf-handler-"));
  process.env.AUTH_JWT_SECRET = SESSION_SECRET;
  process.env.PDF_EXPORT_JWT_SECRET = PDF_SECRET;
});

afterEach(() => {
  delete process.env.AUTH_DEV_MODE;
});

describe("handlePdfDownload", () => {
  it("streams the PDF for an authenticated, in-scope caller (200)", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    const res = new MockResponse();
    const finished = new Promise<void>((r) => res.on("finish", () => r()));

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        verifySessionToken: () => viewerSession,
        prisma: makePrisma({
          job: completedJob(),
          reportAuthorized: true,
          viewerGroups: ["group-1"],
        }),
      }),
    );
    await finished;

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    expect(res.headers["Content-Disposition"]).toBe("attachment");
    expect(res.body).toBe("PDF-BYTES");
  });

  it("reads the session cookie under the deps cookie name, ignoring process.env (200)", async () => {
    const originalCookieName = process.env.AUTH_JWT_COOKIE_NAME;
    process.env.AUTH_JWT_COOKIE_NAME = "env-session-cookie";
    try {
      writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
      const res = new MockResponse();
      const finished = new Promise<void>((r) => res.on("finish", () => r()));

      await handlePdfDownload(
        makeReq({ cookie: "valid" }),
        asResponse(res),
        makeDeps({
          verifySessionToken: () => viewerSession,
          prisma: makePrisma({
            job: completedJob(),
            reportAuthorized: true,
            viewerGroups: ["group-1"],
          }),
        }),
      );
      await finished;

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe("PDF-BYTES");
    } finally {
      if (originalCookieName === undefined) {
        delete process.env.AUTH_JWT_COOKIE_NAME;
      } else {
        process.env.AUTH_JWT_COOKIE_NAME = originalCookieName;
      }
    }
  });

  it("rejects an unauthenticated request (401, no bytes)", async () => {
    const res = new MockResponse();

    await handlePdfDownload(makeReq({}), asResponse(res), makeDeps());

    expect(res.statusCode).toBe(401);
    expect(res.body).toBe("");
  });

  it("rejects a non-string session cookie value (validated, not cast)", async () => {
    const res = new MockResponse();
    const req = {
      cookies: { customreport_session: 123_456 },
      params: { file: `${JOB_ID}.pdf` },
    } as unknown as Request;

    await handlePdfDownload(req, asResponse(res), makeDeps());

    expect(res.statusCode).toBe(401);
  });

  it("rejects an absent cookies container (401)", async () => {
    const res = new MockResponse();
    const req = { params: { file: `${JOB_ID}.pdf` } } as unknown as Request;

    await handlePdfDownload(req, asResponse(res), makeDeps());

    expect(res.statusCode).toBe(401);
  });

  it("rejects an out-of-scope caller, requester identity notwithstanding (403)", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        verifySessionToken: () => viewerSession,
        prisma: makePrisma({
          job: completedJob(),
          reportAuthorized: false,
          viewerGroups: [],
        }),
      }),
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toBe("");
  });

  it("rejects a revoked session (401)", async () => {
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        sessionRevocation: { isRevoked: () => Promise.resolve(true) },
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );

    expect(res.statusCode).toBe(401);
  });

  it("rejects a deactivated account (401)", async () => {
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({
          job: completedJob(),
          reportAuthorized: true,
          isActive: false,
        }),
      }),
    );

    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the job row is missing", async () => {
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({ prisma: makePrisma({ job: null, reportAuthorized: true }) }),
    );

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when the job is completed but the file is missing on disk", async () => {
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );

    expect(res.statusCode).toBe(404);
  });

  it("refuses to serve an artifact that is a symlink planted in the artifacts dir (404)", async () => {
    // A symlink at `{jobId}.pdf` must be rejected at open (O_NOFOLLOW), never
    // followed outside the pdfDir root.
    const outside = join(tmpdir(), "pdf-handler-outside-secret.txt");
    writeFileSync(outside, "SECRET-OUTSIDE-BYTES");
    symlinkSync(outside, join(pdfDir, `${JOB_ID}.pdf`));
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
  });

  it("returns 404 for a non-completed job even with a same-named file on disk", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({
          job: {
            status: "pending",
            filePath: `/pdfs/${JOB_ID}.pdf`,
            reportId: REPORT_ID,
          },
          reportAuthorized: true,
        }),
      }),
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
  });

  it("returns 404 when the persisted artifact path mismatches the requested path", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({
          job: {
            status: "completed",
            filePath: "/pdfs/other.pdf",
            reportId: REPORT_ID,
          },
          reportAuthorized: true,
        }),
      }),
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
  });

  it("returns 404 for a non-UUID jobId path param", async () => {
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid", file: "not-a-uuid.pdf" }),
      asResponse(res),
      makeDeps({ prisma: makePrisma({ reportAuthorized: true }) }),
    );

    expect(res.statusCode).toBe(404);
  });

  it("rejects a PDF-export worker token in the session cookie (401)", async () => {
    const authController = createAuthController(process.env);
    const workerToken = jwt.sign(
      { reportId: REPORT_ID, kind: "pdf-export" },
      PDF_SECRET,
      { expiresIn: "5m" },
    );
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: workerToken }),
      asResponse(res),
      makeDeps({
        verifySessionToken: (token) => authController.verifySessionToken(token),
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toBe("");
  });

  it("dev-mode does not authorize a download (401 on an invalid token even with AUTH_DEV_MODE=true)", async () => {
    process.env.AUTH_DEV_MODE = "true";
    const authController = createAuthController(process.env);
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "not-a-jwt" }),
      asResponse(res),
      makeDeps({
        verifySessionToken: (token) => authController.verifySessionToken(token),
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );

    expect(res.statusCode).toBe(401);
  });

  it("returns 500 when the PDF read fails before headers are sent", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    vi.mocked(createReadStream).mockReturnValueOnce(
      new Readable({
        read() {
          this.destroy(new Error("read failed"));
        },
      }) as unknown as ReturnType<typeof createReadStream>,
    );
    const res = new MockResponse();
    const finished = new Promise<void>((resolve) => {
      res.on("finish", resolve);
    });

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );
    await finished;

    expect(res.statusCode).toBe(500);
    expect(res.writableEnded).toBe(true);
  });

  it("destroys the response when the PDF read fails after headers were sent", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    vi.mocked(createReadStream).mockReturnValueOnce(
      new Readable({
        read() {
          this.destroy(new Error("read failed"));
        },
      }) as unknown as ReturnType<typeof createReadStream>,
    );
    const res = new MockResponse();
    res.headersSent = true;
    const closed = new Promise<void>((resolve) => {
      res.on("close", resolve);
    });

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );
    await closed;

    expect(res.statusCode).toBe(200);
    expect(res.destroyed).toBe(true);
  });

  it("logs a PDF stream failure with the job id (observable, not silent)", async () => {
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "PDF-BYTES");
    vi.mocked(createReadStream).mockReturnValueOnce(
      new Readable({
        read() {
          this.destroy(new Error("read failed"));
        },
      }) as unknown as ReturnType<typeof createReadStream>,
    );
    const error = vi.fn();
    const logger = { error, child: () => logger } as unknown as AppLogger;
    const res = new MockResponse();
    const finished = new Promise<void>((resolve) => {
      res.on("finish", resolve);
    });

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        logger,
        prisma: makePrisma({ job: completedJob(), reportAuthorized: true }),
      }),
    );
    await finished;

    expect(error).toHaveBeenCalledWith(
      "pdf stream read failed",
      expect.objectContaining({ jobId: JOB_ID, error: "read failed" }),
    );
  });
});

describe("canReadReport", () => {
  it("authorizes a viewer via the group-scope section filter (anti-vacuous)", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: REPORT_ID }));
    const prisma = { report: { findFirst } } as unknown as PrismaService;
    const viewer: UserSession = {
      ...viewerSession,
      viewerGroupAccess: ["group-1"],
    };

    const allowed = await canReadReport(viewer, REPORT_ID, prisma);

    expect(allowed).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: REPORT_ID,
          sections: {
            some: { author: { reportingGroupId: { in: ["group-1"] } } },
          },
        },
      }),
    );
  });

  it("denies an empty-access viewer (zero-row scope filter)", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const prisma = { report: { findFirst } } as unknown as PrismaService;
    const viewer: UserSession = { ...viewerSession, viewerGroupAccess: [] };

    const allowed = await canReadReport(viewer, REPORT_ID, prisma);

    expect(allowed).toBe(false);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REPORT_ID, sections: { some: { id: { in: [] } } } },
      }),
    );
  });

  it("authorizes an admin against the report by existence (god mode)", async () => {
    const findUnique = vi.fn(() => Promise.resolve({ id: REPORT_ID }));
    const prisma = { report: { findUnique } } as unknown as PrismaService;
    const admin: UserSession = { ...headSession, role: "admin" };

    expect(await canReadReport(admin, REPORT_ID, prisma)).toBe(true);
    expect(findUnique).toHaveBeenCalled();
  });
});
