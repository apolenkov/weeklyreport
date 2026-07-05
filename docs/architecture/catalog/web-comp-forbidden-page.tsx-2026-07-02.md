# Catalog — web-comp-forbidden-page.tsx (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                       | Layer     | Domain | Purpose                                                                                                                                                                                                      | Key exports                       | Deps                                                               |
| ------------------------------------------ | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| apps/web/src/components/forbidden-page.tsx | component | auth   | Shared 403/forbidden page rendered by route-group layouts when an SSR role check fails; intentionally omits the viewer's actual role to avoid role-enumeration, showing only required roles and a home link. | ForbiddenPage, ForbiddenPageProps | @customreport/shared Role, @customreport/ui Button/Card, next/link |
