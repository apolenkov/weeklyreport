import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { createEndpointSource, useSitepingInbox } from "@siteping/dashboard";
import { initSiteping } from "@siteping/widget";
import { describe, expect, it } from "vitest";

describe("pinned SitePing web compatibility", () => {
  it("exposes the widget and headless dashboard seams", () => {
    expect(initSiteping).toBeTypeOf("function");
    expect(createEndpointSource).toBeTypeOf("function");
    expect(useSitepingInbox).toBeTypeOf("function");
  });

  it("retains the pinned durable retry queue key isolated by the host shim", () => {
    const require = createRequire(import.meta.url);
    const bundle = readFileSync(require.resolve("@siteping/widget"), "utf8");
    expect(bundle).toContain("siteping_retry_queue");
  });

  it("uses the CSS Color 4 compatible screenshot renderer", () => {
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

  it("does not treat SitePing's hidden composer as an open app dialog", () => {
    const appCss = readFileSync(
      resolve(import.meta.dirname, "../../styles/app.css"),
      "utf8",
    );

    expect(appCss).toContain(
      'body:has([role="dialog"]:not([data-siteping-ignore]))',
    );
  });

  it("retains the pinned drawing-toolbar seam used by the host offset", () => {
    const require = createRequire(import.meta.url);
    const bundle = readFileSync(require.resolve("@siteping/widget"), "utf8");

    expect(bundle).toContain("position:fixed;top:0;left:0;right:0;");
    expect(bundle).toContain("height:52px");
  });
});
