import { vi } from "vitest";

import type { AppRouterDeps } from "../infrastructure/trpc/trpc.router.js";

// Build a complete, typed AppRouterDeps whose services are inert vi.fn()
// stubs. Tests override only the members they exercise; the router never
// touches the rest at construction time. The `as unknown as` lives here so
// call sites pass the real deps type instead of erasing it per-test.
function stub() {
  return vi.fn();
}

// Partial overrides keep dependency keys checked; the intentional service
// cast stays at the complete dependency-object boundary below.
export type StubAppRouterDepsOverrides = Partial<{
  [K in keyof AppRouterDeps]: unknown;
}>;

export function createStubAppRouterDeps(
  overrides: StubAppRouterDepsOverrides = {},
): AppRouterDeps {
  return {
    prisma: stub(),
    env: stub(),
    reportSectionsService: stub(),
    reviewService: stub(),
    reviewActionsService: stub(),
    publicationService: stub(),
    pdfExportService: stub(),
    snapshotAdminService: stub(),
    projectAdminService: stub(),
    reminderAdminService: stub(),
    periodAdminService: stub(),
    reopenRequestAdminService: stub(),
    organizationService: stub(),
    remindersService: stub(),
    archiveService: stub(),
    periodService: stub(),
    weeklyReportService: stub(),
    leadFormService: stub(),
    analyticsService: stub(),
    searchService: stub(),
    reportAssistantService: stub(),
    aiProviderService: stub(),
    aiPromptService: stub(),
    activityService: stub(),
    projectActivityService: stub(),
    jobsService: stub(),
    actionLogService: stub(),
    telemetryService: stub(),
    sessionRevocationService: stub(),
    ...overrides,
  } satisfies {
    [K in keyof AppRouterDeps]: unknown;
  } as unknown as AppRouterDeps;
}
