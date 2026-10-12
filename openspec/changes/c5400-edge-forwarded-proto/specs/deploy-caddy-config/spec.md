## ADDED Requirements

### Requirement: The edge preserves the trusted forwarded protocol

The production Caddyfile SHALL NOT override `X-Forwarded-Proto` on proxied
requests. Caddy's forwarded-header handling SHALL supply it: the value sent by
a configured trusted proxy is preserved, otherwise it reflects whether the
client connection to Caddy used TLS.

#### Scenario: HTTPS terminated at the trusted Ingress

- **WHEN** the trusted Ingress forwards a public HTTPS request to the plain-HTTP edge with `X-Forwarded-Proto: https`
- **THEN** the api and web services receive `X-Forwarded-Proto: https`

#### Scenario: Untrusted client spoofs the protocol

- **WHEN** a peer outside the trusted proxies sends `X-Forwarded-Proto: https` over plain HTTP
- **THEN** the proxied request carries `X-Forwarded-Proto: http`
