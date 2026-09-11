import {
  type LeadOpenWorkHistoryInput,
  leadOpenWorkHistoryInputSchema,
  type LeadOpenWorkHistoryOutput,
  leadOpenWorkHistoryOutputSchema,
} from "@customreport/shared";

import {
  LeadFormDomainError,
  type LeadFormRepository,
} from "../domain/lead-form-shared.js";
import { readByPeriod } from "./lead-form-by-period.js";

/** Authorizes the target report, then reads only the session lead's history. */
export async function readLeadOpenWork(
  repository: LeadFormRepository,
  input: LeadOpenWorkHistoryInput,
  userId: string,
): Promise<LeadOpenWorkHistoryOutput> {
  const parsed = leadOpenWorkHistoryInputSchema.parse(input);
  await readByPeriod(repository, parsed.reportId, userId, "lead", undefined);
  const page = await repository.getOpenWorkHistoryPage(
    parsed.reportId,
    userId,
    { cursor: parsed.cursor, limit: parsed.limit },
  );
  if (!page) {
    throw new LeadFormDomainError(`Report ${parsed.reportId} not found.`);
  }
  return leadOpenWorkHistoryOutputSchema.parse(page);
}
