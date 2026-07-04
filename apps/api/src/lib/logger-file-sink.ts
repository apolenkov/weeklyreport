import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

/**
 * File sink for the app logger (extracted from logger.ts): size-based rotation
 * into gzip archives, age-based archive pruning, and a per-sink serialized
 * write queue so concurrent emit() calls never interleave appendFile with a
 * rotation. Fire-and-forget at the call site is preserved by chaining onto the
 * shared queue promise.
 */

// Prune stale archives at most once per interval instead of on every log line —
// a readdir+stat per emit dominated the file sink on a busy process.
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const ACTIVE_LOG_FILENAME = "app.log";
const ARCHIVE_PREFIX = "app.log.";
const ARCHIVE_SUFFIX = ".gz";

export interface ResolvedFileOpts {
  maxBytes: number;
  maxAgeDays: number;
}

export interface FileSink {
  logDir: string;
  opts: ResolvedFileOpts;
  queue: Promise<void>;
  // Epoch ms of the last archive prune; gates prune to once per interval so it
  // does not run on every emitted line. 0 = never pruned (prune on first write).
  lastPruneAt: number;
}

/** A fresh sink whose queue is an already-resolved promise (no async work). */
export function createFileSink(
  logDir: string,
  opts: ResolvedFileOpts,
): FileSink {
  return { logDir, opts, queue: Promise.resolve(), lastPruneAt: 0 };
}

/** Prune stale archives at most once per {@link PRUNE_INTERVAL_MS}. */
async function maybePruneArchives(sink: FileSink): Promise<void> {
  const now = Date.now();
  if (now - sink.lastPruneAt < PRUNE_INTERVAL_MS) return;
  sink.lastPruneAt = now;
  await pruneOldArchives(sink.logDir, sink.opts.maxAgeDays);
}

async function pruneOldArchives(
  logDir: string,
  maxAgeDays: number,
): Promise<void> {
  if (maxAgeDays < 0) return;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
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

async function rotateIfNeeded(
  sink: FileSink,
  activePath: string,
): Promise<void> {
  const stats = await fs.stat(activePath).catch(() => null);
  if (!stats) return;
  if (stats.size < sink.opts.maxBytes) {
    // Not rotating: prune only once per interval so a long-lived process still
    // drops old files without a readdir+stat on every emitted line.
    await maybePruneArchives(sink);
    return;
  }

  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const archivePath = join(
    sink.logDir,
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

  // A rotation just created a new archive — prune immediately regardless of the
  // interval gate.
  sink.lastPruneAt = Date.now();
  await pruneOldArchives(sink.logDir, sink.opts.maxAgeDays);
}

export function enqueueWrite(
  sink: FileSink,
  entry: Record<string, unknown>,
): void {
  const activePath = join(sink.logDir, ACTIVE_LOG_FILENAME);
  sink.queue = sink.queue
    .then(() => rotateIfNeeded(sink, activePath))
    .then(() => fs.appendFile(activePath, `${JSON.stringify(entry)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`[logger] file write failed: ${String(error)}\n`);
    });
}
