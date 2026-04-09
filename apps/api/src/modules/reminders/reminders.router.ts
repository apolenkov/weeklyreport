import { adminReminderExecutionSchema, type AdminReminderExecution } from '@customreport/shared';

import { type RemindersService } from './reminders.service';

export type RemindersRequestContext = {
  remindersService: RemindersService;
  recipientEmail: string;
  ruleId: string;
};

export type RemindersListContext = {
  remindersService: RemindersService;
  ruleId: string;
};

export const remindersRouter = {
  async requestExecution(ctx: RemindersRequestContext): Promise<AdminReminderExecution> {
    return adminReminderExecutionSchema.parse(
      await ctx.remindersService.requestReminderExecution(ctx.ruleId, ctx.recipientEmail),
    );
  },
  async listExecutions(ctx: RemindersListContext): Promise<AdminReminderExecution[]> {
    return adminReminderExecutionSchema.array().parse(
      await ctx.remindersService.listExecutions(ctx.ruleId),
    );
  },
};
