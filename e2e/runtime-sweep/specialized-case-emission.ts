import path from "node:path";

import type { Page } from "@playwright/test";

import {
  coverageCellSchema,
  type EvidenceBundle,
  type EvidenceRef,
  type MatrixExecutionKind,
} from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import type { EvidencePhase, FunctionalAssertion } from "./evidence-types.ts";
import type { FrozenCaseReplayResult } from "./frozen-case-evidence.ts";
import { stableSerialize } from "./ids.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  eventsFor,
  type RuntimeEvents,
  writeCell,
} from "./runtime-matrix-evidence.ts";

const SPECIALIZED_KINDS: readonly MatrixExecutionKind[] = [
  "fault",
  "concurrency",
  "infrastructure",
];
type SpecializedExecutionKind = (typeof SPECIALIZED_KINDS)[number];
const isSpecializedKind = (
  value: MatrixExecutionKind,
): value is SpecializedExecutionKind => SPECIALIZED_KINDS.includes(value);
const DESKTOP_ORACLE = {
  viewport: { width: 1440, height: 900 },
  maxHorizontalOverflow: 0,
  requireNoZeroSize: false,
} as const;

export type SpecializedRuntimeEventWindow = Pick<
  RuntimeEvents,
  "consoleMessages" | "pageErrors" | "requestFailures"
>;

const eventWindow = (
  listeners: SpecializedRuntimeEventWindow,
): SpecializedRuntimeEventWindow => ({
  consoleMessages: [...listeners.consoleMessages],
  pageErrors: [...listeners.pageErrors],
  requestFailures: [...listeners.requestFailures],
});

export async function captureSpecializedEventWindow<T>(
  page: Page,
  operation: () => Promise<T>,
): Promise<
  Readonly<{
    readonly result: T;
    readonly events: SpecializedRuntimeEventWindow;
  }>
> {
  const listeners = eventsFor(page);
  try {
    const result = await operation();
    return { result, events: eventWindow(listeners) };
  } finally {
    listeners.detach();
  }
}

export async function captureSpecializedEventWindows<T>(
  pages: readonly Page[],
  operation: () => Promise<T>,
): Promise<
  Readonly<{
    readonly result: T;
    readonly events: readonly SpecializedRuntimeEventWindow[];
  }>
> {
  const listeners = pages.map(eventsFor);
  try {
    const result = await operation();
    return {
      result,
      events: listeners.map(eventWindow),
    };
  } finally {
    listeners.forEach(({ detach }) => detach());
  }
}

export const initialSpecializedNavigation = async (
  page: Page,
  route: string,
): Promise<
  Readonly<{
    readonly responseStatus: number | null;
    readonly events: SpecializedRuntimeEventWindow;
  }>
> => {
  const navigation = await captureSpecializedEventWindow(page, () =>
    page.goto(route),
  );
  return {
    responseStatus: navigation.result?.status() ?? null,
    events: navigation.events,
  };
};

export interface SpecializedPagePhaseInput {
  readonly page: Page;
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly phase: EvidencePhase;
  readonly capturedAt: string;
  readonly responseStatus: number | null;
  readonly functionalAssertion: FunctionalAssertion;
  readonly initialEvents?: SpecializedRuntimeEventWindow | undefined;
  readonly perform?: (() => Promise<SpecializedPagePhaseAction>) | undefined;
}

export interface SpecializedPagePhaseAction {
  readonly responseStatus?: number | null;
  readonly actionRefs?: readonly EvidenceRef[];
  readonly functionalAssertion?: FunctionalAssertion;
}

export interface SpecializedCoverageWriteInput {
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly result: FrozenCaseReplayResult;
}

export class SpecializedCaseEmissionError extends Error {
  override readonly name = "SpecializedCaseEmissionError";
}

const inside = (root: string, candidate: string): string => {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  if (
    candidatePath !== rootPath &&
    !candidatePath.startsWith(`${rootPath}${path.sep}`)
  )
    throw new SpecializedCaseEmissionError(
      `Specialized coverage artifact escaped archive: ${candidatePath}`,
    );
  return candidatePath;
};

export const specializedCoveragePath = (
  archiveRoot: string,
  matrixCase: MatrixExecutableCase,
): string =>
  inside(
    archiveRoot,
    path.join(
      archiveRoot,
      "cells",
      matrixCase.profile,
      matrixCase.role,
      `${matrixCase.caseId}.json`,
    ),
  );

