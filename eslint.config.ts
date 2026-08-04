import type { Linter } from "eslint";

import { boundaryConfig } from "./eslint-config/boundaries.ts";
import { coreConfig } from "./eslint-config/core.ts";
import { immutabilityConfig } from "./eslint-config/immutability.ts";
import { jsdocConfig } from "./eslint-config/jsdoc.ts";
import { nextConfig } from "./eslint-config/next.ts";
import { overrideConfig } from "./eslint-config/overrides.ts";
import { sonarjsConfig } from "./eslint-config/sonarjs.ts";

const eslintConfig: Linter.Config[] = [
  ...coreConfig,
  sonarjsConfig,
  jsdocConfig,
  nextConfig,
  ...boundaryConfig,
  ...immutabilityConfig,
  ...overrideConfig,
];

export default eslintConfig;
