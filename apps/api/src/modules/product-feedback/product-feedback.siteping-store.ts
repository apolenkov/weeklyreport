import { normalizeFeedbackPath } from "@customreport/shared";
import {
  type SitepingStore,
  StoreNotFoundError,
} from "@siteping/adapter-prisma";

import type { AppLogger } from "../../lib/logger.js";
import {
  type FeedbackAccess,
  type ProductFeedbackRepository,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

const PRODUCT_FEEDBACK_PHASE = "product-feedback";

export function createScopedSitepingStore(deps: {
  readonly repository: ProductFeedbackRepository;
  readonly access: FeedbackAccess;
  readonly logger: AppLogger;
  readonly focusFeedbackId?: string;
}): SitepingStore {
  const { repository, access, logger, focusFeedbackId } = deps;
  return {
    createFeedback: async (input) => {
      const feedback = await repository.create(access, {
        ...input,
        projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
        status: "open",
        url: normalizeFeedbackPath(input.url),
        urlPattern: input.urlPattern
          ? normalizeFeedbackPath(input.urlPattern)
          : null,
        authorName: access.name,
        authorEmail: access.email,
      });
      logger.info("product feedback created", {
        phase: PRODUCT_FEEDBACK_PHASE,
        action: "create",
        feedbackId: feedback.id,
        actorId: access.userId,
        role: access.role,
      });
      return feedback;
    },
    getFeedbacks: (query) =>
      repository.list(
        access,
        {
          ...query,
          projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
          ...(query.url ? { url: normalizeFeedbackPath(query.url) } : {}),
          ...(query.urlPattern
            ? { urlPattern: normalizeFeedbackPath(query.urlPattern) }
            : {}),
        },
        focusFeedbackId,
      ),
    findByClientId: (clientId) => repository.findByClientId(access, clientId),
    updateFeedback: async (id, input) => {
      const feedback = await repository.update(access, id, input);
      logger.info("product feedback status changed", {
        phase: PRODUCT_FEEDBACK_PHASE,
        action: "status",
        feedbackId: id,
        actorId: access.userId,
        role: access.role,
        status: input.status,
      });
      return feedback;
    },
    deleteFeedback: async (id) => {
      await repository.delete(access, id);
      logger.info("product feedback deleted", {
        phase: PRODUCT_FEEDBACK_PHASE,
        action: "delete",
        feedbackId: id,
        actorId: access.userId,
        role: access.role,
      });
    },
    deleteAllFeedbacks: async (projectName) => {
      if (projectName !== WEEKLY_REPORT_FEEDBACK_PRODUCT) {
        throw new StoreNotFoundError();
      }
      await repository.deleteAll(access);
      logger.info("all product feedback deleted", {
        phase: PRODUCT_FEEDBACK_PHASE,
        action: "delete-all",
        actorId: access.userId,
        role: access.role,
      });
    },
    verifyProjectOwnership: (id, projectName) =>
      projectName === WEEKLY_REPORT_FEEDBACK_PRODUCT
        ? repository.owns(access, id)
        : Promise.resolve(false),
  };
}
