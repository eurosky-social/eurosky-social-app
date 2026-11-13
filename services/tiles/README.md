# Tile blob CDN

Bunny.net Edge Script that serves the resources of DASL web tiles (see
`src/features/tiles/README.md`) from the edge instead of from each author's
PDS.

## Why it matters

A tile is a bundle of blobs on its author's PDS, and the web loader fetches
every one of them when the tile runs. Without this service each viewer's
browser does that against the PDS directly (`com.atproto.sync.getBlob`), so a
popular tile hammers its author's host, and a PDS that rate-limits or goes
away takes the tile with it. The card thumbnail already rides `cdn.bsky.app`;
this does the same for the tile itself.

## How it works

`GET /blob/<did>/<cid>`:

1. checks the DID (`did:plc` or `did:web`) and the CID (base32 CIDv1) by shape;
2. resolves the DID to its PDS from its DID document (the PLC directory, or the
   `did:web` host), remembered for `DID_TTL` seconds;
3. passes `getBlob` through, following redirects hop by hop (the bsky.social
   entryway answers with one to the account's host), https on public names
   only, since the host comes from a document anyone can write;
4. streams the body back under `*` CORS and the inert headers the reference
   PDS itself sends (`Content-Disposition: attachment`, a sandboxed CSP,
   `nosniff`, `X-Frame-Options: DENY`), with
   `Cache-Control: public, max-age=31536000, immutable` and the CID as `ETag`.

A CID names its bytes for good, so the script stores each blob in the edge
cache (the Cache API) as it streams it, and answers from there afterwards. A missing blob is a 404 cached
for `ERROR_SECONDS`; a PDS error is a 502, a rate limit a 503, neither cached.
Bodies above `MAX_BLOB_BYTES` are refused (413 when the PDS states the length,
a failed stream otherwise). A blob missing on a PDS remembered for over a
minute makes the script resolve the DID afresh, in case the account moved.

The app points `EXPO_PUBLIC_TILES_BLOB_URL` at this host, and
`tileBlobUrl` (`src/features/tiles/manifest.ts`) builds the `/blob/` URLs;
empty, the app fetches from the PDS as before. The native apps do not use it:
the hosted page they run tiles in (`@dasl/tile-host`) fetches from the PDS
itself.

## The switch

`policy.mjs` is not part of the CDN: it pauses or resumes tile playback for
everyone by writing the `social.mu.tiles.policy` record in the brand's admin
repo (`src/features/tiles/policy.ts` reads it; see the tiles README). Open
apps notice within a minute, with no release.

```bash
node services/tiles/policy.mjs status
HANDLE=eurosky.social APP_PASSWORD=xxxx-xxxx-xxxx-xxxx node services/tiles/policy.mjs pause "Tiles are paused while we look into a problem."
HANDLE=eurosky.social APP_PASSWORD=xxxx-xxxx-xxxx-xxxx node services/tiles/policy.mjs resume
```

`HANDLE` defaults to the creator of the trusted-verifier list in
`src/config/brand.json`; an app password of that account is enough. The
message is shown on every tile card while paused.

## Local run

```bash
deno run --allow-net --allow-env services/tiles/bunny/index.ts   # 127.0.0.1:8080
node services/tiles/test.mjs http://127.0.0.1:8080
```

The SDK listens on 8080 when run outside Bunny (no port setting). The test
fetches a real blob of @berjon.com on eurosky.social, checks the bytes against
the CID and the headers, and walks the error cases. Point it at a deployment
to check that too.

## Deploy

1. Create a standalone Edge Script in the Bunny dashboard and paste
   `bunny/index.ts`, on its own pull zone and hostname, e.g.
   `tiles.<your-domain>`.
2. Caching is the point, and the pull zone does not do it: Bunny does not
   cache what a standalone script answers and rewrites its `Cache-Control` to
   `no-cache` (seen on tiles.mu.social and rss.mu.social, 2026-11-13, with the
   zone on "Respect origin Cache-Control"). The script therefore keeps blobs
   itself through the Edge Scripting Cache API (`caches`, entries of up to
   100 MB, kept per region) and reports `X-Tile-Cache: HIT` or `MISS`. The one
   zone setting that matters: **Cache expiration time** must not be
   "Override: do not cache", which silently turns the Cache API off. Leave
   **Run script before cache** off.
3. Env Configuration, all optional:
   - `ALLOWED_ORIGIN`: `Access-Control-Allow-Origin` (default `*`; the blobs
     are public, and the demo origins fetch them too).
   - `PLC_URL`: the PLC directory (default `https://plc.directory`).
   - `MAX_BLOB_BYTES`: largest blob served (default 52428800, 50 MiB).
   - `DID_TTL`: seconds to remember a DID's PDS (default 3600).
   - `CACHE_SECONDS`: a blob's cache TTL (default 31536000).
   - `ERROR_SECONDS`: a missing blob's cache TTL (default 60).
4. Set `EXPO_PUBLIC_TILES_BLOB_URL=https://tiles.<your-domain>` in the web
   build (the demo build script takes `TILES_BLOB_URL`).

## Verify

```bash
node services/tiles/test.mjs https://tiles.<your-domain>
curl -sI https://tiles.<your-domain>/blob/did:plc:izttpdp3l6vss5crelt5kcux/bafkreihdadacrx6zowligm4yqvvdnili6oiyvjbmhtiqj6bb5ug54t3dcy
```

Run the `curl` twice: the second answer should say `X-Tile-Cache: HIT` (the
zone's own `CDN-Cache` stays `MISS`, and `Cache-Control` reads `no-cache`,
both Bunny's doing). The test checks the same thing. Because of that
rewritten header browsers do not keep blobs themselves; each play asks the
edge, which answers from its cache without touching the PDS.

## Limits

- Bunny documents no response size limit, only 128 MB of memory per isolate;
  the body is streamed, not buffered, and `MAX_BLOB_BYTES` keeps a tile from
  pulling anything huge through.
- Range requests are not supported: tiles fetch whole resources.
- `did:web` DIDs with a port (`%3A`) or path segments resolve, but have not
  been exercised against a live account.
