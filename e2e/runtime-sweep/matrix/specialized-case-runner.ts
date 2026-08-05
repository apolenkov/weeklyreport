import type { Browser, Page, TestInfo } from "@playwright/test";

import type { FrozenCaseReplayResult } from "../replay/frozen-case-evidence.ts";
import {
  type ConcurrencyCaseRunInput,
  runConcurrencyCase,
} from "../scenarios/concurrency/concurrency-runner.ts";
import {
  type FaultCaseRunInput,
  runFaultCase,
} from "../scenarios/faults/fault-runner.ts";
import {
  type InfrastructureCaseRunInput,
  runInfrastructureCase,
} from "../scenarios/infrastructure/infrastructure-runner.ts";
import type { Oracle } from "../source/contracts.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

export interface SpecializedCaseRunInput {
  readonly page: Page;
  readonly browser: Browser;
  readonly baseURL: string | undefined;
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly testInfo: TestInfo;
  readonly capturedAt: string;
}

export const runSpecializedCase = async (
  input: SpecializedCaseRunInput,
): Promise<FrozenCaseReplayResult | undefined> => {
  switch (input.matrixCase.execution.kind) {
    case "fault": {
      const faultInput: FaultCaseRunInput = input;
      return runFaultCase(faultInput);
    }
    case "concurrency": {
      const concurrencyInput: ConcurrencyCaseRunInput = input;
      return runConcurrencyCase(concurrencyInput);
    }
    case "infrastructure": {
      const infrastructureInput: InfrastructureCaseRunInput = input;
      return runInfrastructureCase(infrastructureInput);
    }
    default:
      return undefined;
  }
};
