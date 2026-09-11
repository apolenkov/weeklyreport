## Verification and implementation

- [x] Reproduce the Resolve/revocation wait cycle using independent PostgreSQL connections.
- [x] Acquire source locks before the first outcome write and preserve version/replay checks.
- [x] Verify the contention matrix, applicable outcome tests and final repository gates.
