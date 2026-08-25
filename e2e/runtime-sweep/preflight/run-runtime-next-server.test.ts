import { expect, test } from "vitest";

import { runtimeNextChildArguments } from "./run-runtime-next-server.ts";

test("uses the repository's webpack runtime boundary", () => {
  expect(
    runtimeNextChildArguments("/repo/node_modules/next/dist/bin/next", 33_105),
  ).toEqual([
    "/repo/node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "-p",
    "33105",
  ]);
});
