import type {
  MatrixAxes,
  Role,
  SeedCapability,
} from "../../source/contracts.ts";
import { matrixAxesSchema } from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";
import type { MatrixInapplicable } from "../matrix.ts";

const DEFAULT_WITNESS: SeedCapability = "canonical-identities";

export const stateCapabilities = (
  axes: Readonly<Partial<MatrixAxes>>,
  routeCapability: SeedCapability | null,
): readonly SeedCapability[] =>
  [
    routeCapability,
    axes.lifecycle === "reopened" ? "reopen-flow" : undefined,
    axes.lifecycle === "published" ? "published-period" : undefined,
    axes.lifecycle === "archived" ? "archive-flow" : undefined,
    axes.lifecycle === "open" &&
    axes.submission !== undefined &&
    axes.submission !== "draft"
      ? "submission-contrast"
      : undefined,
    axes.ownershipDensity === "multiple" ? "ownership" : undefined,
  ].filter(
    (value): value is SeedCapability => value !== undefined && value !== null,
  );

export const witnessCapability = (
  axes: MatrixAxes,
  routeCapability: SeedCapability | null,
  available: readonly SeedCapability[],
): SeedCapability =>
  stateCapabilities(axes, routeCapability).at(0) ??
  available.at(0) ??
  DEFAULT_WITNESS;

export const excludedStateCombinations = (
  role: Role,
  route: string,
  routeCapability: SeedCapability | null,
  available: readonly SeedCapability[],
  stateAxes: Readonly<{
    readonly lifecycle: readonly MatrixAxes["lifecycle"][];
    readonly submission: readonly MatrixAxes["submission"][];
    readonly ownershipDensity: readonly MatrixAxes["ownershipDensity"][];
    readonly permission: readonly MatrixAxes["permission"][];
  }>,
): readonly MatrixInapplicable[] => {
  const initialRows = [
    {
      role,
      route,
      profileCapability: available.at(0) ?? DEFAULT_WITNESS,
      fault: "none" as const,
      controlTransition: "none" as const,
    },
  ] satisfies readonly Partial<MatrixAxes>[];
  const rows = (
    ["lifecycle", "submission", "ownershipDensity", "permission"] as const
  ).reduce<readonly Partial<MatrixAxes>[]>(
    (current, axis) => expandAxis(current, axis, stateAxes[axis]),
    initialRows,
  );
  const entries = rows.flatMap((row) => {
    const parsed = matrixAxesSchema.parse(row);
    const axes = matrixAxesSchema.parse({
      ...row,
      profileCapability: witnessCapability(parsed, routeCapability, available),
    });
    const capabilityMissing = stateCapabilities(axes, routeCapability).find(
      (capability) => !available.includes(capability),
    );
    const ownerWithoutStage =
      axes.permission === "owner" && axes.ownershipDensity === "none";
    return capabilityMissing === undefined && !ownerWithoutStage
      ? []
      : [
          {
            axes,
            constraintId:
              capabilityMissing === undefined
                ? "ownership-permission-boundary"
                : "profile-capability-boundary",
            reason:
              capabilityMissing === undefined
                ? "Owner permission requires an assigned stage"
                : "State requires a capability absent from the seed profile",
          },
        ];
  });
  const unique = new Map<string, MatrixInapplicable>();
  entries.forEach((entry) => unique.set(stableSerialize(entry), entry));
  return [...unique.values()];
};

const expandAxis = <T extends StateAxis>(
  rows: readonly Partial<MatrixAxes>[],
  axis: T,
  values: readonly MatrixAxes[T][],
): readonly Partial<MatrixAxes>[] =>
  rows.flatMap((row) => values.map((value) => ({ ...row, [axis]: value })));

type StateAxis = "lifecycle" | "submission" | "ownershipDensity" | "permission";
