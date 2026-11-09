import {
  retainedIncompleteRecordsInputSchema,
  retainedIncompleteRecordsOutputSchema,
} from "@weeklyreport/shared";

import type { RetainedIncompleteRecordsService } from "../../../modules/report-sections/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import { leadProcedure } from "../trpc.middleware.js";

export interface RetainedRecordsRouterDeps {
  retainedIncompleteRecordsService: RetainedIncompleteRecordsService;
}

// Private recovery of the caller's own retained drafts. The input names only
// the source; authorship comes from the session's user id and is re-proven
// against the database by the service's read, not from the session's role.
export function retainedIncompleteRecordsProcedure(
  deps: RetainedRecordsRouterDeps,
) {
  return leadProcedure
    .input(retainedIncompleteRecordsInputSchema)
    .output(retainedIncompleteRecordsOutputSchema)
    .query(({ input, ctx }) =>
      withDomainErrorMapping(() =>
        deps.retainedIncompleteRecordsService.read(input, ctx.session.userId),
      ),
    );
}
