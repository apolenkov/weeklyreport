// Guards the sticky completion rail's bottom clearance: the rail must not paint
// over report content at either supported viewport. A probe that only counts
// box rects lies here — content inside a closed <details> or clipped away by an
// inner scroll container keeps a rect while painting nothing — so the probe
// filters by paint state and clips against every ancestor. The overlay control
// proves the probe still reports an overlap when one exists.
import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { openLeadReport } from "./access.js";
import { command } from "./browser.js";
import { registerE2eHooks } from "./fixtures.js";

registerE2eHooks();

const RAIL = '[data-testid="lead-sticky-completion-actions"]';

const PROBE = `(() => {
  const rail = document.querySelector(${JSON.stringify(RAIL)});
  if (rail === null) return { railPresent: false };
  const railRect = rail.getBoundingClientRect();
  const clipped = (element) => {
    let rect = element.getBoundingClientRect();
    let node = element.parentElement;
    while (node !== null && node !== document.documentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (/^(auto|scroll|hidden)$/u.test(overflowY)) {
        const box = node.getBoundingClientRect();
        const top = Math.max(rect.top, box.top);
        const bottom = Math.min(rect.bottom, box.bottom);
        const left = Math.max(rect.left, box.left);
        const right = Math.min(rect.right, box.right);
        if (bottom <= top || right <= left) return null;
        rect = { top, bottom, left, right };
      }
      node = node.parentElement;
    }
    return rect;
  };
  const hiddenByCollapsedDetails = (element) => {
    let node = element;
    while (node !== null && node.tagName !== "BODY") {
      if (node.tagName === "DETAILS" && !node.open) return true;
      node = node.parentElement;
    }
    return false;
  };
  const overlaps = [];
  for (const element of document.querySelectorAll("main *")) {
    if (rail.contains(element) || element.contains(rail)) continue;
    if (element.childElementCount !== 0) continue;
    const text = (element.textContent ?? "").trim();
    if (text.length < 3) continue;
    try {
      if (!element.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    } catch {
      continue;
    }
    if (hiddenByCollapsedDetails(element)) continue;
    const rect = clipped(element);
    if (rect === null) continue;
    const vertical = Math.min(rect.bottom, railRect.bottom) - Math.max(rect.top, railRect.top);
    const horizontal = Math.min(rect.right, railRect.right) - Math.max(rect.left, railRect.left);
    if (vertical > 1 && horizontal > 1) overlaps.push(text.slice(0, 60));
  }
  const scrolling = document.querySelector('[data-testid="lead-completion-scrollport"]') ?? document.scrollingElement;
  const hitSamples = [];
  for (let x = Math.ceil(railRect.left + 16); x < railRect.right; x += 24) {
    for (let y = Math.ceil(railRect.top + 2); y < railRect.bottom; y += 16) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !rail.contains(hit)) hitSamples.push(hit?.textContent?.trim().slice(0, 60) ?? 'No painted rail');
    }
  }
  return {
    railPresent: true,
    railTop: Math.round(railRect.top),
    atBottomPx: Math.round(scrolling.scrollHeight - scrolling.scrollTop - scrolling.clientHeight),
    hitSamples,
    scrollportBottom: scrolling.getBoundingClientRect().bottom,
    overlaps: overlaps.length,
    samples: overlaps.slice(0, 5),
  };
})()`;

interface Measured {
  readonly railPresent: boolean;
  readonly railTop?: number;
  readonly atBottomPx?: number;
  readonly overlaps?: number;
  readonly samples?: readonly string[];
  readonly hitSamples?: readonly string[];
  readonly scrollportBottom?: number;
}

interface DocumentFit {
  readonly scrollHeight: number;
  readonly innerHeight: number;
  readonly railBottom: number | null;
}

// The layout owns every scroll, so the document itself must not scroll: a
// document taller than the viewport hides the rail below the fold on open.
const documentFit = async (): Promise<DocumentFit> => {
  const data = await command([
    "eval",
    `(() => {
      document.scrollingElement.scrollTop = 0;
      const rail = document.querySelector(${JSON.stringify(RAIL)});
      return {
        scrollHeight: document.scrollingElement.scrollHeight,
        innerHeight: window.innerHeight,
        railBottom: rail === null ? null : rail.getBoundingClientRect().bottom,
      };
    })()`,
  ]);
  return data.result as DocumentFit;
};

const probe = async (): Promise<Measured> => {
  const data = await command(["eval", PROBE]);
  return data.result as Measured;
};

// The rail handoff changes the scrollport height. Re-probe until that intrinsic
// row has settled and the final content is reachable above it.
const settleAtBottom = async (): Promise<Measured> => {
  let measured = await probe();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (measured.railPresent && measured.atBottomPx === 0) return measured;
    await command([
      "eval",
      `(document.querySelector('[data-testid="lead-completion-scrollport"]') ?? document.scrollingElement).scrollTop = Number.MAX_SAFE_INTEGER`,
    ]);
    await command([
      "eval",
      "document.scrollingElement.scrollTop = Number.MAX_SAFE_INTEGER",
    ]);
    await delay(300);
    measured = await probe();
  }
  return measured;
};

