import type { FeedbackRecord } from "./product-feedback.repository.js";

export function serializeFeedback(feedback: FeedbackRecord) {
  return {
    ...feedback,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
    resolvedAt: feedback.resolvedAt?.toISOString() ?? null,
    annotations: feedback.annotations.map((annotation) => ({
      ...annotation,
      createdAt: annotation.createdAt.toISOString(),
    })),
  };
}
