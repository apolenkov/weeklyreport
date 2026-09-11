import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";

vi.mock("@nestjs/common", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nestjs/common")>()),
  Injectable: () => (target: unknown) => target,
}));

vi.mock("../../modules/pdf-export/index.js", () => ({
  PdfExportService: class {
    markExportCompleted = vi.fn();
    markExportFailed = vi.fn();
    signPdfExportToken = vi.fn().mockReturnValue("fresh-jwt");
    buildAuthCookies = vi.fn();
  },
}));

import type { EnvConfig } from "../config/env.schema";
import {
  type PdfArtifactAttempt,
  type PdfArtifactStore,
  PdfExportProcessor as ProductionPdfExportProcessor,
} from "./pdf-export.processor.js";

const TEST_OUTPUT_DIR = "artifact-test-output";

function createMockPdfExportService() {
  return {
    markExportCompleted: vi.fn().mockResolvedValue(undefined),
    markExportFailed: vi.fn().mockResolvedValue(undefined),
    signPdfExportToken: vi.fn().mockReturnValue("fresh-jwt"),
    buildAuthCookies: vi.fn(),
  };
}

class ImmediateArtifactStore implements PdfArtifactStore {
  readonly createAttempt = vi.fn(
    (_outputDir: string, jobId: string, pdfBuffer: Buffer) => {
      const tempPath = `${TEST_OUTPUT_DIR}/.${jobId}.attempt-${this.attempts.size}.pdf.tmp`;
      const attempt = {
        tempPath,
        canonicalPath: `${TEST_OUTPUT_DIR}/${jobId}.pdf`,
      };
      this.attempts.set(tempPath, Buffer.from(pdfBuffer));
      return Promise.resolve(attempt);
    },
  );

  readonly publishAndHash = vi.fn((attempt: PdfArtifactAttempt) => {
    const bytes = this.attempts.get(attempt.tempPath);
    if (!bytes) {
      return Promise.reject(
        new Error(`missing temp attempt ${attempt.tempPath}`),
      );
    }
    this.canonicalBytes ??= Buffer.from(bytes);
    return Promise.resolve(
      createHash("sha256").update(this.canonicalBytes).digest("hex"),
    );
  });

  readonly cleanupAttempt = vi.fn((attempt: PdfArtifactAttempt) => {
    this.attempts.delete(attempt.tempPath);
    return Promise.resolve();
  });

  canonicalBytes: Buffer | undefined;
  protected readonly attempts = new Map<string, Buffer>();
}

class InterleavingArtifactStore extends ImmediateArtifactStore {
  private publishCount = 0;
  private releaseFirstPublish: (() => void) | undefined;

  override readonly publishAndHash = vi.fn(
    (attempt: PdfArtifactAttempt): Promise<string> => {
      const bytes = this.attempts.get(attempt.tempPath);
      if (!bytes) {
        return Promise.reject(
          new Error(`missing temp attempt ${attempt.tempPath}`),
        );
      }
      this.canonicalBytes ??= Buffer.from(bytes);
      this.publishCount += 1;
      const checksum = createHash("sha256")
        .update(this.canonicalBytes)
        .digest("hex");

      if (this.publishCount === 1) {
        return new Promise<string>((resolve) => {
          this.releaseFirstPublish = () => resolve(checksum);
        });
      }

      this.releaseFirstPublish?.();
      this.releaseFirstPublish = undefined;
      return Promise.resolve(checksum);
    },
  );
}

class PdfExportProcessor extends ProductionPdfExportProcessor {
  constructor(
    service: ConstructorParameters<typeof ProductionPdfExportProcessor>[0],
    env: EnvConfig,
    logger: AppLogger,
    private readonly artifactStore: PdfArtifactStore,
  ) {
    super(service, env, logger, null);
  }

  protected override createArtifactStore(): PdfArtifactStore {
    return this.artifactStore;
  }
}

const STUB_ENV = {
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  PDF_BASE_URL: "http://localhost:3000",
  PDF_OUTPUT_DIR: TEST_OUTPUT_DIR,
} as EnvConfig;

interface ProcessorArtifactSeam {
  persistCompletedArtifact(input: {
    artifactUrl: string;
    jobId: string;
    outputDir: string;
    pdfBuffer: Buffer;
  }): Promise<{ artifactUrl: string; checksum: string }>;
}

function persist(
  processor: PdfExportProcessor,
  jobId: string,
  pdfBuffer: Buffer,
): Promise<{ artifactUrl: string; checksum: string }> {
  return (
    processor as unknown as ProcessorArtifactSeam
  ).persistCompletedArtifact({
    artifactUrl: `/pdfs/${jobId}.pdf`,
    jobId,
    outputDir: TEST_OUTPUT_DIR,
    pdfBuffer,
  });
}

