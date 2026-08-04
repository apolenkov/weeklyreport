import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function readPackageStyleSource(): string {
  const styleDirectory = path.resolve(
    process.cwd(),
    "../../packages/ui/src/styles",
  );
  return readdirSync(styleDirectory)
    .filter((file) => file.endsWith(".css"))
    .toSorted((left, right) => left.localeCompare(right))
    .map((file) => readFileSync(path.join(styleDirectory, file), "utf8"))
    .join("\n");
}
