import { z } from "zod";

import {
  periodStateSchema,
  periodStatusSchema,
  reportStatusSchema,
} from "../primitives/report-primitives.schema";

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
        "The canonical and legacy lifecycle fields contradict each other.",
      );
    }
    validateDraftMetadata(value, context);
    validateReopenedTimestamp(value, context);
  })
  .readonly();

/** Complete lifecycle value accepted at current API and persistence seams. */
export type CurrentPeriodLifecycle = z.infer<
  typeof currentPeriodLifecycleSchema
>;

const legacyReportPeriodV1Schema = z
  .object({
    id: z.uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    deadline: z.coerce.date().nullable(),
    status: reportStatusSchema,
    archived: z.boolean().optional(),
  })
  .strict();

const legacyReportPeriodEnvelopeSchema = z.object({
  version: z.unknown(),
  period: z.unknown(),
});

type DecodedLegacyPeriod = Readonly<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
}> &
  CurrentPeriodLifecycle;

/** Distinguishes unsupported legacy versions from invalid versioned payloads. */
export class LegacyPeriodIncompatibilityError extends Error {
  /** Exposes a typed snapshot-import failure to boundary callers. */
  constructor(
    readonly reason: "unsupported-version" | "invalid-payload",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LegacyPeriodIncompatibilityError";
  }
}

/**
 * Decodes an explicitly versioned v1 period snapshot into the current shape.
 */
export function decodeLegacyReportPeriod(input: unknown): DecodedLegacyPeriod {
  const envelope = legacyReportPeriodEnvelopeSchema.safeParse(input);
  if (!envelope.success) {
    throw new LegacyPeriodIncompatibilityError(
      "invalid-payload",
      "Legacy period input must contain version and period fields.",
      { cause: envelope.error },
    );
  }
  if (envelope.data.version !== 1) {
    throw new LegacyPeriodIncompatibilityError(
      "unsupported-version",
      `Unsupported legacy period version: ${String(envelope.data.version)}.`,
    );
  }

  const parsed = legacyReportPeriodV1Schema.safeParse(envelope.data.period);
  if (!parsed.success) {
    throw new LegacyPeriodIncompatibilityError(
      "invalid-payload",
      "Legacy period v1 payload is invalid or mixes lifecycle generations.",
      { cause: parsed.error },
    );
  }

  const { archived = false, ...period } = parsed.data;
  const periodState = archived
    ? "archived"
    : period.status === "published"
      ? "published"
      : "open";
  const periodStatus = period.status === "published" ? "published" : "open";

  return Object.freeze({
    ...period,
    ...currentPeriodLifecycleSchema.parse({
      status: period.status,
      periodState,
      periodStatus,
      archived,
      autoPublished: false,
      autoArchived: false,
      publishedAt: null,
      publishedById: null,
      reopenedAt: null,
    }),
  });
}
