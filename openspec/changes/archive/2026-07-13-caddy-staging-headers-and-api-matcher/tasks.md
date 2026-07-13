## 1. Staging header parity

- [ ] 1.1 `deploy/caddy/Caddyfile.staging`: add `Strict-Transport-Security
"max-age=31536000; includeSubDomains; preload"` to the `header` block
      (lines 56-61), matching the prod `Caddyfile:63` directive verbatim
- [ ] 1.2 `deploy/caddy/Caddyfile.staging`: add `Content-Security-Policy-Report-Only
"default-src 'self'; img-src 'self' data:; style-src 'self'
'unsafe-inline'; connect-src 'self'"` to the same block, matching the
      prod `Caddyfile:70` directive verbatim, including the `TODO` comment
      about the enforcing flip

## 2. `@api` matcher `/api` prefix (both files)

- [ ] 2.1 `deploy/caddy/Caddyfile`: add `/api /api/*` to the `@api` path list
      (line 34)
- [ ] 2.2 `deploy/caddy/Caddyfile.staging`: add `/api /api/*` to the `@api`
      path list (line 32)
- [ ] 2.3 Update the routing comment block at the top of `deploy/caddy/Caddyfile`
      (lines 8-10) to list `/api/*` alongside the other API-routed prefixes

## 3. Spec delta

- [ ] 3.1 `deploy-caddy-config`: ADD a requirement that staging and prod
      Caddyfiles carry matching security-header floors
- [ ] 3.2 `deploy-caddy-config`: ADD a requirement that the `@api` matcher in
      both Caddyfiles routes `/api/*` directly to the api container

## 4. Verification

- [ ] 4.1 `caddy fmt --overwrite deploy/caddy/Caddyfile deploy/caddy/Caddyfile.staging`
- [ ] 4.2 `docker run --rm -v $(pwd)/deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile`
- [ ] 4.3 `docker run --rm -v $(pwd)/deploy/caddy/Caddyfile.staging:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile`
- [ ] 4.4 `diff <(grep -A6 '^\s*header {' deploy/caddy/Caddyfile) <(grep -A6 '^\s*header {' deploy/caddy/Caddyfile.staging)` — manually confirm HSTS and CSP lines now appear in both (the two `header` blocks are not byte-identical; `-Server` and header ordering are expected to differ)
- [ ] 4.5 `openspec validate caddy-staging-headers-and-api-matcher --strict`
- [ ] 4.6 Adversarial review of the diff before archiving
