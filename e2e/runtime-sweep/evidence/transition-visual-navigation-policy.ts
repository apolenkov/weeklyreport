import { z } from "zod";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { TransitionVisualPolicy } from "./transition-visual-evaluation.ts";

const HTTP_ERROR_FLOOR = 400;

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

export const policyForNavigationPair = (
  matrixCase: MatrixExecutableCase,
  before: TransitionUrlArtifact,
  after: TransitionUrlArtifact,
  policy: TransitionVisualPolicy,
): TransitionVisualPolicy => {
  const execution = matrixCase.execution;
  const action = "action" in execution ? execution.action : undefined;
  const href = action?.target?.href;
  if (
    action?.operation !== "click" ||
    action.safety !== "read-only" ||
    href === undefined ||
    !successfulUrl(before) ||
    !successfulUrl(after)
  )
    return policy;
  try {
    const initial = new URL(before.url);
    const target = new URL(href, initial);
    const settled = new URL(after.url);
    const proven =
      target.origin === initial.origin &&
      settled.origin === target.origin &&
      initial.pathname !== settled.pathname &&
      initial.pathname !== target.pathname &&
      settledAtTarget(target, settled);
    return proven
      ? { ...policy, allowCrossRouteStableLayoutChange: true }
      : policy;
  } catch (error: unknown) {
    if (error instanceof TypeError) return policy;
    throw error;
  }
};
