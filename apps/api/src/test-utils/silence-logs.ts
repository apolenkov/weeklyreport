import { Logger } from "@nestjs/common";
import { onTestFinished, vi } from "vitest";

/**
 * Silence raw process.stderr writes for a single negative-path test.
 * Call inside the it() body, NOT in beforeAll/beforeEach. The spy is
 * auto-restored when the current test finishes, so it never leaks into a
 * later test that expects real stderr.
 */
export function silenceStderr() {
  const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return spy;
}

/**
 * Silence NestJS Logger.error / Logger.warn for a single negative-path test.
 * NestJS Logger writes to process.stdout (not console.error), so we mock
 * the prototype methods directly. Both spies are auto-restored when the
 * current test finishes.
 */
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
