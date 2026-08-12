import { describe, expect, it } from "vitest";

import {
  assertSpecializedDeclarations,
  SPECIALIZED_DECLARATIONS,
} from "./specialized-declarations.ts";

describe("specialized declaration contract", () => {
  it("rejects a declaration with a known ID but altered proof metadata", () => {
    const first = SPECIALIZED_DECLARATIONS.at(0);
    if (first === undefined)
      throw new Error("Canonical declarations are empty");
    const tampered = SPECIALIZED_DECLARATIONS.map((declaration, index) =>
      index === 0
        ? {
            ...declaration,
            proof: { ...declaration.proof, target: "tampered-proof" },
          }
        : declaration,
    );
    expect(() => assertSpecializedDeclarations(tampered)).toThrow(
      "must match the canonical",
    );
  });
});
