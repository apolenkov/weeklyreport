import { Logger } from "@nestjs/common";
import { onTestFinished, vi } from "vitest";

// Call inside it() only — spy auto-restores on test finish (never beforeAll).
export function silenceStderr() {
  const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return spy;
}

// Nest Logger writes to stdout — mock prototype methods, auto-restore on finish.
export function silenceNestLogger() {
  const error = vi
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);
  const warn = vi
    .spyOn(Logger.prototype, "warn")
    .mockImplementation(() => undefined);
  onTestFinished(() => {
    error.mockRestore();
    warn.mockRestore();
  });
  return { error, warn };
}