describe("PdfExportProcessor artifact publication races", () => {
  it("keeps winner bytes when a concurrent completion loses and cleans only its temp", async () => {
    const store = new InterleavingArtifactStore();
    const mockService = createMockPdfExportService();
    let completionCount = 0;
    let dbChecksum: string | undefined;
    mockService.markExportCompleted.mockImplementation(
      (_jobId: string, _artifactUrl: string, checksum: string) => {
        completionCount += 1;
        if (completionCount === 1) {
          dbChecksum = checksum;
          return Promise.resolve();
        }
        return Promise.reject(new Error("terminal state conflict"));
      },
    );
    const logger = createNullLogger();
    const processorA = new PdfExportProcessor(
      mockService as never,
      STUB_ENV,
      logger,
      store,
    );
    const processorB = new PdfExportProcessor(
      mockService as never,
      STUB_ENV,
      logger,
      store,
    );
    const winnerBytes = Buffer.from("attempt-a-bytes");
    const loserBytes = Buffer.from("attempt-b-bytes");

    const results = await Promise.allSettled([
      persist(processorA, "job-1", winnerBytes),
      persist(processorB, "job-1", loserBytes),
    ]);

    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(store.canonicalBytes).toEqual(winnerBytes);
    expect(dbChecksum).toBe(
      createHash("sha256").update(winnerBytes).digest("hex"),
    );
    expect(store.cleanupAttempt).toHaveBeenCalledTimes(2);
  });

  it("leaves canonical bytes when failure wins after publication", async () => {
    const store = new ImmediateArtifactStore();
    const mockService = createMockPdfExportService();
    let row: {
      status: "pending" | "failed";
      filePath: string | null;
      checksum: string | null;
      error: string | null;
    } = {
      status: "pending",
      filePath: null,
      checksum: null,
      error: null,
    };
    mockService.markExportCompleted.mockImplementation(() => {
      row = {
        status: "failed",
        filePath: null,
        checksum: null,
        error: "terminal failure won",
      };
      return Promise.reject(new Error("terminal state conflict"));
    });
    const processor = new PdfExportProcessor(
      mockService as never,
      STUB_ENV,
      createNullLogger(),
      store,
    );
    const bytes = Buffer.from("published-but-failed");

    await expect(persist(processor, "job-1", bytes)).rejects.toThrow(
      "terminal state conflict",
    );

    expect(row).toEqual({
      status: "failed",
      filePath: null,
      checksum: null,
      error: "terminal failure won",
    });
    expect(store.canonicalBytes).toEqual(bytes);
    expect(store.cleanupAttempt).toHaveBeenCalledOnce();
  });

  it("adopts canonical bytes after a crash before completion CAS", async () => {
    const store = new ImmediateArtifactStore();
    const mockService = createMockPdfExportService();
    mockService.markExportCompleted.mockRejectedValueOnce(
      new Error("crash before CAS"),
    );
    const processor = new PdfExportProcessor(
      mockService as never,
      STUB_ENV,
      createNullLogger(),
      store,
    );
    const publishedBytes = Buffer.from("published-before-crash");

    await expect(persist(processor, "job-1", publishedBytes)).rejects.toThrow(
      "crash before CAS",
    );
    const retryChecksum = createHash("sha256")
      .update(publishedBytes)
      .digest("hex");
    let observedChecksum: string | undefined;
    mockService.markExportCompleted.mockImplementationOnce(
      (_jobId: string, _artifactUrl: string, checksum: string) => {
        observedChecksum = checksum;
        return Promise.resolve();
      },
    );

    await persist(processor, "job-1", Buffer.from("retry-bytes"));

    expect(observedChecksum).toBe(retryChecksum);
    expect(store.canonicalBytes).toEqual(publishedBytes);
    expect(store.cleanupAttempt).toHaveBeenCalledTimes(2);
  });

  it("retries an identical completed artifact without changing canonical bytes", async () => {
    const store = new ImmediateArtifactStore();
    const mockService = createMockPdfExportService();
    let completedChecksum: string | undefined;
    mockService.markExportCompleted.mockImplementation(
      (_jobId: string, _artifactUrl: string, checksum: string) => {
        if (completedChecksum === undefined) {
          completedChecksum = checksum;
          return Promise.resolve();
        }
        expect(checksum).toBe(completedChecksum);
        return Promise.resolve();
      },
    );
    const processor = new PdfExportProcessor(
      mockService as never,
      STUB_ENV,
      createNullLogger(),
      store,
    );
    const bytes = Buffer.from("idempotent-bytes");

    await persist(processor, "job-1", bytes);
    await persist(processor, "job-1", Buffer.from("different-retry-bytes"));

    expect(mockService.markExportCompleted).toHaveBeenCalledTimes(2);
    expect(store.canonicalBytes).toEqual(bytes);
    expect(store.cleanupAttempt).toHaveBeenCalledTimes(2);
  });

  it("does not turn a completed DB write into a retry when temp cleanup fails", async () => {
    const store = new ImmediateArtifactStore();
    store.cleanupAttempt.mockRejectedValue(new Error("temp cleanup failed"));
    const mockService = createMockPdfExportService();
    const warn = vi.fn<AppLogger["warn"]>();
    const logger: AppLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn,
      error: vi.fn(),
      child: () => logger,
    };
    const processor = new PdfExportProcessor(
      mockService as never,
      STUB_ENV,
      logger,
      store,
    );

    await persist(processor, "job-1", Buffer.from("completed-bytes"));

    expect(mockService.markExportCompleted).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "pdf-export attempt cleanup failed after completion",
      expect.objectContaining({
        jobId: "job-1",
        tempPath: `${TEST_OUTPUT_DIR}/.job-1.attempt-0.pdf.tmp`,
        error: "temp cleanup failed",
      }),
    );
  });
});
