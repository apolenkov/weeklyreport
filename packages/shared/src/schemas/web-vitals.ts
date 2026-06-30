import { z } from "zod";

/**
 * Wire contract for the browser web-vitals beacon posted to
 * `POST /api/web-vitals`. The web sender (`apps/web/src/lib/web-vitals.ts`)
 * forwards `web-vitals` library `Metric` fields verbatim, so the shapes here
 * mirror that library: `value` is the raw metric value (milliseconds for
 * LCP/FCP/INP/TTFB, an unscaled layout-shift score for CLS — not ×1000), and
 * `navigationType` is the library's optional navigation-type string.
 *
 * The endpoint is public and unauthenticated, so this is the single trust
 * boundary: an invalid body must be rejected before any metric write. `value`
 * is a non-negative finite number — `z.number().nonnegative()` rejects NaN,
 * ±Infinity (Zod v4), and negatives, which every web-vitals metric excludes by
 * definition (timings and the CLS score are never < 0). A negative value would
 * otherwise corrupt the histogram's `_sum`/quantile aggregates. `id` must be
 * non-empty.
 */
export const webVitalBeaconSchema = z.object({
  name: z.enum(["LCP", "CLS", "FCP", "INP", "TTFB"]),
  value: z.number().nonnegative(),
  id: z.string().min(1),
  navigationType: z.string().optional(),
});

export type WebVitalBeacon = z.infer<typeof webVitalBeaconSchema>;
export type WebVitalName = WebVitalBeacon["name"];

/**
 * Recognised `navigationType` values, fixed to the `web-vitals` library's
 * navigation enum. Anything outside this set — including an absent value —
 * collapses to {@link WEB_VITAL_NAVIGATION_OTHER}. Bounding the label this way
 * caps `navigation_type` cardinality at a constant seven values regardless of
 * client input, which is the structural defense against the metrics-heap DoS
 * even if upstream validation were ever bypassed.
 */
export const WEB_VITAL_NAVIGATION_TYPES = new Set<string>([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
]);

export const WEB_VITAL_NAVIGATION_OTHER = "other";

/**
 * Map a client-supplied `navigationType` to a bounded label value: a recognised
 * value passes through verbatim, everything else (including absent) becomes
 * {@link WEB_VITAL_NAVIGATION_OTHER}.
 * @param navigationType - raw client navigation type, possibly absent.
 * @returns a whitelisted navigation type or `"other"`.
 */
export function resolveNavigationType(
  navigationType: string | undefined,
): string {
  return navigationType !== undefined &&
    WEB_VITAL_NAVIGATION_TYPES.has(navigationType)
    ? navigationType
    : WEB_VITAL_NAVIGATION_OTHER;
}
