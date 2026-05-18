import { describe, expect, it, vi, beforeEach } from "vitest";
import { silenceStderr } from "../../test-utils/silence-logs";
import type { Job } from "bullmq";

// ---------------------------------------------------------------------------
// Module mocks — factories use vi.fn() inline (no outer variable references)
// because vi.mock is hoisted before variable declarations.
// ---------------------------------------------------------------------------

// Mock NestJS common so decorators are no-ops in tests
vi.mock("@nestjs/common", () => ({
  Injectable: () => (target: unknown) => target,
  OnModuleInit: class {},
  OnModuleDestroy: class {},
}));

// Mock bullmq Worker so no Redis connection is attempted
vi.mock("bullmq", () => ({
  Worker: class {
    static instances: Array<{
      handlers: Record<string, (...args: never[]) => void>;
    }> = [];

    handlers: Record<string, (...args: never[]) => void> = {};

    constructor() {
      (
        this.constructor as typeof import("bullmq").Worker & {
          instances: Array<{
            handlers: Record<string, (...args: never[]) => void>;
          }>;
        }
      ).instances.push(this);
    }

    on(event: string, handler: (...args: never[]) => void) {
      this.handlers[event] = handler;
    }

    close() {
      return Promise.resolve();
    }
  },
}));

// Mock the service (and its transitive @customreport/shared dependency)
vi.mock("../../modules/pdf-export/pdf-export.service.js", () => ({
  PdfExportService: class {
    markExportCompleted = vi.fn();
    markExportFailed = vi.fn();
    buildAuthCookies = vi.fn().mockReturnValue([
      {
        name: "customreport_session",
        value: "fake-jwt",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
      },
    ]);
  },
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  createHash: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { chromium } from "playwright";
import { Worker } from "bullmq";
import { createHash } from "node:crypto";
import { PdfExportProcessor } from "./pdf-export.processor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPdfExportService() {
  return {
    markExportCompleted: vi.fn().mockResolvedValue(undefined),
    markExportFailed: vi.fn().mockResolvedValue(undefined),
    // AUTH-05 (Phase 28-02): processor calls buildAuthCookies before page.goto.
    buildAuthCookies: vi.fn().mockReturnValue([
      {
        name: "customreport_session",
        value: "fake-jwt",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
      },
    ]),
  };
}

type PdfExportJobData = { reportId: string; jobId: string; authToken: string };

function createMockJob(data: PdfExportJobData): Job<PdfExportJobData> {
  return { data } as Job<PdfExportJobData>;
}

// Test seam — `processJob` is `private` on the class, but tests need to invoke
// it directly. Cast through this interface to call without `as any`.
type ProcessorTestSeam = {
  processJob(job: Job<PdfExportJobData>): Promise<void>;
};

function setupMocks() {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
  };

  // AUTH-05 (Phase 28-02): processor now creates a context first then a page so
  // it can addCookies before navigation. Mocks must mirror that shape.
  const mockContext = {
    addCookies: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as never);

  vi.mocked(createHash).mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("abc123hash"),
  } as never);

  return { mockPage, mockBrowser, mockContext };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PdfExportProcessor.processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches Chromium with headless: true", async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      authToken: "fake-jwt",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
  });

  it("navigates to correct report URL", async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      authToken: "fake-jwt",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    // Phase 33-03: print route lives at /print/[id] (top-level, outside the
    // (app) route group) so the print viewport doesn't inherit NavBar/DEV
    // switcher chrome — see commit d45e5b2.
    expect(mockPage.goto).toHaveBeenCalledWith(
      "http://localhost:3000/print/report-1",
      { waitUntil: "networkidle" },
    );
  });

  it("generates PDF with A4 format and printBackground: true", async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      authToken: "fake-jwt",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockPage.pdf).toHaveBeenCalledWith({
      format: "A4",
      printBackground: true,
    });
  });

  it("marks export completed with correct args", async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      authToken: "fake-jwt",
    });

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockService.markExportCompleted).toHaveBeenCalledWith(
      "job-1",
      "/pdfs/job-1.pdf",
      "abc123hash",
    );
  });

  it("closes browser in finally block even if page.goto throws", async () => {
    silenceStderr();
    const { mockPage, mockBrowser } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({
      reportId: "report-1",
      jobId: "job-1",
      authToken: "fake-jwt",
    });

    mockPage.goto.mockRejectedValue(new Error("navigation failed"));

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("navigation failed");

    expect(mockBrowser.close).toHaveBeenCalledOnce();
  });
});

describe("PdfExportProcessor.onModuleInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      Worker as unknown as {
        instances: Array<{
          handlers: Record<string, (...args: never[]) => void>;
        }>;
      }
    ).instances = [];
  });

  it("marks the DB export job failed when BullMQ reports terminal failure", () => {
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);

    processor.onModuleInit();

    const instances = (
      Worker as unknown as {
        instances: Array<{
          handlers: Record<string, (...args: never[]) => void>;
        }>;
      }
    ).instances;
    const failedHandler = instances.at(-1)?.handlers["failed"];
    expect(failedHandler).toBeTypeOf("function");

    failedHandler?.(
      createMockJob({
        reportId: "report-1",
        jobId: "job-1",
        authToken: "fake-jwt",
      }) as never,
      new Error("browser missing") as never,
    );

    expect(mockService.markExportFailed).toHaveBeenCalledWith(
      "job-1",
      "browser missing",
    );
  });
});
