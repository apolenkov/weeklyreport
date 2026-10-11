import { once } from "node:events";
import {
  chmodSync,
  createReadStream,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  type ReadStream,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";

import {
  AUTH_COOKIE_NAME,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { canReadReport } from "../../test-utils/report-read-access.js";
import { makeReportSectionReadModel } from "../../test-utils/report-section-fixtures.js";
import { createAuthController } from "../auth/index.js";
import {
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

function makeReq(opts: {
  cookie?: string;
  cookieName?: string;
  file?: string;
}): Request {
  return {
    cookies: opts.cookie
      ? { [opts.cookieName ?? AUTH_COOKIE_NAME]: opts.cookie }
      : {},
    params: { file: opts.file ?? `${JOB_ID}.pdf` },
  } as unknown as Request;
}

interface PrismaStubOptions {
  job?: {
    status: string;
    filePath: string;
    reportId: string;
    generation?: number;
    requestedBy?: string;
  } | null;
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

function completedJob(requestedBy = headSession.userId, generation = 1) {
  return {
    status: "completed",
    filePath: `/pdfs/${JOB_ID}.pdf`,
    reportId: REPORT_ID,
    generation,
    requestedBy,
  };
}

// The durable row keeps the canonical public URL; the physical artifact is
// generation-scoped — `${jobId}-g${generation}.pdf`.
function artifactName(generation: number): string {
  return `${JOB_ID}-g${generation}.pdf`;
}

function writeArtifact(generation: number, bytes: string | Buffer): void {
  writeFileSync(join(pdfDir, artifactName(generation)), bytes);
}

let pdfDir: string;
let fixtureRoot: string;
const ownedStreams: ReadStream[] = [];
const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");

function failNextRead(): void {
  vi.mocked(createReadStream).mockImplementationOnce((path, options) => {
    const stream = realFs.createReadStream(path, options);
    ownedStreams.push(stream);
    stream._read = () => stream.destroy(new Error("read failed"));
    return stream;
  });
}

function makeDeps(overrides: Partial<PdfDownloadDeps> = {}): PdfDownloadDeps {
  return {
    prisma: makePrisma(),
    pdfDir,
    sessionCookieName: AUTH_COOKIE_NAME,
    verifySessionToken: () => headSession,
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    logger: createNullLogger(),
    ...overrides,
  };
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "pdf-handler-"));
  pdfDir = join(fixtureRoot, "artifacts");
  mkdirSync(pdfDir);
  vi.mocked(createReadStream).mockImplementation((path, options) => {
    const stream = realFs.createReadStream(path, options);
    ownedStreams.push(stream);
    return stream;
  });
  vi.stubEnv("AUTH_JWT_SECRET", SESSION_SECRET);
  vi.stubEnv("PDF_EXPORT_JWT_SECRET", PDF_SECRET);
});

afterEach(async () => {
  await Promise.all(
    ownedStreams.splice(0).map(async (stream) => {
      if (stream.closed) return;
      const closed = new Promise<void>((resolve) =>
        stream.once("close", resolve),
      );
      stream.destroy();
      await closed;
    }),
  );
  rmSync(fixtureRoot, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("handlePdfDownload", () => {
  it.each(["during delivery", "before stream connection"])(
    "closes the real file descriptor when the response closes %s",
    async (timing) => {
      const bytes = Buffer.alloc(1024 * 1024, "p");
      writeArtifact(1, bytes);
      const res = new MockResponse();
      if (timing === "before stream connection") res.destroy();
      else {
        res._write = (chunk, _encoding, callback) => {
          expect(chunk.length).toBeLessThan(bytes.length);
          res.destroy();
          callback();
        };
      }

      await handlePdfDownload(
        makeReq({ cookie: "valid" }),
        asResponse(res),
        makeDeps({ prisma: makePrisma({ job: completedJob() }) }),
      );
      const stream = ownedStreams[0];
      const options = vi.mocked(createReadStream).mock.calls[0]?.[1];
      const fd =
        options && typeof options === "object" ? options.fd : undefined;
      if (!stream || typeof fd !== "number") {
        throw new Error("Expected an owned file readable and descriptor");
      }
      if (!stream.closed) await once(stream, "close");

      expect(stream.destroyed).toBe(true);
      expect(stream.readableEnded).toBe(false);
      expect(() => fstatSync(fd)).toThrow(
        expect.objectContaining({ code: "EBADF" }),
      );
      expect(res.listenerCount("close")).toBe(0);
    },
  );

  it("streams the PDF for an authenticated, in-scope caller (200)", async () => {
    writeArtifact(1, "PDF-BYTES");
    const res = new MockResponse();
    const finished = new Promise<void>((r) => res.on("finish", () => r()));

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        verifySessionToken: () => viewerSession,
        prisma: makePrisma({
          job: completedJob(viewerSession.userId),
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

  it("reads the session cookie under the deps cookie name (200)", async () => {
    writeArtifact(1, "PDF-BYTES");
    const res = new MockResponse();
    const finished = new Promise<void>((r) => res.on("finish", () => r()));

    await handlePdfDownload(
      makeReq({ cookie: "valid", cookieName: "test_pdf_session" }),
      asResponse(res),
      makeDeps({
        sessionCookieName: "test_pdf_session",
        verifySessionToken: () => viewerSession,
        prisma: makePrisma({
          job: completedJob(viewerSession.userId),
          reportAuthorized: true,
          viewerGroups: ["group-1"],
        }),
      }),
    );
    await finished;

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("PDF-BYTES");
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
      cookies: { [AUTH_COOKIE_NAME]: 123_456 },
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
    writeArtifact(1, "PDF-BYTES");
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

  describe.each(["EACCES", "ENOTDIR"] as const)(
    "native %s artifact open failure",
    (code) => {
      // Root can bypass chmod permission bits; ENOTDIR stays native coverage at any UID.
      it.skipIf(
        code === "EACCES" &&
          (typeof process.getuid !== "function" || process.getuid() === 0),
      )(
        "returns 500 after a readable control (EACCES requires a non-root POSIX user)",
        async () => {
          writeArtifact(1, "PDF-BYTES");
          const filePath = join(pdfDir, artifactName(1));
          const owner = {
            ...headSession,
            userId: "a0000000-0000-4000-8000-000000000001",
            reportingGroupId: "b0000000-0000-4000-8000-000000000001",
          };
          const authController = createAuthController(process.env);
          const token = authController.issueSessionCookie(owner).token;
          const prisma = {
            ...makePrisma({ job: completedJob(owner.userId) }),
            user: {
              findUnique: () =>
                Promise.resolve({
                  isActive: true,
                  role: "head",
                  reportingGroupId: owner.reportingGroupId,
                  reportingGroup: { name: "Group 1" },
                  viewerGroupAccess: [],
                }),
            },
          } as unknown as PrismaService;
          const logError = vi.fn();
          const deps = makeDeps({
            prisma,
            verifySessionToken: (value) =>
              authController.verifySessionToken(value),
            logger: { ...createNullLogger(), error: logError },
          });
          const readable = new MockResponse();
          const finished = once(readable, "finish");
          await handlePdfDownload(
            makeReq({ cookie: token }),
            asResponse(readable),
            deps,
          );
          await finished;
          expect(readable.statusCode).toBe(200);
          expect(readable.body).toBe("PDF-BYTES");

          const failingDirectory =
            code === "EACCES" ? pdfDir : join(fixtureRoot, "not-a-directory");
          if (code === "EACCES") chmodSync(filePath, 0o000);
          else writeFileSync(failingDirectory, "regular file");
          try {
            expect(() =>
              realFs.openSync(
                join(failingDirectory, artifactName(1)),
                realFs.constants.O_RDONLY,
              ),
            ).toThrow(expect.objectContaining({ code }));
            const unreadable = new MockResponse();
            await handlePdfDownload(
              makeReq({ cookie: token }),
              asResponse(unreadable),
              { ...deps, pdfDir: failingDirectory },
            );
            expect(unreadable.body).toBe("");
            expect(unreadable.statusCode).toBe(500);
            expect(logError).toHaveBeenCalledExactlyOnceWith(
              "pdf artifact open failed",
              {
                jobId: JOB_ID,
                code,
              },
            );
          } finally {
            if (code === "EACCES") chmodSync(filePath, 0o600);
          }
        },
      );
    },
  );

  it("refuses to serve an artifact that is a symlink planted in the artifacts dir (404)", async () => {
    // A symlink at the generation-scoped artifact path must be rejected at
    // open (O_NOFOLLOW), never followed outside the pdfDir root.
    const outside = join(fixtureRoot, "outside.txt");
    writeFileSync(outside, "SECRET-OUTSIDE-BYTES");
    symlinkSync(outside, join(pdfDir, artifactName(1)));
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
    writeArtifact(1, "PDF-BYTES");
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
    writeArtifact(1, "PDF-BYTES");
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

  it("serves only the completed row's generation file when older generations remain on disk", async () => {
    // Generations 1 and 2 both exist; the row completed at generation 2, so
    // only the g2 bytes may be selected — never the g1 file.
    writeArtifact(1, "STALE-G1-BYTES");
    writeArtifact(2, "CURRENT-G2-BYTES");
    const res = new MockResponse();
    const finished = new Promise<void>((r) => res.on("finish", () => r()));

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({
          job: completedJob(headSession.userId, 2),
          reportAuthorized: true,
        }),
      }),
    );
    await finished;

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("CURRENT-G2-BYTES");
  });

  it("returns 404 when only an older generation's file exists on disk", async () => {
    writeArtifact(1, "STALE-G1-BYTES");
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({
          job: completedJob(headSession.userId, 2),
          reportAuthorized: true,
        }),
      }),
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
  });

  it("never falls back to the legacy un-suffixed artifact name", async () => {
    // A pre-protocol `${jobId}.pdf` file must not be served even for a
    // generation-1 row — generation resolution is mandatory.
    writeFileSync(join(pdfDir, `${JOB_ID}.pdf`), "LEGACY-BYTES");
    const res = new MockResponse();

    await handlePdfDownload(
      makeReq({ cookie: "valid" }),
      asResponse(res),
      makeDeps({
        prisma: makePrisma({
          job: completedJob(headSession.userId, 1),
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
    vi.stubEnv("AUTH_DEV_MODE", "true");
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
    writeArtifact(1, "PDF-BYTES");
    failNextRead();
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
    writeArtifact(1, "PDF-BYTES");
    failNextRead();
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
    writeArtifact(1, "PDF-BYTES");
    failNextRead();
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

describe("report-read-access canReadReport", () => {
  const GROUP_ID = "33333333-3333-4333-8333-333333333333";
  const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
  const SECTION_ID = "55555555-5555-4555-8555-555555555555";

  function publishedReportRow() {
    const publishedAt = new Date("2026-04-18T18:00:00.000Z");
    return {
      id: REPORT_ID,
      status: "published",
      periodStatus: "published",
      publishedSnapshot: publishedReportSnapshotSchema.parse({
        reportId: REPORT_ID,
        periodStart: new Date("2026-04-14T00:00:00.000Z"),
        periodEnd: new Date("2026-04-18T00:00:00.000Z"),
        deadline: null,
        status: "published",
        publishedAt,
        publishedById: null,
        publishedByName: "system",
        portfolioOverview: {
          status: "green",
          totals: { green: 0, yellow: 0, red: 0 },
        },
        sections: [
          {
            ...makeReportSectionReadModel({
              reportSectionId: SECTION_ID,
              reportId: REPORT_ID,
              authorId: AUTHOR_ID,
            }),
            groupId: GROUP_ID,
            groupName: "Frozen Group",
          },
        ],
      }),
    };
  }

  it("authorizes a viewer from frozen section ownership without a live-section query", async () => {
    const findUnique = vi.fn(() => Promise.resolve(publishedReportRow()));
    const findFirst = vi.fn();
    const prisma = {
      report: { findUnique, findFirst },
    } as unknown as PrismaService;
    const viewer: UserSession = {
      ...viewerSession,
      viewerGroupAccess: [GROUP_ID],
    };

    const allowed = await canReadReport(viewer, REPORT_ID, prisma);

    expect(allowed).toBe(true);
    expect(findUnique).toHaveBeenCalledOnce();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("denies an empty-access viewer from the same frozen snapshot", async () => {
    const findUnique = vi.fn(() => Promise.resolve(publishedReportRow()));
    const findFirst = vi.fn();
    const prisma = {
      report: { findUnique, findFirst },
    } as unknown as PrismaService;
    const viewer: UserSession = { ...viewerSession, viewerGroupAccess: [] };

    const allowed = await canReadReport(viewer, REPORT_ID, prisma);

    expect(allowed).toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("authorizes an admin only after validating the published snapshot", async () => {
    const findUnique = vi.fn(() => Promise.resolve(publishedReportRow()));
    const prisma = { report: { findUnique } } as unknown as PrismaService;
    const admin: UserSession = { ...headSession, role: "admin" };

    expect(await canReadReport(admin, REPORT_ID, prisma)).toBe(true);
    expect(findUnique).toHaveBeenCalled();
  });
});
