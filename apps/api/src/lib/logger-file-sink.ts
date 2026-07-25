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

export interface FileSink {
  logDir: string;
  opts: ResolvedFileOpts;
  queue: Promise<void>;
  // Epoch ms of the last archive prune; gates prune to once per interval so it
  // does not run on every emitted line. 0 = never pruned (prune on first write).
  lastPruneAt: number;
}

export function createFileSink(
  logDir: string,
  opts: ResolvedFileOpts,
): FileSink {
  return { logDir, opts, queue: Promise.resolve(), lastPruneAt: 0 };
}

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
