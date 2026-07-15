# RSS proxy

Curated publisher pages pull each publisher's real articles from its RSS/Atom
feed (see `src/features/newsrooms/rss`). Most news feeds send no CORS headers,
so a web build cannot fetch them directly. This service is a passthrough that
adds CORS.

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

Stand up an equivalent edge passthrough (Bunny/Cloudflare), mirroring the
sibling services (`services/footballData`, `services/og`), and point
`EXPO_PUBLIC_RSS_PROXY_URL` at it. The proxy should restrict which upstream hosts
it will fetch to the publishers in the registry rather than proxying arbitrary
URLs.
