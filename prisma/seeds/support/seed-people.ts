// The 9 canonical seed identities (1 head, 1 viewer, 1 admin, 6 leads) and the
// reporting group they belong to.

import { DEFAULT_REPORTING_GROUP } from "../../../packages/shared/src/organization/default-reporting-group.js";
import type { SeedRole } from "./seed-constants.js";
import {
  ADMIN_EMAIL,
  ADMIN_USER_ID,
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_EMAIL,
  HEAD_USER_ID,
  LEAD_1_EMAIL,
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  VIEWER_EMAIL,
  VIEWER_USER_ID,
} from "./seed-identifiers.js";

export interface SeedUser {
  id: string;
  // Stored display name = surname-first ФИО composition of the parts below.
  name: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  position: string | null;
  email: string;
  role: SeedRole;
  samlId: string;
  reportingGroupId: string | null;
}

export interface SeedReportingGroup {
  id: string;
  name: string;
  description: string;
}

export const SEED_REPORTING_GROUPS: readonly SeedReportingGroup[] = [
  {
    id: DEFAULT_REPORTING_GROUP_ID,
    name: DEFAULT_REPORTING_GROUP.name,
    description: "Default reporting group for CustomReport demo users",
  },
] as const;

// Names are surname-first ФИО with real parts; `name` is the composed display
// value and the surname initials match the compact display form
// («Антон К.» → Кедров Антон …). `position` is the admin-maintained HR title.
export const SEED_USERS: readonly SeedUser[] = [
  {
    id: HEAD_USER_ID,
    email: HEAD_EMAIL,
    name: "Кедров Антон Сергеевич",
    lastName: "Кедров",
    firstName: "Антон",
    middleName: "Сергеевич",
    position: "Руководитель отдела",
    role: "head",
    samlId: "head-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: VIEWER_USER_ID,
    email: VIEWER_EMAIL,
    name: "Вязова Дарья Игоревна",
    lastName: "Вязова",
    firstName: "Дарья",
    middleName: "Игоревна",
    position: "Директор по развитию",
    role: "viewer",
    samlId: "viewer-1",
    reportingGroupId: null,
  },
  {
    id: ADMIN_USER_ID,
    email: ADMIN_EMAIL,
    name: "Берёзов Михаил Владимирович",
    lastName: "Берёзов",
    firstName: "Михаил",
    middleName: "Владимирович",
    position: "Системный администратор",
    role: "admin",
    samlId: "admin-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: LEAD_1_ID,
    email: LEAD_1_EMAIL,
    name: "Иванов Василий Петрович",
    lastName: "Иванов",
    firstName: "Василий",
    middleName: "Петрович",
    position: "Тимлид",
    role: "lead",
    samlId: "lead-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: LEAD_MARIA_ID,
    email: "maria@customreport.local",
    name: "Каштанова Мария Андреевна",
    lastName: "Каштанова",
    firstName: "Мария",
    middleName: "Андреевна",
    position: "Тимлид",
    role: "lead",
    samlId: "lead-maria",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: LEAD_IGOR_ID,
    email: "igor@customreport.local",
    name: "Ветров Игорь Олегович",
    lastName: "Ветров",
    firstName: "Игорь",
    middleName: "Олегович",
    position: "Ведущий разработчик",
    role: "lead",
    samlId: "lead-igor",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: LEAD_DMITRY_ID,
    email: "dmitry@customreport.local",
    name: "Соснов Дмитрий Максимович",
    lastName: "Соснов",
    firstName: "Дмитрий",
    middleName: "Максимович",
    position: "Тимлид",
    role: "lead",
    samlId: "lead-dmitry",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: LEAD_OLGA_ID,
    email: "olga@customreport.local",
    name: "Незабудкина Ольга Сергеевна",
    lastName: "Незабудкина",
    firstName: "Ольга",
    middleName: "Сергеевна",
    position: "Ведущий аналитик",
    role: "lead",
    samlId: "lead-olga",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: LEAD_SERGEY_ID,
    email: "sergey@customreport.local",
    name: "Тополев Сергей Дмитриевич",
    lastName: "Тополев",
    firstName: "Сергей",
    middleName: "Дмитриевич",
    position: "Тимлид",
    role: "lead",
    samlId: "lead-sergey",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
] as const;

export const LEAD_IDS = SEED_USERS.filter((u) => u.role === "lead").map(
  (u) => u.id,
);
