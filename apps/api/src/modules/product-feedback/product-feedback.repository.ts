import type { UserSession } from "@customreport/shared";
import type { SitepingStore } from "@siteping/adapter-prisma";

export const WEEKLY_REPORT_FEEDBACK_PRODUCT = "weekly-report";

export type FeedbackCreateInput = Parameters<
  SitepingStore["createFeedback"]
>[0];
export type FeedbackQuery = Parameters<SitepingStore["getFeedbacks"]>[0];
export type FeedbackPage = Awaited<ReturnType<SitepingStore["getFeedbacks"]>>;
export type FeedbackRecord = Awaited<
  ReturnType<SitepingStore["createFeedback"]>
> & {
  readonly authorUserId: UserSession["userId"];
  readonly authorReportingGroupId: UserSession["reportingGroupId"] | null;
};
export type FeedbackUpdateInput = Parameters<
  SitepingStore["updateFeedback"]
>[1];

export interface FeedbackAccess {
  readonly userId: UserSession["userId"];
  readonly role: UserSession["role"];
  readonly name: UserSession["name"];
  readonly email: UserSession["email"];
  readonly reportingGroupId: UserSession["reportingGroupId"];
}

export function feedbackAccessFromSession(
  session: UserSession,
): FeedbackAccess {
  return {
    userId: session.userId,
    role: session.role,
    name: session.name,
    email: session.email,
    reportingGroupId: session.reportingGroupId,
  };
}

export interface ProductFeedbackRepository {
  create(
    access: FeedbackAccess,
    input: FeedbackCreateInput,
  ): Promise<FeedbackRecord>;
  list(
    access: FeedbackAccess,
    query: FeedbackQuery,
    focusId?: string,
  ): Promise<FeedbackPage>;
  findByClientId(
    access: FeedbackAccess,
    clientId: string,
  ): Promise<FeedbackRecord | null>;
  update(
    access: FeedbackAccess,
    id: string,
    input: FeedbackUpdateInput,
  ): Promise<FeedbackRecord>;
  delete(access: FeedbackAccess, id: string): Promise<void>;
  deleteAll(access: FeedbackAccess): Promise<void>;
  owns(access: FeedbackAccess, id: string): Promise<boolean>;
}
