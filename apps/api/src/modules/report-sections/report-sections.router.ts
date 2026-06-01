import type {
  DraftSavePayload,
  ReportSectionReadModel,
  SubmitSectionPayload,
  UserSession,
} from "@customreport/shared";
import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  submitSectionSchema,
} from "@customreport/shared";

import type { ReportSectionsService } from "./report-sections.service";

export interface ReportSectionsRouterContext {
  reportSectionsService: ReportSectionsService;
  session: UserSession;
}

export const reportSectionsRouter = {
  async getActiveSection(
    ctx: ReportSectionsRouterContext,
  ): Promise<ReportSectionReadModel> {
    return reportSectionReadModelSchema.parse(
      await ctx.reportSectionsService.getActiveSection(
        ctx.session.activeReportSectionId ?? "",
      ),
    );
  },
  async saveDraft(
    ctx: ReportSectionsRouterContext,
    input: DraftSavePayload,
  ): Promise<ReportSectionReadModel> {
    return reportSectionReadModelSchema.parse(
      await ctx.reportSectionsService.saveDraft(
        draftSaveSchema.parse(input),
        ctx.session.userId,
      ),
    );
  },
  async submitSection(
    ctx: ReportSectionsRouterContext,
    input: SubmitSectionPayload,
  ): Promise<ReportSectionReadModel> {
    return reportSectionReadModelSchema.parse(
      await ctx.reportSectionsService.submitSection(
        submitSectionSchema.parse(input),
        ctx.session.userId,
      ),
    );
  },
};
