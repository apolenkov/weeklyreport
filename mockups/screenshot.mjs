#!/usr/bin/env node
/**
 * Playwright screenshot utility for CustomReport mockup
 * Usage:
 *   node screenshot.mjs                    # all slides
 *   node screenshot.mjs 2                  # single slide by ID
 *   node screenshot.mjs 2 3 4             # specific slides
 *   node screenshot.mjs --file v13        # specific version (default: latest)
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright");
import { existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, basename } from "path";

const SLIDES = [
  { id: 1, name: "lead-form" },
  { id: 9, name: "lead-history" },
  { id: 2, name: "dashboard" },
  { id: 3, name: "weekly-report" },
  { id: 4, name: "admin" },
  { id: 7, name: "ui-states" },
  { id: 8, name: "login" },
];

const args = process.argv.slice(2);
let fileVersion = "v14";
const requestedIds = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--file" && args[i + 1]) {
    fileVersion = args[++i];
  } else if (/^\d+$/.test(args[i])) {
    requestedIds.push(parseInt(args[i]));
  }
}

// Find the mockup file
let mockupFile;
if (existsSync(`mockup-v17-${fileVersion}.html`)) {
  mockupFile = resolve(`mockup-v17-${fileVersion}.html`);
} else {
  // Find latest version
  const files = readdirSync(".")
    .filter((f) => f.startsWith("mockup-v17-") && f.endsWith(".html"))
    .sort();
  mockupFile = resolve(files[files.length - 1]);
}

const slidesToCapture =
  requestedIds.length > 0
    ? SLIDES.filter((s) => requestedIds.includes(s.id))
    : SLIDES;

const outDir = resolve("screenshots");
mkdirSync(outDir, { recursive: true });

console.log(`📸 ${basename(mockupFile)} → ${slidesToCapture.length} slides`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file://${mockupFile}`);

for (const s of slidesToCapture) {
  await page.evaluate((n) => go(n), s.id);
  await page.waitForTimeout(200);
  const path = `${outDir}/s${s.id}-${s.name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  ✓ s${s.id} ${s.name}`);
}

await browser.close();
console.log(`\n✅ Done → mockup-screenshots/`);
