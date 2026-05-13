import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const rows = await db.pdfExportJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      filePath: r.filePath,
      createdAt: r.createdAt,
    })),
  );
  await db.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
