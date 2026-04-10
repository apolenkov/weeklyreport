import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { INestApplication } from '@nestjs/common';
import type { UserSession } from '@customreport/shared';

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
  return async ({ req: _req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    if (process.env['AUTH_DEV_MODE'] === 'true') {
      return { session: DEV_SESSION };
    }

    // Phase 6: extract JWT from cookie, verify, return session
    return { session: null };
  };
}
