import { z } from "zod";

/** Upper bound that keeps public beacon samples from corrupting metric aggregates. */
export const MAX_WEB_VITAL_VALUE = 300_000;

/** Input validation ceiling for CLS scores, not a performance threshold. */
const MAX_CLS_WEB_VITAL_VALUE = 10;

/** Validates the unauthenticated browser beacon before any metric write. */
export const webVitalBeaconSchema = z
  .object({
    name: z.enum(["LCP", "CLS", "FCP", "INP", "TTFB"]),
    value: z.number().nonnegative().max(MAX_WEB_VITAL_VALUE),
    id: z.string().min(1),
    navigationType: z.string().optional(),
  })
  .superRefine((beacon, ctx) => {
    if (beacon.name === "CLS" && beacon.value > MAX_CLS_WEB_VITAL_VALUE) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `CLS must not exceed ${MAX_CLS_WEB_VITAL_VALUE}.`,
      });
    }
  })
  .readonly();

const WEB_VITAL_NAVIGATION_TYPES = new Set<string>([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
]);

/** Bounded fallback label for unknown browser navigation types. */
const WEB_VITAL_NAVIGATION_OTHER = "other";

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
