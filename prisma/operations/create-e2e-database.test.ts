import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  connect: vi.fn(() => Promise.resolve()),
  end: vi.fn(() => Promise.resolve()),
  query: vi.fn<() => Promise<{ rows: { datname: string }[] }>>(() =>
    Promise.resolve({ rows: [] }),
  ),
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
  client.connect.mockReset().mockResolvedValue(undefined);
  client.end.mockReset().mockResolvedValue(undefined);
  client.query.mockReset().mockResolvedValue({ rows: [] });
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

const primaryError = new Error("Synthetic client failure");
const cleanupError = new Error("Synthetic client end failure");
it.each([
  {
    name: "success",
    connectFailed: false,
    queryFailed: false,
    primary: undefined,
    endFailed: false,
  },
  {
    name: "connect failure",
    connectFailed: true,
    queryFailed: false,
    primary: primaryError,
    endFailed: false,
  },
  {
    name: "query failure",
    connectFailed: false,
    queryFailed: true,
    primary: primaryError,
    endFailed: false,
  },
  {
    name: "throw undefined",
    connectFailed: false,
    queryFailed: true,
    primary: undefined,
    endFailed: false,
  },
  {
    name: "non-Error primary",
    connectFailed: false,
    queryFailed: true,
    primary: "Synthetic primary",
    endFailed: false,
  },
  {
    name: "end failure",
    connectFailed: false,
    queryFailed: false,
    primary: undefined,
    endFailed: true,
  },
  {
    name: "connect and end failure",
    connectFailed: true,
    queryFailed: false,
    primary: primaryError,
    endFailed: true,
  },
  {
    name: "query and end failure",
    connectFailed: false,
    queryFailed: true,
    primary: primaryError,
    endFailed: true,
  },
  {
    name: "undefined and end failure",
    connectFailed: false,
    queryFailed: true,
    primary: undefined,
    endFailed: true,
  },
])("preserves the public client lifecycle: $name", async (scenario) => {
  const events: string[] = [];
  client.connect.mockImplementation(() => {
    events.push("connect");
    return scenario.connectFailed
      ? Promise.reject(scenario.primary)
      : Promise.resolve();
  });
  client.query.mockImplementation(() => {
    events.push("query");
    return scenario.queryFailed
      ? Promise.reject(scenario.primary)
      : Promise.resolve({ rows: [] });
  });
  client.end.mockImplementation(() => {
    events.push("end");
    return scenario.endFailed
      ? Promise.reject(cleanupError)
      : Promise.resolve();
  });
  const operation = createE2eDatabase(environment);
  const hasPrimary = scenario.connectFailed || scenario.queryFailed;
  if (!hasPrimary && !scenario.endFailed) {
    await expect(operation).resolves.toBeUndefined();
    expect(events).toEqual(["connect", "query", "query", "end"]);
  } else if (scenario.endFailed) {
    let failure: unknown;
    try {
      await operation;
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    const aggregate = failure as AggregateError;
    expect(aggregate.errors).toEqual(
      hasPrimary ? [scenario.primary, cleanupError] : [cleanupError],
    );
    expect(aggregate.cause).toBe(hasPrimary ? scenario.primary : undefined);
  } else await expect(operation).rejects.toBe(scenario.primary);
  expect(client.end).toHaveBeenCalledOnce();
  expect(events.at(-1)).toBe("end");
  if (scenario.connectFailed) expect(client.query).not.toHaveBeenCalled();
});

it("finalizes an already-existing database without issuing CREATE", async () => {
  client.query.mockResolvedValueOnce({
    rows: [{ datname: "customreport_e2e" }],
  });
  await expect(createE2eDatabase(environment)).resolves.toBeUndefined();
  expect(client.query).toHaveBeenCalledOnce();
  expect(client.end).toHaveBeenCalledOnce();
});
