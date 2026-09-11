import { describe, expect, it } from "vitest";

import { resolveExactAlias } from "./entity-alias-index.js";
import { buildAccessibleEntityCatalog } from "./entity-resolver.catalog.js";
import type { AccessibleEntity } from "./entity-resolver.types.js";

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
