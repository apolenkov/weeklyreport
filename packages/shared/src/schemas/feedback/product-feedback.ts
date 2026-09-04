import { z } from "zod";

/** Maximum persisted length of a normalized feedback pathname. */
export const MAX_FEEDBACK_PAGE_SCOPE_LENGTH = 2000;
const MAX_SELECTOR_LENGTH = 2000;
const MAX_TEXT_SNIPPET_LENGTH = 500;
const MAX_ELEMENT_TAG_LENGTH = 100;
const MAX_METADATA_LENGTH = 200;
const MAX_DEVICE_PIXEL_RATIO = 10;
/** Maximum length of a feedback message accepted by the ingress. */
export const MAX_FEEDBACK_MESSAGE_LENGTH = 5000;
const MAX_VIEWPORT_LENGTH = 50;
const MAX_USER_AGENT_LENGTH = 500;
/** Maximum number of DOM annotations accepted on one feedback record. */
export const MAX_FEEDBACK_ANNOTATIONS = 50;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 1_500_000;
const MAX_CONSOLE_ENTRIES = 50;
const MAX_NETWORK_ENTRIES = 20;
const MAX_DIAGNOSTIC_TIMESTAMP_LENGTH = 50;
const MAX_CONSOLE_MESSAGE_LENGTH = 600;
const MAX_NETWORK_METHOD_LENGTH = 20;
const MAX_NETWORK_STATUS = 599;
const MAX_NETWORK_DURATION_MS = 600_000;

/** Product identifiers accepted by the shared feedback persistence model. */
export const FEEDBACK_PRODUCTS = ["weekly-report", "external-product"] as const;
/** Validates a feedback product identifier. */
export const feedbackProductSchema = z.enum(FEEDBACK_PRODUCTS);
/** Feedback product identifier. */
export type FeedbackProduct = z.infer<typeof feedbackProductSchema>;

/** SitePing feedback categories supported by the pinned wire contract. */
export const FEEDBACK_TYPES = ["question", "change", "bug", "other"] as const;
/** Validates a SitePing feedback category. */
export const feedbackTypeSchema = z.enum(FEEDBACK_TYPES);
/** SitePing feedback category. */
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

/** SitePing workflow states supported by the pinned wire contract. */
export const FEEDBACK_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "wont_fix",
] as const;
/** Validates a SitePing workflow state. */
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);
/** SitePing workflow state. */
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

/** Validates persisted page identity without browser location metadata. */
export const feedbackPageScopeSchema = z
  .object({
    url: z.string().trim().min(1).max(MAX_FEEDBACK_PAGE_SCOPE_LENGTH),
    urlPattern: z
      .string()
      .trim()
      .min(1)
      .max(MAX_FEEDBACK_PAGE_SCOPE_LENGTH)
      .nullable()
      .optional(),
  })
  .readonly();
/** Path-based scope attached to product feedback. */
export type FeedbackPageScope = z.infer<typeof feedbackPageScopeSchema>;

/** Validates the stable DOM anchor portion of an annotation. */
export const feedbackAnnotationAnchorSchema = z
  .object({
    cssSelector: z.string().min(1).max(MAX_SELECTOR_LENGTH),
    xpath: z.string().min(1).max(MAX_SELECTOR_LENGTH),
    textSnippet: z.string().max(MAX_TEXT_SNIPPET_LENGTH),
    elementTag: z.string().min(1).max(MAX_ELEMENT_TAG_LENGTH),
    elementId: z.string().max(MAX_METADATA_LENGTH).optional(),
    textPrefix: z.string().max(MAX_METADATA_LENGTH),
    textSuffix: z.string().max(MAX_METADATA_LENGTH),
    fingerprint: z.string().max(MAX_METADATA_LENGTH),
    neighborText: z.string().max(MAX_TEXT_SNIPPET_LENGTH),
    anchorKey: z.string().max(MAX_METADATA_LENGTH).nullable().optional(),
  })
  .strict();

/** Validates the flat annotation form persisted by SitePing stores. */
export const feedbackAnnotationSchema = feedbackAnnotationAnchorSchema.extend({
  xPct: z.number().min(0).max(1),
  yPct: z.number().min(0).max(1),
  wPct: z.number().min(0).max(1),
  hPct: z.number().min(0).max(1),
  scrollX: z.number().nonnegative(),
  scrollY: z.number().nonnegative(),
  viewportW: z.number().int().positive(),
  viewportH: z.number().int().positive(),
  devicePixelRatio: z.number().positive().max(MAX_DEVICE_PIXEL_RATIO),
});
/** Persisted SitePing annotation without database metadata. */
export type FeedbackAnnotation = z.infer<typeof feedbackAnnotationSchema>;

/** Validates the bounded screenshot representation accepted by SitePing. */
export const feedbackScreenshotDataUrlSchema = z
  .string()
  .max(MAX_SCREENSHOT_DATA_URL_LENGTH)
  .regex(/^data:image\/(jpeg|png|webp);base64,/);

/** Validates the annotation position inside a captured screenshot. */
export const feedbackScreenshotRegionSchema = z
  .object({
    xPct: z.number().min(0).max(1),
    yPct: z.number().min(0).max(1),
    wPct: z.number().min(0).max(1),
    hPct: z.number().min(0).max(1),
  })
  .strict();
/** Screenshot annotation position. */
export type FeedbackScreenshotRegion = z.infer<
  typeof feedbackScreenshotRegionSchema
>;

