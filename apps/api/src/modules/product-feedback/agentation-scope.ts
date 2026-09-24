import type { AgentationAnnotationPatch } from "@customreport/shared";
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

// Moderation fields (status/kind/severity) follow visibility scope; content
// fields (comment/intent) stay editable by the annotation author only.
export function annotationPatchScope(
  access: FeedbackAccess,
  patch: AgentationAnnotationPatch,
): Prisma.AgentationAnnotationWhereInput {
  return {
    ...annotationScope(access),
    ...(patch.comment !== undefined || patch.intent !== undefined
      ? { authorUserId: access.userId }
      : {}),
  };
}
