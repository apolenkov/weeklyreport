import "dotenv/config";

import { defineConfig, env } from "prisma/config";

interface Env {
  DATABASE_URL: string;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm --dir apps/api exec tsx ../../prisma/seed-profile.ts full",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
