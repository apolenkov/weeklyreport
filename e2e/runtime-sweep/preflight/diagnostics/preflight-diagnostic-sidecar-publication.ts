import { createHash } from "node:crypto";
import { link, mkdir, open, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import {
  DIAGNOSTIC_MAX_AGGREGATE_BYTES,
  DIAGNOSTIC_MAX_MANIFEST_BYTES,
  type DiagnosticSidecarManifest,
  diagnosticSidecarManifestSchema,
} from "./preflight-diagnostic-sidecar-contract.ts";

const MANIFEST_FIXED_POINT_ATTEMPTS = 3;
const PRIVATE_FILE_MODE = 0o600;

class DiagnosticSidecarPublicationError extends Error {
  override readonly name = "DiagnosticSidecarPublicationError";
}

const bytesFor = (text: string): number => Buffer.byteLength(text, "utf8");

const manifestTextFor = (manifest: DiagnosticSidecarManifest): string =>
  `${JSON.stringify(manifest)}\n`;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const digestDiagnosticSidecar = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const candidateFor = (
  manifest: Omit<DiagnosticSidecarManifest, "manifestBytes" | "aggregateBytes">,
  sidecarBytes: number,
  manifestBytes: number,
): DiagnosticSidecarManifest => ({
  ...manifest,
  manifestBytes,
  aggregateBytes: sidecarBytes + manifestBytes,
});

const stableManifestFor = (
  manifest: Omit<DiagnosticSidecarManifest, "manifestBytes" | "aggregateBytes">,
  sidecarBytes: number,
  manifestBytes: number,
  attemptsLeft: number,
): { readonly manifest: DiagnosticSidecarManifest; readonly text: string } => {
  const candidate = candidateFor(manifest, sidecarBytes, manifestBytes);
  const candidateText = manifestTextFor(candidate);
  const nextBytes = bytesFor(candidateText);
  const nextManifest = candidateFor(manifest, sidecarBytes, nextBytes);
  const text = manifestTextFor(nextManifest);
  if (bytesFor(text) === nextBytes) return { manifest: nextManifest, text };
  if (attemptsLeft <= 1)
    throw new DiagnosticSidecarPublicationError(
      "Diagnostic manifest byte accounting did not converge",
    );
  return stableManifestFor(
    manifest,
    sidecarBytes,
    bytesFor(text),
    attemptsLeft - 1,
  );
};

export const updateDiagnosticManifestBytes = (
  manifest: Omit<DiagnosticSidecarManifest, "manifestBytes" | "aggregateBytes">,
  sidecarBytes: number,
): { readonly manifest: DiagnosticSidecarManifest; readonly text: string } => {
  const { manifest: candidate, text } = stableManifestFor(
    manifest,
    sidecarBytes,
    0,
    MANIFEST_FIXED_POINT_ATTEMPTS,
  );
  const parsed = diagnosticSidecarManifestSchema.safeParse(candidate);
  if (!parsed.success)
    throw new DiagnosticSidecarPublicationError(
      `Diagnostic manifest is invalid: ${parsed.error.message}`,
    );
  const finalBytes = bytesFor(text);
  if (
    finalBytes !== parsed.data.manifestBytes ||
    parsed.data.aggregateBytes !== sidecarBytes + finalBytes
  )
    throw new DiagnosticSidecarPublicationError(
      "Diagnostic manifest byte accounting is not canonical",
    );
  if (finalBytes > DIAGNOSTIC_MAX_MANIFEST_BYTES)
    throw new DiagnosticSidecarPublicationError(
      "Diagnostic manifest exceeds byte bound",
    );
  if (parsed.data.aggregateBytes > DIAGNOSTIC_MAX_AGGREGATE_BYTES)
    throw new DiagnosticSidecarPublicationError(
      "Diagnostic sidecar aggregate exceeds byte bound",
    );
  return { manifest: parsed.data, text };
};

export async function publishDiagnosticManifest(input: {
  readonly outputRoot: string;
  readonly manifestPath: string;
  readonly text: string;
}): Promise<void> {
  const temporaryPath = path.join(
    input.outputRoot,
    `.manifest.json.${process.pid}.tmp`,
  );
  try {
    await mkdir(input.outputRoot, { recursive: true });
    const temporaryHandle = await open(temporaryPath, "wx", PRIVATE_FILE_MODE);
    try {
      await temporaryHandle.write(input.text, undefined, "utf8");
      await temporaryHandle.sync();
    } finally {
      await temporaryHandle.close();
    }
    await link(temporaryPath, input.manifestPath);
    await rm(temporaryPath, { force: true });
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true });
    throw new DiagnosticSidecarPublicationError(
      `Cannot publish diagnostic manifest: ${errorMessage(error)}`,
    );
  }
}

export async function readPublishedDiagnosticManifest(
  manifestPath: string,
): Promise<string> {
  return readFile(manifestPath, "utf8");
}
