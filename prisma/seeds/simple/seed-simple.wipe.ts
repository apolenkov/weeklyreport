import type { PrismaClient } from "@prisma/client";

import { wipeSeedData } from "../support/wipe-seed-data.js";

export async function wipeExistingData(prisma: PrismaClient): Promise<void> {
  console.log("[seed-simple] Wiping existing data...");
  await wipeSeedData(prisma);
}
