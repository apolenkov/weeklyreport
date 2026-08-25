import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EvidencePhase } from "../../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { type EvidenceRef, evidenceRefSchema } from "../../source/contracts.ts";
import { makeArtifactId } from "../../support/ids.ts";

export interface FrozenCaseArtifactInput {
  readonly archiveRoot: string;
  readonly sourceSha: string;
  readonly profile: MatrixExecutableCase["profile"];
  readonly role: MatrixExecutableCase["role"];
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly cellId: string;
  readonly phase: EvidencePhase;
  readonly fileName: string;
  readonly kind: EvidenceRef["kind"];
  readonly dimension: EvidenceRef["dimension"];
  readonly capturedAt: string;
  readonly value: unknown;
}

const digest = (content: Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

const routeSlug = (route: string): string =>
  route.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "root";

const archivePathFor = (input: FrozenCaseArtifactInput): string => {
  const root = path.resolve(input.archiveRoot);
  const candidate = path.resolve(
    root,
    "routes",
    input.profile,
    input.role,
    routeSlug(input.catalogRoute),
    "cells",
    encodeURIComponent(input.cellId),
    input.phase,
    input.fileName,
  );
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`))
    throw new Error(`Frozen case artifact escaped archive: ${candidate}`);
  return candidate;
};

export async function writeFrozenCaseArtifact(
  input: FrozenCaseArtifactInput,
): Promise<EvidenceRef> {
  const archivePath = archivePathFor(input);
  const content = Buffer.from(
    `${JSON.stringify(input.value, null, 2)}\n`,
    "utf8",
  );
  const contentDigest = digest(content);
  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(archivePath, content, { flag: "wx" });
  return evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: input.cellId,
      sourceSha: input.sourceSha,
      archivePath,
      content: contentDigest,
    }),
    kind: input.kind,
    dimension: input.dimension,
    archivePath,
    digest: contentDigest,
    capturedAt: input.capturedAt,
    cellId: input.cellId,
    sourceSha: input.sourceSha,
    profile: input.profile,
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
}
