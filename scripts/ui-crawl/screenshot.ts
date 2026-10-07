import { join } from "node:path";

import { add, type Ctx } from "./logs.ts";

/** A screenshot path is evidence only after its external capture command succeeds. */
export function captureScreenshot(
  ctx: Ctx,
  target: Readonly<{ page: string; filename: string; full?: boolean }>,
): string | null {
  try {
    const command = [
      "screenshot",
      ...(target.full ? ["--full"] : []),
      join(ctx.dir, target.filename),
    ];
    const [result] = ctx.browser.batch([command]);
    if (!result?.ok) throw new Error(result?.error ?? "no screenshot result");
    return target.filename;
  } catch (error: unknown) {
    add(
      ctx,
      { page: target.page, shot: null },
      {
        severity: "medium",
        kind: "screenshot-failed",
        detail: `${target.filename}: ${error instanceof Error ? error.message : "capture failed"}`,
      },
    );
    return null;
  }
}
