import { describe, expect, it } from "vitest";

import {
  persistentServerEnvironmentsFor,
  persistentServerLaunchSpecsFor,
} from "./preflight-persistent-server-launch.ts";

describe("persistent preflight server environment", () => {
  it("supplies the required live OpenTelemetry settings to the API", () => {
    const environments = persistentServerEnvironmentsFor({
      inherited: {
        E2E_DATABASE_URL: "postgresql://127.0.0.1/customreport_e2e",
        OTEL_SDK_DISABLED: "true",
        OTEL_TRACES_SAMPLER_ARG: "0",
      },
      archiveRoot: process.cwd(),
      apiPort: 31_225,
      webPort: 32_225,
    });

    expect(environments.api.OTEL_SDK_DISABLED).toBe("false");
    expect(environments.api.OTEL_TRACES_SAMPLER_ARG).toBe("1");

    const [, web] = persistentServerLaunchSpecsFor({
      repoRoot: process.cwd(),
      environment: { npm_execpath: "/usr/bin/pnpm" },
      servers: environments,
      apiPort: 31_225,
      webPort: 32_225,
    });
    expect(web.args).toContain(
      "../../e2e/runtime-sweep/preflight/run-runtime-next-server.ts",
    );
  });
});
