# Tasks

- [x] 1. Spec delta for `deploy-caddy-config`.
- [x] 2. Static test: no `header_up X-Forwarded-Proto` in the Caddyfile.
- [x] 3. Delete the override in both proxied sites.
- [ ] 4. Native check: real Caddy (pinned image) with a trusted and an untrusted peer.
- [ ] 5. Native check: HTTPS request through the Ingress and `next start` redirects to `https://`.
- [ ] 6. `helm template` and `helm lint` with `values.production.example.yaml`.
