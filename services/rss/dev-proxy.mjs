/**
 * Local dev proxy for curated page RSS feeds.
 *
 * Most news feeds send no CORS headers, so a web build's fetch is blocked. This
 * zero-dependency proxy fetches the upstream feed named in the `url` query param
 * and re-serves it with permissive CORS headers. It mirrors what a production
 * edge script (e.g. a Bunny/Cloudflare worker) would do.
 *
 * Usage:
 *   node services/rss/dev-proxy.mjs
 *
 * Then point the app at it:
 *   EXPO_PUBLIC_RSS_PROXY_URL=http://localhost:8788
 *
 * The app appends `?url=<feed>` itself (see src/features/curatedPages/rss).
 */
import http from 'node:http'

const PORT = Number(process.env.PORT || 8788)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }

  try {
    const incoming = new URL(req.url, `http://localhost:${PORT}`)
    const target = incoming.searchParams.get('url')
    if (!target || !/^https?:\/\//i.test(target)) {
      res.writeHead(400, {...CORS, 'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: 'Missing or invalid url param'}))
      return
    }

    const upstream = await fetch(target, {
      headers: {
        // Broad Accept: this proxies both feeds (XML) and article pages (HTML,
        // for og:image scraping).
        Accept:
          'text/html, application/xhtml+xml, application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
        // Some servers reject requests without a UA.
        'User-Agent':
          'Mozilla/5.0 (compatible; curated-pages-dev-proxy/1.0)',
      },
    })
    const body = await upstream.text()
    res.writeHead(upstream.status, {
      ...CORS,
      'Content-Type':
        upstream.headers.get('content-type') || 'application/xml; charset=utf-8',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(502, {...CORS, 'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: String(err)}))
  }
})

server.listen(PORT, () => {
  console.log(`rss dev proxy on http://localhost:${PORT}`)
})
