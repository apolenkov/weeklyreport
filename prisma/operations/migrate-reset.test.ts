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
    "postgresql://customreport:secret@db.internal:5432/customreport_e2e",
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
