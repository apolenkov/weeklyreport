// Interaction inventory walker — for each (route × role) tuple, dumps every
// interactive DOM element + emits a JSON map and a human-readable report.
//
// Goal: make "what the user can DO" first-class, surface UI elements that are
// rendered but never tested, and feed into the side-effect coverage check.
//
// Run:
//   pnpm uat:inventory     (needs dev servers up: pnpm dev)
//
// Outputs under ~/work/customreport-archive/uat-inventory by default.

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { emit, loginAs, note, waitForAppReady } from "./helpers.mjs";

// (route, role) tuples — we only walk routes a role can actually reach.
// State variants beyond the default seed (draft / published) are intentionally
// out of scope for v1; this is per-route-per-role baseline coverage.
const TARGETS = [
  // Lead surface
  {
    route: "/lead/report",
    role: "lead",
    email: "olga@customreport.local",
    kind: "lead-form",
  },
  {
    route: "/lead/history",
    role: "lead",
    email: "olga@customreport.local",
    kind: "history",
  },
  {
    route: "/reports/history",
    role: "lead",
    email: "olga@customreport.local",
    kind: "archive",
  },

  // Head + admin (head ≡ admin in UX)
  { route: "/head/dashboard", role: "head", kind: "dashboard" },
  { route: "/head/report", role: "head", kind: "weekly" },
  { route: "/lead/report", role: "head", kind: "lead-form" },
  { route: "/lead/history", role: "head", kind: "history" },
  { route: "/reports/history", role: "head", kind: "archive" },
  { route: "/admin?tab=users", role: "head", kind: "admin" },
  { route: "/admin?tab=products", role: "head", kind: "admin" },
  { route: "/admin?tab=periods", role: "head", kind: "admin" },
  { route: "/admin?tab=reminders", role: "head", kind: "admin" },
  { route: "/admin?tab=reopen", role: "head", kind: "admin" },
  { route: "/admin?tab=settings", role: "head", kind: "admin" },
  { route: "/reports/trends", role: "head", kind: "trends" },

  // Viewer surface
  { route: "/reports/history", role: "viewer", kind: "archive" },
];

// Selector that captures every interactive node we care about. Excludes script,
// style, hidden inputs (type=hidden), and aria-hidden subtrees.
const INTERACTIVE_SELECTOR = [
  'button:not([aria-hidden="true"])',
  'a[href]:not([aria-hidden="true"])',
  '[role="button"]:not([aria-hidden="true"])',
  '[role="tab"]:not([aria-hidden="true"])',
  '[role="menuitem"]:not([aria-hidden="true"])',
  '[role="checkbox"]:not([aria-hidden="true"])',
  '[role="switch"]:not([aria-hidden="true"])',
  'input:not([type="hidden"]):not([aria-hidden="true"])',
  'select:not([aria-hidden="true"])',
  'textarea:not([aria-hidden="true"])',
  '[contenteditable="true"]',
  '[aria-haspopup="true"]:not([aria-hidden="true"])',
].join(", ");

