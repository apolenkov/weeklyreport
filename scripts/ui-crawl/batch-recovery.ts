import { type BatchOutcome, recoverResults } from "./batch.ts";
import { add, type Ctx } from "./logs.ts";

export function recoverBatch(
  ctx: Ctx,
  target: Readonly<{ key: string }>,
  primaryError: unknown,
  restorePage: () => void,
): Readonly<{ outcome: BatchOutcome; hungReason: string; restored: boolean }> {
  const hungReason =
    primaryError instanceof Error ? primaryError.message : String(primaryError);
  const saved = recoverResults(ctx.browser);
  const failures: string[] = [];
  const record = (source: string, error: unknown): void => {
    failures.push(
      `${source}: ${error instanceof Error ? error.message : String(error)}`,
    );
  };
  if (saved.error !== null) record("recovery evidence", saved.error);
  try {
    const [dismissed] = ctx.browser.batch([["dialog", "dismiss"]]);
    if (!dismissed?.ok) record("dismiss", dismissed?.error ?? "no result");
  } catch (error) {
    record("dismiss", error);
  }
  let restored = false;
  try {
    restorePage();
    restored = true;
  } catch (error) {
    record("restore", error);
  }
  add(
    ctx,
    { page: target.key, shot: null },
    {
      severity: "medium",
      kind: "press-batch-failed",
      detail: hungReason,
    },
  );
  for (const detail of failures)
    add(
      ctx,
      { page: target.key, shot: null },
      {
        severity: "medium",
        kind: "recovery-failed",
        detail,
      },
    );
  if (!restored || saved.error !== null)
    add(
      ctx,
      { page: target.key, shot: null },
      {
        severity: "medium",
        kind: "coverage-incomplete",
        detail: `${hungReason}; ${failures.join("; ")}`,
      },
    );
  return {
    outcome: { results: saved.results, stopped: true, req: null, took: 0 },
    hungReason,
    restored,
  };
}
