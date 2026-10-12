import { spawnSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import { runMigrateReset } from "./migrate-reset.js";

const environment = {
  DATABASE_URL:
    "postgresql://customreport:secret@127.0.0.1:5432/customreport_e2e",
  NODE_ENV: "test",
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
} as const;

describe("migrate reset boundary", () => {
  it.each([
    "postgresql://customreport:secret@127.0.0.1:5432/customreport_dev",
    "postgresql://customreport:secret@db.example.com:5432/customreport_e2e",
  ])("rejects unsafe targets before spawning Prisma: %s", (databaseUrl) => {
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    expect(() =>
      runMigrateReset({ ...environment, DATABASE_URL: databaseUrl }, spawn),
    ).toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("rejects missing consent before spawning Prisma", () => {
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    expect(() =>
      runMigrateReset(
        { ...environment, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "" },
        spawn,
      ),
    ).toThrow(/must equal/u);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("spawns only the guarded exact reset command", () => {
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    runMigrateReset(environment, spawn);
    expect(spawn).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "prisma", "migrate", "reset", "--force"],
      expect.objectContaining({ shell: false, stdio: "inherit" }),
    );
  });
});

it("reports a genuine OS spawn failure and stops before another action", () => {
  const result = spawnSync("/f09-no-such-executable", [], {
    shell: false,
    timeout: 1000,
    stdio: "pipe",
  });
  expect(result.status).toBeNull();
  expect(result.signal).toBeNull();
  expect(result.error?.message).toContain("ENOENT");
  console.log("Synthetic OS receipt", {
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  const spawn = vi.fn(() => result);
  let failure: unknown;
  try {
    runMigrateReset(environment, spawn);
  } catch (error) {
    failure = error;
  }
  expect(spawn).toHaveBeenCalledOnce();
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error)) throw new Error("Expected producer failure");
  expect(failure.message).toContain("migrate reset");
  expect(failure.message).toContain("ENOENT");
  expect(failure.cause).toBe(result.error);
});

it("keeps context and cause when the spawn boundary itself throws", () => {
  const primary = new Error("Synthetic spawn boundary failure");
  let failure: unknown;
  try {
    runMigrateReset(environment, () => {
      throw primary;
    });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error))
    throw new Error("Expected contextual producer failure");
  expect(failure.message).toContain("migrate reset");
  expect(failure.cause).toBe(primary);
});
