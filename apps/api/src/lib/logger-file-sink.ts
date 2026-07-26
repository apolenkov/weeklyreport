import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import { MS_PER_DAY, MS_PER_HOUR } from "@customreport/shared";

// Prune at most once per interval — readdir+stat per emit dominated the sink.
const PRUNE_INTERVAL_MS = MS_PER_HOUR;
const ACTIVE_LOG_FILENAME = "app.log";
const ARCHIVE_PREFIX = "app.log.";
const ARCHIVE_SUFFIX = ".gz";

export interface ResolvedFileOpts {
  maxBytes: number;
  maxAgeDays: number;
}

// Opaque handle. The write chain and the prune clock stay inside the closure
// createFileSink builds, so a caller can neither read nor corrupt them.
export interface FileSink {
  readonly enqueue: (entry: Record<string, unknown>) => void;
}

async function pruneOldArchives(
  logDir: string,
  maxAgeDays: number,
): Promise<void> {
  if (maxAgeDays < 0) return;
  const cutoff = Date.now() - maxAgeDays * MS_PER_DAY;
  const entries = await fs.readdir(logDir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((f) => f.startsWith(ARCHIVE_PREFIX) && f.endsWith(ARCHIVE_SUFFIX))
      .map(async (f) => {
        const p = join(logDir, f);
        const st = await fs.stat(p).catch(() => null);
        if (!st) return;
        if (st.mtimeMs <= cutoff) {
          await fs.unlink(p).catch(() => undefined);
        }
      }),
  );
}

// Returns the prune clock to carry forward: the given `lastPruneAt` while the
// interval gate holds, otherwise the moment of the prune it just ran.
async function maybePruneArchives(
  logDir: string,
  maxAgeDays: number,
  lastPruneAt: number,
): Promise<number> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return lastPruneAt;
  await pruneOldArchives(logDir, maxAgeDays);
  return now;
}

async function archiveActiveLog(
  logDir: string,
  activePath: string,
): Promise<void> {
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const archivePath = join(
    logDir,
    `${ARCHIVE_PREFIX}${stamp}${ARCHIVE_SUFFIX}`,
  );
  await pipeline(
    createReadStream(activePath),
    createGzip(),
    createWriteStream(archivePath),
  );
  // truncate keeps the inode/handle valid for any open writers and is faster
  // than unlink + recreate.
  await fs.truncate(activePath, 0);
}

async function rotateIfNeeded(
  logDir: string,
  opts: ResolvedFileOpts,
  activePath: string,
  lastPruneAt: number,
): Promise<number> {
  const stats = await fs.stat(activePath).catch(() => null);
  if (!stats) return lastPruneAt;
  if (stats.size < opts.maxBytes) {
    return maybePruneArchives(logDir, opts.maxAgeDays, lastPruneAt);
  }

  await archiveActiveLog(logDir, activePath);
  // A rotation just created a new archive — prune immediately, gate or not.
  const prunedAt = Date.now();
  await pruneOldArchives(logDir, opts.maxAgeDays);
  return prunedAt;
}

export function createFileSink(
  logDir: string,
  opts: ResolvedFileOpts,
): FileSink {
  const activePath = join(logDir, ACTIVE_LOG_FILENAME);
  // The sink's whole mutable state: writes serialize on `queue`, and
  // `lastPruneAt` (0 = never pruned) carries the prune clock between writes.
  const state = { queue: Promise.resolve(), lastPruneAt: 0 };
  return {
    enqueue: (entry) => {
      state.queue = state.queue
        .then(async () => {
          state.lastPruneAt = await rotateIfNeeded(
            logDir,
            opts,
            activePath,
            state.lastPruneAt,
          );
        })
        .then(() => fs.appendFile(activePath, `${JSON.stringify(entry)}\n`))
        .catch((error: unknown) => {
          process.stderr.write(
            `[logger] file write failed: ${String(error)}\n`,
          );
        });
    },
  };
}

// Free-function façade over the sink closure that owns the write state, so
// logger.ts calls a plain function rather than reaching for the method.
export function enqueueWrite(
  sink: FileSink,
  entry: Record<string, unknown>,
): void {
  sink.enqueue(entry);
}
