import { checkStructuralBaseline } from "./exemplary-structure-baseline.ts";
import { parseStructuralInventoryArgs } from "./exemplary-structure-contract.ts";
import { checkStructuralFinal } from "./exemplary-structure-final.ts";
import { measureStructuralInventory } from "./exemplary-structure-inventory.ts";

const args = process.argv.slice(2);
const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
const result =
  normalizedArgs.length === 1 && normalizedArgs[0] === "--check-baseline"
    ? await checkStructuralBaseline()
    : normalizedArgs.length === 1 && normalizedArgs[0] === "--check-final"
      ? await checkStructuralFinal()
      : await measureStructuralInventory(parseStructuralInventoryArgs(args));
process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
