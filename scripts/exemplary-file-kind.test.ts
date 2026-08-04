import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyExemplaryFile } from "./exemplary-file-kind.ts";

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
    assert.equal(classifyExemplaryFile("e2e/integration/flow.ts"), "tooling");
    assert.equal(classifyExemplaryFile("vitest.config.ts"), "config");
    assert.equal(classifyExemplaryFile("eslint-config/jsdoc.ts"), "config");
    assert.equal(classifyExemplaryFile("apps/api/src/config.ts"), "product");
  });
});
