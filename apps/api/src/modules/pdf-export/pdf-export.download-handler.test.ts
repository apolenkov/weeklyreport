import { createReadStream, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";

import type { UserSession } from "@customreport/shared";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createAuthController } from "../auth/auth.controller";
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

/** Express Response stand-in: a Writable that records status, headers, body. */
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
        Promise.resolve({ shortName: "Demo", fullName: "Product Team" }),
      upsert: () =>
        Promise.resolve({ shortName: "Demo", fullName: "Product Team" }),
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
    verifySessionToken: () => headSession,
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
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
  it("4.1/4.2 streams the PDF for an authenticated, in-scope caller (200)", async () => {
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

  it("4.3 rejects an unauthenticated request (401, no bytes)", async () => {
    const res = new MockResponse();

    await handlePdfDownload(makeReq({}), asResponse(res), makeDeps());

    expect(res.statusCode).toBe(401);
    expect(res.body).toBe("");
  });

  it("4.4/4.7 rejects an out-of-scope caller, requester identity notwithstanding (403)", async () => {
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

  it("4.5 rejects a revoked session (401)", async () => {
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

  it("4.5 rejects a deactivated account (401)", async () => {
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

  it("4.6 returns 404 when the job row is missing", async () => {
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({ prisma: makePrisma({ job: null, reportAuthorized: true }) }),
    );

    expect(res.statusCode).toBe(404);
  });

  it("4.6 returns 404 when the job is completed but the file is missing on disk", async () => {
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

  it("4.8 returns 404 for a non-completed job even with a same-named file on disk", async () => {
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

  it("4.8 returns 404 when the persisted artifact path mismatches the requested path", async () => {
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

  it("4.9 rejects a PDF-export worker token in the session cookie (401)", async () => {
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

  it("4.9 dev-mode does not authorize a download (401 on an invalid token even with AUTH_DEV_MODE=true)", async () => {
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
      }) as never,
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
      }) as never,
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
