import pg from "pg";

export interface CompletedArtifactRow {
  readonly jobId: string;
  readonly checksum: string | null;
}

/** Minimal query surface so tests can substitute a recording client. */
export interface MigratorQueryable {
  query(text: string): Promise<{ rows: CompletedArtifactRow[] }>;
  end(): Promise<void>;
}

export interface ArtifactRowSource {
  listRows(): Promise<CompletedArtifactRow[]>;
  close(): Promise<void>;
}

export const READ_ONLY_SESSION_PIN =
  "SET SESSION default_transaction_read_only = on";

export const COMPLETED_GENERATION_ONE_SELECT =
  'SELECT "id" AS "jobId", "checksum" ' +
  'FROM "PdfExportJob" ' +
  'WHERE "status" = \'completed\' AND "generation" = 1 ' +
  'ORDER BY "id"';

export const createRowSource = (
  client: MigratorQueryable,
): ArtifactRowSource => ({
  async listRows() {
    // The pin is issued on the migrator's own session before every listing so
    // the read-only guarantee is self-contained in this source, not ambient.
    await client.query(READ_ONLY_SESSION_PIN);
    const result = await client.query(COMPLETED_GENERATION_ONE_SELECT);
    return result.rows;
  },
  close: () => client.end(),
});

export const connectReadOnlyClient = async (
  databaseUrl: string,
): Promise<pg.Client> => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
};
