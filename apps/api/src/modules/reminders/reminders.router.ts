import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type PaginatedResult,
} from "@customreport/shared";

import type { RemindersService } from "./reminders.service";

export interface RemindersRequestContext {
  remindersService: RemindersService;
  recipientEmail: string;
  ruleId: string;
}

export interface RemindersListContext {
  remindersService: RemindersService;
  ruleId: string;
}

export const remindersRouter = {
  async requestExecution(
    ctx: RemindersRequestContext,
  ): Promise<AdminReminderExecution> {
    return adminReminderExecutionSchema.parse(
      await ctx.remindersService.requestReminderExecution(
        ctx.ruleId,
        ctx.recipientEmail,
      ),
    );
  },
  async listExecutions(
    ctx: RemindersListContext,
  ): Promise<PaginatedResult<AdminReminderExecution>> {
    const result = await ctx.remindersService.listExecutions(ctx.ruleId);

    return {
      items: adminReminderExecutionSchema.array().parse(result.items),
      nextCursor: result.nextCursor,
    };
  },
};
