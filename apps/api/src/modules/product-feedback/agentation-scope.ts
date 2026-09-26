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

export function mayUpdateAnnotationStatus(
  access: FeedbackAccess,
  actor: "human" | "agent",
  source: "patch" | "native-delete",
  status: AgentationAnnotationPatch["status"],
): boolean {
  if (status === undefined) return true;
  if (source === "native-delete") return status === "dismissed";
  if (actor === "agent" || access.role === "admin" || access.role === "head")
    return true;
  return false;
}

// Original content stays author-only; lifecycle status is role-gated above.
export function annotationPatchScope(
  access: FeedbackAccess,
  patch: AgentationAnnotationPatch,
  actor: "human" | "agent",
  source: "patch" | "native-delete",
): Prisma.AgentationAnnotationWhereInput {
  const authorOnly =
    source === "native-delete" ||
    patch.comment !== undefined ||
    patch.intent !== undefined;
  return {
    ...annotationScope(access),
    ...(!mayUpdateAnnotationStatus(access, actor, source, patch.status)
      ? { id: { in: [] } }
      : {}),
    ...(authorOnly ? { authorUserId: access.userId } : {}),
  };
}
