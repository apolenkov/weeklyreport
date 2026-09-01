## 1. Refresh immutable runtime references

- [x] 1.1 Update supported service tags and digests in Compose, CI, and backup surfaces.
- [x] 1.2 Update configuration gates that deliberately pin reviewed releases.
- [x] 1.3 Apply the versioned-tag requirement to the durable specification.
- [x] 1.4 Mount Bugsink's named volume at `/data` and specify the persistence contract.
- [x] 1.5 Use Bugsink's reviewed `SINGLE_USER` setting and reject the obsolete alias.

## 2. Prove runtime compatibility

- [x] 2.1 Render every current Compose topology with documented inputs.
- [ ] 2.2 Validate PostgreSQL/pgvector, Redis, Mailpit, and PgBouncer on disposable state.
- [ ] 2.3 Validate Caddy configuration and optional overlay readiness/persistence.
- [ ] 2.4 Run repository operations, OpenSpec, Docker, and full quality gates.
