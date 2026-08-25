import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  connect: vi.fn(() => Promise.resolve()),
  end: vi.fn(() => Promise.resolve()),
  query: vi.fn(() => Promise.resolve({ rows: [] })),
}));
const Client = vi.hoisted(() =>
  vi.fn(
    class FakeClient {
      readonly connect = client.connect;
      readonly end = client.end;
      readonly query = client.query;
    },
  ),
);

vi.mock("pg", () => ({ default: { Client } }));

import { createE2eDatabase } from "./create-e2e-database.js";

const environment = {
  E2E_DATABASE_URL:
    "postgresql://customreport:secret@127.0.0.1:5432/customreport_e2e",
  NODE_ENV: "test",
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
} as const;

afterEach(() => {
  Client.mockClear();
  client.connect.mockClear();
  client.end.mockClear();
  client.query.mockClear();
});

describe("create E2E database boundary", () => {
  it("guards before connecting or creating the database", async () => {
    await expect(
      createE2eDatabase({
        ...environment,
        E2E_DATABASE_URL:
          "postgresql://customreport:secret@127.0.0.1:5432/customreport_dev",
      }),
    ).rejects.toThrow(/not one of/u);
    expect(Client).not.toHaveBeenCalled();
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  it("requires exact per-run consent before connecting", async () => {
    await expect(
      createE2eDatabase({
        ...environment,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "да",
      }),
    ).rejects.toThrow(/must equal/u);
    expect(Client).not.toHaveBeenCalled();
  });

  it("connects to maintenance postgres only after the guard passes", async () => {
    await expect(createE2eDatabase(environment)).resolves.toBeUndefined();
    expect(Client).toHaveBeenCalledWith({
      connectionString:
        "postgresql://customreport:secret@127.0.0.1:5432/postgres",
    });
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith(
      "SELECT datname FROM pg_database WHERE datname = $1",
      ["customreport_e2e"],
    );
    expect(client.end).toHaveBeenCalledOnce();
  });
});
