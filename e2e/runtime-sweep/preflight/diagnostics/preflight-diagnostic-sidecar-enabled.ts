import { open, readFile } from "node:fs/promises";
import * as path from "node:path";

import { sourceShaSchema, sourceTreeSchema } from "../../source/contracts.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveDirectory,
  ensurePreflightArchiveRoot,
} from "../preflight-archive-path.ts";
import { assertDiagnosticSidecarManifestAccounting } from "./preflight-diagnostic-sidecar-accounting.ts";
import {
  assertDiagnosticOutputPath,
  diagnosticProcessIdentityFor,
  type DiagnosticProcessRole,
  type DiagnosticSidecarManifest,
  parseDiagnosticSample,
  parseDiagnosticSidecarManifest,
  serializeDiagnosticSample,
} from "./preflight-diagnostic-sidecar-contract.ts";
import { diagnosticManifestBaseFor } from "./preflight-diagnostic-sidecar-manifest.ts";
import {
  digestDiagnosticSidecar,
  publishDiagnosticManifest,
  readPublishedDiagnosticManifest,
  updateDiagnosticManifestBytes,
} from "./preflight-diagnostic-sidecar-publication.ts";
import {
  assertDiagnosticRecordBounds,
  recordDiagnosticRecord,
} from "./preflight-diagnostic-sidecar-records.ts";
import {
  type DiagnosticSidecar,
  type DiagnosticSidecarInput,
  DiagnosticSidecarIOError,
} from "./preflight-diagnostic-sidecar-types.ts";

const SIDECAR_FILE_NAME = "samples.jsonl";
const MANIFEST_FILE_NAME = "manifest.json";
const PRIVATE_FILE_MODE = 0o600;

