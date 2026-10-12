import { TRPCError } from "@trpc/server";
import type {
  AiProviderAvailabilityRead,
  ReportAssistantOutcome,
  ReportAssistantRequest,
  Role,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import type { AiProviderConfigurationService } from "../../modules/ai-provider/index.js";
import type { ReportAssistantService } from "../../modules/search/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "./trpc.router.js";

const USER_ID = "44444444-4444-4444-8444-444444444444";
const GROUP_ID = "99999999-9999-4999-8999-999999999999";
const REQUEST: ReportAssistantRequest = {
  question: "What changed?",
  resolutionTokens: [],
};
const SUCCESSFUL_OUTCOME: ReportAssistantOutcome = {
  kind: "ok",
  answerMarkdown: "The report is ready.",
  citations: [],
  metadata: { truncated: false, insufficientEvidence: false },
};
const AVAILABILITY: AiProviderAvailabilityRead = {
  availability: "available",
};

const callerFor = (role: Role | null) => {
  const answer = vi
    .fn<ReportAssistantService["answer"]>()
    .mockResolvedValue(SUCCESSFUL_OUTCOME);
  const availability = vi
    .fn<AiProviderConfigurationService["availability"]>()
    .mockResolvedValue(AVAILABILITY);
  const caller = createAppRouter(
    createStubAppRouterDeps({
      reportAssistantService: { answer } as unknown as ReportAssistantService,
      aiProviderService: {
        availability,
      } as unknown as AiProviderConfigurationService,
    }),
  ).createCaller({
    session: role
      ? {
          userId: USER_ID,
          email: `${role}@test.local`,
          name: `${role} user`,
          role,
          reportingGroupId: GROUP_ID,
          viewerGroupAccess: [GROUP_ID],
          activeReportId: null,
          activeReportSectionId: null,
        }
      : null,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, answer, availability };
};

describe("leadForm.assistant role gate", () => {
  it.each(["head", "admin", "viewer"] as const)(
    "rejects %s before the assistant service runs",
    async (role) => {
      const { caller, answer } = callerFor(role);

      await expect(caller.leadForm.assistant(REQUEST)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(answer).not.toHaveBeenCalled();
    },
  );

  it("rejects unauthenticated callers before input processing", async () => {
    const { caller, answer } = callerFor(null);

    await expect(caller.leadForm.assistant(REQUEST)).rejects.toBeInstanceOf(
      TRPCError,
    );
    expect(answer).not.toHaveBeenCalled();
  });

  it("forwards the exact Lead request and actor to the assistant service", async () => {
    const { caller, answer } = callerFor("lead");

    await expect(caller.leadForm.assistant(REQUEST)).resolves.toEqual(
      SUCCESSFUL_OUTCOME,
    );
    expect(answer).toHaveBeenCalledOnce();
    expect(answer).toHaveBeenCalledWith(REQUEST, USER_ID);
  });

  it("returns AI availability from its configured dependency", async () => {
    const { caller, availability } = callerFor("lead");

    await expect(caller.ai.availability()).resolves.toEqual(AVAILABILITY);
    expect(availability).toHaveBeenCalledOnce();
  });
});
