import { rm } from "node:fs/promises";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { sha256Hex } from "../../support/ids.ts";
import type {
  PreflightShard,
  PreflightShardAssignment,
} from "./preflight-shard-assignment.ts";

export const withSource = async <T>(
  callback: (
    source: Awaited<ReturnType<typeof buildCampaignSource>>,
  ) => Promise<T> | T,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(fixture.input, fakeManifestGit()),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

export const shardWithDigest = (shard: PreflightShard): PreflightShard => {
  const { shardDigest: _shardDigest, ...body } = shard;
  return { ...body, shardDigest: sha256Hex(body) };
};

export const assignmentWithDigest = (
  assignment: PreflightShardAssignment,
  mutate: (candidate: PreflightShardAssignment) => PreflightShardAssignment,
): PreflightShardAssignment => {
  const candidate = mutate(assignment);
  const shards = candidate.shards.map(shardWithDigest);
  const { assignmentDigest: _assignmentDigest, ...body } = {
    ...candidate,
    shards,
  };
  return { ...body, assignmentDigest: sha256Hex(body) };
};

export const firstShardWithAtLeastTwoStates = (
  assignment: PreflightShardAssignment,
): PreflightShard => {
  const shard = assignment.shards.find(({ states }) => states.length >= 2);
  if (shard === undefined) throw new Error("fixture has no multi-state shard");
  return shard;
};
