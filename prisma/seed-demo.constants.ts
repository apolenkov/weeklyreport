// Values shared by more than one demo-seed module.

import { HEAD_USER_ID, SEED_USERS } from "./seed-constants.js";

export const HEAD_NAME =
  SEED_USERS.find((u) => u.id === HEAD_USER_ID)?.name ?? "Антон К.";

// Priority ranks are per-author: a lead's first three products get P1..P3, the
// rest stay unranked, so a slide never shows a wall of P1s.
export const MAX_RANKED_PRODUCTS = 3;
