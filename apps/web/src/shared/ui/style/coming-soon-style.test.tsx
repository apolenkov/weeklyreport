// @vitest-environment jsdom
// Portal-based tooltip coverage keeps the canonical badge and shared wrapper
// while guarding against bespoke pill markup.

import "@testing-library/jest-dom/vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import {
  ComingSoonControl,
  ComingSoonIconButton,
} from "@customreport/ui/components/coming-soon-control";
import { fireEvent, render, screen } from "@testing-library/react";
import { History } from "lucide-react";
import { describe, expect, it } from "vitest";

import { VersionComingSoonControl } from "../../../features/admin/ui/version-coming-soon";
import { PdfExportComingSoonControl } from "../../../features/pdf-export/ui/pdf-export-coming-soon";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";

const CANONICAL_BG = "bg-coming-soon";
const CANONICAL_FG = "text-coming-soon-foreground";

describe("ComingSoonBadge — single canonical style", () => {
  it("the primitive renders the canonical amber tokens + data-state", () => {
    render(<ComingSoonBadge />);
    const badge = screen.getByText("Coming Soon");
    expect(badge).toHaveAttribute("data-state", "coming-soon");
    expect(badge).toHaveClass(CANONICAL_BG, CANONICAL_FG);
  });
});

describe("shared coming-soon primitive owns the inert button chrome", () => {
  // Button controls compose this primitive — chrome is asserted once here.
  const INERT_CLASSES = [
    "cursor-default",
    "border-[var(--color-border)]",
    "bg-[var(--color-surface-empty)]",
    "text-[var(--color-muted-foreground)]",
  ];

  it("icon-only toolbar shape carries the inert chrome + square geometry", () => {
    render(
      <ComingSoonIconButton
        icon={History}
        shape="toolbar"
        ariaLabel="Version history is coming soon"
        testId="primitive-toolbar"
      />,
    );
    const button = screen.getByTestId("primitive-toolbar");
    expect(button).toHaveClass(...INERT_CLASSES);
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "w-[var(--toolbar-control-h)]",
      "shrink-0",
      "rounded-full",
    );
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).not.toHaveAttribute("title");
    // Fixed-size lucide icon slot, aria-hidden so it adds no accessible name.
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("icon-only nav shape carries the inert chrome + pill geometry", () => {
    render(
      <ComingSoonIconButton
        icon={History}
        shape="nav"
        ariaLabel="Language selection is coming soon"
        testId="primitive-nav"
      />,
    );
    const button = screen.getByTestId("primitive-nav");
    expect(button).toHaveClass(...INERT_CLASSES);
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "min-w-[var(--toolbar-control-h)]",
      "w-10",
      "px-0",
      "rounded-[var(--radius-pill)]",
    );
  });

  it("labelled variant renders its label and default touch-target geometry", () => {
    render(
      <ComingSoonControl
        icon={History}
        label="Agent review"
        ariaLabel="Agent review is coming soon"
        testId="primitive-labelled"
      />,
    );
    const button = screen.getByTestId("primitive-labelled");
    expect(button).toHaveClass(...INERT_CLASSES);
    expect(button).toHaveClass(
      "min-h-[var(--touch-target-min)]",
      "px-4",
      "py-1.5",
      "text-sm",
      "rounded-[var(--radius-pill)]",
    );
    expect(button).toHaveTextContent("Agent review");
  });

  it("labelled compact variant swaps to the toolbar-height geometry", () => {
    render(
      <ComingSoonControl
        icon={History}
        label="Agent review"
        ariaLabel="Agent review is coming soon"
        testId="primitive-compact"
        compact
      />,
    );
    const button = screen.getByTestId("primitive-compact");
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "px-2.5",
      "text-xs",
    );
    expect(button).not.toHaveClass("min-h-[var(--touch-target-min)]");
  });

  it("opens the amber ComingSoonBadge through the Radix portal on focus", async () => {
    render(
      <ComingSoonIconButton
        icon={History}
        shape="toolbar"
        ariaLabel="Version history is coming soon"
        testId="primitive-portal"
      />,
    );
    expect(document.querySelector('[data-state="coming-soon"]')).toBeNull();

    fireEvent.focus(screen.getByTestId("primitive-portal"));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveAccessibleName("Coming Soon");
    const content = document.querySelector('[data-slot="tooltip-content"]');
    const badge = content?.querySelector('[data-state="coming-soon"]');
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains(CANONICAL_BG)).toBe(true);
    expect(badge?.classList.contains(CANONICAL_FG)).toBe(true);
  });
});