for (const [width, height] of [
  [1280, 900],
  [375, 1000],
] as const) {
  void test(`the completion rail clears painted content at ${width}×${height}`, async () => {
    await openLeadReport();
    await command(["set", "viewport", String(width), String(height)]);
    const opened = await documentFit();
    assert.ok(
      opened.scrollHeight <= opened.innerHeight,
      `The document scrolls on open at ${width}×${height} (${opened.scrollHeight} > ${opened.innerHeight})`,
    );
    if (opened.railBottom !== null)
      assert.ok(
        opened.railBottom <= opened.innerHeight,
        `The rail starts below the viewport at ${width}×${height}`,
      );
    const measured = await settleAtBottom();
    assert.equal(
      measured.railPresent,
      true,
      `The completion rail did not activate at ${width}×${height}`,
    );
    assert.equal(
      measured.atBottomPx,
      0,
      `Probe never reached the bottom at ${width}×${height}`,
    );
    const settled = await documentFit();
    assert.ok(
      settled.scrollHeight <= settled.innerHeight,
      `The document scrolls with the rail shown at ${width}×${height} (${settled.scrollHeight} > ${settled.innerHeight})`,
    );
    assert.ok(
      settled.railBottom !== null && settled.railBottom <= settled.innerHeight,
      `The rail bottom is below the viewport at document scroll 0 (${width}×${height})`,
    );
    assert.deepEqual(
      measured.samples,
      [],
      `The completion rail paints over content at ${width}×${height}`,
    );

    assert.deepEqual(
      measured.hitSamples,
      [],
      "Rail hit testing must stay inside the rail",
    );
    assert.ok(
      (measured.scrollportBottom ?? Infinity) <= (measured.railTop ?? 0),
      "The content scrollport must end above the rail",
    );

    for (const fraction of [0, 0.5, 1]) {
      await command([
        "eval",
        `document.querySelector('[data-testid="lead-completion-scrollport"]').scrollTop = (document.querySelector('[data-testid="lead-completion-scrollport"]').scrollHeight - document.querySelector('[data-testid="lead-completion-scrollport"]').clientHeight) * ${fraction}`,
      ]);
      await delay(300);
      const position = await probe();
      if (fraction > 0) assert.equal(position.railPresent, true);
      if (position.railPresent) {
        assert.deepEqual(
          position.samples,
          [],
          `Content overlap at scroll fraction ${fraction}`,
        );
        assert.deepEqual(
          position.hitSamples,
          [],
          `Rail hit testing failed at scroll fraction ${fraction}`,
        );
      }
    }

    // Tab is the real browser focus-scrolling path, not programmatic geometry.
    await command([
      "eval",
      `document.querySelector('[data-testid="lead-completion-scrollport"]').scrollTop = 0; document.activeElement?.blur()`,
    ]);
    let contentVisits = 0;
    let reachedRail = false;
    for (let index = 0; index < 250; index += 1) {
      await command(["press", "Tab"]);
      const focus = (
        await command([
          "eval",
          `(() => {
        const active = document.activeElement;
        const rail = document.querySelector(${JSON.stringify(RAIL)});
        const scrollport = document.querySelector('[data-testid="lead-completion-scrollport"]');
        return { inRail: !!rail?.contains(active), inContent: !!scrollport?.contains(active), bottom: active?.getBoundingClientRect().bottom, railTop: rail?.getBoundingClientRect().top };
      })()`,
        ])
      ).result as {
        inRail: boolean;
        inContent: boolean;
        bottom: number;
        railTop?: number;
      };
      if (focus.inRail) {
        reachedRail = true;
        break;
      }
      if (focus.inContent) contentVisits += 1;
      if (focus.inContent && focus.railTop !== undefined)
        assert.ok(
          focus.bottom <= focus.railTop,
          `Tab ${index}: focus is obscured`,
        );
    }

    assert.ok(contentVisits > 0, "Tab must visit report content");
    assert.equal(reachedRail, true, "Tab must reach the completion rail");

    // Control: turn the reserved row back into the old overlay; the same probe
    // must detect painted content underneath it, rather than always returning 0.
    await settleAtBottom();
    await command([
      "eval",
      `document.querySelector('[data-testid="lead-completion-layout"]').style.gridTemplateRows = 'minmax(0, 1fr) 0px'; document.querySelector(${JSON.stringify(RAIL)}).style.cssText = 'position:fixed;bottom:0;left:12px;right:12px;z-index:50'`,
    ]);
    const control = await settleAtBottom();
    await command([
      "eval",
      `document.querySelector('[data-testid="lead-completion-layout"]').style.removeProperty('grid-template-rows'); document.querySelector(${JSON.stringify(RAIL)}).removeAttribute('style')`,
    ]);
    assert.ok(
      (control.overlaps ?? 0) > 0,
      `Control found no overlap without clearance at ${width}×${height}; the probe is not live`,
    );
  });
}
