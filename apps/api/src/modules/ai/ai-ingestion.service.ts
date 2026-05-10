// Phase 54 (UFB-055): AiIngestionService — fire-and-forget enqueue
// surface called by PublicationService.publishReport / publishAuto and
// by PeriodService.publishPeriod. Writes one `AiIngestionJob` row per
// published section so a future worker can batch-process them.
//
// This is the seam for the future RAG pipeline. No LLM call happens
// here; only DB inserts. The contract is:
//
//   - Calling code (PublicationService etc.) MUST swallow errors so
//     the publish path is never broken by ingestion. The service
//     itself catches DB errors internally and logs; calling code
//     should still wrap in try/catch as belt-and-braces.
//   - Idempotency is intentionally NOT enforced at this layer. The
//     worker is the one that dedupes by content hash.

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { createNullLogger, type AppLogger } from '../../lib/logger.js';

/**
 * Port used by callers to push section ids without depending on the
 * concrete PrismaService.
 */
export interface AiIngestionPort {
  enqueueSections(sectionIds: readonly string[]): Promise<void>;
}

/**
 * No-op port wired into PeriodService / PublicationService tests so
 * existing fixtures that don't care about ingestion stay green.
 */
export class NullAiIngestion implements AiIngestionPort {
  async enqueueSections(_sectionIds: readonly string[]): Promise<void> {
    // Intentionally blank.
  }
}

@Injectable()
export class AiIngestionService implements AiIngestionPort {
  // Logger is intentionally NOT a constructor parameter — Nest's DI
  // would try to resolve it as a provider and fail (AppLogger is built
  // in main.ts, not registered as a Nest token). Tests that want to
  // capture the log signal use `withLogger` to swap in a recording
  // logger.
  private logger: AppLogger = createNullLogger();

  constructor(private readonly prisma: PrismaService) {}

  /** Test-only: replace the internal logger with a recording logger. */
  withLogger(logger: AppLogger): this {
    this.logger = logger;
    return this;
  }

  /**
   * Enqueues one `AiIngestionJob` row per given section id in `pending`
   * status. Errors are caught and logged — never rethrown — so a
   * downstream DB blip cannot break a publication.
   *
   * Uses `createMany` with `skipDuplicates: false` (jobs have a uuid
   * pk so collisions are impossible) — the worker is the dedup point.
   */
  async enqueueSections(sectionIds: readonly string[]): Promise<void> {
    if (sectionIds.length === 0) return;
    try {
      await this.prisma.aiIngestionJob.createMany({
        data: sectionIds.map((reportSectionId) => ({
          reportSectionId,
          status: 'pending',
        })),
      });
      this.logger.info('ai ingestion enqueued', {
        count: sectionIds.length,
      });
    } catch (err) {
      // Fire-and-forget: log and continue. Publication path keeps moving.
      this.logger.warn('ai ingestion enqueue failed', {
        count: sectionIds.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
