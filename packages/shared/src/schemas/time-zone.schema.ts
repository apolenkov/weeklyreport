import { z } from "zod";

const isResolvableTimeZone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/** Accepts time-zone identifiers supported by the runtime's IANA database. */
export const resolvableTimeZoneSchema = z
  .string()
  .min(1)
  .refine(
    isResolvableTimeZone,
    "timezone must be a valid IANA time zone identifier",
  );
