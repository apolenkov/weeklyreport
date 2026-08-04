// In-memory stand-in for the subset of Redis commands rate-limit-redis v6
// issues through a store's sendCommand: SCRIPT LOAD, EVALSHA (its two Lua
// scripts), DECR, and DEL. Lets a unit test exercise a real RedisStore-backed
// limiter without a live Redis.
interface Bucket {
  count: number;
  resetAt: number;
}

interface FakeRedisState {
  buckets: Map<string, Bucket>;
  scripts: Map<string, string>;
  scriptCounter: number;
  errorListeners: ((error: unknown) => void)[];
}

export interface FakeRedisCall {
  readonly call: (...args: (string | number | Buffer)[]) => Promise<unknown>;
  readonly on: (
    event: string,
    listener: (error: unknown) => void,
  ) => FakeRedisCall;
  readonly emit: (event: string, error: unknown) => void;
}

// EVALSHA carries the Lua script's sha plus `1 <key> [windowMs]`. The
// increment script sets-or-increments a bucket; the get script only reads.
function runEvalSha(rest: string[], state: FakeRedisState): unknown {
  const sha = rest[0] ?? "";
  const key = rest[2] ?? "";
  const now = Date.now();
  const bucket = state.buckets.get(key);
  const isIncrement = state.scripts.get(sha)?.includes("INCR") ?? false;

  if (!isIncrement) {
    return bucket ? [bucket.count, bucket.resetAt - now] : [false, -1];
  }
  const windowMs = Number(rest[3]);
  if (!bucket || bucket.resetAt <= now) {
    state.buckets.set(key, { count: 1, resetAt: now + windowMs });
    return [1, windowMs];
  }
  bucket.count += 1;
  return [bucket.count, bucket.resetAt - now];
}

function runMutate(
  command: string,
  rest: string[],
  state: FakeRedisState,
): number {
  const key = rest[0] ?? "";
  const bucket = state.buckets.get(key);
  if (command === "DECR" && bucket) {
    bucket.count -= 1;
  } else if (command === "DEL") {
    state.buckets.delete(key);
  }
  return 0;
}

export function createFakeRedisCall(): FakeRedisCall {
  const state: FakeRedisState = {
    buckets: new Map(),
    scripts: new Map(),
    scriptCounter: 0,
    errorListeners: [],
  };

  const fake: FakeRedisCall = {
    call: (...args: (string | number | Buffer)[]): Promise<unknown> => {
      const [command, ...rest] = args.map((arg) => String(arg));
      if (command === "SCRIPT") {
        state.scriptCounter += 1;
        const sha = `fake-sha-${state.scriptCounter}`;
        state.scripts.set(sha, rest[1] ?? "");
        return Promise.resolve(sha);
      }
      if (command === "EVALSHA") {
        return Promise.resolve(runEvalSha(rest, state));
      }
      if (command === "DECR" || command === "DEL") {
        return Promise.resolve(runMutate(command, rest, state));
      }
      return Promise.reject(
        new Error(`Unsupported fake redis command: ${command ?? "unknown"}`),
      );
    },
    on: (event, listener) => {
      if (event === "error") state.errorListeners.push(listener);
      return fake;
    },
    emit: (event, error) => {
      if (event === "error") {
        state.errorListeners.slice().forEach((listener) => listener(error));
      }
    },
  };

  return fake;
}
