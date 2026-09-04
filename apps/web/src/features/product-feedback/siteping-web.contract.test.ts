import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { createEndpointSource, useSitepingInbox } from "@siteping/dashboard";
import { initSiteping, registerLocale } from "@siteping/widget";
import { describe, expect, it } from "vitest";

describe("SitePing web contract", () => {
  it("exposes the widget and headless dashboard APIs used by WeeklyReport", () => {
    expect(initSiteping).toBeTypeOf("function");
    expect(registerLocale).toBeTypeOf("function");
    expect(createEndpointSource).toBeTypeOf("function");
    expect(useSitepingInbox).toBeTypeOf("function");
  });

  it("uses the renderer required for CSS Color 4 screenshots", () => {
    const require = createRequire(import.meta.url);
    const widgetPath = require.resolve("@siteping/widget");
    const rendererPath = require.resolve("html2canvas", {
      paths: [widgetPath],
    });
    const rendererPackage = JSON.parse(
      readFileSync(
        join(dirname(dirname(rendererPath)), "package.json"),
        "utf8",
      ),
    ) as { name: string; version: string };

    expect(rendererPackage).toMatchObject({
      name: "html2canvas-pro",
      version: "1.6.7",
    });
  });
});
