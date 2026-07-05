# Catalog — web-comp-error-boundary.tsx (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                       | Layer     | Domain    | Purpose                                                                                                                                                                                     | Key exports        | Deps                          |
| ------------------------------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------- |
| apps/web/src/components/error-boundary.tsx | component | shared-ui | Class-based React error boundary that catches render errors beneath tRPC/query-driven trees, toasts the message, logs to console, and renders a fallback alert or caller-supplied fallback. | QueryErrorBoundary | react Component, sonner toast |
