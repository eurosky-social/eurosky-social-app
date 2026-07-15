# eurosky-oauth-worker

Bunny.net Edge Script that signs Eurosky's `private_key_jwt` OAuth
**client assertions**. It makes the Eurosky web app a *confidential* atproto
OAuth client (unlimited session lifetime + 180-day refresh tokens) without
putting the client private key in the browser.

The script (`bunny/index.ts`) runs on Bunny Edge Scripting (Deno runtime:
`BunnySDK.net.http.serve` + `Deno.env`). Crypto (`crypto.subtle`), `btoa`,
`TextEncoder`, `URL`, `JSON`, and `Date` are standard Web APIs, so the signing
code is plain Web Crypto.

It is **stateless**: no DB, no KV, no token storage. The only state is one
secret - the client private key. User tokens and DPoP keys stay in the
browser (IndexedDB).

## Two scripts: prod (pinned) vs staging/dev (wildcard subdomain)

- `bunny/index.ts` - **prod**. Pins one exact `CLIENT_ID` + `ALLOWED_ORIGIN`
  pair via env. Deployed at `oauth.mu.social`, serves only `mu.social`.
- `bunny/staging.ts` - **every non-prod environment**. Accepts any https
  SUBDOMAIN of `ALLOWED_PARENT_DOMAIN` (e.g. `*.mu.social`) and derives the
  client_id from the validated request Origin as
  `<origin>/oauth-client-metadata.json` - the exact URL each environment
  self-publishes its metadata at. Deployed at `oauth-staging.mu.social`.
  The apex is deliberately rejected, so this instance can never mint under
  prod's identity. Spinning up `v10.mu.social` needs NO OAuth change: point
  its build's `EXPO_PUBLIC_OAUTH_ASSERTION_URL` at the staging worker, done.

Both are the same strict reconstructing minter and share the same keypair
(the committed public JWKS is inlined into every build's metadata). The
security model is identical too: the Origin check is defense-in-depth, not
authentication, in both variants (any non-browser caller sets Origin freely);
PKCE + pinned redirect_uri + DPoP do the real work. The split just keeps
prod's config maximally rigid while making new dev versions free.

## What it does

`POST` `{ header, payload }` (produced by `@atproto/oauth-client` in the app)
-> validates strict invariants -> signs ES256 -> returns `{ jws }`.

It is an assertion *minter*, not a generic signing oracle. It never signs
caller-supplied JWT material: it validates the request, then reconstructs the
header and payload itself from a fixed whitelist (`alg`/`kid`/`typ`;
`iss`/`sub`/`aud`/`jti`/`iat`/`exp`). Every request must satisfy `alg=ES256`,
`iss==sub==CLIENT_ID`, `aud` is a clean `https` origin, and `jti` present. The
browser `Origin` is locked to `ALLOWED_ORIGIN` (defense-in-depth, not auth -
see the SECURITY MODEL block in `bunny/index.ts`).

`iat`/`exp` are stamped from the edge node's NTP-synced clock, not the
browser's. `@atproto/oauth-client` builds those timestamps on the client, so a
user whose device clock ran fast produced an `iat` in the future and the
authorization server rejected the assertion. Stamping them server-side removes
that whole class of clock-skew failures.

## Deploy

1. Create an Edge Script in the Bunny dashboard and paste `bunny/index.ts`
   (or wire it to this repo).
2. Attach a hostname, e.g. `oauth.<your-domain>`.
3. Set Env Configuration (script -> Env Configuration):
   - `OAUTH_PRIVATE_JWK` (**Environment SECRET**) - the PRIVATE JWK JSON
     printed by `../scripts/gen-oauth-keypair.js` (the block labelled
     "PRIVATE JWK"), on one line. Must include `kid`. Never commit it.
   - `CLIENT_ID` - exact `iss`/`sub`, e.g.
     `https://<domain>/oauth-client-metadata.json`
   - `ALLOWED_ORIGIN` - exact browser Origin, e.g. `https://<domain>`

For the staging/dev worker, deploy `bunny/staging.ts` the same way (hostname
e.g. `oauth-staging.<your-domain>`) with:

   - `OAUTH_PRIVATE_JWK` (**Environment SECRET**) - same secret as prod
   - `ALLOWED_PARENT_DOMAIN` - apex whose https subdomains are accepted,
     e.g. `mu.social` (no `CLIENT_ID`/`ALLOWED_ORIGIN` - both derive from
     the request Origin)

## Wire the app to it

The app calls `OAUTH_ASSERTION_URL` (see `../src/config/oauth.ts`). Default:
`https://oauth.mu.social/client-assertion`. Point that hostname at the Edge
Script, or set `EXPO_PUBLIC_OAUTH_ASSERTION_URL` at app build time to the
script's actual URL. The script ignores the request path (it only checks method
+ Origin), so any path under the hostname works.

Loopback/dev does NOT use this script - dev stays a public client.

## Key rotation

Generate a new keypair (`../scripts/gen-oauth-keypair.js --force`), commit the
new public JWKS, redeploy the web build (regenerates
`oauth-client-metadata.json`), and update the `OAUTH_PRIVATE_JWK` secret in the
Bunny dashboard. The shared `kid` keeps old/new distinguishable; publish both
public keys briefly for a graceful rollover.

## Test

`test.mjs` exercises the minter's guardrails (Origin lock, bad `iss`/`sub`,
non-`https`/path/query/userinfo `aud`, missing `jti`, wrong `alg`, and
injected-header/claim stripping), and verifies a returned JWS against the
committed PUBLIC JWK. It talks to the script over HTTP - no authorization server
involved - and needs no private key (the script signs server-side).

```bash
# Point it at a running instance (local Deno run, Bunny preview, or staging):
WORKER_URL=http://localhost:8000 node test.mjs
```

`CLIENT_ID` / `ALLOWED_ORIGIN` default to the `mu.social` config and can be
overridden via env to match the target instance.

`test-staging.mjs` is the equivalent suite for `bunny/staging.ts`: the same
minter guardrails plus the wildcard origin gate (subdomains accepted with
per-origin derived identities; apex, lookalike domains, http, explicit ports,
and cross-environment identities rejected). `PARENT_DOMAIN` defaults to
`mu.social`.

```bash
WORKER_URL=https://oauth-staging.mu.social node test-staging.mjs
```
