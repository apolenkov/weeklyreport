export const PRODUCTION_DIST_MODES = ["--all", "--api", "--shared"] as const;

export type ProductionDistMode = (typeof PRODUCTION_DIST_MODES)[number];

export const isProductionDistMode = (
  value: string,
): value is ProductionDistMode =>
  (PRODUCTION_DIST_MODES as readonly string[]).includes(value);

export const checksApiRuntime = (mode: ProductionDistMode): boolean =>
  mode === "--all" || mode === "--api";

export const hasBareInternalPackageImport = (source: string): boolean =>
  source.includes("@customreport/shared") ||
  source.includes("@customreport/report-persistence");
