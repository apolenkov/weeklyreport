import {
  normalizeFeedbackPath,
  pageFeedbackCreateSchema,
} from "@customreport/shared";
import type { Request } from "express";

import type {
  FeedbackCreateInput,
  FeedbackRecord,
} from "./product-feedback.repository.js";

export function parsePageFeedbackCreate(req: Request): FeedbackCreateInput {
  const input = pageFeedbackCreateSchema.parse(req.body);
  return {
    ...input,
    url: normalizeFeedbackPath(input.url),
    urlPattern: null,
    screenshotDataUrl: null,
    screenshotRegion: null,
    diagnostics: null,
    annotations: [],
  };
}

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
