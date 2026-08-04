import { z } from "zod";

import { type Role, SEED_PROFILES } from "./contracts.ts";
import {
  type DriverValidationInput,
  renderDriverAssignment,
} from "./driver-results.ts";
import type { DriverShardAssignment } from "./driver-shards.ts";

interface DriverIdentity {
  readonly email: string;
  readonly landing: string;
}

const DRIVER_IDENTITIES: Readonly<Record<Role, DriverIdentity>> = {
  lead: {
    email: "lead1@customreport.local",
    landing: "%2Flead%2Freport",
  },
  head: {
    email: "head@customreport.local",
    landing: "%2Fhead%2Fdashboard",
  },
  admin: {
    email: "admin@customreport.local",
    landing: "%2Fadmin",
  },
  viewer: {
    email: "viewer@customreport.local",
    landing: "%2Freports%3Ftab%3Dpublished",
  },
};

const assignedCellsSchema = z.array(z.record(z.string(), z.unknown()));

const driverModeFor = (
  kind: DriverValidationInput["cells"][number]["execution"]["kind"],
): "browser-action" | "deterministic-evidence-review" =>
  ["fault", "concurrency", "infrastructure"].includes(kind)
    ? "deterministic-evidence-review"
    : "browser-action";

export interface DriverPromptInput {
  readonly template: string;
  readonly role: Role;
  readonly profile: (typeof SEED_PROFILES)[number];
  readonly sourceSha: string;
  readonly repoRoot: string;
  readonly baseURL: string;
  readonly shard: DriverShardAssignment;
  readonly validation: DriverValidationInput;
}

const renderShardAssignment = (
  shard: DriverShardAssignment,
  validation: DriverValidationInput,
): string =>
  JSON.stringify(
    {
      shard: {
        shardId: shard.shardId,
        shardIndex: shard.shardIndex,
        shardCount: shard.shardCount,
        digest: shard.digest,
        profile: shard.profile,
        role: shard.role,
        catalogRoute: shard.catalogRoute,
        resolvedRoute: shard.resolvedRoute,
        routeTarget: shard.routeTarget,
        stateId: shard.stateId,
        state: shard.state,
        caseIds: shard.caseIds,
        executionLane: shard.executionLane,
      },
      assignedCells: assignedCellsSchema.parse(
        JSON.parse(renderDriverAssignment(validation)),
      ),
      cellInstructions: validation.cells.map((cell) => ({
        cellId: cell.cellId,
        executionKind: cell.execution.kind,
        action: cell.action,
        driverMode: driverModeFor(cell.execution.kind),
      })),
    },
    null,
    2,
  );

export function renderDriverPrompt(input: DriverPromptInput): string {
  const identity = DRIVER_IDENTITIES[input.role];
  return input.template
    .replaceAll("<ROLE>", input.role)
    .replaceAll("<EMAIL>", identity.email)
    .replaceAll("<LANDING>", identity.landing)
    .replaceAll("<CATALOG>", `e2e/catalog/${input.role}.yaml`)
    .replaceAll("<REPO_ROOT>", input.repoRoot)
    .replaceAll("<BASE_URL>", input.baseURL)
    .replaceAll("<SOURCE_SHA>", input.sourceSha)
    .replaceAll("<PROFILE>", input.profile)
    .replaceAll(
      "<ASSIGNED_CELLS>",
      renderShardAssignment(input.shard, input.validation),
    );
}
