import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import { requireExportContract } from "./require-export-contract.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run("require-export-contract", requireExportContract, {
  valid: [
    "/** Public contract. */\nconst documented = 1;\nexport { documented };",
    "export const direct = 1;",
    "export { external } from './external.js';",
    "import { external } from './external.js';\nexport { external };",
  ],
  invalid: [
    {
      code: "const undocumented = 1;\nexport { undocumented };",
      errors: [{ messageId: "missing", data: { name: "undocumented" } }],
    },
    {
      code: "/** Private contract. */\nconst privateValue = 1;\nconst undocumented = privateValue;\nexport { undocumented };",
      errors: [{ messageId: "missing", data: { name: "undocumented" } }],
    },
  ],
});
