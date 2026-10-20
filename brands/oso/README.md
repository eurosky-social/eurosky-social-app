# Oso partner preview (web only)

One repository, one app: Mu stays the default. This directory holds Oso-only
inputs. The existing brand codegen still writes shared paths, so **never run the
Oso prepare script directly in the checkout**. The isolated build wrapper sets
a guard and works in a disposable tree instead.

```bash
bash scripts/build-oso-preview.sh --prepare-only  # generate/check only
bash scripts/build-oso-preview.sh                 # build web-build-oso/
```

The build uses the Oso vector favicon from `https://oso.social/favicon.svg`
(adapted to `currentColor`) and the League Spartan variable font served by
oso.social. The palette is derived from `https://oso.social/styles.css`, with
additional shades for UI contrast. The preview also scales only small/medium
body text (13.1–15px tokens) by 1.1; headings and tiny labels keep their
original sizes, and Mu remains unchanged. See `branding/oso-reference/README.md` in
the workspace for source/provenance. Before public launch get approval for the
logo/font and official brand masters. The Oso override replaces the accent
families but inherits the app's neutral and network/service defaults, and it
currently inherits **Mu's legal/support links**. That is acceptable only for
an explicitly reviewed private demonstration, not an Oso public launch.

## Deployment (not automatic)

Run `.github/workflows/deploy-web.yml` manually with the `oso-preview`
environment; it builds and uploads to Oso's own storage zone. Before running it:

1. Provision a **new** Bunny storage zone and pull zone for `oso.mu.social`;
   configure HTTPS and the SPA's 404 fallback to `/index.html`. Never attach
   this host to Mu's pull zone or reuse Mu's storage password or pull-zone ID.
2. On that pull zone, set `X-Robots-Tag: noindex, nofollow`. The build also
   ships a disallow-all `robots.txt`. No OG middleware is installed for this
   preview; home-page metadata is Oso-branded, deep links get the generic card.
3. On the `oso-preview` GitHub environment, set the secrets
   `BUNNY_STORAGE_ZONE` (full Bunny storage URL), `BUNNY_STORAGE_PASSWORD`, and
   `BUNNY_PULLZONE_ID` (see `.github/environments/README.md`). The shared
   `BUNNY_API_KEY` is used only to purge that zone after upload. DNS/TLS and these credentials are not created
   by the workflow.
4. Run the workflow manually **only after reviewing this build**. Check
   `/oauth-client-metadata.json` is publicly fetchable even if adding a preview
   access gate; OAuth servers must be able to read it. The app points its
   assertion requests at the existing shared `*.mu.social` non-production
   worker (`oauth-staging.mu.social`), which uses the public JWKS shipped by
   this repo. Verify sign-in and the PDS redirect from the Oso hostname.

### Other hosts and a dedicated OAuth endpoint

`OSO_HOST` (default `oso.mu.social`) sets the hostname the bundle is built
for: share links, `og:url`, OAuth client ID and redirect. The shared staging
assertion worker only signs for `*.mu.social`, so any other host also needs
`OSO_OAUTH_ASSERTION_URL`, pointing at Oso's own pinned instance of
`services/oauth/bunny/index.ts`. That instance signs with a dedicated key
whose public half is `brands/oso/oauth.public-jwks.json`; the build advertises
it instead of Mu's key whenever `OSO_OAUTH_ASSERTION_URL` is set.

```bash
OSO_HOST=oso-app.b-cdn.net \
  OSO_OAUTH_ASSERTION_URL=https://oso-oauth.b-cdn.net/client-assertion \
  bash scripts/build-oso-preview.sh
```

The worker's `CLIENT_ID` / `ALLOWED_ORIGIN` must match `OSO_HOST`. Check it
with `PUBLIC_JWKS=brands/oso/oauth.public-jwks.json` plus those values and
`WORKER_URL` passed to `node services/oauth/test.mjs`.

Noindex is **not** access control: until an access gate is configured, anyone
with the URL can see the preview. An access gate must exempt OAuth metadata and
allow OAuth redirects/callbacks. Do not use the wildcard worker or the inherited
Mu legal/content configuration as-is for a public release.

## Future domain

When oso.social becomes the app hostname, change the primary host, share links,
OAuth client ID and redirect URI, OG origin, DNS and edge config. Use a dedicated
pinned assertion worker. Keep old oso.mu.social shared URLs working (redirect
ordinary content) and plan for existing OAuth sessions: browser storage is
origin-specific, so users will sign in again on the new domain.
