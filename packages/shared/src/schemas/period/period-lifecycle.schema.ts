import { z } from "zod";

import {
  periodStateSchema,
  periodStatusSchema,
  reportStatusSchema,
} from "../primitives/report-primitives.schema.js";

const lifecycleTupleKey = (value: {
  readonly periodState: string;
  readonly status: string;
  readonly archived: boolean;
  readonly periodStatus: string;
}) =>
  [
    value.periodState,
    value.status,
    String(value.archived),
    value.periodStatus,
  ].join("|");

const VALID_LIFECYCLE_TUPLES = new Set([
  "scheduled|draft|false|open",
  "open|draft|false|open",
  "open|published|false|reopened",
  "published|published|false|published",
  "archived|draft|true|open",
  "archived|published|true|published",
]);

/** Restricts pre-publication period creation to its two legal states. */
export const draftPeriodStateSchema = z.enum(["scheduled", "open"]);

/** Canonical state accepted while creating a draft period. */
export type DraftPeriodState = z.infer<typeof draftPeriodStateSchema>;

const lifecycleFieldsSchema = z.object({
  status: reportStatusSchema,
  periodState: periodStateSchema,
  periodStatus: periodStatusSchema,
  archived: z.boolean(),
  autoPublished: z.boolean(),
  autoArchived: z.boolean(),
  publishedAt: z.coerce.date().nullable(),
  publishedById: z.uuid().nullable(),
  reopenedAt: z.coerce.date().nullable(),
});

type LifecycleFields = z.infer<typeof lifecycleFieldsSchema>;

function addIssue(
  context: z.RefinementCtx,
  path: keyof LifecycleFields,
  message: string,
): void {
  context.addIssue({ code: "custom", path: [path], message });
}

function validateDraftMetadata(
  value: LifecycleFields,
  context: z.RefinementCtx,
): void {
  if (value.status === "published") return;

  if (value.publishedAt !== null) {
    addIssue(context, "publishedAt", "Draft periods cannot have publishedAt.");
  }
  if (value.publishedById !== null) {
    addIssue(
      context,
      "publishedById",
      "Draft periods cannot have a publisher.",
    );
  }
  if (value.reopenedAt !== null) {
    addIssue(context, "reopenedAt", "Draft periods cannot have reopenedAt.");
  }
  if (value.autoPublished) {
    addIssue(
      context,
      "autoPublished",
      "Draft periods cannot be marked auto-published.",
    );
  }
  if (value.autoArchived) {
    addIssue(
      context,
      "autoArchived",
      "Draft periods cannot be marked auto-archived.",
    );
  }
}

function validatePublishedMetadata(
  value: LifecycleFields,
  context: z.RefinementCtx,
): void {
  if (value.status === "published" && value.publishedAt === null) {
    addIssue(
      context,
      "publishedAt",
      "Published periods require a publication timestamp.",
    );
  }
}

function validateReopenedTimestamp(
  value: LifecycleFields,
  context: z.RefinementCtx,
): void {
  if (value.periodStatus === "reopened" && value.reopenedAt === null) {
    addIssue(
      context,
      "reopenedAt",
      "Reopened periods require a reopen timestamp.",
    );
  }
}

/** Validates the complete current Report lifecycle representation. */
export const currentPeriodLifecycleSchema = lifecycleFieldsSchema
  .superRefine((value, context) => {
    if (!VALID_LIFECYCLE_TUPLES.has(lifecycleTupleKey(value))) {
      addIssue(
        context,
        "periodState",
        "The lifecycle fields contradict each other.",
      );
    }
    validateDraftMetadata(value, context);
    validatePublishedMetadata(value, context);
    if (value.autoArchived && !value.archived) {
      addIssue(
        context,
        "autoArchived",
        "Auto-archived periods must be archived.",
      );
    }
    validateReopenedTimestamp(value, context);
  })
  .readonly();

/** Complete lifecycle value accepted at current API and persistence seams. */
export type CurrentPeriodLifecycle = z.infer<
  typeof currentPeriodLifecycleSchema
>;
