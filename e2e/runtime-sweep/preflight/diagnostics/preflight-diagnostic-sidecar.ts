import { EnabledDiagnosticSidecar } from "./preflight-diagnostic-sidecar-enabled.ts";
import {
  type DiagnosticSidecar,
  type DiagnosticSidecarInput,
  DiagnosticSidecarIOError,
} from "./preflight-diagnostic-sidecar-types.ts";

export { assertDiagnosticCampaignBinding } from "./preflight-diagnostic-sidecar-contract.ts";
export { DiagnosticSidecarIOError } from "./preflight-diagnostic-sidecar-types.ts";

const MAX_SECONDARY_ERROR_CHARS = 512;

const bounded = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : value.slice(0, MAX_SECONDARY_ERROR_CHARS);

export function selectDiagnosticPrimaryError(
  original: Error | undefined,
  secondary: Error,
): Error {
  if (original === undefined) return secondary;
  if ("cause" in original || !Object.isExtensible(original)) return original;
  try {
    Object.defineProperty(original, "cause", {
      configurable: true,
      enumerable: false,
      value: {
        name: bounded(secondary.name) ?? "Error",
        message:
          bounded(secondary.message) ?? "Unknown diagnostic sidecar failure",
        stack: bounded(secondary.stack),
      },
      writable: false,
    });
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) throw error;
  }
  return original;
}

export function diagnosticFailureFor(
  original: Error | undefined,
  secondary: Error | undefined,
): Error | undefined {
  if (original === undefined) return secondary;
  if (secondary === undefined) return original;
  return selectDiagnosticPrimaryError(original, secondary);
}

export type { DiagnosticSidecar } from "./preflight-diagnostic-sidecar-types.ts";

export function createDiagnosticSidecar(input: {
  readonly enabled: boolean;
  readonly archiveRoot: string;
  readonly outputRoot: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly now?: () => Date;
}): DiagnosticSidecar {
  if (!input.enabled)
    return {
      record: () => Promise.resolve(),
      finalize: () => Promise.resolve(undefined),
      closeWithoutManifest: () => Promise.resolve(),
    };
  const sidecarInput: DiagnosticSidecarInput = {
    archiveRoot: input.archiveRoot,
    outputRoot: input.outputRoot,
    sourceSha: input.sourceSha,
    sourceTree: input.sourceTree,
    campaignId: input.campaignId,
    now: input.now ?? (() => new Date()),
  };
  try {
    return new EnabledDiagnosticSidecar(sidecarInput);
  } catch (error: unknown) {
    throw error instanceof Error
      ? error
      : new DiagnosticSidecarIOError(String(error));
  }
}
