import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  isSafeReticleSegment,
  validateMappedFlow,
} from "./reticle-flow-validation.ts";
import type {
  DeterministicProof,
  ReticleSpecCoverageEntry,
  ReticleSpecCoverageRegistry,
} from "./reticle-spec-coverage-types.ts";

export function validateConfiguredProjectId(
  registry: ReticleSpecCoverageRegistry,
  projectId: string,
): void {
  if (!isSafeReticleSegment(projectId)) {
    throw new Error("invalid configured Reticle projectId");
  }
  if (registry.projectId !== projectId) {
    throw new Error("registry projectId mismatch");
  }
}

async function assertRepositoryFile(
  reference: string,
  label: string,
): Promise<void> {
  const repositoryRoot = resolve(process.cwd());
  const referencePath = resolve(repositoryRoot, reference);
  const relativeReference = relative(repositoryRoot, referencePath);
  if (
    relativeReference === "" ||
    relativeReference === ".." ||
    relativeReference.startsWith(`..${sep}`) ||
    isAbsolute(relativeReference)
  ) {
    throw new Error(`unresolvable ${label}: ${reference}`);
  }
  try {
    if (!(await stat(referencePath)).isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`unresolvable ${label}: ${reference}`);
  }
}

export async function validateDeterministicReference(
  proof: DeterministicProof,
): Promise<void> {
  await assertRepositoryFile(proof.reference, "deterministic reference");
}

export async function validateExclusionDecisionReference(
  reference: string,
): Promise<void> {
  await assertRepositoryFile(reference, "exclusion decision reference");
}

export async function validateEntryCoverage(
  entry: ReticleSpecCoverageEntry,
  flowsRoot: string,
  projectId: string,
  flows: Set<string>,
): Promise<{
  readonly hasReticle: boolean;
  readonly hasDeterministic: boolean;
  readonly proofCount: number;
}> {
  if (entry.coverage.kind !== "classified")
    throw new Error("unclassified outcome");
  let hasReticle = false;
  let hasDeterministic = false;
  for (const proof of entry.coverage.proofs) {
    if (proof.kind === "reticle") {
      await validateMappedFlow(flowsRoot, proof, projectId);
      flows.add(proof.flow);
      hasReticle = true;
    } else {
      await validateDeterministicReference(proof);
      hasDeterministic = true;
    }
  }
  return {
    hasReticle,
    hasDeterministic,
    proofCount: entry.coverage.proofs.length,
  };
}
