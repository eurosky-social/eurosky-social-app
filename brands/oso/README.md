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

Run `.github/workflows/deploy-web.yml` manually from the `oso` branch with the
`oso` environment; it builds for `oso.social` and uploads to Oso's own storage
zone. Before running it:

1. Point `oso.social` at a **dedicated** Bunny pull zone with HTTPS and the
   SPA's 404 fallback to `/index.html`. Never attach this host to Mu's pull
   zone or reuse Mu's storage password or pull-zone ID.
2. On that pull zone, set `X-Robots-Tag: noindex, nofollow`. The build also
   ships a disallow-all `robots.txt`. No OG middleware is installed for this
   preview; home-page metadata is Oso-branded, deep links get the generic card.
3. On the `oso` GitHub environment, set `BUNNY_STORAGE_ZONE` (full Bunny
   storage URL), `BUNNY_STORAGE_PASSWORD`, `BUNNY_PULLZONE_ID` and
   `BUNNY_API_KEY` (see `.github/environments/README.md`). DNS/TLS and these
   credentials are not created by the workflow.
4. Configure the assertion worker at `oauth.oso.social` (below) for this host.
5. Run the workflow manually **only after reviewing this build**. Check
   `/oauth-client-metadata.json` is publicly fetchable even if adding a preview
   access gate; OAuth servers must be able to read it. Verify sign-in and the
   PDS redirect from `oso.social`.

## OAuth

The bundle is a confidential atproto OAuth client whose client ID is
`https://<OSO_HOST>/oauth-client-metadata.json`. Client assertions come from
Oso's own pinned instance of `services/oauth/bunny/index.ts` at
`https://oauth.oso.social/client-assertion`, which signs with a dedicated key
whose public half is `brands/oso/oauth.public-jwks.json`; the build advertises
that key instead of Mu's. On that worker set:

- `CLIENT_ID=https://oso.social/oauth-client-metadata.json`
- `ALLOWED_ORIGIN=https://oso.social`

Check it with `PUBLIC_JWKS=brands/oso/oauth.public-jwks.json` plus those values
and `WORKER_URL` passed to `node services/oauth/test.mjs`.

### Other hosts

`OSO_HOST` (default `oso.social`) sets the hostname the bundle is built for:
share links, `og:url`, OAuth client ID and redirect. `OSO_OAUTH_ASSERTION_URL`
(default `https://oauth.oso.social/client-assertion`) sets the worker, whose
`CLIENT_ID` / `ALLOWED_ORIGIN` must match the host. A `*.mu.social` host can
instead use Mu's shared staging worker, and the build then keeps Mu's key:

```bash
OSO_HOST=oso.mu.social \
  OSO_OAUTH_ASSERTION_URL=https://oauth-staging.mu.social/client-assertion \
  bash scripts/build-oso-preview.sh
```

Noindex is **not** access control: until an access gate is configured, anyone
with the URL can see the preview. An access gate must exempt OAuth metadata and
allow OAuth redirects/callbacks. Do not use the inherited Mu legal/content
configuration as-is for a public release.

## Moving from oso.mu.social

Keep old oso.mu.social shared URLs working (redirect ordinary content to
oso.social) and expect existing sessions to end: browser storage is
origin-specific, so users sign in again on the new domain.
