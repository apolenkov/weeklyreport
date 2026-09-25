import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const themeCandidates = [
  path.resolve(process.cwd(), "../../packages/ui/src/styles/theme.css"),
  path.resolve(process.cwd(), "packages/ui/src/styles/theme.css"),
];
const themePath = themeCandidates.find((candidate) => existsSync(candidate));
if (!themePath)
  throw new Error("Could not locate packages/ui/src/styles/theme.css");
const THEME = readFileSync(themePath, "utf8");

function themeColor(name: string): string {
  const match = new RegExp(String.raw`--${name}:\s*(#[0-9a-f]{6})`, "i").exec(
    THEME,
  );
  if (!match?.[1]) throw new Error(`Missing theme token --${name}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channelMatch = /^(..)(..)(..)$/.exec(hex.slice(1));
  if (!channelMatch) {
    throw new Error(`Invalid color ${hex}`);
  }
  const [, redHex, greenHex, blueHex] = channelMatch;
  if (!redHex || !greenHex || !blueHex) throw new Error(`Invalid color ${hex}`);
  const channels = [redHex, greenHex, blueHex].map(
    (channel) => Number.parseInt(channel, 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const [red, green, blue] = linear;
  if (red === undefined || green === undefined || blue === undefined)
    throw new Error(`Invalid color ${hex}`);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("analytics chart legend palette", () => {
  const surface = themeColor("color-background");

  it.each([1, 2, 3, 4, 5, 6, 7])(
    "keeps every categorical series color readable on the desktop surface (chart-%i)",
    (index) => {
      expect(
        contrastRatio(themeColor(`color-chart-${String(index)}`), surface),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
