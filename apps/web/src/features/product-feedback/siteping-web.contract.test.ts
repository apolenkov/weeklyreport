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

  it("keeps the annotation composer measurable and inside the viewport", () => {
    const require = createRequire(import.meta.url);
    const widgetPath = require.resolve("@siteping/widget");
    const distPath = dirname(widgetPath);
    const entrypoints = [
      readFileSync(join(distPath, "index.js"), "utf8"),
      readFileSync(join(distPath, "index.cjs"), "utf8"),
    ];

    for (const entrypoint of entrypoints) {
      expect(entrypoint).toContain("getBoundingClientRect()");
      expect(entrypoint).toContain('this.root.style.transition="none"');
      expect(entrypoint).toContain('this.root.style.transform="none"');
      expect(entrypoint).toContain(
        "getBoundingClientRect();this.root.style.transform=p",
      );
      expect(entrypoint).toContain("window.innerWidth-r-8");
      expect(entrypoint).toContain("window.innerHeight-o-8");
      expect(entrypoint).toContain("max-height:calc(100vh - 16px)");
      expect(entrypoint).toContain("overflow-y:auto");
      expect(entrypoint).not.toContain("let o=220,r=300");
    }
  });
});
