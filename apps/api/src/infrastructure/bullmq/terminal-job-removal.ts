import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { Job, Queue, QueueBase } from "bullmq";
import { z } from "zod";

import type {
  TerminalJobPolicy,
  TerminalRemovalOutcome,
} from "../../modules/admin/index.js";

export interface ObservedTerminalJob {
  readonly getState: () => Promise<string>;
  readonly removeIfTerminal: (
    policy: TerminalJobPolicy,
  ) => Promise<TerminalRemovalOutcome>;
}

export interface TerminalJobRemoval {
  readonly getJob: (jobId: string) => Promise<ObservedTerminalJob | undefined>;
}

const require = createRequire(import.meta.url);
const { removeJob } = z
  .object({
    removeJob: z.object({
      name: z.string(),
      content: z.string(),
      keys: z.number().int(),
    }),
  })
  .parse(require("bullmq/dist/cjs/scripts/removeJob-2.js"));
const COMMAND_NAME = "weeklyreportRemoveTerminalJob";
const REVIEWED_BULLMQ_VERSION = "6.3.14";
const REVIEWED_NATIVE_CONTENT_SHA256 =
  "f2acb16fda20ccac200abd5289a8910e48870d454c1577b19bd375ab809bb4b6";

// Guard locals must not shadow the unmodified native script appended below.
const TERMINAL_GUARD = `
do
  local jobKey = KEYS[1]
  local prefix = ARGV[3]
  local policy = ARGV[4]
  if policy ~= "failed" and policy ~= "failed-or-completed" then
    return "invalid-policy"
  end
  if redis.call("EXISTS", jobKey) == 0 then
    return "missing"
  end
  local failed = redis.call("ZSCORE", prefix .. "failed", ARGV[1])
  local completed = policy == "failed-or-completed"
    and redis.call("ZSCORE", prefix .. "completed", ARGV[1])
  if not failed and not completed then
    return "state-changed"
  end
  local snapshot = redis.call("HMGET", jobKey, "name", "data", "timestamp", "finishedOn")
  if snapshot[1] ~= ARGV[5] or snapshot[2] ~= ARGV[6]
    or snapshot[3] ~= ARGV[7] or snapshot[4] ~= ARGV[8] then
    return "identity-changed"
  end
end
`;

function assertNativeRemovalContract(): void {
  const metadata: unknown = JSON.parse(
    readFileSync(require.resolve("bullmq/package.json"), "utf8"),
  );
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    !("version" in metadata) ||
    metadata.version !== REVIEWED_BULLMQ_VERSION ||
    removeJob.name !== "removeJob" ||
    removeJob.keys !== 2 ||
    createHash("sha256").update(removeJob.content).digest("hex") !==
      REVIEWED_NATIVE_CONTENT_SHA256
  ) {
    throw new Error(
      "BullMQ terminal-removal native contract changed; re-review required.",
    );
  }
}

export class BullmqTerminalJobRemoval implements TerminalJobRemoval {
  private readonly command: string;

  constructor(private readonly queue: Queue) {
    assertNativeRemovalContract();
    this.command = TERMINAL_GUARD + removeJob.content;
  }

  readonly getJob = async (
    jobId: string,
  ): Promise<ObservedTerminalJob | undefined> => {
    const job = await this.queue.getJob(jobId);
    return job ? this.capture(job) : undefined;
  };

  readonly capture = (job: Job): ObservedTerminalJob => {
    // shortcut: byte-identical recreation matches this snapshot; add a generation token if that producer is admitted.
    const snapshot = job.asJSON();
    const jobId = job.id;
    const namespace = job.queueQualifiedName;
    return {
      getState: () => job.getState(),
      removeIfTerminal: async (policy) => {
        if (
          namespace !== this.queue.qualifiedName ||
          typeof jobId !== "string" ||
          jobId.length === 0 ||
          typeof snapshot.name !== "string" ||
          snapshot.name.length === 0 ||
          typeof snapshot.data !== "string" ||
          !Number.isSafeInteger(snapshot.timestamp) ||
          snapshot.timestamp <= 0
        ) {
          throw new Error("Terminal job snapshot is missing or invalid.");
        }
        // The handle can be captured just before its job enters the terminal
        // set, so the observed snapshot may carry no finish stamp yet: the
        // terminal identity cannot be fenced, and removal must not be attempted.
        // Answer identity-changed before touching Redis (design.md, "Validate
        // captured id, terminal timestamp and serialized fields before invoking
        // Redis").
        if (
          typeof snapshot.finishedOn !== "number" ||
          !Number.isSafeInteger(snapshot.finishedOn) ||
          snapshot.finishedOn <= 0
        ) {
          return "identity-changed";
        }
        const backend = this.queue.getBackend();
        const client = await backend.client;
        client.defineCommand(COMMAND_NAME, {
          numberOfKeys: removeJob.keys,
          lua: this.command,
        });
        const result: unknown = await client.runCommand(COMMAND_NAME, [
          this.queue.toKey(jobId),
          this.queue.toKey("repeat"),
          jobId,
          1,
          this.queue.toKey(""),
          policy,
          snapshot.name,
          snapshot.data,
          String(snapshot.timestamp),
          String(snapshot.finishedOn),
        ]);
        if (result === 1) {
          // Job.remove emits the Job despite Queue's jobId-only event type.
          const eventQueue: QueueBase = this.queue;
          eventQueue.emit("removed", job);
          return "removed";
        }
        if (
          result === "missing" ||
          result === "state-changed" ||
          result === "identity-changed"
        ) {
          return result;
        }
        if (result === 0) {
          throw new Error(
            `Job ${jobId} could not be removed because it is locked by another worker`,
          );
        }
        if (typeof result === "number" && result < 0) {
          throw backend.finishedErrors({
            code: result,
            jobId,
            command: "removeJob",
          });
        }
        throw new Error("BullMQ terminal-removal returned an unknown result.");
      },
    };
  };
}
