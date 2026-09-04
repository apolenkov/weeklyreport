import type {
  FeedbackAccess,
  FeedbackRecord,
} from "./product-feedback.repository.js";

export function serializeFeedback(
  feedback: FeedbackRecord,
  access?: FeedbackAccess,
) {
  const capabilities = access
    ? {
        editOriginal: access.userId === feedback.authorUserId,
        triage: access.role === "admin" || access.role === "head",
        reply: feedback.source === "agentation",
        dismiss:
          feedback.source === "agentation" &&
          (access.role === "admin" || access.role === "head"),
        delete: access.role === "admin",
      }
    : feedback.capabilities;
  return {
    ...feedback,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
    resolvedAt: feedback.resolvedAt?.toISOString() ?? null,
    annotations: feedback.annotations.map((annotation) => ({
      ...annotation,
      createdAt: annotation.createdAt.toISOString(),
    })),
    capabilities,
  };
}