export function assertSpecializedCaseBinding(
  matrixCase: MatrixExecutableCase,
  expected?: Readonly<{
    readonly kind?: Exclude<
      MatrixExecutionKind,
      "navigation" | "idle" | "control" | "recovery"
    >;
    readonly faultId?: string;
  }>,
): void {
  const { execution } = matrixCase;
  if (!isSpecializedKind(execution.kind))
    throw new SpecializedCaseEmissionError(
      `Case ${matrixCase.caseId} is not a specialized execution row`,
    );
  if (!("faultId" in execution))
    throw new SpecializedCaseEmissionError(
      `Case ${matrixCase.caseId} has no canonical fault id`,
    );
  if (matrixCase.state.fault === "none")
    throw new SpecializedCaseEmissionError(
      `Case ${matrixCase.caseId} has a specialized execution with fault none`,
    );
  if (expected?.kind !== undefined && execution.kind !== expected.kind)
    throw new SpecializedCaseEmissionError(
      `Case ${matrixCase.caseId} execution kind ${execution.kind} does not match ${expected.kind}`,
    );
  if (expected?.faultId !== undefined && execution.faultId !== expected.faultId)
    throw new SpecializedCaseEmissionError(
      `Case ${matrixCase.caseId} fault id ${execution.faultId} does not match ${expected.faultId}`,
    );
}

export async function captureSpecializedPagePhase(
  input: SpecializedPagePhaseInput,
): Promise<EvidenceBundle> {
  assertSpecializedCaseBinding(input.matrixCase);
  const listeners = eventsFor(input.page);
  try {
    const action =
      input.perform === undefined ? undefined : await input.perform();
    const inventory = await inventoryDom(input.page);
    const phaseEvents =
      input.initialEvents === undefined
        ? listeners
        : {
            consoleMessages: [
              ...input.initialEvents.consoleMessages,
              ...listeners.consoleMessages,
            ],
            pageErrors: [
              ...input.initialEvents.pageErrors,
              ...listeners.pageErrors,
            ],
            requestFailures: [
              ...input.initialEvents.requestFailures,
              ...listeners.requestFailures,
            ],
          };
    const captured = (
      await captureRouteEvidence({
        page: input.page,
        archiveRoot: input.archiveRoot,
        sourceSha: input.matrixCase.sourceSha,
        profile: input.matrixCase.profile,
        role: input.matrixCase.role,
        catalogRoute: input.matrixCase.catalogRoute,
        resolvedRoute: input.matrixCase.resolvedRoute,
        cellId: input.matrixCase.caseId,
        inventory,
        consoleMessages: phaseEvents.consoleMessages,
        pageErrors: phaseEvents.pageErrors,
        requestFailures: phaseEvents.requestFailures,
        responseStatus: action?.responseStatus ?? input.responseStatus,
        capturedAt: input.capturedAt,
        capturePhase: input.phase,
        functionalAssertion:
          action?.functionalAssertion ?? input.functionalAssertion,
        geometryOracle: DESKTOP_ORACLE,
      })
    ).bundle;
    return {
      ...captured,
      action: [...captured.action, ...(action?.actionRefs ?? [])],
    };
  } finally {
    listeners.detach();
  }
}

export async function writeSpecializedCoverageCell(
  input: SpecializedCoverageWriteInput,
): Promise<string> {
  assertSpecializedCaseBinding(input.matrixCase);
  const cell = coverageCellSchema.parse(input.result.cell);
  if (cell.cellId !== input.matrixCase.caseId)
    throw new SpecializedCaseEmissionError(
      `Specialized result cell ${cell.cellId} does not equal case ${input.matrixCase.caseId}`,
    );
  if (
    stableSerialize(cell.execution) !==
    stableSerialize(input.matrixCase.execution)
  )
    throw new SpecializedCaseEmissionError(
      `Specialized result execution does not equal case ${input.matrixCase.caseId}`,
    );
  const expectedFaultId =
    "faultId" in input.matrixCase.execution
      ? input.matrixCase.execution.faultId
      : null;
  if (cell.faultId !== expectedFaultId)
    throw new SpecializedCaseEmissionError(
      `Specialized result fault id does not equal case ${input.matrixCase.caseId}`,
    );
  await writeCell(input.archiveRoot, cell);
  return specializedCoveragePath(input.archiveRoot, input.matrixCase);
}
