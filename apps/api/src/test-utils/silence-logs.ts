import { vi } from "vitest";
import { Logger } from "@nestjs/common";

/**
 * Silence raw process.stderr writes for a single negative-path test.
 * Call inside the it() body, NOT in beforeAll/beforeEach.
 */
export function silenceStderr() {
  return vi.spyOn(process.stderr, "write").mockImplementation(() => true);
}

/**
 * Silence NestJS Logger.error / Logger.warn for a single negative-path test.
 * NestJS Logger writes to process.stdout (not console.error), so we mock
 * the prototype methods directly.
 */
export function silenceNestLogger() {
  return {
    error: vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined),
    warn: vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined),
  };
}
