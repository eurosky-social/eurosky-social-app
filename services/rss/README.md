# RSS proxy

Newsroom pages pull each publisher's real articles from its RSS/Atom feed (see
`src/features/newsrooms/rss`). Most news feeds send no CORS headers, so a web
build cannot fetch them directly. This service is a passthrough that adds CORS.

## Local dev (web)

```bash
node services/rss/dev-proxy.mjs            # listens on :8788
```

Then set, in your env / `.env`:

```bash
EXPO_PUBLIC_RSS_PROXY_URL=http://localhost:8788
```

The app appends `?url=<feed>` itself. Native builds can fetch feeds directly, so
the proxy is only needed for web.

## Production

`bunny/index.ts` is the production equivalent (Bunny Edge Scripting), mirroring
the sibling services (`services/footballData`, `services/og`): create a
standalone Edge Script on its own hostname, paste the file, and point
`EXPO_PUBLIC_RSS_PROXY_URL` at it in the web build.

Beyond the dev proxy it adds a host allowlist, hop-validated redirects so a
feed cannot redirect the proxy off the allowlist, and edge caching
(`CACHE_SECONDS`, default 300) so many readers cost roughly one upstream fetch
per interval.

The allowlist maintains itself: `build-web` runs
`scripts/gen-newsroom-hosts.js`, which derives the publishers' registrable
domains from the registry and emits `newsroom-hosts.json` into the web build.
The proxy fetches that file (`HOSTS_URL`, cached `HOSTS_TTL` seconds), so
adding a publisher to `publishers.ts` reaches the proxy on the next web deploy
with no proxy-side change. `ALLOWED_HOSTS` remains as a manual override, and a
hardcoded fallback covers cold starts if the hosted list is unreachable.
