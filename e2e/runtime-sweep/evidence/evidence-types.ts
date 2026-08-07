import type { Page } from "@playwright/test";

import type { DomInventory } from "../replay/dom-inventory.ts";
import type {
  EvidenceBundle,
  EvidenceRef,
  Role,
  SeedProfile,
} from "../source/contracts.ts";

export type ConsoleRecord = Readonly<{ type: string; text: string }>;
export type PageErrorRecord = Readonly<{ message: string }>;
export type RequestFailureRecord = Readonly<{
  url: string;
  method: string;
  resourceType: string;
  failure: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}>;
export type ResponseRecord = Readonly<{
  url: string;
  method: string;
  resourceType: string;
  status: number;
  ok: boolean;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  correlationId: string | null;
}>;
export type NetworkEvidencePolicy = Readonly<{
  maxRepeatedApiRequests: number;
  retryStormThreshold: number;
  slowRequestThresholdMs: number;
  cacheExpectedOperations: readonly string[];
}>;
export type ExpectedFault = Readonly<{
  faultId: string;
  operation: string;
  method: string;
  expectedStatus: number | null;
  expectedTransportFailure: string | null;
  expectedCount: 1;
}>;
export type ServerLogRecord = Readonly<{
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  correlationId: string;
  service: string | null;
  context: Readonly<Record<string, unknown>>;
}>;
export type ServerLogEvidence = Readonly<{
  available: boolean;
  records: readonly ServerLogRecord[];
  malformedCount: number;
  correlationIds: readonly string[];
  missingCorrelationIds: readonly string[];
  errorCount: number;
  warningCount: number;
  slowCount: number;
  workerCount: number;
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
  layoutKey: string | null;
  layoutStability: "position-size" | "position-width" | null;
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
  loading: Readonly<{ busyCount: number; skeletonCount: number }>;
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
  responses?: readonly ResponseRecord[];
  expectedFault?: ExpectedFault;
  networkPolicy?: NetworkEvidencePolicy;
  settleRuntimeEvents?: () => Promise<void>;
  serverLogPath?: string;
  phaseStartedAt?: string;
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
