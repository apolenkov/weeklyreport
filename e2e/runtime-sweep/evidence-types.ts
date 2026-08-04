import type { Page } from "@playwright/test";

import type {
  EvidenceBundle,
  EvidenceRef,
  Role,
  SeedProfile,
} from "./contracts.ts";
import type { DomInventory } from "./dom-inventory.ts";

export type ConsoleRecord = Readonly<{ type: string; text: string }>;
export type PageErrorRecord = Readonly<{ message: string }>;
export type RequestFailureRecord = Readonly<{
  url: string;
  failure: string | null;
}>;
export type EvidenceCaptureInput = Readonly<{
  page: Page;
  archiveRoot: string;
  sourceSha: string;
  profile: SeedProfile;
  role: Role;
  catalogRoute: string;
  resolvedRoute: string;
  cellId: string;
  inventory: DomInventory;
  consoleMessages: readonly ConsoleRecord[];
  pageErrors: readonly PageErrorRecord[];
  requestFailures: readonly RequestFailureRecord[];
  responseStatus: number | null;
  capturedAt: string;
}>;
export type EvidenceCaptureResult = Readonly<{
  bundle: EvidenceBundle;
  all: readonly EvidenceRef[];
}>;