describe("Coming-Soon controls render the amber badge through the Radix portal", () => {
  const controls = [
    {
      label: "agent-review",
      node: <AgentReviewComingSoon />,
      testid: "agent-review-coming-soon",
    },
    {
      label: "pdf-export",
      node: <PdfExportComingSoonControl />,
      testid: "lead-pdf-export-coming-soon",
    },
    {
      label: "version",
      node: <VersionComingSoonControl />,
      testid: "version-coming-soon",
    },
  ];

  it.each(controls)(
    "$label: focus opens a portaled amber ComingSoonBadge (no second colour variant)",
    async ({ node, testid }) => {
      render(node);
      // Portaled: no badge is in the DOM before the control is interacted with.
      expect(document.querySelector('[data-state="coming-soon"]')).toBeNull();

      fireEvent.focus(screen.getByTestId(testid));

      await screen.findByRole("tooltip");
      const content = document.querySelector('[data-slot="tooltip-content"]');
      expect(content).not.toBeNull();
      expect(screen.getByRole("tooltip")).toHaveAccessibleName("Coming Soon");
      const badge = content?.querySelector('[data-state="coming-soon"]');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains(CANONICAL_BG)).toBe(true);
      expect(badge?.classList.contains(CANONICAL_FG)).toBe(true);
      // The chromeless content must NOT fall back to the Radix dark surface.
      expect(content?.classList.contains("bg-foreground")).toBe(false);
    },
  );

  it.each(controls)(
    "$label: the control keeps its label and exposes the semantic tooltip description",
    async ({ node, testid }) => {
      render(node);
      const control = screen.getByTestId(testid);
      fireEvent.focus(control);
      await screen.findByRole("tooltip");
      expect(control).toHaveAccessibleName(/coming soon/i);
      expect(control).toHaveAccessibleDescription("Coming Soon");
    },
  );
});

describe("every tooltip control uses the shared Radix wrapper (source scan)", () => {
  // Holidays keeps its own inert-span (nested-button validity); other controls
  // compose the shared primitive and are covered by its unit tests.
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const TOOLTIP_CONTROL_FILES = ["../../../features/admin/ui/settings-tab.tsx"];

  it("each control uses ComingSoonTooltip and dropped the retired CSS anchor", () => {
    for (const rel of TOOLTIP_CONTROL_FILES) {
      const source = readFileSync(path.join(componentsRoot, rel), "utf8");
      expect(source).toContain("ComingSoonTooltip");
      expect(source).not.toContain("COMING_SOON_TOOLTIP_ANCHOR");
      expect(source).not.toContain("absolute right-0");
    }
  });

  it("the holidays tab keeps a persistent ComingSoonBadge for its accessible name", () => {
    // The Radix tooltip badge is portaled (hover-only), so the holidays span
    // carries a PERSISTENT (sr-only) ComingSoonBadge — the tab's accessible name
    // still announces the coming-soon state without adding an aria-label.
    const source = readFileSync(
      path.join(componentsRoot, "../../../features/admin/ui/settings-tab.tsx"),
      "utf8",
    );
    expect(source).toContain("ComingSoonBadge");
    expect(source).toContain("sr-only");
  });
});

describe("every inert Coming Soon control — no stacked native title", () => {
  // Native `title` stacks a second browser tooltip over the amber badge.
  // Shared primitive already forbids it; scan remaining hand-rolled controls.
  const componentsRoot = path.dirname(fileURLToPath(import.meta.url));
  const INERT_CONTROL_FILES = ["../../../features/admin/ui/settings-tab.tsx"];

  it("no inert control source carries title=Coming Soon", () => {
    const violations = INERT_CONTROL_FILES.filter((rel) =>
      readFileSync(path.join(componentsRoot, rel), "utf8").includes(
        'title="Coming Soon"',
      ),
    );
    expect(violations).toEqual([]);
  });
});

describe("deferred-feature-pattern — no bespoke 'Coming Soon' pill", () => {
  // The literal "Coming Soon" may appear ONLY as: the primitive's rendered
  // text, a native title="Coming Soon" attribute, or a comment. Any other
  // rendered occurrence is a bespoke pill that bypasses the shared primitive.
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../../",
  );
  const SCAN_ROOTS = [
    path.join(repoRoot, "apps/web/src"),
    path.join(repoRoot, "packages/ui/src"),
  ];
  const PRIMITIVE = "coming-soon-badge.tsx";

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      if (!/\.tsx?$/.test(entry)) return [];
      if (/\.(test|spec)\.tsx?$/.test(entry)) return [];
      if (entry === PRIMITIVE) return [];
      return [full];
    });
  }

  function bespokeOccurrences(file: string): number[] {
    const lines = readFileSync(file, "utf8").split("\n");
    return lines.flatMap((line, i) => {
      if (!line.includes("Coming Soon")) return [];
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("{/*");
      if (isComment) return [];
      // Strip allowed attribute carriers, then see if any text remains.
      const stripped = line
        .replaceAll('title="Coming Soon"', "")
        .replaceAll(/aria-label="[^"]*"/gi, "");
      return stripped.includes("Coming Soon") ? [i + 1] : [];
    });
  }

  it("no source file renders 'Coming Soon' text outside the shared primitive", () => {
    const violations = SCAN_ROOTS.flatMap(sourceFiles).flatMap((file) =>
      bespokeOccurrences(file).map((line) => `${file}:${line}`),
    );
    expect(violations).toEqual([]);
  });
});
