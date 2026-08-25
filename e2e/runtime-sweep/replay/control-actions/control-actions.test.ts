import { describe, expect, it } from "vitest";

import { assertDisposableE2eDatabase } from "../recovery/control-recovery.ts";
import { POTENTIALLY_MUTATING_FORM_OPERATIONS } from "./control-action-policy.ts";
import { STATEFUL_CONTROL_OPERATIONS } from "./control-actions.ts";

describe("runtime control-action safety boundary", () => {
  it("keeps the four stateful operations finite and ordered", () => {
    expect(STATEFUL_CONTROL_OPERATIONS).toEqual([
      "publish",
      "delete",
      "revoke",
      "restore",
      "submit",
    ]);
  });

  it("keeps form mutations behind the disposable recovery boundary", () => {
    expect(POTENTIALLY_MUTATING_FORM_OPERATIONS).toEqual([
      "fill",
      "select",
      "submit",
    ]);
  });

  it("accepts a local disposable E2E target distinct from the app database", () => {
    expect(() =>
      assertDisposableE2eDatabase("postgres://localhost/customreport_e2e", {
        DATABASE_URL: "postgres://localhost/customreport_dev",
        NODE_ENV: "test",
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
      }),
    ).not.toThrow();
  });

  it.each([
    [
      "same database",
      "postgres://localhost/customreport_dev",
      {
        DATABASE_URL: "postgres://localhost/customreport_dev",
        NODE_ENV: "test",
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
      },
    ],
    [
      "production database",
      "postgres://db/customreport_prod",
      {
        NODE_ENV: "test",
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
      },
    ],
    [
      "production runtime",
      "postgres://localhost/customreport_e2e",
      {
        NODE_ENV: "production",
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
      },
    ],
  ] as const)("rejects a %s target", (_label, databaseUrl, environment) => {
    expect(() => assertDisposableE2eDatabase(databaseUrl, environment)).toThrow(
      /Refusing|must differ/iu,
    );
  });
});
