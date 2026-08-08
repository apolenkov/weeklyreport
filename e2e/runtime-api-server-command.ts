import path from "node:path";

export const runtimeApiServerCommand =
  "exec node --env-file-if-exists=../../.env --import @swc-node/register/esm-register src/main.ts" as const;

export const runtimeApiServerCwd = path.resolve(
  import.meta.dirname,
  "../apps/api",
);
