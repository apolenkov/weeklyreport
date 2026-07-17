/**
 * Circular-import gate. The ESLint import-boundary zones own directional
 * rules; dependency-cruiser adds the one check ESLint cannot do — cycle
 * detection across the whole module graph. Run via `pnpm depcruise`.
 *
 * tsPreCompilationDeps stays false: only RUNTIME cycles gate (41 at
 * adoption). Type-only cycles (119 total with them) are erased by
 * compilation and tracked as burn-down, not gated.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular imports make initialization order load-bearing and break refactoring.",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: false,
    tsConfig: { fileName: "tsconfig.base.json" },
    exclude: { path: "\\.(test|spec)\\.(ts|tsx)$" },
  },
};
