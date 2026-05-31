import {
  carryOverExecutionSchema,
  carryOverRecordSchema,
  reportSectionReadModelSchema,
} from "@customreport/shared";

import type { CarryOverService } from "./carry-over.service";

export type CarryOverRouterContext = {
  carryOverService: CarryOverService;
  sourceReportId: string;
  targetReportId: string;
};

export const carryOverRouter = {
  async executeCarryOver(ctx: CarryOverRouterContext) {
    const result = await ctx.carryOverService.executeCarryOver(
      ctx.sourceReportId,
      ctx.targetReportId,
    );

    return {
      execution: carryOverExecutionSchema.parse(result.execution),
      records: carryOverRecordSchema.array().parse(result.records),
      targetSection: reportSectionReadModelSchema.parse(result.targetSection),
    };
  },
};
