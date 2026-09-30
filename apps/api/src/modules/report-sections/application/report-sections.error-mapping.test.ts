import { describe, expect, it, vi } from "vitest";

import { withDomainErrorMapping } from "../../../infrastructure/trpc/trpc.error-mapper.js";
import { createNullLogger } from "../../../lib/logger.js";
import {
  AUTHOR_ID,
  baseSection,
  createRepository,
  validDraft,
} from "./report-sections.contract.fixtures.js";
import { ReportSectionsService } from "./report-sections.service.js";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

describe("missing initial report section error mapping", () => {
  it.each(["read", "save", "submit"] as const)(
    "%s returns NOT_FOUND before persistence",
    async (operation) => {
      const repository = createRepository(baseSection);
      const save = vi.spyOn(repository, "saveSection");
      const service = new ReportSectionsService(
        repository,
        NOOP_REPORT_SECTIONS_TELEMETRY,
        createNullLogger(),
      );
      const missingId = "99999999-9999-4999-8999-999999999999";
      const draft = validDraft({ reportSectionId: missingId });

      await expect(
        withDomainErrorMapping(() => {
          if (operation === "read") return service.getActiveSection(missingId);
          if (operation === "save") return service.saveDraft(draft, AUTHOR_ID);
          return service.submitSection(
            {
              ...draft,
              confirmed: true,
              projectStatuses: [],
              activityStatuses: [],
            },
            AUTHOR_ID,
          );
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(save).not.toHaveBeenCalled();
    },
  );
});
