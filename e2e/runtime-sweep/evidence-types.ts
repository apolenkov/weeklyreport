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
export type EvidencePhase = "before" | "action" | "after";
export type FunctionalAssertion = Readonly<{
  assertionId: string;
  expected: unknown;
  actual: unknown;
  message: string;
}>;
export type VisualBaseline = Readonly<{
  archivePath: string;
  digest: string;
  sourceSha: string;
  reviewedMasks: readonly string[];
}>;
export type GeometryOracle = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  maxHorizontalOverflow?: number;
  maxVerticalOverflow?: number;
  requireNoZeroSize?: boolean;
}>;
export type GeometryElement = Readonly<{
  index: number;
  tagName: string;
  role: string | null;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layoutVisible: boolean;
  visible: boolean;
}>;
export type GeometrySnapshot = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  document: Readonly<{ scrollWidth: number; scrollHeight: number }>;
  elements: readonly GeometryElement[];
  issues: readonly string[];
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
  capturePhase?: EvidencePhase;
  functionalAssertion?: FunctionalAssertion;
  visualBaseline?: VisualBaseline;
  geometryOracle?: GeometryOracle;
}>;
export type EvidenceCaptureResult = Readonly<{
  bundle: EvidenceBundle;
  all: readonly EvidenceRef[];
}>;
