import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pressBatch, quietState } from "./batch.ts";
import { browserFixture } from "./browser.fixture.ts";
import { fullControlReason } from "./full-plan.ts";
import { readFullProbe } from "./full-probe.ts";
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
<button id="fetchfail" onclick="window.__fetchCaught=null;fetch('http://127.0.0.1:1/?token=secret').then(r=>r.text()).catch(e=>{window.__fetchCaught=e.name})">Refused request</button>
<input type="number" aria-label="Count" value="2"><input type="range" aria-label="Level"><input type="submit" aria-label="Go"><input type="date" aria-label="Day">
<input type="nonsense" aria-label="Odd"><input role="" aria-label="Blank role"><input type="radio" name="pick" aria-label="Pick">
<input type="search" aria-label="Find"><input type="email" list="hints" aria-label="Suggest"><datalist id="hints"><option value="a@example.com"></option></datalist>
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
    it.each([false, true])(
      "reports each reused XHR request once (first aborted=%s)",
      (abortFirst) => {
        quietState(fixture.browser);
        const observed = fixture.browser.evaluate(`(async () => {
          const xhr = new XMLHttpRequest();
          let initialError = null;
          try {xhr.open('INVALID METHOD', '/invalid');}
          catch (cause) {initialError = cause.name;}
          for (const url of ['/first', '/second']) {
            xhr.open('GET', url);
            const finished = new Promise((resolve, reject) => {
              const deadline = setTimeout(() => reject(new Error('XHR fixture timed out')), 3000);
              xhr.addEventListener('loadend', () => {clearTimeout(deadline); resolve();}, {once: true});
            });
            xhr.send();
            if (${abortFirst} && url === '/first') xhr.abort();
            await finished;
          }
          return {initialError, inflight: window.__crawl2.inflight, logs: window.__crawl2.logs.filter((log) => log.kind === 'network')};
        })()`) as {
          initialError: string | null;
          inflight: number;
          logs: { detail: string }[];
        };
        expect(observed.initialError).toBe("SyntaxError");
        expect(observed.logs.map((log) => log.detail)).toEqual([
          `${abortFirst ? 0 : 200} GET /first`,
          "200 GET /second",
        ]);
        expect(observed.inflight).toBe(0);
      },
      30_000,
    );
    it.each([
      { method: "GET", afterOpen: 0, url: "/second", error: null },
      {
        method: "INVALID METHOD",
        afterOpen: 1,
        url: "/first",
        error: "SyntaxError",
      },
    ])(
      "preserves request accounting when active open uses $method",
      ({ method, afterOpen, url, error }) => {
        quietState(fixture.browser);
        const observed = fixture.browser.evaluate(`(async () => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', '/first');
          const finished = new Promise((resolve, reject) => {
            const deadline = setTimeout(() => reject(new Error('XHR fixture timed out')), 3000);
            xhr.addEventListener('loadend', () => {clearTimeout(deadline); resolve();}, {once: true});
          });
          xhr.send();
          const before = window.__crawl2.inflight;
          let error = null;
          try {xhr.open(${JSON.stringify(method)}, '/second');}
          catch (cause) {error = cause.name;}
          const afterOpen = window.__crawl2.inflight;
          if (error === null) xhr.send();
          await finished;
          return {before, afterOpen, afterDone: window.__crawl2.inflight, error,
            logs: window.__crawl2.logs.filter((log) => log.kind === 'network').map((log) => log.detail)};
        })()`);
        expect(observed).toEqual({
          before: 1,
          afterOpen,
          afterDone: 0,
          error,
          logs: [`200 GET ${url}`],
        });
      },
      30_000,
    );
    it("attributes requests before an onload handler reuses the XHR", () => {
      quietState(fixture.browser);
      const observed = fixture.browser.evaluate(`(async () => {
        const xhr = new XMLHttpRequest();
        await new Promise((resolve, reject) => {
          const deadline = setTimeout(() => reject(new Error('XHR fixture timed out')), 3000);
          xhr.onload = () => {
            if (xhr.responseURL.endsWith('/first')) {xhr.open('GET', '/second'); xhr.send();}
            else {clearTimeout(deadline); resolve();}
          };
          xhr.open('GET', '/first'); xhr.send();
        });
        return {inflight: window.__crawl2.inflight, logs: window.__crawl2.logs.filter((log) => log.kind === 'network').map((log) => log.detail)};
      })()`);
      expect(observed).toEqual({
        inflight: 0,
        logs: ["200 GET /first", "200 GET /second"],
      });
    }, 30_000);
    it.each([false, true])(
      "observes requests sent by an OPENED handler (nested open=%s)",
      (nested) => {
        quietState(fixture.browser);
        const observed = fixture.browser.evaluate(`(async () => {
          const xhr = new XMLHttpRequest();
          let opened = 0;
          const finished = new Promise((resolve, reject) => {
            const deadline = setTimeout(() => reject(new Error('XHR fixture timed out')), 3000);
            xhr.onloadend = () => {clearTimeout(deadline); resolve();};
          });
          xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.OPENED) return;
            if (${nested} && opened++ === 0) xhr.open('GET', '/second');
            xhr.send();
          };
          xhr.open('GET', '/first');
          const afterOpen = window.__crawl2.inflight;
          await finished;
          return {afterOpen, afterDone: window.__crawl2.inflight, logs: window.__crawl2.logs.filter((log) => log.kind === 'network').map((log) => log.detail)};
        })()`);
        expect(observed).toEqual({
          afterOpen: 1,
          afterDone: 0,
          logs: [`200 GET /${nested ? "second" : "first"}`],
        });
      },
      30_000,
    );
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
    it("reports implicit input roles while the full walk still guards every input", () => {
      const probe = readFullProbe(fixture.browser);
      const byName = (name: string) => {
        const found = probe.controls.find((c) => c.name === name);
        if (!found) throw new Error(`Missing fixture control ${name}`);
        return found;
      };
      expect(
        Object.fromEntries(
          [
            "Count",
            "Level",
            "Go",
            "Day",
            "Odd",
            "Blank role",
            "Text",
            "Pick",
            "Check",
            "Password",
            "Find",
            "Suggest",
          ].map((name) => [name, byName(name).role]),
        ),
      ).toEqual({
        Count: "spinbutton",
        Level: "slider",
        Go: "button",
        Day: null,
        Odd: "textbox",
        "Blank role": "textbox",
        Text: "textbox",
        Pick: "radio",
        Check: "checkbox",
        Password: null,
        Find: "searchbox",
        Suggest: "combobox",
      });
      for (const name of [
        "Count",
        "Level",
        "Go",
        "Day",
        "Odd",
        "Text",
        "Area",
        "Password",
        "Find",
        "Suggest",
      ])
        expect(fullControlReason(byName(name))).toBe(
          "input: requires a named scenario",
        );
      for (const name of ["Pick", "Check", "Fast work"])
        expect(fullControlReason(byName(name))).toBeNull();
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
    it("records a handled transport failure in press evidence without secrets", async () => {
      const probe = fixture.browser.evaluate(PAGE_PROBE) as PageProbe;
      const target = probe.controls.find((c) => c.name === "Refused request");
      if (!target) throw new Error("Missing fixture control");
      const [result] = pressBatch(fixture.browser, [target], {
        budgetMs: 3000,
        maxQuietMs: 500,
        mode: "quick",
      }).results;
      await fixture.browser.evaluate(
        `(() => { const s = performance.now(); return new Promise((r) => { const t = () => window.__fetchCaught !== undefined ? r() : (performance.now() - s > 5000 ? r() : setTimeout(t, 50)); t(); }); })()`,
      );
      const failures =
        result?.logs.filter(
          (log) =>
            log.kind === "page-error" && log.detail.includes("fetch failed"),
        ) ?? [];
      expect(failures).toHaveLength(1);
      expect(failures[0]?.detail).not.toContain("secret");
      expect(fixture.browser.evaluate("window.__fetchCaught")).toBe(
        "TypeError",
      );
    }, 30_000);
  },
);
