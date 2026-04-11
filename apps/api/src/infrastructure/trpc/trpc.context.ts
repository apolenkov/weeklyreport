import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { INestApplication } from '@nestjs/common';
import type { UserSession } from '@customreport/shared';

import { createAuthController } from '../../modules/auth/auth.controller.js';

const DEV_SESSION: UserSession = {
  userId: 'a0000000-0000-4000-8000-000000000099',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: 'a0000000-0000-4000-8000-000000000001',
  activeReportSectionId: null,
};

export type TrpcContext = {
  session: UserSession | null;
};

export function createContextFactory(_app: INestApplication) {
  const authController = createAuthController(process.env);

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    if (process.env['AUTH_DEV_MODE'] === 'true') {
      return { session: DEV_SESSION };
    }

    const token = req.cookies?.['customreport_session'] as string | undefined;

    if (!token) {
      return { session: null };
    }

    try {
      const session = authController.verifySessionToken(token);

      return { session };
    } catch {
      return { session: null };
    }
  };
}
