import type {
  FeedbackAnnotation,
  FeedbackDiagnostics,
  FeedbackScreenshotRegion,
  FeedbackStatus,
  FeedbackType,
  UserSession,
} from "@customreport/shared";

export const WEEKLY_REPORT_FEEDBACK_PRODUCT = "weekly-report";

export interface FeedbackCreateInput {
  readonly projectName?: string;
  readonly status?: FeedbackStatus;
  readonly authorName?: string;
  readonly authorEmail?: string;
  readonly type: FeedbackType;
  readonly message: string;
  readonly url: string;
  readonly urlPattern?: string | null;
  readonly screenshotDataUrl?: string | null;
  readonly screenshotRegion?: FeedbackScreenshotRegion | null;
  readonly diagnostics?: FeedbackDiagnostics | null;
  readonly viewport: string;
  readonly userAgent: string;
  readonly clientId: string;
  readonly annotations: readonly FeedbackAnnotation[];
}

export interface FeedbackQuery {
  readonly projectName?: string;
  readonly page?: number;
  readonly limit?: number;
  readonly status?: FeedbackStatus;
  readonly statuses?: readonly FeedbackStatus[];
  readonly type?: FeedbackType;
  readonly search?: string;
  readonly url?: string;
  readonly urlPattern?: string;
}

export interface FeedbackRecordAnnotation extends FeedbackAnnotation {
  readonly id: string;
  readonly feedbackId: string;
  readonly createdAt: Date;
}

export interface FeedbackRecord extends Omit<
  FeedbackCreateInput,
  "annotations"
> {
  readonly id: string;
  readonly projectName: typeof WEEKLY_REPORT_FEEDBACK_PRODUCT;
  readonly status: FeedbackStatus;
  readonly authorUserId: UserSession["userId"];
  readonly authorReportingGroupId: UserSession["reportingGroupId"] | null;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly screenshotUrl: string | null;
  readonly annotations: readonly FeedbackRecordAnnotation[];
  readonly agentationSessionId?: string;
  readonly agentationAnnotationId?: string;
}

export interface FeedbackPage {
  readonly feedbacks: FeedbackRecord[];
  readonly total: number;
}

export interface FeedbackUpdateInput {
  readonly status?: FeedbackStatus;
  readonly message?: string;
  readonly screenshotDataUrl?: string;
  readonly resolvedAt?: Date | null;
}

export class FeedbackDuplicateError extends Error {
  readonly code = "STORE_DUPLICATE";
}

export class FeedbackNotFoundError extends Error {
  readonly code = "STORE_NOT_FOUND";
}

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
