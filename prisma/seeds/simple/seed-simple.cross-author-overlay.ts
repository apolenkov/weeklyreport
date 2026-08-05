import type { PrismaClient } from "@prisma/client";

import { seedBorisOverlay } from "./seed-simple.overlay-boris.js";
import { seedGalinaOverlay } from "./seed-simple.overlay-galina.js";
import { seedVictorOverlay } from "./seed-simple.overlay-victor.js";

// Boris (Planning), Victor (Analysis) and Galina (Design) each add a full
// five-section spread to their own ACTIVE section on PROD_CRM, so opening
// Vasily's /lead/report shows all three merged inline behind the owner lock.
export async function seedCrossAuthorOverlay(
  prisma: PrismaClient,
): Promise<void> {
  await seedBorisOverlay(prisma);
  await seedVictorOverlay(prisma);
  await seedGalinaOverlay(prisma);
}
