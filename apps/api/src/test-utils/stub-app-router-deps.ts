import type { PrismaClient } from "@prisma/client";
import { vi } from "vitest";

import type { AppRouterDeps } from "../infrastructure/trpc/trpc.router.js";

// Build a complete, typed AppRouterDeps whose services are inert vi.fn()
// stubs. Tests override only the members they exercise; the router never
// touches the rest at construction time. The `as unknown as` lives here so
// call sites pass the real deps type instead of erasing it per-test.
function stub<T>(_value?: T): T {
  return vi.fn() as unknown as T;
}

// Override values are cast to their service type at the merge point below;
// keys stay exactly the AppRouterDeps members so a typo still fails.
export type StubAppRouterDepsOverrides = Partial<{
  [K in keyof AppRouterDeps]: unknown;
}>;

export function createStubAppRouterDeps(
  overrides: StubAppRouterDepsOverrides = {},
): AppRouterDeps {
  return {
    prisma: stub<PrismaClient>(),
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
    activityService: stub(),
    projectActivityService: stub(),
    telemetryService: stub(),
    sessionRevocationService: stub(),
    // Optional deps default to absent so fail-loud guards (ops/jobs/telegram)
    // stay reachable; tests that wire them pass them as overrides.
    ...(overrides as Partial<AppRouterDeps>),
  };
}