const campaignIdFor = (value: string): string => {
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/u.test(value))
    throw new DiagnosticSidecarIOError(
      "Diagnostic campaignId must be a lowercase stable identifier",
    );
  return value;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class EnabledDiagnosticSidecar implements DiagnosticSidecar {
  private readonly sidecarPath: string;
  private readonly manifestPath: string;
  private readonly sourceSha: string;
  private readonly sourceTree: string;
  private readonly campaignId: string;
  private readonly now: () => Date;
  private readonly processSampleCounts = new Map<
    DiagnosticProcessRole,
    number
  >();
  private readonly processIdentitySampleCounts = new Map<string, number>();
  private readonly trackedProcessIdentities = new Set<string>();
  private readonly processIdentityMetadata = new Map<
    string,
    Readonly<{
      readonly parentPid: number | null;
      readonly ownerRootPid: number;
    }>
  >();
  private readonly startedAt: string;
  private fileHandle: Awaited<ReturnType<typeof open>> | undefined;
  private sidecarBytes = 0;
  private sampleCount = 0;
  private eventCount = 0;
  private readonly observedProcessRoles = new Set<DiagnosticProcessRole>();
  private failed: Error | undefined;
  private closed = false;
  private queue: Promise<void> = Promise.resolve();

  public constructor(private readonly input: DiagnosticSidecarInput) {
    this.sidecarPath = path.join(input.outputRoot, SIDECAR_FILE_NAME);
    this.manifestPath = path.join(input.outputRoot, MANIFEST_FILE_NAME);
    this.sourceSha = sourceShaSchema.parse(input.sourceSha);
    this.sourceTree = sourceTreeSchema.parse(input.sourceTree);
    this.campaignId = campaignIdFor(input.campaignId);
    assertDiagnosticOutputPath(input);
    this.now = input.now;
    this.startedAt = this.now().toISOString();
  }

  public record(sample: unknown): Promise<void> {
    const next = this.queue.then(() => this.writeSample(sample));
    this.queue = next.catch((error: unknown) => {
      this.failed =
        error instanceof Error
          ? error
          : new DiagnosticSidecarIOError(String(error));
    });
    return next;
  }

  public async closeWithoutManifest(): Promise<void> {
    await this.queue;
    this.closed = true;
    await this.closeFile();
  }

  public async finalize(): Promise<DiagnosticSidecarManifest> {
    await this.queue;
    if (this.failed !== undefined) {
      this.closed = true;
      await this.closeFile();
      throw this.failed;
    }
    if (this.closed)
      throw new DiagnosticSidecarIOError("Diagnostic sidecar is closed");
    this.closed = true;
    await this.closeFile();
    await assertPreflightRegularFile(this.sidecarPath);
    const sidecarData = await readFile(this.sidecarPath);
    if (sidecarData.byteLength !== this.sidecarBytes)
      throw new DiagnosticSidecarIOError(
        "Diagnostic sidecar size changed before publication",
      );
    const baseManifest = diagnosticManifestBaseFor({
      campaignId: this.campaignId,
      sourceSha: this.sourceSha,
      sourceTree: this.sourceTree,
      sampleCount: this.sampleCount,
      eventCount: this.eventCount,
      processCaptureStatus: {
        "playwright-child": this.observedProcessRoles.has("playwright-child")
          ? "CAPTURED"
          : "NOT_CAPTURED",
        browser: this.observedProcessRoles.has("browser")
          ? "CAPTURED"
          : "NOT_CAPTURED",
        renderer: "NOT_CAPTURED",
      },
      processSampleCounts: this.processSampleCounts,
      processIdentitySampleCounts: this.processIdentitySampleCounts,
      sidecarBytes: this.sidecarBytes,
      sidecarDigest: digestDiagnosticSidecar(sidecarData),
      sidecarPath: this.sidecarPath,
      manifestPath: this.manifestPath,
      startedAt: this.startedAt,
      completedAt: this.now().toISOString(),
    });
    const { text } = updateDiagnosticManifestBytes(
      baseManifest,
      this.sidecarBytes,
    );
    await publishDiagnosticManifest({
      outputRoot: this.input.outputRoot,
      manifestPath: this.manifestPath,
      text,
    });
    await assertPreflightRegularFile(this.manifestPath);
    const persisted = await readPublishedDiagnosticManifest(this.manifestPath);
    if (persisted !== text)
      throw new DiagnosticSidecarIOError(
        "Diagnostic manifest changed while it was being published",
      );
    const persistedManifest = parseDiagnosticSidecarManifest(
      JSON.parse(persisted) as unknown,
    );
    const persistedSidecarData = await readFile(this.sidecarPath);
    if (persistedSidecarData.byteLength !== this.sidecarBytes)
      throw new DiagnosticSidecarIOError(
        "Diagnostic sidecar changed after manifest publication",
      );
    assertDiagnosticSidecarManifestAccounting({
      manifest: persistedManifest,
      sidecarText: persistedSidecarData.toString("utf8"),
    });
    return persistedManifest;
  }

  private async initialize(): Promise<void> {
    if (this.fileHandle !== undefined) return;
    try {
      const archiveRoot = await ensurePreflightArchiveRoot(
        this.input.archiveRoot,
      );
      await ensurePreflightArchiveDirectory(archiveRoot, this.input.outputRoot);
      await assertPreflightArchivePath(archiveRoot, this.sidecarPath);
      await assertPreflightArchivePath(archiveRoot, this.manifestPath);
      this.fileHandle = await open(this.sidecarPath, "wx", PRIVATE_FILE_MODE);
    } catch (error: unknown) {
      throw new DiagnosticSidecarIOError(
        `Cannot initialize diagnostic sidecar: ${errorMessage(error)}`,
      );
    }
  }

  private async closeFile(): Promise<void> {
    if (this.fileHandle === undefined) return;
    const handle = this.fileHandle;
    this.fileHandle = undefined;
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  private async writeSample(inputSample: unknown): Promise<void> {
    if (this.closed)
      throw new DiagnosticSidecarIOError("Diagnostic sidecar is closed");
    if (this.failed !== undefined) throw this.failed;
    const sample = parseDiagnosticSample(inputSample);
    await this.initialize();
    if (this.fileHandle === undefined)
      throw new DiagnosticSidecarIOError("Diagnostic sidecar is not open");
    const text = serializeDiagnosticSample(sample);
    const bytes = Buffer.byteLength(text, "utf8");
    const identity = diagnosticProcessIdentityFor(sample);
    assertDiagnosticRecordBounds({
      sample,
      identity,
      bytes,
      sidecarBytes: this.sidecarBytes,
      eventCount: this.eventCount,
      trackedProcessIdentities: this.trackedProcessIdentities,
      processIdentitySampleCounts: this.processIdentitySampleCounts,
      processIdentityMetadata: this.processIdentityMetadata,
    });
    try {
      await this.fileHandle.write(text, undefined, "utf8");
    } catch (error: unknown) {
      throw new DiagnosticSidecarIOError(
        `Cannot append diagnostic sample: ${errorMessage(error)}`,
      );
    }
    this.sidecarBytes += bytes;
    this.trackedProcessIdentities.add(identity);
    this.processIdentityMetadata.set(identity, {
      parentPid: sample.parentPid,
      ownerRootPid: sample.ownerRootPid,
    });
    if (sample.recordKind === "sample")
      this.observedProcessRoles.add(sample.processRole);
    const counts = recordDiagnosticRecord({
      sample,
      identity,
      processSampleCounts: this.processSampleCounts,
      processIdentitySampleCounts: this.processIdentitySampleCounts,
      sampleCount: this.sampleCount,
      eventCount: this.eventCount,
    });
    this.sampleCount = counts.sampleCount;
    this.eventCount = counts.eventCount;
  }
}
