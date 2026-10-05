// Prints every tRPC procedure of the real app router as JSON: [{path, type}].
import { createAppRouter } from "../src/infrastructure/trpc/trpc.router.js";

const router = createAppRouter({} as never);
const procedures = router._def.procedures as unknown as Record<
  string,
  { _def: { type: string } }
>;
const list = Object.entries(procedures)
  .map(([path, p]) => ({ path, type: p._def.type }))
  .sort((a, b) => a.path.localeCompare(b.path));
process.stdout.write(`${JSON.stringify(list)}\n`);