const feedbackConsoleDiagnosticSchema = z
  .object({
    level: z.enum(["log", "info", "warn", "error"]),
    timestamp: z.string().max(MAX_DIAGNOSTIC_TIMESTAMP_LENGTH),
    message: z.string().max(MAX_CONSOLE_MESSAGE_LENGTH),
  })
  .strict();

const feedbackNetworkDiagnosticSchema = z
  .object({
    url: z.string().max(MAX_FEEDBACK_PAGE_SCOPE_LENGTH),
    method: z.string().max(MAX_NETWORK_METHOD_LENGTH),
    status: z.number().int().min(0).max(MAX_NETWORK_STATUS),
    durationMs: z.number().min(0).max(MAX_NETWORK_DURATION_MS),
    timestamp: z.string().max(MAX_DIAGNOSTIC_TIMESTAMP_LENGTH),
  })
  .strict();

/** Validates the bounded console and failed-network snapshot from SitePing. */
export const feedbackDiagnosticsSchema = z
  .object({
    console: z.array(feedbackConsoleDiagnosticSchema).max(MAX_CONSOLE_ENTRIES),
    network: z.array(feedbackNetworkDiagnosticSchema).max(MAX_NETWORK_ENTRIES),
  })
  .strict();
/** Bounded console and failed-network snapshot. */
export type FeedbackDiagnostics = z.infer<typeof feedbackDiagnosticsSchema>;

/** Validates the nested annotation form emitted by the SitePing widget. */
export const feedbackAnnotationWireSchema = z
  .object({
    anchor: feedbackAnnotationAnchorSchema,
    rect: z
      .object({
        xPct: z.number().min(0).max(1),
        yPct: z.number().min(0).max(1),
        wPct: z.number().min(0).max(1),
        hPct: z.number().min(0).max(1),
      })
      .strict(),
    scrollX: z.number(),
    scrollY: z.number(),
    viewportW: z.number().int().positive(),
    viewportH: z.number().int().positive(),
    devicePixelRatio: z.number().positive().max(MAX_DEVICE_PIXEL_RATIO),
  })
  .strict();

// This mirrors the pinned SitePing 0.x wire contract. Identity and scope fields
// are accepted only so the gateway can overwrite them from the human session.
/** Validates a SitePing create payload before server-owned fields are replaced. */
export const feedbackCreateWireSchema = z
  .object({
    projectName: z.string().min(1).max(MAX_METADATA_LENGTH),
    type: feedbackTypeSchema,
    message: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
    url: z.string().trim().min(1).max(MAX_FEEDBACK_PAGE_SCOPE_LENGTH),
    urlPattern: z
      .string()
      .max(MAX_FEEDBACK_PAGE_SCOPE_LENGTH)
      .nullable()
      .optional(),
    viewport: z.string().min(1).max(MAX_VIEWPORT_LENGTH),
    userAgent: z.string().min(1).max(MAX_USER_AGENT_LENGTH),
    authorName: z.string().min(1).max(MAX_METADATA_LENGTH),
    authorEmail: z.email().max(MAX_METADATA_LENGTH),
    annotations: z
      .array(feedbackAnnotationWireSchema)
      .max(MAX_FEEDBACK_ANNOTATIONS),
    clientId: z
      .string()
      .min(1)
      .max(MAX_METADATA_LENGTH)
      .regex(/^[a-zA-Z0-9_-]+$/),
    screenshotDataUrl: feedbackScreenshotDataUrlSchema.nullable().optional(),
    screenshotRegion: feedbackScreenshotRegionSchema.nullable().optional(),
    diagnostics: feedbackDiagnosticsSchema.nullable().optional(),
  })
  .strict();
/** SitePing create payload accepted by the authenticated ingress. */
export type FeedbackCreateWire = z.infer<typeof feedbackCreateWireSchema>;

/** Validates a serialized annotation returned by the SitePing endpoint. */
export const feedbackAnnotationResponseSchema = feedbackAnnotationSchema.extend(
  {
    id: z.string(),
    feedbackId: z.string(),
    createdAt: z.iso.datetime(),
  },
);

/** Validates a serialized feedback record returned by the SitePing endpoint. */
export const feedbackResponseSchema = z
  .object({
    id: z.string().min(1),
    projectName: feedbackProductSchema,
    type: feedbackTypeSchema,
    message: z.string(),
    status: feedbackStatusSchema,
    url: z.string(),
    urlPattern: z.string().nullable().optional(),
    viewport: z.string(),
    userAgent: z.string(),
    authorName: z.string(),
    authorEmail: z.email(),
    authorUserId: z.string().min(1),
    authorReportingGroupId: z.string().min(1).nullable(),
    resolvedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    annotations: z
      .array(feedbackAnnotationResponseSchema)
      .max(MAX_FEEDBACK_ANNOTATIONS),
    screenshotUrl: feedbackScreenshotDataUrlSchema.nullable(),
    screenshotRegion: feedbackScreenshotRegionSchema.nullable(),
    diagnostics: feedbackDiagnosticsSchema.nullable(),
  })
  .loose();
/** Serialized feedback record returned to browser clients. */
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

/** Reduces a browser-supplied URL to the only persisted page scope: pathname. */
export function normalizeFeedbackPath(value: string): string {
  const pathname = new URL(value, "https://weekly-report.invalid").pathname;
  return pathname.startsWith("/")
    ? pathname.slice(0, MAX_FEEDBACK_PAGE_SCOPE_LENGTH)
    : `/${pathname}`;
}
