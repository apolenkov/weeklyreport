import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pressBatch } from "./batch.ts";
import { browserFixture } from "./browser.fixture.ts";
import { PAGE_PROBE, type PageProbe, SIGNATURE_ONLY } from "./probe.ts";

const html = `<!doctype html><html><body style="margin:0">
<input id="text" aria-label="Text" value="first"><textarea id="area" aria-label="Area">first</textarea>
<select id="choice" aria-label="Choice"><option value="a">Alpha</option><option value="b">Beta</option></select>
<input id="password" type="password" aria-label="Password" value="private"><input id="check" type="checkbox" aria-label="Check">
<button id="edge" style="position:fixed;left:0;top:300px;width:30px;height:40px">Edge</button>
<button id="offscreen" style="position:absolute;left:-250px;top:300px;width:100px;height:40px">Offscreen</button>
<button id="partial" style="position:absolute;left:-80px;top:360px;width:100px;height:40px">Partial</button>
<button id="covered" style="position:absolute;left:200px;top:300px;width:100px;height:40px">Covered</button><div style="position:absolute;left:200px;top:300px;width:100px;height:40px;background:red;z-index:2"></div>
<label style="position:absolute;left:400px;top:300px"><input type="checkbox" id="labelcheck" aria-label="Label check">Label</label>
<button id="clip" style="position:absolute;left:100px;top:450px;width:80px;height:35px;white-space:nowrap;overflow:clip">A long content string unavailable to the reader</button>
<button id="scroll" style="position:absolute;left:100px;top:500px;width:80px;height:35px;white-space:nowrap;overflow:auto">A long content string accessible by scrolling</button>
<button id="ellipsis" style="position:absolute;left:100px;top:550px;width:80px;height:35px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">A long content string intentionally truncated</button>
<button id="heavy" onclick="const end=performance.now()+250;while(performance.now()<end){}">Heavy work</button><button id="fast">Fast work</button>
</body></html>`;

describe.runIf(process.env.CRAWL_BROWSER_TESTS === "1")(
  "native crawler observations",
  () => {
    let fixture: Awaited<ReturnType<typeof browserFixture>>;
    beforeAll(async () => {
      fixture = await browserFixture(html);
    }, 30_000);
    beforeEach(() => fixture.open());
    afterAll(async () => {
      await fixture.close();
    }, 30_000);
    it.each(["text", "area", "choice"])(
      "fingerprints changed live %s values",
      (id) => {
        const before = fixture.browser.evaluate(SIGNATURE_ONLY);
        fixture.browser.evaluate(
          `document.getElementById('${id}').value='${id === "choice" ? "b" : "changed"}';true`,
        );
        expect(fixture.browser.evaluate(SIGNATURE_ONLY)).not.toBe(before);
      },
      30_000,
    );
    it("omits password values but preserves checked state", () => {
      const before = fixture.browser.evaluate(SIGNATURE_ONLY);
      fixture.browser.evaluate(
        "document.getElementById('password').value='new private';true",
      );
      expect(fixture.browser.evaluate(SIGNATURE_ONLY)).toBe(before);
      fixture.browser.evaluate(
        "document.getElementById('check').checked=true;true",
      );
      expect(fixture.browser.evaluate(SIGNATURE_ONLY)).not.toBe(before);
    });
    it("keeps offscreen controls without attributing viewport edge obstruction", () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      const off = probe.controls.find((c) => c.name === "Offscreen");
      expect(off).toBeDefined();
      expect(off?.obstructedBy).toBeNull();
      expect(
        probe.controls.find((c) => c.name === "Partial")?.obstructedBy,
      ).toBeNull();
      expect(
        probe.controls.find((c) => c.name === "Covered")?.obstructedBy,
      ).toEqual(expect.any(String));
      expect(
        probe.controls.find((c) => c.name === "Label check")?.obstructedBy,
      ).toBeNull();
    });
    it("reports overflow:clip as clipping while preserving intentional ellipsis", () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      expect(
        probe.geometry.some(
          (g) =>
            g.kind === "control-clipped" &&
            g.target.startsWith("A long content string unavailable"),
        ),
      ).toBe(true);
      expect(
        probe.geometry.some(
          (g) =>
            g.kind === "control-clipped" && g.target.includes("intentionally"),
        ),
      ).toBe(false);
    });
    it("does not report accessible scrolling as inaccessible clipping", () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      expect(
        probe.geometry.some(
          (g) =>
            g.kind === "control-clipped" &&
            g.target.startsWith("A long content string accessible"),
        ),
      ).toBe(false);
    });
    it("attributes synchronous main-thread work to the current press only", () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      const controls = ["Heavy work", "Fast work"].map((name) => {
        const c = probe.controls.find((c) => c.name === name);
        if (!c) throw new Error("Missing fixture control");
        return c;
      });
      const options = {
        budgetMs: 2000,
        maxQuietMs: 100,
        mode: "quick" as const,
      };
      const [heavyControl, fastControl] = controls;
      if (!heavyControl || !fastControl)
        throw new Error("Missing action controls");
      const heavy = pressBatch(fixture.browser, [heavyControl], options)
        .results[0];
      const fast = pressBatch(fixture.browser, [fastControl], options)
        .results[0];
      expect(heavy?.blockedMs).toBeGreaterThanOrEqual(200);
      expect(fast?.blockedMs).toBeLessThan(100);
    }, 30_000);
  },
);
