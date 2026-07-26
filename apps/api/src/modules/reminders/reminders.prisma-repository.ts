import {
  type AdminReminderExecution,
  type AdminReminderRule,
  type UserSession,
} from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";

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

  constructor(private readonly prisma: PrismaService) {}

  findDueDeadlineRules(now: Date): Promise<DueDeadlineRule[]> {
    return queryDueDeadlineRules(this.prisma, now);
  }

  findDueEscalationRules(now: Date): Promise<DueEscalationRule[]> {
    return queryDueEscalationRules(this.prisma, now, this.logger);
  }

  getRuleReportId(ruleId: string): Promise<string | null> {
    return queryRuleReportId(this.prisma, ruleId);
  }

  findInScopeSectionId(
    session: UserSession,
    reportId: string,
  ): Promise<string | null> {
    return queryInScopeSectionId(this.prisma, session, reportId);
  }

  listInScopeSectionAuthorEmails(
    session: UserSession,
    reportId: string,
  ): Promise<string[]> {
    return queryInScopeSectionAuthorEmails(this.prisma, session, reportId);
  }

  findInScopeLeadId(
    session: UserSession,
    leadId: string,
  ): Promise<string | null> {
    return queryInScopeLeadId(this.prisma, session, leadId);
  }

  findActiveRuleForDispatch(
    reportId: string,
    ruleId?: string,
  ): Promise<{ id: string; fireAt: Date } | null> {
    return queryActiveRuleForDispatch(this.prisma, reportId, ruleId);
  }

  findDraftSectionsForDispatch(
    session: UserSession,
    reportId: string,
    leadId?: string,
  ): Promise<{ email: string; notificationOptOut: boolean }[]> {
    return queryDraftSectionsForDispatch(
      this.prisma,
      session,
      reportId,
      leadId,
    );
  }

  getRule(ruleId: string): Promise<AdminReminderRule | null> {
    return queryReminderRule(this.prisma, ruleId);
  }

  getRulePeriodLabel(ruleId: string): Promise<string | null> {
    return queryRulePeriodLabel(this.prisma, ruleId);
  }

  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null> {
    return queryExecutionByDedupeKey(this.prisma, dedupeKey);
  }

  saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution> {
    return upsertExecution(this.prisma, execution);
  }

  insertExecutionOnConflict(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
    return insertExecutionOnConflict(this.prisma, execution);
  }

  transitionExecutionToSending(executionId: string): Promise<boolean> {
    return transitionExecutionToSending(this.prisma, executionId);
  }

  releaseExecutionClaim(executionId: string): Promise<void> {
    return releaseExecutionClaim(this.prisma, executionId);
  }

  markExecutionFailed(
    executionId: string,
    errorMessage: string,
  ): Promise<void> {
    return markExecutionFailed(this.prisma, executionId, errorMessage);
  }

  requeueFailedExecution(executionId: string): Promise<boolean> {
    return requeueFailedExecution(this.prisma, executionId);
  }

  listStuckQueuedExecutions(
    olderThan: Date,
  ): Promise<AdminReminderExecution[]> {
    return listStuckQueuedExecutions(this.prisma, olderThan);
  }

  getExecution(executionId: string): Promise<AdminReminderExecution | null> {
    return queryExecutionById(this.prisma, executionId);
  }

  listExecutions(
    ruleId: string,
    page: ExecutionPageRequest,
  ): Promise<AdminReminderExecution[]> {
    return queryExecutionsPage(this.prisma, ruleId, page);
  }
}
