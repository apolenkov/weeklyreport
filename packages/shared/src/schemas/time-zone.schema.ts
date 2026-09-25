import { z } from "zod";

// ICU also accepts UTC-offset strings like "+03:00"; no IANA identifier
// starts with a signed digit.
const OFFSET_STYLE_PATTERN = /^[+-]\d/;

const isResolvableTimeZone = (timezone: string): boolean => {
  if (OFFSET_STYLE_PATTERN.test(timezone)) {
    return false;
  }
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
