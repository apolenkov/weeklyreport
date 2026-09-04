import type { Prisma } from "@prisma/client";

import {
  type FeedbackAccess,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

interface AuthorScopeWhere {
  authorUserId?: string;
  OR?: ({ authorUserId: string } | { authorReportingGroupId: string })[];
}

function authorScope(access: FeedbackAccess): AuthorScopeWhere {
  if (access.role === "admin") return {};
  if (access.role === "head" && access.reportingGroupId)
    return {
      OR: [
        { authorUserId: access.userId },
        { authorReportingGroupId: access.reportingGroupId },
      ],
    };
  return { authorUserId: access.userId };
}

export function sessionScope(
  access: FeedbackAccess,
): Prisma.AgentationSessionWhereInput {
  return {
    projectId: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    ...authorScope(access),
  };
}

export function annotationScope(
  access: FeedbackAccess,
): Prisma.AgentationAnnotationWhereInput {
  return {
    session: { projectId: WEEKLY_REPORT_FEEDBACK_PRODUCT },
    ...authorScope(access),
  };
}
