import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import { assertPreflightArchivePath } from "../../preflight-archive-path.ts";
import {
  PREFLIGHT_REVEAL_BOOTSTRAP,
  PREFLIGHT_REVEAL_EXECUTION_GRANT,
  PREFLIGHT_REVEAL_PARENT_PASS,
  PREFLIGHT_REVEAL_RECEIPT_CHUNK,
  type RevealBootstrap,
  type RevealReceiptChunk,
} from "./contracts/preflight-reveal-continuation-schemas.ts";
import { readBoundedRegularFile } from "./io/preflight-reveal-continuation-bounded-file.ts";
import {
  parseRevealBootstrap,
  parseRevealReceiptChunk,
} from "./preflight-reveal-continuation-artifacts.ts";
import { MAX_ASSET_BYTES } from "./preflight-reveal-continuation-assets.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";

const missingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const assertArtifactPath = (archiveRoot: string, filePath: string): void => {
  const root = path.resolve(archiveRoot);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new RevealContinuationError(
      "R188 artifact path escapes the archive root",
    );
};

type RevealContinuationChildArtifact =
  | Readonly<{
      readonly kind: "BOOTSTRAP";
      readonly bootstrap: RevealBootstrap;
    }>
  | Readonly<{ readonly kind: "CHUNK"; readonly chunk: RevealReceiptChunk }>;

const artifactTagFor = (value: unknown): unknown =>
  typeof value === "object" && value !== null && "artifact" in value
    ? value.artifact
    : undefined;

const childArtifactFor = (input: {
  readonly value: unknown;
  readonly text: string;
}): RevealContinuationChildArtifact => {
  const artifact = artifactTagFor(input.value);
  if (artifact === PREFLIGHT_REVEAL_BOOTSTRAP) {
    const bootstrap = parseRevealBootstrap(input.value);
    if (stableSerialize(bootstrap) !== input.text.slice(0, -1))
      throw new RevealContinuationError(
        "R188 child bootstrap bytes are not canonical",
      );
    return { kind: "BOOTSTRAP", bootstrap };
  }
  if (artifact === PREFLIGHT_REVEAL_RECEIPT_CHUNK) {
    const chunk = parseRevealReceiptChunk(input.value);
    if (stableSerialize(chunk) !== input.text.slice(0, -1))
      throw new RevealContinuationError(
        "R188 child chunk bytes are not canonical",
      );
    return { kind: "CHUNK", chunk };
  }
  if (artifact === PREFLIGHT_REVEAL_PARENT_PASS)
    throw new RevealContinuationError("R188 child cannot author parent PASS");
  if (artifact === PREFLIGHT_REVEAL_EXECUTION_GRANT)
    throw new RevealContinuationError(
      "R188 child output cannot be an execution grant",
    );
  throw new RevealContinuationError("Unknown R188 child output artifact");
};

export async function readRevealContinuationArtifact(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<RevealContinuationChildArtifact | undefined> {
  const root = path.resolve(input.archiveRoot);
  const filePath = path.resolve(input.filePath);
  assertArtifactPath(root, filePath);
  await assertPreflightArchivePath(root, filePath);
  try {
    const buffer = await readBoundedRegularFile({
      filePath,
      maxBytes: MAX_ASSET_BYTES,
      regularFileError: "R188 artifact must be a regular non-symlink file",
      sizeError: "R188 artifact exceeds the byte bound",
    });
    const text = buffer.toString("utf8");
    if (!text.endsWith("\n"))
      throw new RevealContinuationError(
        "R188 child output bytes are not canonical",
      );
    const value: unknown = JSON.parse(text);
    return childArtifactFor({ value, text });
  } catch (error: unknown) {
    if (missingFile(error)) return undefined;
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `Cannot read R188 child output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
