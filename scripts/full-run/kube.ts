import { execFileSync } from "node:child_process";

import { LOG_BUFFER_BYTES, MAX_BUFFER_BYTES } from "./constants.ts";

const KUBECTL = process.env.KUBECTL_BIN ?? "kubectl";
const NAMESPACE = process.env.NS ?? "wr-tester";
const POSTGRES_LOG = "/var/lib/postgresql/data/pgdata/log/wr-run.log";

/** Runs SQL on the stand's Postgres through psql in the pod; returns tuples only. */
export function psql(sql: string): string {
  return execFileSync(
    KUBECTL,
    ["-n", NAMESPACE, "exec", "-i", "postgres-0", "--"].concat([
      "psql",
      "-U",
      "weeklyreport",
      "-d",
      "weeklyreport_e2e",
      "-At",
      "-q",
    ]),
    { input: sql, encoding: "utf8", maxBuffer: MAX_BUFFER_BYTES },
  );
}

/** The statement log of the run (log_statement=all). */
export function postgresLog(): string {
  return execFileSync(
    KUBECTL,
    ["-n", NAMESPACE, "exec", "postgres-0", "--", "cat", POSTGRES_LOG],
    { encoding: "utf8", maxBuffer: LOG_BUFFER_BYTES },
  );
}
