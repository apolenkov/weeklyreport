import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

/**
 * Mount Bull Board monitoring UI at /admin/queues.
 *
 * Retrieves the registered BullMQ queues from the NestJS DI container
 * and wires them into the Bull Board Express adapter.
 *
 * Authentication for this endpoint should be layered via middleware
 * checking JWT role (head only). For now, it is accessible by path.
 */
export function mountBullBoard(app: INestApplication): void {
  const pdfQueue = app.get<Queue>(getQueueToken('pdf-export'));
  const emailQueue = app.get<Queue>(getQueueToken('email-reminder'));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(pdfQueue),
      new BullMQAdapter(emailQueue),
    ],
    serverAdapter,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/admin/queues', serverAdapter.getRouter());
}
