// Values shared by more than one demo-seed module.

import { HEAD_USER_ID, SEED_USERS } from "../support/seed-constants.js";

const headUser = SEED_USERS.find((user) => user.id === HEAD_USER_ID);
if (!headUser) {
  throw new Error(`Demo seed: head user ${HEAD_USER_ID} is not in catalogue`);
}
export const HEAD_NAME = headUser.name;
