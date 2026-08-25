import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { RevealContinuationError } from "../preflight-reveal-continuation-errors.ts";

type BoundedReadHandle = Readonly<{
  read: (
    buffer: Buffer,
    offset: number,
    length: number,
    position: null,
  ) => Promise<Readonly<{ readonly bytesRead: number }>>;
}>;

export const readBoundedBytes = async (input: {
  readonly handle: BoundedReadHandle;
  readonly maxBytes: number;
  readonly sizeError: string;
}): Promise<Buffer> => {
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 0)
    throw new RevealContinuationError("R188 byte bound is invalid");
  const buffer = Buffer.allocUnsafe(input.maxBytes + 1);
  const readFromOffset = async (offset: number): Promise<Buffer> => {
    if (offset === buffer.byteLength)
      throw new RevealContinuationError(input.sizeError);
    const remaining = buffer.byteLength - offset;
    const { bytesRead } = await input.handle.read(
      buffer,
      offset,
      remaining,
      null,
    );
    if (bytesRead === 0) return buffer.subarray(0, offset);
    if (bytesRead < 0 || bytesRead > remaining)
      throw new RevealContinuationError("R188 bounded reader contract drifted");
    return readFromOffset(offset + bytesRead);
  };
  return readFromOffset(0);
};

export const readBoundedRegularFile = async (input: {
  readonly filePath: string;
  readonly maxBytes: number;
  readonly regularFileError: string;
  readonly sizeError: string;
}): Promise<Buffer> => {
  const handle = await open(
    input.filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  ).catch((error: unknown) => {
    const isSymlink =
      error instanceof Error && "code" in error && error.code === "ELOOP";
    if (isSymlink) throw new RevealContinuationError(input.regularFileError);
    throw error;
  });
  try {
    const stats = await handle.stat();
    if (!stats.isFile())
      throw new RevealContinuationError(input.regularFileError);
    if (stats.size > input.maxBytes)
      throw new RevealContinuationError(input.sizeError);
    return await readBoundedBytes({
      handle,
      maxBytes: input.maxBytes,
      sizeError: input.sizeError,
    });
  } finally {
    await handle.close();
  }
};
