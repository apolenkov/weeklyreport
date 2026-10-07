import { VISIT_ATTEMPTS } from "./constants.ts";
import type { Ctx } from "./logs.ts";

function summary(error: unknown): string {
  return error instanceof Error
    ? (error.message.split("\n")[0] ?? "failed")
    : "failed";
}

/** Retries page ownership without mixing findings from abandoned attempts into a successful result. */
export function retryPage<T>(
  ctx: Ctx,
  visit: () => T,
): Readonly<{ ok: true; value: T } | { ok: false; detail: string }> {
  const mark = ctx.findings.length;
  const failures: string[] = [];
  for (let attempt = 1; attempt <= VISIT_ATTEMPTS; attempt++) {
    try {
      return { ok: true, value: visit() };
    } catch (error: unknown) {
      ctx.findings.length = mark;
      let detail = `page attempt ${attempt}: ${summary(error)}`;
      try {
        ctx.signIn();
      } catch (error_: unknown) {
        detail += `; sign-in: ${summary(error_)}`;
      }
      failures.push(detail);
    }
  }
  return { ok: false, detail: failures.join("; ") };
}
