# Catalog — web-comp-auth (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                     | Layer     | Domain | Purpose                                                                                                                                                                                                  | Key exports | Deps                                     |
| ---------------------------------------- | --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------- |
| apps/web/src/components/auth/if-role.tsx | component | auth   | Declarative role-guard wrapper that renders children only if the current session's role matches (or is in) the given role(s), based on the auth.me query; renders nothing while loading or unauthorized. | IfRole      | useTRPC (trpc.auth.me), shared Role type |
