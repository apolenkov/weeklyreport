import type { DiagnosticSidecarManifest } from "./preflight-diagnostic-sidecar-contract.ts";

export class DiagnosticSidecarIOError extends Error {
  override readonly name = "DiagnosticSidecarIOError";
}

export type DiagnosticSidecar = Readonly<{
  record(sample: unknown): Promise<void>;
  finalize(): Promise<DiagnosticSidecarManifest | undefined>;
  closeWithoutManifest(): Promise<void>;
}>;

export type DiagnosticSidecarInput = Readonly<{
  readonly archiveRoot: string;
  readonly outputRoot: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly now: () => Date;
}>;
