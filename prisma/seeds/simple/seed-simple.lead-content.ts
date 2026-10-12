import { COREDEV_LEAD_CONTENT } from "./seed-simple.lead-content-coredev.js";
import { FINANCE_LEAD_CONTENT } from "./seed-simple.lead-content-finance.js";
import { PM_LEAD_CONTENT } from "./seed-simple.lead-content-pm.js";
import type { LeadContent } from "./seed-simple.leads.js";

// Every lead id in LEADS must have an entry here — the section writer indexes
// this map directly and rejects a missing key before writing that section.
export const CONTENT_BY_LEAD: ReadonlyMap<string, LeadContent> = new Map(
  Object.entries({
    ...COREDEV_LEAD_CONTENT,
    ...FINANCE_LEAD_CONTENT,
    ...PM_LEAD_CONTENT,
  }),
);
