import { normalizeFeedbackPath } from "@customreport/shared";
import { z } from "zod";

export function requestedFeedbackLocation(
  value: string | undefined,
  frontendOrigin: string,
) {
  if (!value) return { normalizedUrl: undefined, focusId: undefined };
  return z
    .string()
    .transform((url, context) => {
      try {
        return {
          normalizedUrl: normalizeFeedbackPath(url),
          focusId:
            new URL(url, frontendOrigin).searchParams.get("feedback") ??
            undefined,
        };
      } catch {
        context.addIssue({
          code: "custom",
          message: "Invalid feedback URL filter.",
        });
        return z.NEVER;
      }
    })
    .parse(value);
}
