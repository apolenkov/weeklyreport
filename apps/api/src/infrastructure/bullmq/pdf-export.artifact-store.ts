import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { link, mkdir, open, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const PDF_TEMP_FILE_MODE = 0o600;

export interface PdfArtifactAttempt {
  tempPath: string;
  canonicalPath: string;
}

export interface PdfArtifactStore {
  createAttempt(
    outputDir: string,
    jobId: string,
    generation: number,
    pdfBuffer: Buffer,
  ): Promise<PdfArtifactAttempt>;
  publishAndHash(attempt: PdfArtifactAttempt): Promise<string>;
  cleanupAttempt(attempt: PdfArtifactAttempt): Promise<void>;
}

export function createDefaultPdfArtifactStore(): PdfArtifactStore {
  return {
    async createAttempt(outputDir, jobId, generation, pdfBuffer) {
      await mkdir(outputDir, { recursive: true });
      const tempPath = join(
        outputDir,
        `.${jobId}-g${generation}.${randomUUID()}.pdf.tmp`,
      );
      const canonicalPath = join(outputDir, `${jobId}-g${generation}.pdf`);
      const handle = await open(tempPath, "wx", PDF_TEMP_FILE_MODE);
      try {
        await handle.writeFile(pdfBuffer);
        await handle.sync();
        await handle.close();
        return { tempPath, canonicalPath };
      } catch (error) {
        await handle.close().catch(() => undefined);
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
      }
    },

    async publishAndHash(attempt) {
      try {
        await link(attempt.tempPath, attempt.canonicalPath);
      } catch (error) {
        if (!isFsError(error, "EEXIST")) {
          throw error;
        }
      }

      const checksum = await checksumCanonicalFile(attempt.canonicalPath);
      await syncDirectory(dirname(attempt.canonicalPath));
      return checksum;
    },

    async cleanupAttempt(attempt) {
      await rm(attempt.tempPath, { force: true });
    },
  };
}

async function checksumCanonicalFile(filePath: string): Promise<string> {
  const handle = await open(
    filePath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new Error(`PDF artifact is not a regular file: ${filePath}`);
    }
    const bytes = await handle.readFile();
    if (bytes.length === 0) {
      throw new Error(`PDF artifact is empty: ${filePath}`);
    }
    return createHash("sha256").update(bytes).digest("hex");
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directoryPath: string): Promise<void> {
  const handle = await open(directoryPath, fsConstants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function isFsError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
