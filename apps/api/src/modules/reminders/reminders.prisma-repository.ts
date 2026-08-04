import {
  type AdminReminderExecution,
  type AdminReminderRule,
  type UserSession,
} from "@customreport/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type {
  DueDeadlineRule,
  DueEscalationRule,
  RemindersRepository,
} from "./reminders.types.js";
import {
  queryDueDeadlineRules,
  queryDueEscalationRules,
} from "./reminders-due-rules.prisma-query.js";
import {
  insertExecutionOnConflict,
  listStuckQueuedExecutions,
  markExecutionFailed,
  markStuckSendingSent,
  queryExecutionByDedupeKey,
  queryExecutionById,
  queryExecutionsPage,
  releaseExecutionClaim,
  requeueFailedExecution,
  transitionExecutionToSending,
  upsertExecution,
} from "./reminders-execution.prisma-query.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import {
  queryReminderRule,
  queryRulePeriodLabel,
} from "./reminders-rule.prisma-query.js";
import {
  queryActiveRuleForDispatch,
  queryDraftSectionsForDispatch,
  queryInScopeLeadId,
  queryInScopeSectionAuthorEmails,
  queryInScopeSectionId,
  queryRuleReportId,
} from "./reminders-scope.prisma-query.js";

@Injectable()
export class RemindersPrismaRepository implements RemindersRepository {
  private readonly logger = new Logger(RemindersPrismaRepository.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly findDueDeadlineRules = (now: Date): Promise<DueDeadlineRule[]> => {
    return queryDueDeadlineRules(this.prisma, now);
  };

  readonly findDueEscalationRules = (
    now: Date,
  ): Promise<DueEscalationRule[]> => {
    return queryDueEscalationRules(this.prisma, now, this.logger);
  };

  readonly getRuleReportId = (ruleId: string): Promise<string | null> => {
    return queryRuleReportId(this.prisma, ruleId);
  };

  readonly findInScopeSectionId = (
    session: UserSession,
    reportId: string,
  ): Promise<string | null> => {
    return queryInScopeSectionId(this.prisma, session, reportId);
  };

  readonly listInScopeSectionAuthorEmails = (
    session: UserSession,
    reportId: string,
  ): Promise<string[]> => {
    return queryInScopeSectionAuthorEmails(this.prisma, session, reportId);
  };

  readonly findInScopeLeadId = (
    session: UserSession,
    leadId: string,
  ): Promise<string | null> => {
    return queryInScopeLeadId(this.prisma, session, leadId);
  };

  readonly findActiveRuleForDispatch = (
    reportId: string,
    ruleId?: string,
  ): Promise<{ id: string; fireAt: Date } | null> => {
    return queryActiveRuleForDispatch(this.prisma, reportId, ruleId);
  };

  readonly findDraftSectionsForDispatch = (
    session: UserSession,
    reportId: string,
    leadId?: string,
  ): Promise<{ email: string; notificationOptOut: boolean }[]> => {
    return queryDraftSectionsForDispatch(
      this.prisma,
      session,
      reportId,
      leadId,
    );
  };

  readonly getRule = (ruleId: string): Promise<AdminReminderRule | null> => {
    return queryReminderRule(this.prisma, ruleId);
  };

  readonly getRulePeriodLabel = (ruleId: string): Promise<string | null> => {
    return queryRulePeriodLabel(this.prisma, ruleId);
  };

  readonly findExecutionByDedupeKey = (
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null> => {
    return queryExecutionByDedupeKey(this.prisma, dedupeKey);
  };

  readonly saveExecution = (
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution> => {
    return upsertExecution(this.prisma, execution);
  };

  readonly insertExecutionOnConflict = (
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }> => {
    return insertExecutionOnConflict(this.prisma, execution);
  };

  readonly transitionExecutionToSending = (
    executionId: string,
  ): Promise<boolean> => {
    return transitionExecutionToSending(this.prisma, executionId);
  };

  readonly releaseExecutionClaim = (executionId: string): Promise<void> => {
    return releaseExecutionClaim(this.prisma, executionId);
  };

  readonly markExecutionFailed = (
    executionId: string,
    errorMessage: string,
  ): Promise<void> => {
    return markExecutionFailed(this.prisma, executionId, errorMessage);
  };

  readonly requeueFailedExecution = (executionId: string): Promise<boolean> => {
    return requeueFailedExecution(this.prisma, executionId);
  };

  readonly listStuckQueuedExecutions = (
    olderThan: Date,
  ): Promise<AdminReminderExecution[]> => {
    return listStuckQueuedExecutions(this.prisma, olderThan);
  };

  readonly markStuckSendingSent = (olderThan: Date): Promise<number> => {
    return markStuckSendingSent(this.prisma, olderThan);
  };

  readonly getExecution = (
    executionId: string,
  ): Promise<AdminReminderExecution | null> => {
    return queryExecutionById(this.prisma, executionId);
  };

  readonly listExecutions = (
    ruleId: string,
    page: ExecutionPageRequest,
  ): Promise<AdminReminderExecution[]> => {
    return queryExecutionsPage(this.prisma, ruleId, page);
  };
}
