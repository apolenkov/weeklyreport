# Tasks

Backlog: TASK-825 (notes).

- [x] 1. Test first: the dev action reseeds a disposable target without server-wide consent and leaves the API process environment unchanged (failed before the change).
- [x] 2. Test: a non-allowlisted target is still refused before any child process.
- [x] 3. `wipeAndReseed` passes the consent only to its guard check and reset/seed children.
- [ ] 4. Six gates on the delivered tree; stand check of the role-switcher "Wipe + reseed".
- [ ] 5. Archive after acceptance.
