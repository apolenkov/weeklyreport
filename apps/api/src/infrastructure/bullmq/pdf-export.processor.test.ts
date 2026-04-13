import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// ---------------------------------------------------------------------------
// Module mocks — factories use vi.fn() inline (no outer variable references)
// because vi.mock is hoisted before variable declarations.
// ---------------------------------------------------------------------------

// Mock NestJS common so decorators are no-ops in tests
vi.mock('@nestjs/common', () => ({
  Injectable: () => (target: unknown) => target,
  OnModuleInit: class {},
  OnModuleDestroy: class {},
}));

// Mock bullmq Worker so no Redis connection is attempted
vi.mock('bullmq', () => ({
  Worker: class {
    on() {}
    close() { return Promise.resolve(); }
  },
}));

// Mock the service (and its transitive @customreport/shared dependency)
vi.mock('../../modules/pdf-export/pdf-export.service.js', () => ({
  PdfExportService: class {
    markExportCompleted = vi.fn();
  },
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  createHash: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { PdfExportProcessor } from './pdf-export.processor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPdfExportService() {
  return {
    markExportCompleted: vi.fn().mockResolvedValue(undefined),
  };
}

type PdfExportJobData = { reportId: string; jobId: string };

function createMockJob(data: PdfExportJobData): Job<PdfExportJobData> {
  return { data } as Job<PdfExportJobData>;
}

function setupMocks() {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as never);

  vi.mocked(createHash).mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('abc123hash'),
  } as never);

  return { mockPage, mockBrowser };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfExportProcessor.processJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('launches Chromium with headless: true', async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({ reportId: 'report-1', jobId: 'job-1' });

    await (processor as any).processJob(job);

    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
  });

  it('navigates to correct report URL', async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({ reportId: 'report-1', jobId: 'job-1' });

    await (processor as any).processJob(job);

    expect(mockPage.goto).toHaveBeenCalledWith(
      'http://localhost:3000/reports/report-1/print',
      { waitUntil: 'networkidle' },
    );
  });

  it('generates PDF with A4 format and printBackground: true', async () => {
    const { mockPage } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({ reportId: 'report-1', jobId: 'job-1' });

    await (processor as any).processJob(job);

    expect(mockPage.pdf).toHaveBeenCalledWith({
      format: 'A4',
      printBackground: true,
    });
  });

  it('marks export completed with correct args', async () => {
    setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({ reportId: 'report-1', jobId: 'job-1' });

    await (processor as any).processJob(job);

    expect(mockService.markExportCompleted).toHaveBeenCalledWith(
      'job-1',
      '/pdfs/job-1.pdf',
      'abc123hash',
    );
  });

  it('closes browser in finally block even if page.goto throws', async () => {
    const { mockPage, mockBrowser } = setupMocks();
    const mockService = createMockPdfExportService();
    const processor = new PdfExportProcessor(mockService as never);
    const job = createMockJob({ reportId: 'report-1', jobId: 'job-1' });

    mockPage.goto.mockRejectedValue(new Error('navigation failed'));

    await expect((processor as any).processJob(job)).rejects.toThrow('navigation failed');

    expect(mockBrowser.close).toHaveBeenCalledOnce();
  });
});
