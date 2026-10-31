import { describe, expect, it } from "vitest";

import { createClarificationTokenCodec } from "../application/clarification-token.js";
import { resolveExactAlias } from "./entity-alias-index.js";
import {
  buildAccessibleEntityCatalog,
  resolveReference,
} from "./entity-resolver.catalog.js";
import type {
  AccessibleEntity,
  ReferenceSlot,
} from "./entity-resolver.types.js";

describe("buildAccessibleEntityCatalog", () => {
  it("merges repeated identities in first-seen order without merging entity kinds", () => {
    const entities: readonly AccessibleEntity[] = [
      {
        kind: "product",
        id: "shared",
        label: "Original",
        aliases: ["Common", "  "],
      },
      { kind: "author", id: "shared", label: "Author", aliases: ["Common"] },
      { kind: "product", id: "other", label: "Other", aliases: ["Common"] },
      {
        kind: "product",
        id: "shared",
        label: "Later label",
        aliases: ["Common", "COMMON", "New alias"],
      },
    ];
    const before = structuredClone(entities);

    const catalog = buildAccessibleEntityCatalog(entities);

    expect(catalog.entities).toEqual([
      {
        kind: "product",
        id: "shared",
        label: "Original",
        aliases: ["Common", "  ", "COMMON", "New alias"],
      },
      entities[1],
      entities[2],
    ]);
    expect(
      resolveExactAlias(catalog.index, " common ").map(({ kind, id }) => [
        kind,
        id,
      ]),
    ).toEqual([
      ["product", "shared"],
      ["author", "shared"],
      ["product", "other"],
    ]);
    expect(resolveExactAlias(catalog.index, "New alias")).toHaveLength(1);
    expect(resolveExactAlias(catalog.index, "Later label")).toEqual([]);
    expect(resolveExactAlias(catalog.index, " ")).toEqual([]);
    expect(entities).toEqual(before);
  });
});

describe("resolveReference clarification totals", () => {
  const actorId = "actor-a";
  const tokenCodec = createClarificationTokenCodec({
    AUTH_JWT_SECRET: "entity-resolver-test-secret-with-at-least-32-chars",
  });
  const slot: ReferenceSlot = { kind: "product", reference: "Common" };
  const productsWithAlias = (count: number): readonly AccessibleEntity[] =>
    Array.from({ length: count }, (_, index) => ({
      kind: "product",
      id: `product-${String(index).padStart(2, "0")}`,
      label: `Product ${String(index).padStart(2, "0")}`,
      aliases: ["Common"],
    }));

  it("reports total and truncated when candidates exceed the option limit", () => {
    const catalog = buildAccessibleEntityCatalog(productsWithAlias(21));

    const outcome = resolveReference(catalog, slot, new Map(), {
      actorId,
      tokenCodec,
    });

    expect(outcome.kind).toBe("clarification_required");
    if (outcome.kind !== "clarification_required") return;
    expect(outcome.options).toHaveLength(20);
    expect(outcome).toMatchObject({ total: 21, truncated: true });
  });

  it("reports the full count and truncated false when candidates fit the option limit", () => {
    const catalog = buildAccessibleEntityCatalog(productsWithAlias(2));

    const outcome = resolveReference(catalog, slot, new Map(), {
      actorId,
      tokenCodec,
    });

    expect(outcome.kind).toBe("clarification_required");
    if (outcome.kind !== "clarification_required") return;
    expect(outcome.options).toHaveLength(2);
    expect(outcome).toMatchObject({ total: 2, truncated: false });
  });
});
