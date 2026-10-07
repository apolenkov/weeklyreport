import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pressBatch } from "./batch.ts";
import { browserFixture } from "./browser.fixture.ts";
import { PAGE_PROBE, type PageProbe } from "./probe.ts";

const html = `<!doctype html><html><body><label>Mode
  <select id="mode"><option value="a">Alpha</option><option value="b">Beta</option><option value="c">Gamma</option></select></label><script>window.events=[];for(const type of ['input','change'])document.querySelector('#mode').addEventListener(type,event=>window.events.push(event.type))</script>
  </body></html>`;

describe.runIf(process.env.CRAWL_BROWSER_TESTS === "1")(
  "native select freshness",
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

    it.each([
      ["disabled select", "document.querySelector('#mode').disabled=true"],
      [
        "aria-disabled select",
        "document.querySelector('#mode').setAttribute('aria-disabled','true')",
      ],
      ["removed option", "document.querySelector('option[value=b]').remove()"],
      [
        "changed tag",
        "document.querySelector('#mode').outerHTML='<button id=mode>Mode</button>'",
      ],
      [
        "disabled option",
        "document.querySelector('option[value=b]').disabled=true",
      ],
    ])(
      "does not dispatch events for a stale %s",
      (_label, mutate) => {
        const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
        const control = probe.controls.find((c) => c.tag === "select");
        if (!control) throw new Error("Missing fixture select");
        fixture.browser.evaluate(`${mutate};true`);

        const outcome = pressBatch(fixture.browser, [control], {
          budgetMs: 1000,
          maxQuietMs: 100,
          mode: "quick",
        });

        expect(outcome.results[0]?.status).not.toBe("ok");
        if (_label !== "changed tag")
          expect(
            fixture.browser.evaluate("document.querySelector('#mode').value"),
          ).toBe("a");
        expect(fixture.browser.evaluate("window.events")).toEqual([]);
      },
      30_000,
    );

    it.each(["quick", "full"] as const)(
      "preserves assignment policy when planned value is current (%s)",
      (mode) => {
        const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
        const control = probe.controls.find((c) => c.tag === "select");
        if (!control) throw new Error("Missing fixture select");
        fixture.browser.evaluate(
          "document.querySelector('#mode').value='b';true",
        );
        const outcome = pressBatch(fixture.browser, [control], {
          budgetMs: 1000,
          maxQuietMs: 100,
          mode,
        });
        expect(
          fixture.browser.evaluate("document.querySelector('#mode').value"),
        ).toBe(mode === "full" ? "b" : "a");
        expect(fixture.browser.evaluate("window.events")).toEqual(
          mode === "full" ? [] : ["input", "change"],
        );
        expect(outcome.results[0]?.status).toBe(
          mode === "full" ? "stale" : "ok",
        );
      },
      30_000,
    );

    it("changes an available option and dispatches both native events", () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      const control = probe.controls.find((c) => c.tag === "select");
      if (!control) throw new Error("Missing fixture select");

      const outcome = pressBatch(fixture.browser, [control], {
        budgetMs: 1000,
        maxQuietMs: 100,
        mode: "quick",
      });

      expect(outcome.results[0]?.status).toBe("ok");
      expect(
        fixture.browser.evaluate("document.querySelector('#mode').value"),
      ).toBe("b");
      expect(fixture.browser.evaluate("window.events")).toEqual([
        "input",
        "change",
      ]);
    }, 30_000);
  },
);
