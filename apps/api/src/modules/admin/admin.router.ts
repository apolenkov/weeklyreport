import { type UserSession, adminSnapshotSchema } from '@customreport/shared';

import { createRoleGuard } from '../auth/roles.guard';
import { AdminAccessError, type AdminService } from './admin.service';

export type AdminRouterContext = {
  adminService: AdminService;
  session: UserSession;
};

const headRoleGuard = createRoleGuard('head');

function assertHeadAccess(session: UserSession): void {
  if (!headRoleGuard.canActivate({ user: { role: session.role } })) {
    throw new AdminAccessError('Admin panel is available only to head users.');
  }
}

export const adminRouter = {
  async getSnapshot(ctx: AdminRouterContext) {
    assertHeadAccess(ctx.session);
    return adminSnapshotSchema.parse(await ctx.adminService.getSnapshot());
  },
};
