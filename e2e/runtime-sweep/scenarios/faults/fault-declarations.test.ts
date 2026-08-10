import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import {
  FAULT_DECLARATIONS,
  faultDeclarationFor,
  INJECTABLE_FAULT_MODES,
} from "./fault-declarations.ts";

type SuperJsonModule =
  typeof import("../../../../apps/api/node_modules/superjson/dist/index.js");
type TrpcCoreModule =
  typeof import("../../../../apps/api/node_modules/@trpc/server/dist/unstable-core-do-not-import.mjs");

const productionRequire = createRequire(
  new URL("../../../../apps/api/package.json", import.meta.url),
);
const superjson = productionRequire("superjson") as SuperJsonModule;
const { transformResult } = productionRequire(
  "@trpc/server/unstable-core-do-not-import",
) as TrpcCoreModule;

describe("runtime fault declarations", () => {
  it("declares every injectable mode exactly once", () => {
    expect(FAULT_DECLARATIONS.map(({ mode }) => mode)).toEqual(
      INJECTABLE_FAULT_MODES,
    );
    expect(new Set(FAULT_DECLARATIONS.map(({ id }) => id)).size).toBe(
      INJECTABLE_FAULT_MODES.length,
    );
  });

  it("returns stable immutable declarations by mode", () => {
    INJECTABLE_FAULT_MODES.forEach((mode) => {
      const declaration = faultDeclarationFor(mode);
      expect(declaration).toBe(
        FAULT_DECLARATIONS.find((item) => item.mode === mode),
      );
      expect(Object.isFrozen(declaration)).toBe(true);
      expect(declaration.operation).toBe("period.publish");
      expect(declaration.expectation.persistedState).toBe("unchanged");
    });
  });

  it("matches response and abort declarations to the injectable mode", () => {
    expect(
      FAULT_DECLARATIONS.filter(({ response }) => response !== null).map(
        ({ mode }) => mode,
      ),
    ).toEqual([
      "auth-missing",
      "auth-expired",
      "auth-forbidden",
      "http-4xx",
      "http-5xx",
    ]);
    expect(
      FAULT_DECLARATIONS.filter(({ response }) => response === null).map(
        ({ mode }) => mode,
      ),
    ).toEqual(["network-timeout", "request-aborted"]);
  });

  it("keeps each declared HTTP message through the production tRPC transformer", () => {
    FAULT_DECLARATIONS.filter(
      (declaration) => declaration.response !== null,
    ).forEach((declaration) => {
      const [wireResponse] = JSON.parse(declaration.response.body) as [unknown];
      const transformed = transformResult(
        wireResponse as Parameters<typeof transformResult>[0],
        superjson,
      );
      expect(transformed.ok).toBe(false);
      if (transformed.ok) throw new Error("expected a tRPC error response");
      expect(transformed).toMatchObject({
        error: {
          error: { message: declaration.expectation.userVisibleMessage },
        },
      });
    });
  });
});
