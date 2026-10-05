import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";

import { MS_PER_SECOND, SECONDS_PER_MINUTE } from "./constants.ts";

/** The stand allows 200 tRPC requests a minute per IP and 5 sign-ins; roles share one budget through a file. */
const WINDOW_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const POLL_MS = 200;
const LOCK_POLL_MS = 20;
const STALE_LOCK_MS = 5000;

type Ledger = Readonly<{ file: string; cap: number }>;

const ledgers = new Map<string, Ledger>();

export function configureRate(name: string, file: string, cap: number): void {
  ledgers.set(name, { file, cap });
}

function sleep(ms: number): void {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    ms,
  );
}

function entries(file: string): readonly (readonly [number, number])[] {
  try {
    return readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.split(" ").map(Number))
      .flatMap(([at, n]) =>
        at !== undefined && n !== undefined ? [[at, n] as const] : [],
      );
  } catch {
    // no ledger yet: nothing used
    return [];
  }
}

function used(file: string, now: number): number {
  return entries(file)
    .filter(([at]) => now - at < WINDOW_MS)
    .reduce((total, [, n]) => total + n, 0);
}

/** A crashed holder never releases its lock: take it over after a few seconds. */
function dropStaleLock(lock: string): void {
  try {
    if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS)
      rmSync(lock, { recursive: true, force: true });
  } catch {
    // released meanwhile
  }
}

/** Runs `action` under a lock directory; whoever holds it has the ledger to itself. */
function locked<T>(file: string, action: () => T): T {
  const lock = `${file}.lock`;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      dropStaleLock(lock);
      sleep(LOCK_POLL_MS);
    }
  }
  try {
    return action();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** Reserves `cost` requests, waiting until they fit into the last minute; returns the reservation time. */
export function pace(name: string, cost: number): number {
  const ledger = ledgers.get(name);
  if (!ledger) return 0;
  for (;;) {
    const at = locked(ledger.file, () => {
      const now = Date.now();
      if (used(ledger.file, now) + cost > ledger.cap) return null;
      appendFileSync(ledger.file, `${now} ${cost}\n`);
      return now;
    });
    if (at !== null) return at;
    sleep(POLL_MS);
  }
}

/** Corrects a reservation made at `at` once the real request count is known. */
export function settleRate(
  name: string,
  at: number,
  reserved: number,
  actual: number,
): void {
  const ledger = ledgers.get(name);
  if (ledger && actual !== reserved)
    locked(ledger.file, () => {
      appendFileSync(ledger.file, `${at} ${actual - reserved}\n`);
    });
}
