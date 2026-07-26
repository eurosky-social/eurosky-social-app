# Eurosky+ decoration service

Mollie subscription backend for paid profile decorations in
`src/features/avatarDecorations/`. It runs as a Bunny Edge Script, stores
subscription state in Bunny Database/libSQL, and manages membership in an
exact Bluesky subscriber list owned by the Eurosky+ atproto account.

Decoration selection never passes through this service. The app writes the
subscriber's `social.mu.deco.settings/self` record directly with that user's
session. Paid entitlement is a standard `app.bsky.graph.listitem` pointing to
the exact `DECO_SUBSCRIBER_LIST_URI`. Memberships added manually through an
ordinary Bluesky client are valid too.

## Endpoints

The three XRPC methods require an atproto service-auth JWT with this service's
DID as `aud` and the method NSID as `lxm`:

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/xrpc/social.mu.deco.getStatus` | Status plus the current plan price |
| POST | `/xrpc/social.mu.deco.createCheckout` | `{checkoutUrl}` for Mollie's hosted checkout |
| POST | `/xrpc/social.mu.deco.cancel` | Cancels renewal while preserving the paid period |

Other routes:

- `POST /mollie/webhook` - Mollie sends a payment ID as form data. The service
  re-fetches the payment with its Mollie API key before trusting anything.
- `GET /sweep` - removes service-owned memberships whose
  `paidUntil + GRACE_DAYS` has passed.
  Requires `Authorization: Bearer <SWEEP_SECRET>`.
- `GET /.well-known/did.json` - did:web service identity.
- `GET /xrpc/_health` - uptime check.

Lexicon definitions are under `lexicons/social/mu/deco/`.

## Payment and membership lifecycle

1. `createCheckout` creates or reuses a Mollie customer and first payment.
   Checkout attempts and Mollie requests use idempotency keys, so retries reuse
   an existing hosted checkout instead of charging twice.
2. Mollie calls the webhook. A paid first payment with a valid mandate creates
   the recurring subscription beginning when the first paid period ends.
3. A successful first or recurring payment advances `paidUntil` and writes an
   `app.bsky.graph.listitem` into the configured subscriber list.
4. `cancel` deletes the Mollie subscription immediately, preventing another
   charge, but keeps membership through `paidUntil`.
5. Failed, expired, canceled, or charged-back payment notifications do not
   extend entitlement. The daily sweep removes the service-owned membership
   after the grace period.

Service-created list-item rkeys are deterministic (`sub-` plus SHA-256 of the
list URI and subject DID). This makes webhook writes idempotent and permits the
same account to own separate test and production lists. The client does not rely
on that rkey: manually created list items use normal TIDs and count equally.

## Storage

The service creates these tables automatically:

- `deco_subscribers` - one row per DID with Mollie IDs, checkout state,
  `paidUntil`, service-owned list-item identity, and cancellation state.
- `deco_processed_payments` - payment IDs observed by the service for auditing
  and idempotency.

`DB_URL` and `DB_TOKEN` point to Bunny Database/libSQL. With no `DB_URL`, local
dev uses an ephemeral in-memory implementation. Production must always set a
persistent database.

## Configuration

Copy `env.example` for production or `env.test.example` for the isolated
`test.deco.mu.social` Mollie test deployment, then set the values as Bunny
environment variables/secrets.
Required production secrets are:

- `MOLLIE_API_KEY`
- `DECO_ISSUER_APP_PASSWORD`
- `DB_TOKEN`
- `SWEEP_SECRET`

Required non-secret identity settings include `DECO_ISSUER_DID`,
`DECO_ISSUER_IDENTIFIER`, `DECO_ISSUER_PDS_URL`, and the exact
`DECO_SUBSCRIBER_LIST_URI`. The app accepts exact list URIs from
`src/config/brand.json` under `decorations.subscriberListUris`. A test build can
override that array without allowing the test list in production.

`BILLING_MONTHS` supports 1 through 12. `MOLLIE_AMOUNT` must use two decimal
places. Start in Mollie test mode with a `test_...` API key.

`DEV_TRUST_DID_HEADER=1` allows local requests to identify a caller using
`x-did`. It bypasses service-auth and must never be enabled in production.

## Develop and test

Deno 2 is required:

```sh
cd services/deco
deno task check
deno lint src
deno task test
```

To run locally, load `env.example` values, use a Mollie test key, leave
`DB_URL` unset if ephemeral storage is acceptable, and then:

```sh
DEV_TRUST_DID_HEADER=1 deno task dev
```

The lifecycle test uses fake Mollie and list-membership clients. It covers checkout reuse,
first-payment activation, duplicate webhook handling, cancellation, and expiry
sweeping without contacting Mollie or a PDS.

`./scripts/emit-test-records.mjs` remains available for testing client rendering
without any payment flow.

## Deploy to Bunny

1. Create a Bunny Database and inject its URL/token into the Edge Script.
2. Create the subscriber list and an app password on the issuer account. The
   same account may own separate test and production lists; configure each
   deployment with its own exact list URI.
3. Create a Bunny Edge Script from `src/index.ts` with this directory's
   `deno.json` import map and local modules.
4. Attach `deco.mu.social` (or the configured host) and verify
   `/.well-known/did.json` resolves to the exact `SERVICE_DID`.
5. Add every setting from `env.example`; leave `DEV_TRUST_DID_HEADER` unset.
6. Configure a daily external cron request to `/sweep` with the bearer secret.
7. Test the entire lifecycle using Mollie test mode before installing a live API
   key.

Operational checks should monitor `/xrpc/_health`, failed webhook responses,
and sweep failures. Payment and subscription records contain account DIDs, so
the privacy policy and retention policy must cover this processing.
