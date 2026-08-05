import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type OwnershipCatalogue,
  parseOwnershipCatalogue,
} from "./catalogue-schema.ts";

const OWNERSHIP_CATALOGUE_PATH = fileURLToPath(
  new URL("./ownership-catalogue.json", import.meta.url),
);

const readOwnershipCatalogue = (
  path = OWNERSHIP_CATALOGUE_PATH,
): OwnershipCatalogue =>
  parseOwnershipCatalogue(JSON.parse(readFileSync(path, "utf8")) as unknown);

export const OWNERSHIP_CATALOGUE = readOwnershipCatalogue();
