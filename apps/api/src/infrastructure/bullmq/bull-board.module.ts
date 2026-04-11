import type { Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

import { createAuthController } from '../../modules/auth/auth.controller';

/**
 * Mount Bull Board monitoring UI at /admin/queues.
 *
 * Retrieves the registered BullMQ queues from the NestJS DI container
 * and wires them into the Bull Board Express adapter.
 * Protected by JWT auth — only head role can access.
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

  const authController = createAuthController(process.env);

  const requireHead = (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies?.['customreport_session'] as string | undefined;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const session = authController.verifySessionToken(token);

      if (session.role !== 'head') {
        res.status(403).json({ error: 'Head role required' });
        return;
      }

      next();
    } catch {
      res.status(401).json({ error: 'Invalid session' });
    }
  };

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/admin/queues', requireHead, serverAdapter.getRouter());
}
