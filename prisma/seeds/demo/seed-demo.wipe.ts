import type { PrismaClient } from "@prisma/client";

import { wipeSeedData } from "../support/wipe-seed-data.js";

export async function wipe(prisma: PrismaClient): Promise<void> {
  console.log("[seed-demo] Wiping existing data...");
  await wipeSeedData(prisma);
}
