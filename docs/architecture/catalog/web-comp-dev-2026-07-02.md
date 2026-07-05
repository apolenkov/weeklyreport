# Catalog — web-comp-dev (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                          | Layer     | Domain | Purpose                                                                                                                                                         | Key exports     | Deps                                                                  |
| --------------------------------------------- | --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| apps/web/src/components/dev/role-switcher.tsx | component | auth   | Dev-only dropdown (gated by env flags) to switch the logged-in role/user via dev-login, log out, and (admin-only) trigger wipe-and-reseed of dev data variants. | DevRoleSwitcher | trpc.dev.listUsers/wipeAndReseed, trpc.auth.me, next dropdown-menu UI |
