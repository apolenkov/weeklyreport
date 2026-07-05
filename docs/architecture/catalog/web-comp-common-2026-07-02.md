# Catalog — web-comp-common (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                                         | Layer     | Domain    | Purpose                                                                                                                        | Key exports             | Deps                            |
| ------------------------------------------------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------- |
| apps/web/src/components/common/api-readiness-placeholder.tsx | component | shared-ui | Stub 'hello world' page shown when the frontend UI is ahead of backend API readiness, linking to API health/metrics endpoints. | ApiReadinessPlaceholder | process.env.NEXT_PUBLIC_API_URL |
