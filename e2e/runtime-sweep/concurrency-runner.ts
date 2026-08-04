import type { Browser, TestInfo } from "@playwright/test";

import { resetMutations } from "../integration/helpers/db.ts";
import {
  loadInitialSection,
  openPages,
  prepareConcurrentEdits,
} from "./concurrency-helpers.ts";
import { runConcurrencyPhases } from "./concurrency-runner-phases.ts";
import { coverageCellSchema, type Oracle } from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import { writeFrozenCaseArtifact } from "./frozen-case-artifacts.ts";
import { type FrozenCaseReplayResult } from "./frozen-case-evidence.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import { controlEvidence } from "./runtime-matrix-evidence.ts";
import {
  assertSpecializedCaseBinding,
  captureSpecializedEventWindows,
} from "./specialized-case-emission.ts";

export interface ConcurrencyCaseRunInput {
  readonly browser: Browser;
  readonly baseURL: string | undefined;
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly testInfo: TestInfo;
  readonly capturedAt: string;
}

const writeCleanupArtifact = async (input: ConcurrencyCaseRunInput) =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "concurrency-cleanup.json",
    kind: "db",
    dimension: "runtime",
    capturedAt: input.capturedAt,
    value: {
      gatesReleased: true,
      routesUnregistered: true,
      pagesClosed: true,
      cleanup: "complete",
    },
  });

const finalizeCoverage = async (
  input: ConcurrencyCaseRunInput,
  result: FrozenCaseReplayResult,
  cleanupRef: Awaited<ReturnType<typeof writeCleanupArtifact>>,
): Promise<FrozenCaseReplayResult> => {
  const cell = coverageCellSchema.parse({
    ...result.cell,
    evidence: {
      ...result.cell.evidence,
      after: [...result.cell.evidence.after, cleanupRef],
    },
  });
  const finalResult = { cell, issues: result.issues };
  await input.testInfo.attach(`${input.matrixCase.caseId}.json`, {
    body: JSON.stringify(cell),
    contentType: "application/json",
  });
  return finalResult;
};

export async function runConcurrencyCase(
  input: ConcurrencyCaseRunInput,
): Promise<FrozenCaseReplayResult> {
  assertSpecializedCaseBinding(input.matrixCase, {
    kind: "concurrency",
    faultId: "period-stale-version",
  });
  await resetMutations();
  const initial = await loadInitialSection();
  const pages = await openPages(input.browser, input.baseURL);
  const result = await (async () => {
    try {
      const prepared = await captureSpecializedEventWindows(
        [pages.first, pages.second],
        () =>
          prepareConcurrentEdits(
            pages.first,
            pages.second,
            initial.initialItem.text,
          ),
      );
      const inventory = await inventoryDom(pages.first);
      return await runConcurrencyPhases({
        ...input,
        initial,
        pages,
        controls: controlEvidence(inventory, input.matrixCase.caseId),
        initialEvents: prepared.events[0] ?? {
          consoleMessages: [],
          pageErrors: [],
          requestFailures: [],
        },
        concurrentEvents: prepared.events[1] ?? {
          consoleMessages: [],
          pageErrors: [],
          requestFailures: [],
        },
      });
    } finally {
      pages.firstGate.release();
      pages.secondGate.release();
      await Promise.all([
        pages.firstGate.remove(),
        pages.secondGate.remove(),
        pages.first.close(),
        pages.second.close(),
      ]);
      await resetMutations();
    }
  })();
  return finalizeCoverage(input, result, await writeCleanupArtifact(input));
}
