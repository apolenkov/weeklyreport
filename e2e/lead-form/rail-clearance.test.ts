// Guards the sticky completion rail's bottom clearance: the rail must not paint
// over report content at either supported viewport. A probe that only counts
// box rects lies here — content inside a closed <details> or clipped away by an
// inner scroll container keeps a rect while painting nothing — so the probe
// filters by paint state and clips against every ancestor. The zeroed-clearance
// control proves the probe still reports an overlap when one exists.
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
  const scrolling = document.scrollingElement;
  return {
    railPresent: true,
    railTop: Math.round(railRect.top),
    atBottomPx: Math.round(scrolling.scrollHeight - scrolling.scrollTop - window.innerHeight),
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
}

const probe = async (): Promise<Measured> => {
  const data = await command(["eval", PROBE]);
  return data.result as Measured;
};

// Activating the rail adds its clearance to the document, so the page lands
// short of the bottom again after the first scroll: settle by scrolling and
// re-probing until the probe itself reports the anchored state.
const settleAtBottom = async (): Promise<Measured> => {
  let measured = await probe();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (measured.railPresent && measured.atBottomPx === 0) return measured;
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
    assert.deepEqual(
      measured.samples,
      [],
      `The completion rail paints over content at ${width}×${height}`,
    );

    // Control: without the clearance the same probe must find painted overlap,
    // otherwise a probe that never reports anything would pass this test.
    await command([
      "eval",
      "document.documentElement.style.setProperty('--lead-sticky-completion-clearance', '0rem')",
    ]);
    const control = await settleAtBottom();
    await command([
      "eval",
      "document.documentElement.style.removeProperty('--lead-sticky-completion-clearance')",
    ]);
    assert.ok(
      (control.overlaps ?? 0) > 0,
      `Control found no overlap without clearance at ${width}×${height}; the probe is not live`,
    );
  });
}
