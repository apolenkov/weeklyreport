import { initTRPC } from "@trpc/server";

import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  submissionDashboardRowSchema,
  submitSectionSchema,
} from "../schemas/report";

const t = initTRPC.create();

export const sharedRouter = t.router({
  getActiveSection: t.procedure
    .output(reportSectionReadModelSchema)
    .query(() => {
      throw new Error("Not implemented in shared contract layer");
    }),
  saveDraft: t.procedure
    .input(draftSaveSchema)
    .output(reportSectionReadModelSchema)
    .mutation(() => {
      throw new Error("Not implemented in shared contract layer");
    }),
  submitSection: t.procedure
    .input(submitSectionSchema)
    .output(reportSectionReadModelSchema)
    .mutation(() => {
      throw new Error("Not implemented in shared contract layer");
    }),
  getSubmissionDashboard: t.procedure
    .output(submissionDashboardRowSchema.array())
    .query(() => {
      throw new Error("Not implemented in shared contract layer");
    }),
});

export type SharedRouter = typeof sharedRouter;
