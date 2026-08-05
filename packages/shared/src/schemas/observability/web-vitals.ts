import { z } from "zod";

/** Upper bound that keeps public beacon samples from corrupting metric aggregates. */
export const MAX_WEB_VITAL_VALUE = 300_000;

/** Validates the unauthenticated browser beacon before any metric write. */
export const webVitalBeaconSchema = z
  .object({
    name: z.enum(["LCP", "CLS", "FCP", "INP", "TTFB"]),
    value: z.number().nonnegative().max(MAX_WEB_VITAL_VALUE),
    id: z.string().min(1),
    navigationType: z.string().optional(),
  })
  .readonly();

/** Validated web-vital sample accepted from the browser beacon. */
export type WebVitalBeacon = z.infer<typeof webVitalBeaconSchema>;
/** Bounded web-vital metric name accepted by the public endpoint. */
export type WebVitalName = WebVitalBeacon["name"];

const WEB_VITAL_NAVIGATION_TYPES = new Set<string>([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
]);

/** Bounded fallback label for unknown browser navigation types. */
export const WEB_VITAL_NAVIGATION_OTHER = "other";

/**
 * Map a client-supplied `navigationType` to a bounded label value: a recognised
 * value passes through verbatim, everything else (including absent) becomes
 * {@link WEB_VITAL_NAVIGATION_OTHER}.
 */
export function resolveNavigationType(
  navigationType: string | undefined,
): string {
  return navigationType !== undefined &&
    WEB_VITAL_NAVIGATION_TYPES.has(navigationType)
    ? navigationType
    : WEB_VITAL_NAVIGATION_OTHER;
}
