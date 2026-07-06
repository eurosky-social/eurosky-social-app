# deco - Eurosky+ subscription service

Backend for paid avatar decorations (`src/features/avatarDecorations/`).
Architecture and phase plan: `DECORATIONS_PLAN.md` in the workspace root.

## Status

Phase 1: only `scripts/emit-test-records.mjs` exists, for hand-writing test
records so the client read path can be exercised before this service is
built.

## Planned shape (phase 2)

Bunny Edge Script (like `services/geolocation` and `services/og`), cloning
the mu-age-service patterns: `@atcute/xrpc-server` router, atproto
service-auth JWT verification (aud = this service's did:web, per-method lxm,
with the 3900s maxAge allowance for OAuth-session tokens), Bunny SQLite via
`@libsql/client/web` with an in-memory dev fallback.

- XRPC `social.mu.deco.getStatus` - subscription state for the caller
- XRPC `social.mu.deco.createCheckout` - Mollie customer + first
  payment (mandate), returns hosted-checkout URL
- XRPC `social.mu.deco.cancel` - cancel at period end
- `POST /mollie/webhook` - plain HTTP; Mollie sends only an object id, so
  authenticity = re-fetch from the Mollie API. Paid first payment => create
  subscription + `putRecord` a `social.mu.deco.grant` from the issuer
  account; recurring paid => extend; failures => let expire.
- `GET /sweep` (secret token, external cron ping) - delete grants past
  `paid_until` + grace.

Frame *selection* never goes through this service - the app writes the
user's `social.mu.deco.settings` self-record with their own session.
This service only ever touches grant records in the issuer account's repo.
