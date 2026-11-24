# Tile loading server

Bunny.net Edge Script that gives every DASL web tile (see
`src/features/tiles/README.md`) a throwaway origin to run on. It is
[`@dasl/tile-server`](https://www.npmjs.com/package/@dasl/tile-server) as one
edge script, so mu no longer depends on `load.webtil.es`.

## What it does

- `load.<BASE_HOST>` serves the dock, under `/.well-known/web-tiles/dock/`:
  the page the app frames. Asked for without a tile origin it mints one, a
  fresh `<20 random letters>.<BASE_HOST>`, and redirects to itself with it:
  each load gets its own origin, cross-origin from mu and from every other
  tile. The dock frames the runtime on that origin and keeps it there: its
  policy lets its frame be at that runtime and nowhere else, so a tile that
  scripts its runtime into following a link out gets a refused navigation,
  and is stopped. Any other path there still answers with a 303 to a fresh
  origin, where a loader from before the dock is told to update.
- On such a tile origin it serves the loader runtime (the shuttle page, its
  scripts and the service worker) under `/.well-known/web-tiles/`, with the
  runtime policy from `@dasl/tile-lexicon`. Every other path there is a dead
  end: a 404 that loads nothing, runs nothing and cannot be framed.
- `/.well-known/web-tiles/wipe` on a tile origin answers with
  `Clear-Site-Data`. The runtime loads it when the app closes a tile, so that
  an origin made for one load does not stay in the browser, with its worker
  registered and whatever the tile stored, for good. It answers a page of
  that origin and no one else (`Sec-Fetch-Site: same-origin`, which the
  browser sets): anything else gets a 403 that clears nothing.
- `<BASE_HOST>/.well-known/web-tiles/host/` is the page the native apps'
  WebView runs one tile in
  ([`@dasl/tile-host`](https://www.npmjs.com/package/@dasl/tile-host), inlined
  like the runtime), beside the dock and the runtime. Its CSP lets it frame
  this server's tile origins only. The same page is served at
  `<BASE_HOST>/host/`, its address until it moved, which the native builds
  installed before then open: that one can go once no installed build uses
  it.
- A tile's CID, `<the CID of its manifest>.<BASE_HOST>`, is a tile origin
  too, as `@dasl/tile-server` takes it from 4.0 on, but only under a base
  host on a site of its own. The name is decoded and checked as
  `@dasl/tile-lexicon` does it (a CIDv1 of DRISL with a SHA-256, in
  lowercase base32, written the one way it can be: not a pattern), and the
  runtime there serves the one tile whose manifest that CID names, and no
  other. Such an origin is kept, for the tile to find what it stored, so its
  frame is a plain one, and a plain frame has the cookies of its origin's
  site: under `t.mu.social`, which shares a site with mu.social, any tile
  would read and set mu.social's cookies, and any link to the host page can
  ask for such an origin (`&origin=cid`). So the script takes no tile's CID
  under a base host on the site of mu's own pages (mu.social, mycopunk.it,
  and those of the hosts in `src/config/brand.json`), whatever a request
  says; under a base host on a domain of its own, it takes them with no
  further step (see "Moving tile origins to a domain of their own"). Built
  from a `@dasl/tile-server` older than 4.0, whose runtime holds no such
  origin to its tile, it takes none anywhere.
- Any other name gets a 404. Only names of the shape it mints are tile
  origins, and tiles' CIDs where those are, so the runtime and its worker
  never land on another subdomain.

It never sees tile content: the page embedding the tile hands the resources
to the worker (through the blob CDN, `services/tiles`).

## Files

- `bunny/index.ts`: the script to paste. **Generated**: the runtime files and
  the policy headers are inlined from `node_modules`.
- `template.ts`: its source. Edit this, not the generated file.
- `build.mjs`: `pnpm tiles:loader:build` regenerates the script;
  `pnpm tiles:loader:check` fails if it is stale, and runs in CI with the
  linters. Rerun after bumping `@dasl/tile-server`, `@dasl/tile-lexicon` or
  `@dasl/tile-host`, or changing the hosts in `src/config/brand.json`, **and
  paste the new script into Bunny**: CI keeps the repository consistent, it
  does not deploy. The runtime served has to be the one the app's
  `@dasl/tile-loader` expects.
- `test.mjs`: checks a running instance against the packages (redirect,
  byte-identical runtime, policy headers, dead ends, non-tile names, tiles'
  CIDs under its base host, a cookie jar of 12 kB).

## Local run

```bash
BASE_HOST=localhost deno run --allow-net --allow-env services/tileLoader/bunny/index.ts
node services/tileLoader/test.mjs http://localhost:8080 localhost
```

A tile does not actually render through a plain-http `*.localhost` loader in
a browser (the reference `tiles-loading-server` behaves the same), so the
local check is parity with the reference; a real tile is checked once
deployed. Run with `BASE_HOST=t.mu.social`, and `t.mu.social` as
`test.mjs`'s second argument, the same check covers mu's own names, where
tiles' CIDs are refused: `test.mjs` sends every request to this machine
when its first argument is on `localhost`.

## Deploy

`BASE_HOST` defaults to `t.mu.social`: the load domain is `load.t.mu.social`
and tile origins are `<random>.t.mu.social`. Nesting them under `t.` keeps the
`*.mu.social` wildcard record, and every other mu.social name, out of it.

1. Bunny dashboard: Edge Scripting, add a **standalone** script, paste
   `bunny/index.ts`, deploy. Leave "Run script before cache" off. No env is
   needed. On the script's pull zone, under Caching, turn **Strip Response
   Cookies** off: Bunny has it on by default, and it removes the expiries
   the script sends (see "Cookies and the rest of mu.social"). `test.mjs`
   says so when it is on.
2. On the script's pull zone, add three hostnames: `load.t.mu.social`, the
   wildcard `*.t.mu.social`, and `t.mu.social` itself (the native host page),
   with SSL on each (the wildcard certificate is
   issued through Bunny DNS, which hosts mu.social).
3. DNS (Bunny DNS, zone mu.social): three CNAME records to the script's pull
   zone (`<zone>.b-cdn.net`), named `load.t`, `*.t` and `t`. Nothing existing
   changes.
4. Check it, then switch the app over:

```bash
node services/tileLoader/test.mjs https://t.mu.social t.mu.social
```

   `EXPO_PUBLIC_TILES_LOAD_DOMAIN=load.t.mu.social` in
   `.github/environments/common.env` is what points every web build at it
   (the demo build takes `TILES_LOAD_DOMAIN`). Deployed and switched on
   2026-11-13; a real tile was played through it.

## Moving tile origins to a domain of their own

Under `t.mu.social` tile origins share a site with mu.social (see "Cookies
and the rest of mu.social"), and the script takes no tile's CID for a tile
origin there. On a registrable domain of their own (`<tiles domain>` below,
which is yours to pick, and not under mu.social or mycopunk.it, where the
script takes none), no cookie a tile sets reaches mu's hosts, and the
script takes tiles' CIDs with no further step. There it also expires the
cookies that reach it for every domain above the base host up to that
site, the site included, not only for the base host: a cookie a tile left
on the site would otherwise ride every request to every tile origin until
the browser drops it. So nothing else on that site is to keep a cookie:
if something else runs there (a tile server of its own, say), it should
set none either. There the expiries also carry `Secure` and
`SameSite=None`: tiles are then framed in pages of another site, mu's,
where Chromium takes no expiry without them, and Chromium and Firefox
take none without `Secure` for a cookie named `__Secure-...`, as the rules
for cookie prefixes ask. In Chrome, in a plain frame (the host page frames
a tile on its CID's origin so), one a tile sets as `Partitioned` still
stays: that would take a second expiry for each, one that says
`Partitioned`. The move takes:

1. **Bunny.** The same `bunny/index.ts`, pasted as a second standalone
   script on a pull zone of its own, with `BASE_HOST=<tiles domain>` in its
   Env Configuration and **Strip Response Cookies** off on that pull zone
   (as in Deploy, step 1). The `t.mu.social` script stays as it is; if the
   default in `template.ts` is changed to the new domain, it needs
   `BASE_HOST=t.mu.social` set first.
2. **DNS and the certificate.** On the new pull zone, three hostnames with
   SSL on each: `load.<tiles domain>`, the wildcard `*.<tiles domain>` and
   `<tiles domain>` itself (the host page), and records for the three
   pointing at the pull zone. The wildcard certificate comes through Bunny
   DNS, as mu.social's does, so the new domain's zone goes there too (or
   Bunny is given a wildcard certificate of your own). The domain's apex
   cannot be a CNAME: use what Bunny DNS offers there for a pull zone, or
   make the base host a name under the domain (`t.<tiles domain>`, as
   `t.mu.social` is under mu.social), with `load.t`, `*.t` and `t`.
3. **Check it** before anything points at it:
   `node services/tileLoader/test.mjs https://<tiles domain> <tiles domain>`
   says `tiles' CIDs are tile origins under <tiles domain>`, and ends with
   `all good`.
4. **The app.** `EXPO_PUBLIC_TILES_LOAD_DOMAIN=load.<tiles domain>` and
   `EXPO_PUBLIC_TILES_HOST_URL=https://<tiles domain>/.well-known/web-tiles/host/`
   in `.github/environments/common.env` and `.env.example`, and the same
   two as the built-in defaults in `src/features/tiles/constants.ts` and
   `app.config.js` (which makes the iOS app-bound domains from them). The
   host page's built-in address is also written by hand in
   `src/features/tiles/host.test.ts`, whose test of `tileHostUrl` with no
   settings fails until it says the new one. Then a web build, and new
   native builds: the host page's address and the app-bound domains are
   built into each.
5. **`t.mu.social`, until nothing uses it.** Native builds installed before
   the move have `https://t.mu.social/.well-known/web-tiles/host/` built in
   (older ones `https://t.mu.social/host/`), and `load.t.mu.social`; a web
   page opened before the new web build is served keeps using
   `load.t.mu.social` until it is reloaded. So the `t.mu.social` script
   keeps serving, unchanged and taking no tile's CID, until no installed
   build opens it: when that is, is yours to decide. Then its hostnames and
   its DNS records under mu.social go, and `/host/` (`OLD_HOST_PATH` in
   `template.ts`) with them.

Nothing else moves: the blob CDN (`tiles.mu.social`) is no tile origin, and
the web app's cookie scrub (`src/lib/cookies/scrub.ts`) still matters while
tiles run under `t.mu.social`.

## Cookies and the rest of mu.social

Tile origins are cross-origin from everything, but `<random>.t.mu.social`
shares a *site* with mu.social, and cookies follow sites: a cookie set for
`Domain=mu.social` is sent to every subdomain, and a script on a subdomain may
set one. What keeps tiles and the rest of mu apart:

- **Nothing on mu.social uses cookies.** No mu host sets one (checked
  2026-11-13: the app, staging, and the tiles, rss, ip, events, oauth and age
  services) and no app or service code reads one; sessions live in the app
  origin's storage, which no other origin can reach. That is the property to
  keep: a future mu service that needs a cookie should name it with the
  `__Host-` prefix, which pins it to its own host so that no tile can see or
  overwrite it.
- **The web app deletes every cookie it can see** (`src/lib/cookies/scrub.ts`,
  from `App.web.tsx`): at start, when the page comes back into view and every
  minute. A cookie set from a tile's script is always visible to script, so
  one tossed at `mu.social` is expired the next time the app looks, in every
  browser. Storage is not touched.
- **Tiles are framed credentialless on the web** (`TileEmbed/index.web.tsx`).
  In Chromium that gives the frame, and every frame inside it, a cookie jar
  and storage of its own that starts empty and is discarded with the page: a
  tile sees no cookie from outside and none it sets, for any domain, gets
  out. Firefox and Safari ignore the attribute.
- **This server expires what reaches it.** It never sets a cookie, and any
  cookie arriving on a request is expired in the answer, for
  `Domain=t.mu.social` first and then host-only, as many as fit in 16 kB of
  `Set-Cookie`: all of a page's credentialless jar in Chromium, for
  `t.mu.social`, at once. What does not fit is expired in the answers to the
  requests that follow. That needs **Strip Response Cookies** off on the
  pull zone (Deploy, step 1): with it on, Bunny removes every expiry. Under
  `t.mu.social` it never names a domain above its own, so nothing of
  mu.social's is ever reset (under a base host on a site of its own, it
  names every domain up to that site: see "Moving tile origins to a domain
  of their own"). Tile origins are fresh per load, so their own storage
  never outlives a load anyway.
- **Native** runs tiles in a WebView whose cookie store is the app's alone;
  the app sets none.

What this cannot do: in Firefox and Safari a tile's script can still set a
`Domain=mu.social` cookie, which rides along on requests to mu's hosts until
the app's next scrub, at most a minute while the app is open. Nothing there
reads cookies, so it is inert meanwhile; only a registrable domain of its own
for tiles (`BASE_HOST`) rules it out entirely (see "Moving tile origins to a
domain of their own"). Neither the app's scrub nor this server's expiries
under `t.mu.social` carry `Secure`, and Chromium and Firefox take no expiry
without it for a cookie named `__Secure-...`: one a tile sets with such a
name, for `Domain=mu.social` or `Domain=t.mu.social`, stays until it runs
out. And under any base host, this server expires cookies on `Path=/`
only: one a tile sets for another path stays. On a path this server is
asked for (`/.well-known/web-tiles/`), it rides those requests; on one it
never is (one the tile's worker answers), the next tile that looks there
finds it.

## Things to know

- **Same site as the app.** Tile origins under `t.mu.social` are cross-origin
  from the app but same-site with it and with every other `*.mu.social`
  service: a cookie set for `Domain=mu.social` would reach them, and browsers
  isolate processes by site, not origin. The tile policy blocks a tile's
  network access either way. A separate registrable domain (as `webtil.es`
  is) is the stricter choice; `BASE_HOST` makes that a configuration change
  of the script, and "Moving tile origins to a domain of their own" says
  what else it takes. It is also what lets tiles' CIDs be tile origins.
- **How the script knows mu's site.** It is part of the script, not of its
  settings, so that nothing set in Bunny, and nothing in a request, can
  make a tile's CID a tile origin there: mu.social and mycopunk.it always
  (demo builds of mu's web app run on mycopunk.it, so a tiles domain there
  would share their site), and the sites of the hosts in
  `src/config/brand.json`, which `build.mjs` reads. It refuses to build
  when one of those is not written as a bare host name, in lower case and
  in ASCII (with a scheme, a path or a port, in capitals, in Unicode rather
  than its `xn--` form, with a dot at the end): the script could read no
  site from it, and that site would take tiles' CIDs. A site is read as a
  host's last two labels. Two hosts on one site always end in the same
  two, so this never takes one of mu's for another's; under a public
  suffix of more than one label (`co.uk`) it can take two sites for one,
  which only refuses more. A `BASE_HOST` that is not a plain host name
  takes no CID either.
- **The app asks for no CID origin.** mu web's mothership is made without
  `cidOrigins`, and the native player's address for the host page has no
  `&origin=cid`, so every tile still runs on a fresh origin for each load,
  in a credentialless frame on the web. What asking would gain: a tile on
  the same origin at every load, which keeps what it stores (notes, a
  game's progress) from one load to the next, with no wipe when it is
  closed. What it would cost: a plain frame, which in Chromium has the
  cookies of the tiles' domain on every site that shows tiles (a channel
  between tiles); any frame of a page that shows the tile, of whatever
  site, can run it there with what it kept, feed it data and take its
  messages; the host name tells DNS and the network which tile is shown;
  and what it stored stays on the device until the browser clears it. Only
  worth weighing once tile origins are on a domain of their own; it is a
  change in `src/features/tiles`, not here.
- **Native.** The iOS and Android apps run tiles in a WebView on the hosted
  page, `https://t.mu.social/.well-known/web-tiles/host/`
  (`EXPO_PUBLIC_TILES_HOST_URL`; this and the
  load domain are the app's built-in defaults, so a native build needs no
  setting). The page defaults its loading server to `load.<its own host>`,
  which is ours. `app.config.js` derives the iOS app-bound domain,
  `t.mu.social`, from the two settings: changing either means a new native
  build.
- Bunny rewrites `Cache-Control` on script responses to `no-cache`, which
  suits the runtime: it revalidates on each load, by ETag.
- **Large cookie jars.** Every request to the loading host or a tile
  origin brings the cookies a tile left there, and the next tiles' loads
  bring them too. In Chromium a page's credentialless tiles share a jar of
  about 11 kB; over HTTP/2 a browser sends each cookie as a field of its
  own, which comes to about 19 kB of headers. Where frames are not
  credentialless (Firefox, Safari, the native WebView) a tile can fill the
  jar the browser keeps for `t.mu.social`: some 740 kB in Firefox. Bunny
  refuses a request past its own limit before the script runs, and that
  limit is not documented: where it is lower than what a jar comes to, the
  next tiles on the page fail to load until the page is reloaded, and
  outside a credentialless frame until those cookies are cleared. If it is
  below about 19 kB, ask Bunny to raise it for the pull zone. `test.mjs`
  sends a 12 kB jar.
