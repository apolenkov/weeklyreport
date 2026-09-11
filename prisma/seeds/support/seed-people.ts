// The 9 canonical seed identities (1 head, 1 viewer, 1 admin, 6 leads) and the
// reporting group they belong to.

import { type DbRole, DEFAULT_REPORTING_GROUP } from "@customreport/shared";

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
  role: DbRole;
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
// («Антон К.» → Климов Антон …). `position` is the admin-maintained HR title.
export const SEED_USERS: readonly SeedUser[] = [
  {
    id: HEAD_USER_ID,
    email: HEAD_EMAIL,
    name: "Климов Антон Сергеевич",
    lastName: "Климов",
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
    name: "Власова Дарья Игоревна",
    lastName: "Власова",
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
    name: "Баленков Михаил Владимирович",
    lastName: "Баленков",
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
    name: "Кузнецова Мария Андреевна",
    lastName: "Кузнецова",
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
    name: "Волков Игорь Олегович",
    lastName: "Волков",
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
    name: "Соколов Дмитрий Максимович",
    lastName: "Соколов",
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
    name: "Никитина Ольга Сергеевна",
    lastName: "Никитина",
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
    name: "Тихонов Сергей Дмитриевич",
    lastName: "Тихонов",
    firstName: "Сергей",
    middleName: "Дмитриевич",
    position: "Тимлид",
    role: "lead",
    samlId: "lead-sergey",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
] as const;
