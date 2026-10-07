import { join } from "node:path";

import { add, type Ctx } from "./logs.ts";

function recordCommand(
  ctx: Ctx,
  stage: "start" | "stop",
  command: readonly string[],
): boolean {
  try {
    const [result] = ctx.browser.batch([command]);
    if (!result?.ok) throw new Error(result?.error ?? "no recording result");
    return true;
  } catch (error: unknown) {
    add(
      ctx,
      { page: "video", shot: null },
      {
        severity: "medium",
        kind: "recording-failed",
        detail: `record ${stage}: ${error instanceof Error ? error.message : "recording failed"}`,
      },
    );
    return false;
  }
}

/** Returns a completion operation; only a successfully started and stopped recording has a path. */
export function beginRecording(
  ctx: Ctx,
  filename: string,
): () => string | null {
  if (!ctx.config.video) return () => null;
  const started = recordCommand(ctx, "start", [
    "record",
    "start",
    join(ctx.config.out, filename),
  ]);
  return () =>
    started && recordCommand(ctx, "stop", ["record", "stop"]) ? filename : null;
}
