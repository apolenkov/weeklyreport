import type { Page, TestInfo } from "@playwright/test";

import { reseedE2eRuntimeState } from "../../helpers/e2e-runtime-state-setup.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import {
  routeForState,
  type RuntimeMatrixSource,
  runtimeStateGroupKey,
} from "../matrix/runtime-matrix.ts";
import { awaitRuntimeApiDrain } from "../support/runtime-api-drain.ts";
import type { FrozenCaseCoverageCell } from "./frozen-case-evidence.ts";
import {
  type FrozenCaseLiveRuntime,
  prepareCase,
  stateForCase,
} from "./frozen-case-live-actions.ts";
import {
  buildFrozenCasePreparationPlan,
  type FrozenCaseGroup,
  frozenCasePreparationKey,
  type FrozenCasePreparationRoute,
  groupFrozenCases,
  isReusableFrozenCase,
  restoreFrozenCaseOrder,
} from "./frozen-case-live-shards.ts";

type PreparedCase = Awaited<ReturnType<typeof prepareCase>>["prepared"];

export type RuntimeFrozenCaseExecutor = (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  testInfo: TestInfo,
  preparedCase?: PreparedCase,
) => Promise<FrozenCaseCoverageCell>;

interface CampaignInput {
  readonly page: Page;
  readonly source: RuntimeMatrixSource;
  readonly cases: readonly MatrixExecutableCase[];
  readonly runtime: FrozenCaseLiveRuntime;
  readonly testInfo: TestInfo;
  readonly execute: RuntimeFrozenCaseExecutor;
}

const reuseProfileBaseline = (): void => undefined;
const BLANK_PAGE = "about:blank";

export const quiesceFrozenCasePage = async (
  page: Page,
  runtime: FrozenCaseLiveRuntime,
): Promise<void> => {
  await page.goto(BLANK_PAGE);
  await awaitRuntimeApiDrain(runtime.apiURL);
};

const groupKeyFor = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
): string =>
  runtimeStateGroupKey(
    matrixCase.profile,
    routeForState(source, stateForCase(matrixCase)).target,
  );

const replaySubgroupKeyFor = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  repoRoot: string,
): string => {
  if (!isReusableFrozenCase(matrixCase)) return `isolated:${matrixCase.caseId}`;
  const route = routeForState(source, stateForCase(matrixCase));
  return `reusable:${frozenCasePreparationKey(matrixCase, route, repoRoot)}`;
};

const requirePassingCell = (
  matrixCase: MatrixExecutableCase,
  cell: FrozenCaseCoverageCell,
): FrozenCaseCoverageCell => {
  if (cell.verdict !== "pass")
    throw new Error(
      `Frozen case ${matrixCase.caseId} produced cell ${cell.cellId} with verdict=${cell.verdict}`,
    );
  return cell;
};

const runPreparedReadOnlyCases = async (
  input: CampaignInput,
  cases: readonly MatrixExecutableCase[],
  prepared: PreparedCase,
  index: number,
): Promise<readonly FrozenCaseCoverageCell[]> => {
  const matrixCase = cases[index];
  if (matrixCase === undefined) return [];
  await quiesceFrozenCasePage(input.page, input.runtime);
  const current = requirePassingCell(
    matrixCase,
    await input.execute(
      input.page,
      input.source,
      matrixCase,
      input.runtime,
      input.testInfo,
      prepared,
    ),
  );
  const remaining = await runPreparedReadOnlyCases(
    input,
    cases,
    prepared,
    index + 1,
  );
  return [current, ...remaining];
};

