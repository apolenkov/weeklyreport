import path from "node:path";

import type { CampaignMatrixState } from "./campaign-matrix.ts";
import type { Role, SeedProfile } from "./contracts.ts";
import { type RuntimeMatrixSelection } from "./runtime-matrix.ts";

type MatrixLiveControlSpecialization =
  "fault" | "control-transition" | "fault-and-control-transition";

export type MatrixLiveControlRoute =
  | Readonly<{
      readonly kind: "runnable";
      readonly state: CampaignMatrixState;
    }>
  | Readonly<{
      readonly kind: "specialized";
      readonly state: CampaignMatrixState;
      readonly specialization: MatrixLiveControlSpecialization;
    }>;

class MatrixLiveControlRoutingError extends Error {
  override readonly name = "MatrixLiveControlRoutingError";
}

const specializationFor = (
  state: CampaignMatrixState,
): MatrixLiveControlSpecialization | undefined => {
  const hasFault = state.axes.fault !== "none";
  const hasTransition = state.axes.controlTransition !== "none";
  if (hasFault && hasTransition) return "fault-and-control-transition";
  if (hasFault) return "fault";
  if (hasTransition) return "control-transition";
  return undefined;
};

const assertStateKind = (
  state: CampaignMatrixState,
  expected: "runnable" | "specialized",
): MatrixLiveControlRoute => {
  const specialization = specializationFor(state);
  if (expected === "runnable" && specialization !== undefined)
    throw new MatrixLiveControlRoutingError(
      `Runnable matrix state ${state.stateId} carries ${specialization}`,
    );
  if (expected === "specialized" && specialization === undefined)
    throw new MatrixLiveControlRoutingError(
      `Specialized matrix state ${state.stateId} has no fault or control transition`,
    );
  if (expected === "runnable") return { kind: "runnable", state };
  if (specialization === undefined)
    throw new MatrixLiveControlRoutingError(
      `Specialized matrix state ${state.stateId} has no specialization`,
    );
  return { kind: "specialized", state, specialization };
};

const assertUniqueStateIds = (
  states: readonly MatrixLiveControlRoute[],
): void => {
  const seen = new Set<string>();
  states.forEach(({ state }) => {
    if (seen.has(state.stateId))
      throw new MatrixLiveControlRoutingError(
        `Duplicate matrix state identity: ${state.stateId}`,
      );
    seen.add(state.stateId);
  });
};

export function routeSelectedMatrixStates(
  selection: RuntimeMatrixSelection,
): readonly MatrixLiveControlRoute[] {
  const routed = [
    ...selection.runnable.map((state) => assertStateKind(state, "runnable")),
    ...selection.specialized.map((state) =>
      assertStateKind(state, "specialized"),
    ),
  ];
  assertUniqueStateIds(routed);
  return routed;
}

export function matrixCellPath(
  archiveRoot: string,
  profile: SeedProfile,
  role: Role,
  cellId: string,
): string {
  return path.join(
    path.resolve(archiveRoot),
    "cells",
    profile,
    role,
    `${cellId}.json`,
  );
}
