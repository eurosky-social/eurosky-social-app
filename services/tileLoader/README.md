# Tile loading server

Bunny.net Edge Script that gives every DASL web tile (see
`src/features/tiles/README.md`) a throwaway origin to run on. It is
[`@dasl/tile-server`](https://www.npmjs.com/package/@dasl/tile-server) as one
edge script, so mu no longer depends on `load.webtil.es`.

## What it does

- `load.<BASE_HOST>` answers every request with a 303 to a fresh
  `<20 random letters>.<BASE_HOST>`, same path: each load gets its own origin,
  cross-origin from mu and from every other tile.
- On such a tile origin it serves the loader runtime (the shuttle page, its
  scripts and the service worker) under `/.well-known/web-tiles/`, with the
  runtime policy from `@dasl/tile-lexicon`. Every other path there is a dead
  end: a 404 that loads nothing, runs nothing and cannot be framed.
- Any other name gets a 404. Only names of the shape it mints are tile
  origins, so the runtime and its worker never land on another subdomain.

It never sees tile content: the page embedding the tile hands the resources
to the worker (through the blob CDN, `services/tiles`).

## Files

- `bunny/index.ts`: the script to paste. **Generated**: the runtime files and
  the policy headers are inlined from `node_modules`.
- `template.ts`: its source. Edit this, not the generated file.
- `build.mjs`: `node services/tileLoader/build.mjs` regenerates the script;
  `--check` fails if it is stale. Rerun after bumping `@dasl/tile-server` or
  `@dasl/tile-lexicon`, and redeploy: the runtime served here has to be the
  one the app's `@dasl/tile-loader` expects.
- `test.mjs`: checks a running instance against the packages (redirect,
  byte-identical runtime, policy headers, dead ends, non-tile names).

## Local run

```bash
BASE_HOST=localhost deno run --allow-net --allow-env services/tileLoader/bunny/index.ts
node services/tileLoader/test.mjs http://localhost:8080 localhost
```

A tile does not actually render through a plain-http `*.localhost` loader in
a browser (the reference `tiles-loading-server` behaves the same), so the
local check is parity with the reference; a real tile is checked once
deployed.

## Deploy

`BASE_HOST` defaults to `mu.social`: the load domain is `load.mu.social` and
tile origins are `<random>.mu.social`.

1. Bunny dashboard: Edge Scripting, add a **standalone** script, paste
   `bunny/index.ts`, deploy. Leave "Run script before cache" off. No env is
   needed for mu.social.
2. On the script's pull zone, add two hostnames: `load.mu.social` and the
   wildcard `*.mu.social`, with SSL on both (the wildcard certificate is
   issued through Bunny DNS, which hosts mu.social).
3. DNS (Bunny DNS, zone mu.social):
   - `load` CNAME to the script's pull zone (`<zone>.b-cdn.net`).
   - `*` CNAME to the same zone. **There is a wildcard record today**: it
     sends every unknown subdomain to a redirect to portal.eurosky.tech.
     Pointing it here replaces that: unknown names then get this script's
     404. Named records (`tiles`, `rss`, `ip`, `staging`, ...) are untouched,
     since an exact record wins over the wildcard.
4. Check it, then switch the app over:

```bash
node services/tileLoader/test.mjs https://mu.social mu.social
```

   then uncomment `EXPO_PUBLIC_TILES_LOAD_DOMAIN=load.mu.social` in
   `.github/environments/common.env` (and pass `TILES_LOAD_DOMAIN` to the demo
   build), and play a tile.

## Things to know

- **Same site as the app.** Tile origins under `mu.social` are cross-origin
  from the app but same-site with it and with every other `*.mu.social`
  service: a cookie set for `Domain=mu.social` would reach them, and browsers
  isolate processes by site, not origin. The tile policy blocks a tile's
  network access either way. A separate registrable domain (as `webtil.es`
  is) is the stricter choice; `BASE_HOST` makes that a configuration change.
  A nested base such as `t.mu.social` (`load.t.mu.social`, `*.t.mu.social`)
  would at least leave the `*.mu.social` wildcard alone.
- **Native.** The iOS and Android apps run tiles in a WebView on the hosted
  page (`EXPO_PUBLIC_TILES_HOST_URL`, still `https://webtil.es/host/`), which
  defaults its loading server to `load.<its own host>`. `tileHostUrl` passes
  ours along when it differs, and `app.config.js` derives the iOS app-bound
  domains from both settings, so changing the load domain means a new native
  build. Moving the hosted page off webtil.es is a separate step.
- Bunny rewrites `Cache-Control` on script responses to `no-cache`, which
  suits the runtime: it revalidates on each load, by ETag.