async function dumpRoute(page, target) {
  await page.goto(`${BASE}${target.route}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await waitForAppReady(page, 12000, target.kind);

  return await page.evaluate((selector) => {
    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return true;
    }
    function shortLabel(el) {
      const aria = el.getAttribute("aria-label");
      if (aria) return aria.trim();
      const text = (el.innerText || el.textContent || "").trim().split("\n")[0];
      if (text) return text.slice(0, 80);
      const title = el.getAttribute("title");
      if (title) return title.trim();
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) return `[placeholder] ${placeholder}`;
      return "(no label)";
    }
    function classify(el) {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      const type = el.getAttribute("type");
      if (tag === "a")
        return el.getAttribute("href")?.startsWith("http")
          ? "external-link"
          : "link";
      if (tag === "button") {
        if (
          el.dataset.testid?.includes("toggle") ||
          el.getAttribute("aria-expanded") !== null
        ) {
          return "toggle";
        }
        return type === "submit" ? "submit-button" : "button";
      }
      if (role === "tab") return "tab";
      if (role === "menuitem") return "menu-item";
      if (role === "switch" || role === "checkbox") return role;
      if (tag === "input") return `input[${type || "text"}]`;
      if (tag === "select") return "select";
      if (tag === "textarea") return "textarea";
      if (el.getAttribute("contenteditable") === "true")
        return "contenteditable";
      if (el.getAttribute("aria-haspopup") === "true") return "menu-trigger";
      return tag;
    }
    const nodes = Array.from(document.querySelectorAll(selector)).filter(
      isVisible,
    );
    return nodes.map((el) => ({
      kind: classify(el),
      label: shortLabel(el),
      ariaLabel: el.getAttribute("aria-label") || null,
      testid: el.getAttribute("data-testid") || null,
      href: el.getAttribute("href") || null,
      name: el.getAttribute("name") || null,
      disabled: el.hasAttribute("disabled"),
      ariaExpanded: el.getAttribute("aria-expanded"),
    }));
  }, INTERACTIVE_SELECTOR);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const inventory = {};

  for (const target of TARGETS) {
    const key = `${target.role}::${target.route}`;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, target.role, target.email);
      const elements = await dumpRoute(page, target);
      inventory[key] = {
        role: target.role,
        route: target.route,
        elementCount: elements.length,
        elements,
      };
      emit(key, "PASS", `${elements.length} interactive nodes`);
    } catch (err) {
      inventory[key] = {
        role: target.role,
        route: target.route,
        error: err.message,
      };
      emit(key, "FAIL", err.message);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();

  const archiveRoot =
    process.env.CUSTOMREPORT_ARCHIVE_DIR ??
    path.join(homedir(), "work", "customreport-archive");
  const outputDirectory = path.join(archiveRoot, "uat-inventory");
  const outJson = path.join(outputDirectory, "inventory.json");
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(outJson, JSON.stringify(inventory, null, 2));

  // Aggregate stats per (role, route) and a flat human-readable summary.
  const lines = ["# Interaction Inventory", ""];
  lines.push(
    "| Role | Route | Buttons | Links | Inputs | Tabs | Menu items | Other | Total |",
  );
  lines.push("| --- | --- | --: | --: | --: | --: | --: | --: | --: |");
  let grandTotal = 0;
  for (const [_key, entry] of Object.entries(inventory)) {
    if (!entry.elements) {
      lines.push(
        `| ${entry.role} | ${entry.route} | — | — | — | — | — | — | (error: ${entry.error}) |`,
      );
      continue;
    }
    const counts = { button: 0, link: 0, input: 0, tab: 0, menu: 0, other: 0 };
    for (const el of entry.elements) {
      if (
        el.kind === "button" ||
        el.kind === "submit-button" ||
        el.kind === "toggle"
      )
        counts.button++;
      else if (el.kind === "link" || el.kind === "external-link") counts.link++;
      else if (
        el.kind.startsWith("input") ||
        el.kind === "select" ||
        el.kind === "textarea" ||
        el.kind === "contenteditable"
      )
        counts.input++;
      else if (el.kind === "tab") counts.tab++;
      else if (el.kind === "menu-item" || el.kind === "menu-trigger")
        counts.menu++;
      else counts.other++;
    }
    lines.push(
      `| ${entry.role} | ${entry.route} | ${counts.button} | ${counts.link} | ${counts.input} | ${counts.tab} | ${counts.menu} | ${counts.other} | ${entry.elementCount} |`,
    );
    grandTotal += entry.elementCount;
  }
  lines.push("");
  lines.push(
    `**Total interactive nodes across all (role, route) tuples: ${grandTotal}**`,
  );
  lines.push("");

  // Per-route detail blocks for spot-checking.
  for (const [_key, entry] of Object.entries(inventory)) {
    if (!entry.elements) continue;
    lines.push(
      `## ${entry.role} → \`${entry.route}\` (${entry.elementCount} nodes)`,
    );
    lines.push("");
    lines.push("| # | Kind | Label | testid | href |");
    lines.push("| --: | --- | --- | --- | --- |");
    entry.elements.forEach((el, i) => {
      lines.push(
        `| ${i + 1} | ${el.kind} | ${(el.label || "—").replace(/\|/g, "\\|")} | ${el.testid || "—"} | ${el.href || "—"} |`,
      );
    });
    lines.push("");
  }

  const outMd = path.join(outputDirectory, "inventory.md");
  writeFileSync(outMd, lines.join("\n"));

  note(`wrote ${outJson}`);
  note(`wrote ${outMd}`);
  note(`grand total: ${grandTotal} interactive nodes`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
