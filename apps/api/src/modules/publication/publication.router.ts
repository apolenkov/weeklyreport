import {
  type AssembledReport,
  assembledReportSchema,
  type UserSession,
} from "@customreport/shared";

import { createRoleGuard } from "../auth/roles.guard";
import {
  PublicationAccessError,
  type PublicationService,
} from "./publication.service";

export interface PublicationRouterContext {
  publicationService: PublicationService;
  session: UserSession;
}

const headRoleGuard = createRoleGuard("head");

function assertHeadAccess(session: UserSession): string {
  if (!headRoleGuard.canActivate({ user: { role: session.role } })) {
    throw new PublicationAccessError(
      "Assembled report is available only to head users.",
    );
  }

  if (!session.activeReportId) {
    throw new PublicationAccessError(
      "Assembled report requires an active report.",
    );
  }

  return session.activeReportId;
}

export const publicationRouter = {
  async getAssembledReport(
    ctx: PublicationRouterContext,
  ): Promise<AssembledReport> {
    const activeReportId = assertHeadAccess(ctx.session);

    return assembledReportSchema.parse(
      await ctx.publicationService.getAssembledReport(activeReportId),
    );
  },
  async publishReport(ctx: PublicationRouterContext): Promise<AssembledReport> {
    const activeReportId = assertHeadAccess(ctx.session);

    return assembledReportSchema.parse(
      await ctx.publicationService.publishReport(activeReportId, ctx.session),
    );
  },
};