const runReusableReadOnlyGroup = async (
  input: CampaignInput,
  cases: readonly MatrixExecutableCase[],
): Promise<readonly FrozenCaseCoverageCell[]> => {
  const firstCase = cases[0];
  if (firstCase === undefined)
    throw new Error("Reusable read-only case group is empty");
  await quiesceFrozenCasePage(input.page, input.runtime);
  const route: FrozenCasePreparationRoute = routeForState(
    input.source,
    stateForCase(firstCase),
  );
  const { prepared } = await prepareCase(
    input.source,
    firstCase,
    input.runtime,
    reuseProfileBaseline,
  );
  const expectedPlan = buildFrozenCasePreparationPlan(
    firstCase,
    route,
    input.runtime.repoRoot,
  );
  if (prepared.plan.digest !== expectedPlan.digest)
    throw new Error(
      `Frozen case ${firstCase.caseId} prepared plan digest mismatch: expected=${expectedPlan.digest} actual=${prepared.plan.digest}`,
    );
  const firstCell = requirePassingCell(
    firstCase,
    await input.execute(
      input.page,
      input.source,
      firstCase,
      input.runtime,
      input.testInfo,
      prepared,
    ),
  );
  const remaining = await runPreparedReadOnlyCases(input, cases, prepared, 1);
  return [firstCell, ...remaining];
};

const runFrozenCaseRange = async (
  input: CampaignInput,
  cases: readonly MatrixExecutableCase[],
  start: number,
  end: number,
): Promise<readonly FrozenCaseCoverageCell[]> => {
  if (start >= end) return [];
  if (end - start === 1) {
    const matrixCase = cases[start];
    if (matrixCase === undefined)
      throw new Error(`Frozen case range has no case at index ${start}`);
    return [
      requirePassingCell(
        matrixCase,
        await input.execute(
          input.page,
          input.source,
          matrixCase,
          input.runtime,
          input.testInfo,
        ),
      ),
    ];
  }
  const middle = start + Math.floor((end - start) / 2);
  const left = await runFrozenCaseRange(input, cases, start, middle);
  const right = await runFrozenCaseRange(input, cases, middle, end);
  return [...left, ...right];
};

const runFrozenCaseSubgroups = async (
  input: CampaignInput,
  groups: readonly FrozenCaseGroup[],
  index: number,
): Promise<readonly FrozenCaseCoverageCell[]> => {
  const group = groups[index];
  if (group === undefined) return [];
  const firstCase = group[0];
  if (firstCase === undefined)
    throw new Error(`Frozen case subgroup ${index} is empty`);
  const current = isReusableFrozenCase(firstCase)
    ? await runReusableReadOnlyGroup(input, group)
    : await runFrozenCaseRange(input, group, 0, group.length);
  const remaining = await runFrozenCaseSubgroups(input, groups, index + 1);
  return [...current, ...remaining];
};

const resetBetweenGroups = async (
  input: CampaignInput,
  profile: MatrixExecutableCase["profile"],
): Promise<void> => {
  await quiesceFrozenCasePage(input.page, input.runtime);
  await reseedE2eRuntimeState({
    databaseUrl: input.runtime.databaseUrl,
    profile,
    repoRoot: input.runtime.repoRoot,
  });
};

const runFrozenCaseGroups = async (
  input: CampaignInput,
  groups: readonly FrozenCaseGroup[],
  index: number,
): Promise<readonly FrozenCaseCoverageCell[]> => {
  const group = groups[index];
  if (group === undefined) return [];
  const firstCase = group[0];
  if (firstCase === undefined)
    throw new Error(`Frozen case group ${index} is empty`);
  if (index > 0) await resetBetweenGroups(input, firstCase.profile);
  const current = await runFrozenCaseSubgroups(
    input,
    groupFrozenCases(group, (matrixCase) =>
      replaySubgroupKeyFor(input.source, matrixCase, input.runtime.repoRoot),
    ),
    0,
  );
  const remaining = await runFrozenCaseGroups(input, groups, index + 1);
  return [...current, ...remaining];
};

export const runFrozenCaseCampaign = async (
  input: CampaignInput,
): Promise<readonly FrozenCaseCoverageCell[]> => {
  const cells = await runFrozenCaseGroups(
    input,
    groupFrozenCases(input.cases, (matrixCase) =>
      groupKeyFor(input.source, matrixCase),
    ),
    0,
  );
  return restoreFrozenCaseOrder(input.cases, cells);
};
