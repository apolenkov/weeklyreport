import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { INestApplication } from '@nestjs/common';
import type { UserSession } from '@customreport/shared';

import { createAuthController } from '../../modules/auth/auth.controller.js';

const DEV_SESSION: UserSession = {
  userId: '00000000-0000-0000-0000-000000000099',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '00000000-0000-0000-0000-000000000001',
  activeReportSectionId: null,
};

export type TrpcContext = {
  session: UserSession | null;
};

export function createContextFactory(_app: INestApplication) {
  const authController = createAuthController(process.env);

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    const token = req.cookies?.['customreport_session'] as string | undefined;

    if (token) {
      try {
        const session = authController.verifySessionToken(token);
        return { session };
      } catch {
        // Token invalid/expired -- fall through
      }
    }

    // In dev mode without a valid cookie, use fallback session
    if (process.env['AUTH_DEV_MODE'] === 'true') {
      return { session: DEV_SESSION };
    }

    return { session: null };
  };
}
