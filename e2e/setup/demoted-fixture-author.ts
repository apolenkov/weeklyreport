import assert from "node:assert/strict";

import pg from "pg";

import { LEAD_FORM_FIXTURE } from "./fixture-data.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

/** Changes only the synthetic fixture author's role, preserving its session and section ownership. */
export async function withDemotedFixtureAuthor(
  verify: () => Promise<void>,
): Promise<void> {
  const target = validateE2eRuntimeTarget("e2e-demote-fixture-author");
  const url = new URL(target.e2eDatabaseUrl);
  console.log({
    host: url.hostname,
    database: url.pathname,
    redisDb: target.redisDb,
  });
  const pool = new pg.Pool({ connectionString: target.e2eDatabaseUrl });
  try {
    const changed = await pool.query(
      "UPDATE \"User\" SET role = 'viewer' WHERE id = $1 AND role = 'lead' AND \"isActive\" = true RETURNING id",
      [LEAD_FORM_FIXTURE.leadId],
    );
    assert.equal(
      changed.rowCount,
      1,
      "Expected one active synthetic Lead before demotion",
    );
    try {
      await verify();
    } finally {
      validateE2eRuntimeTarget("e2e-restore-fixture-author");
      const restored = await pool.query(
        "UPDATE \"User\" SET role = 'lead' WHERE id = $1 AND role = 'viewer' AND \"isActive\" = true RETURNING id",
        [LEAD_FORM_FIXTURE.leadId],
      );
      assert.equal(
        restored.rowCount,
        1,
        "Expected the demoted synthetic author to be restored",
      );
    }
  } finally {
    await pool.end();
  }
}
