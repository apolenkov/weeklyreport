import { z } from "zod";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { Action } from "../source/contracts.ts";
import { expectedActionPathnameFor } from "../support/action-navigation-contract.ts";
import type { TransitionVisualPolicy } from "./transition-visual-evaluation.ts";

const HTTP_ERROR_FLOOR = 400;
const VIEW_MODE_PARAMETER = "mode";
const SLIDES_VIEW_MODE = "slides";

export const transitionUrlArtifactSchema = z
  .object({
    url: z.url(),
    status: z.number().int().nullable(),
  })
  .strict();

export type TransitionUrlArtifact = z.infer<typeof transitionUrlArtifactSchema>;

const successfulUrl = ({ status }: TransitionUrlArtifact): boolean =>
  status !== null && status < HTTP_ERROR_FLOOR;

const settledAtTarget = (target: URL, settled: URL): boolean => {
  const targetPath =
    target.pathname !== "/" && target.pathname.endsWith("/")
      ? target.pathname.slice(0, -1)
      : target.pathname;
  const matchingPath =
    settled.pathname === targetPath ||
    (targetPath !== "/" && settled.pathname.startsWith(`${targetPath}/`));
  return (
    matchingPath &&
    (target.search === "" || settled.search === target.search) &&
    (target.hash === "" || settled.hash === target.hash)
  );
};

const crossRouteLinkIsProven = (
  target: URL,
  initial: URL,
  settled: URL,
): boolean =>
  target.origin === initial.origin &&
  settled.origin === target.origin &&
  initial.pathname !== settled.pathname &&
  initial.pathname !== target.pathname &&
  settledAtTarget(target, settled);

const compareQueryEntries = (
  left: readonly [string, string],
  right: readonly [string, string],
): number => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]);

const queryEntriesWithoutMode = (
  url: URL,
): readonly (readonly [string, string])[] =>
  [...url.searchParams.entries()]
    .filter(([name]) => name !== VIEW_MODE_PARAMETER)
    .map(([name, value]) => [name, value] as const)
    .toSorted(compareQueryEntries);

const viewMode = (url: URL): string | null | undefined => {
  const values = url.searchParams.getAll(VIEW_MODE_PARAMETER);
  if (values.length > 1) return undefined;
  const value = values[0] ?? null;
  return value === null || value === SLIDES_VIEW_MODE ? value : undefined;
};

const sameEntries = (left: URL, right: URL): boolean =>
  JSON.stringify(queryEntriesWithoutMode(left)) ===
  JSON.stringify(queryEntriesWithoutMode(right));

const viewModeLinkIsProven = (
  target: URL,
  initial: URL,
  settled: URL,
): boolean => {
  const initialMode = viewMode(initial);
  const targetMode = viewMode(target);
  const settledMode = viewMode(settled);
  return (
    initial.origin === target.origin &&
    target.origin === settled.origin &&
    initial.pathname === target.pathname &&
    target.pathname === settled.pathname &&
    initialMode !== undefined &&
    targetMode !== undefined &&
    settledMode !== undefined &&
    initialMode !== targetMode &&
    targetMode === settledMode &&
    sameEntries(initial, target) &&
    sameEntries(target, settled) &&
    initial.hash === target.hash &&
    target.hash === settled.hash
  );
};

const signOutIsProven = (
  controlKey: string,
  initial: URL,
  settled: URL,
): boolean => {
  const expectedPathname = expectedActionPathnameFor(controlKey);
  return (
    expectedPathname !== undefined &&
    initial.origin === settled.origin &&
    initial.pathname !== expectedPathname &&
    settled.pathname === expectedPathname &&
    settled.search === "" &&
    settled.hash === ""
  );
};

const navigationBoundaryIsProven = (
  action: Action,
  initial: URL,
  settled: URL,
): boolean => {
  const href = action.target?.href;
  if (href === undefined)
    return signOutIsProven(action.controlKey, initial, settled);
  const target = new URL(href, initial);
  return (
    crossRouteLinkIsProven(target, initial, settled) ||
    viewModeLinkIsProven(target, initial, settled)
  );
};

export const policyForNavigationPair = (
  matrixCase: MatrixExecutableCase,
  before: TransitionUrlArtifact,
  after: TransitionUrlArtifact,
  policy: TransitionVisualPolicy,
): TransitionVisualPolicy => {
  const execution = matrixCase.execution;
  const action = "action" in execution ? execution.action : undefined;
  if (
    action?.operation !== "click" ||
    action.safety !== "read-only" ||
    !successfulUrl(before) ||
    !successfulUrl(after)
  )
    return policy;
  try {
    const initial = new URL(before.url);
    const settled = new URL(after.url);
    const proven = navigationBoundaryIsProven(action, initial, settled);
    return proven
      ? { ...policy, allowNavigationBoundaryStableLayoutChange: true }
      : policy;
  } catch (error: unknown) {
    if (error instanceof TypeError) return policy;
    throw error;
  }
};
