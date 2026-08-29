import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyExemplaryFile,
  classifyExemplaryFileRole,
  exemplaryFileRoleMetadata,
  isExemplaryProductEntrypoint,
} from "./exemplary-file-kind.ts";

void describe("classifyExemplaryFile", () => {
  void it("classifies test suffixes and test infrastructure", () => {
    assert.equal(classifyExemplaryFile("apps/api/src/service.test.ts"), "test");
    assert.equal(classifyExemplaryFile("apps/web/src/view.spec.tsx"), "test");
    assert.equal(
      classifyExemplaryFile("apps/web/src/test-utils/fake.ts"),
      "test",
    );
    assert.equal(classifyExemplaryFile("apps/web/src/auth-harness.ts"), "test");
    assert.equal(
      classifyExemplaryFile("apps/api/src/router.fixture.ts"),
      "test",
    );
  });

  void it("keeps nearby product names out of the test class", () => {
    assert.equal(
      classifyExemplaryFile("apps/web/src/latest-status.ts"),
      "product",
    );
    assert.equal(
      classifyExemplaryFile("apps/web/src/setup-screen.tsx"),
      "product",
    );
  });

  void it("classifies tooling and configuration roots explicitly", () => {
    assert.equal(classifyExemplaryFile("scripts/check.ts"), "tooling");
    assert.equal(classifyExemplaryFile("vitest.config.ts"), "config");
    assert.equal(classifyExemplaryFile("eslint-config/jsdoc.ts"), "config");
    assert.equal(classifyExemplaryFile("apps/api/src/config.ts"), "product");
  });

  void it("recognizes only exact framework and package-command entrypoints", () => {
    for (const file of [
      "apps/api/src/main.ts",
      "apps/web/src/app/reports/page.tsx",
      "apps/web/instrumentation.ts",
      "apps/web/src/proxy.ts",
      "apps/web/scripts/run-next.ts",
      "packages/shared/src/index.ts",
    ]) {
      assert.equal(isExemplaryProductEntrypoint(file), true);
    }
    for (const file of [
      "apps/api/src/main-helper.ts",
      "apps/web/src/scripts/run-next.ts",
      "apps/web/scripts/run-next-copy.ts",
      "packages/shared/src/nested/index.ts",
    ]) {
      assert.equal(isExemplaryProductEntrypoint(file), false);
    }
  });

  void it("assigns every governed repository role owner and rationale metadata", () => {
    const examples = [
      ["apps/api/src/service.ts", "maintained-product"],
      ["apps/api/src/main.ts", "externally-constrained-adapter"],
      ["apps/api/src/queue.adapter.ts", "externally-constrained-adapter"],
      ["apps/web/src/app/reports/page.tsx", "externally-constrained-adapter"],
      ["apps/web/scripts/run-next.ts", "externally-constrained-adapter"],
      ["apps/api/src/service.test.ts", "test"],
      ["apps/api/src/__fixtures__/report.ts", "fixture"],
      ["prisma/generated/client.ts", "generated"],
      ["prisma/seeds/demo/seed-demo.ts", "seed"],
      ["apps/web/next.config.ts", "config"],
      ["scripts/check.ts", "tooling"],
    ] as const;

    for (const [file, expectedRole] of examples) {
      const role = classifyExemplaryFileRole(file);
      assert.equal(role.id, expectedRole);
      assert.notEqual(role.owner.trim(), "");
      assert.notEqual(role.rationale.trim(), "");
      assert.deepEqual(
        { owner: role.owner, rationale: role.rationale },
        exemplaryFileRoleMetadata[expectedRole],
      );
    }
  });

  void it("keeps external adapters and unmatched fixture names on the product floor", () => {
    assert.deepEqual(
      classifyExemplaryFileRole("apps/api/src/queue.adapter.ts"),
      {
        id: "externally-constrained-adapter",
        kind: "product",
        ...exemplaryFileRoleMetadata["externally-constrained-adapter"],
        structuralScope: "maintained-product",
      },
    );
    assert.deepEqual(
      classifyExemplaryFileRole(
        "apps/api/src/test-utils/report-section-fixtures.ts",
      ),
      {
        id: "fixture",
        kind: "test",
        ...exemplaryFileRoleMetadata.fixture,
        structuralScope: "separately-measured",
      },
    );
    assert.deepEqual(
      classifyExemplaryFileRole(
        "apps/web/src/features/report-section-fixtures.ts",
      ),
      {
        id: "fixture",
        kind: "product",
        ...exemplaryFileRoleMetadata.fixture,
        structuralScope: "maintained-product",
      },
    );
  });

  void it("does not let nearby product paths escape through exceptional roles", () => {
    for (const file of [
      "apps/web/src/features/setup-screen.tsx",
      "apps/api/src/modules/generated-report.ts",
      "apps/api/src/modules/seeded-report.ts",
      "apps/web/src/features/report-page.tsx",
    ]) {
      assert.equal(classifyExemplaryFileRole(file).id, "maintained-product");
      assert.equal(
        classifyExemplaryFileRole(file).structuralScope,
        "maintained-product",
      );
    }
  });
});
