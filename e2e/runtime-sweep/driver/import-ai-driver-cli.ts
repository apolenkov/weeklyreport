import { parseImportOptions } from "./import-ai-driver-options.ts";
import { importAiDriverReports } from "./import-ai-driver-report.ts";

const USAGE =
  "pnpm test:runtime-driver --report <path> [--report <path> ...] --cells <file-or-directory> --output <directory> [--verification <path>] --source-sha <sha> --profile <profile> --role <role>";

const main = async (): Promise<void> => {
  const merged = await importAiDriverReports(
    parseImportOptions(process.argv.slice(2)),
  );
  console.log(`runtime-driver PASS imported ${merged.length} cells`);
};

void main().catch((error: unknown) => {
  console.error(`[runtime-driver] Usage: ${USAGE}`);
  console.error(
    error instanceof Error
      ? error.message
      : "Unable to import AI driver report",
  );
  process.exitCode = 1;
});
