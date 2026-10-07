import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { repress } from "./batch.ts";
import { browserFixture } from "./browser.fixture.ts";
import { PAGE_PROBE, type PageProbe, SIGNATURE_ONLY } from "./probe.ts";

const html = `<!doctype html><html><body>
  <button id="toggle" aria-pressed="false" onclick="window.clickCount=(window.clickCount||0)+1;this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')==='true'?'false':'true')">Inspect health for shared alpha</button>
</body></html>`;

describe.runIf(process.env.CRAWL_BROWSER_TESTS === "1")(
  "native browser control identity",
  () => {
    let fixture: Awaited<ReturnType<typeof browserFixture>>;
    beforeAll(async () => {
      fixture = await browserFixture(html);
    }, 30_000);
    beforeEach(() => {
      fixture.open();
    });
    afterAll(async () => {
      await fixture.close();
    }, 30_000);

    it("never undoes a replacement action sharing the original label prefix", () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      const control = probe.controls[0];
      expect(control).toBeDefined();
      if (!control) throw new Error("Missing fixture control");
      fixture.browser.evaluate(
        "document.querySelector('#toggle').textContent='Inspect health for shared beta';window.clickCount=0;true",
      );

      repress(fixture.browser, control);

      expect(fixture.browser.evaluate("window.clickCount")).toBe(0);
    }, 30_000);

    it.each([
      "Inspect health for shared alpha",
      `Inspect ${"shared ".repeat(20)}alpha`,
    ])(
      "undoes the same available toggle with full label %s",
      (name) => {
        fixture.browser.evaluate(
          `document.querySelector('#toggle').textContent=${JSON.stringify(name)};true`,
        );
        const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
        const control = probe.controls[0];
        if (!control) throw new Error("Missing fixture control");
        const baseline = fixture.browser.evaluate(SIGNATURE_ONLY);
        fixture.browser.evaluate(
          "document.querySelector('#toggle').click();true",
        );

        const restored = repress(fixture.browser, control);

        expect(restored).toBe(baseline);
        expect(fixture.browser.evaluate("window.clickCount")).toBe(2);
      },
      30_000,
    );

    it.each([
      [
        "native tag",
        "document.querySelector('#toggle').outerHTML='<div id=toggle role=button>Inspect health for shared alpha</div>'",
      ],
      ["role", "document.querySelector('#toggle').setAttribute('role','link')"],
      ["disabled state", "document.querySelector('#toggle').disabled=true"],
      [
        "obstruction",
        "document.body.insertAdjacentHTML('beforeend','<div style=\"position:fixed;inset:0;z-index:100\">Cover</div>')",
      ],
    ])(
      "does not dispatch events when %s changes",
      (_label, change) => {
        const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
        const control = probe.controls[0];
        if (!control) throw new Error("Missing fixture control");
        fixture.browser.evaluate(
          `${change};window.eventCount=0;document.querySelector('#toggle').addEventListener('pointerdown',()=>window.eventCount++);true`,
        );

        repress(fixture.browser, control);

        expect(fixture.browser.evaluate("window.eventCount")).toBe(0);
      },
      30_000,
    );

    it("does not use an empty original name as permission to press a named action", () => {
      fixture.browser.evaluate("window.clickCount=0;true");

      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      const control = probe.controls[0];
      if (!control) throw new Error("Missing fixture control");
      repress(fixture.browser, { ...control, name: "" });

      expect(fixture.browser.evaluate("window.clickCount")).toBe(0);
    }, 30_000);
  },
);
