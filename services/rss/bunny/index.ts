/**
 * Publisher RSS/article proxy (Bunny.net Edge Scripting).
 *
 * First-party passthrough for the newsroom pages (see
 * ../../../src/features/newsrooms/). Publisher feeds and article pages send no
 * Access-Control-Allow-Origin header, so a web build cannot fetch them from
 * the browser; this service refetches them server-side and re-serves the body
 * with CORS headers. The app points EXPO_PUBLIC_RSS_PROXY_URL at this host and
 * appends `?url=<target>` itself (see src/features/newsrooms/rss/config.ts).
 * It proxies two kinds of targets: feed XML, and article HTML (for the hero's
 * og:image scrape).
 *
 * Lockdown: only GET, only http(s) targets, and only hosts under the
 * registered publishers' domains - the proxy must not fetch arbitrary URLs on
 * our egress. The allowlist is the build-emitted `newsroom-hosts.json` served
 * next to the web app (scripts/gen-newsroom-hosts.js derives it from the
 * publisher registry), so adding a publisher propagates here on the next web
 * deploy with no proxy change. Redirects are followed manually so a hop
 * cannot escape the allowlist. Responses are cached at the edge so N readers
 * cost roughly one upstream fetch per interval.
 *
 * Config (Bunny dashboard -> script -> Env Configuration), all optional:
 *   HOSTS_URL       where the emitted allowlist lives
 *                   (default https://mu.social/newsroom-hosts.json).
 *   HOSTS_TTL       seconds to cache the fetched allowlist (default 300).
 *   ALLOWED_HOSTS   comma-separated domain-suffix override; when set, the
 *                   hosted list is not consulted at all.
 *   ALLOWED_ORIGIN  Access-Control-Allow-Origin (default *).
 *   CACHE_SECONDS   edge/browser cache TTL for proxied bodies (default 300).
 */
import * as BunnySDK from 'https://esm.sh/@bunny.net/edgescript-sdk@0.11.2'

// Cold-start fallback, used only until the hosted list has been fetched once.
// Not the source of truth - that is the registry via newsroom-hosts.json.
const FALLBACK_HOSTS = [
  'ft.com',
  'theverge.com',
  'wired.com',
  'nytimes.com',
  'euractiv.com',
  '404media.co',
  'cnn.com',
  'nrc.nl',
  'propublica.org',
  'euobserver.com',
  'theguardian.com',
  'lemonde.fr',
  'elpais.com',
  'next.ink',
]

const MAX_REDIRECTS = 5

function env(name: string): string | undefined {
  return Deno.env.get(name) || undefined
}

function baseHeaders(): Record<string, string> {
  const cacheSeconds = Number(env('CACHE_SECONDS') || '300')
  return {
    'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Cache-Control': `public, max-age=60, s-maxage=${cacheSeconds}`,
  }
}

let hostsCache: {hosts: string[]; fetchedAt: number} | null = null

async function allowedHosts(): Promise<string[]> {
  const override = env('ALLOWED_HOSTS')
  if (override) {
    return override
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  }

  const ttlMs = Number(env('HOSTS_TTL') || '300') * 1000
  if (hostsCache && Date.now() - hostsCache.fetchedAt < ttlMs) {
    return hostsCache.hosts
  }
  try {
    const res = await fetch(
      env('HOSTS_URL') || 'https://mu.social/newsroom-hosts.json',
      {headers: {Accept: 'application/json'}},
    )
    if (res.ok) {
      const data = await res.json()
      const hosts = Array.isArray(data?.hosts)
        ? data.hosts
            .map((h: unknown) => String(h).toLowerCase())
            .filter(Boolean)
        : []
      if (hosts.length > 0) {
        hostsCache = {hosts, fetchedAt: Date.now()}
        return hosts
      }
    }
  } catch {
    // fall through to stale / fallback below
  }
  // Refresh failed: serve the stale list (and wait a full TTL before retrying,
  // so a broken hosts endpoint does not add a failed fetch to every request).
  if (hostsCache) {
    hostsCache.fetchedAt = Date.now()
    return hostsCache.hosts
  }
  return FALLBACK_HOSTS
}

function isAllowed(target: URL, hosts: string[]): boolean {
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false
  const host = target.hostname.toLowerCase()
  return hosts.some(domain => host === domain || host.endsWith('.' + domain))
}

/**
 * Fetch with redirects validated hop by hop: a registered feed redirecting to
 * an unregistered host (or a non-http scheme) is refused rather than followed.
 */
async function fetchAllowed(
  target: URL,
  hosts: string[],
): Promise<Response | null> {
  let current = target
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowed(current, hosts)) return null
    const res = await fetch(current.toString(), {
      redirect: 'manual',
      headers: {
        // Broad Accept: this proxies both feeds (XML) and article pages (HTML).
        Accept:
          'text/html, application/xhtml+xml, application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
        // Some servers reject requests without a UA.
        'User-Agent': 'Mozilla/5.0 (compatible; mu-newsrooms-proxy/1.0)',
      },
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res
      current = new URL(location, current)
      continue
    }
    return res
  }
  return null
}

BunnySDK.net.http.serve(async (req: Request): Promise<Response> => {
  const headers = baseHeaders()

  if (req.method === 'OPTIONS') {
    return new Response(null, {status: 204, headers})
  }
  if (req.method !== 'GET') {
    return new Response(null, {status: 405, headers})
  }

  let target: URL
  try {
    const raw = new URL(req.url).searchParams.get('url') || ''
    target = new URL(raw)
  } catch {
    return new Response(
      JSON.stringify({error: 'Missing or invalid url param'}),
      {status: 400, headers: {...headers, 'Content-Type': 'application/json'}},
    )
  }

  const hosts = await allowedHosts()
  if (!isAllowed(target, hosts)) {
    return new Response(JSON.stringify({error: 'Host not allowed'}), {
      status: 403,
      headers: {...headers, 'Content-Type': 'application/json'},
    })
  }

  try {
    const upstream = await fetchAllowed(target, hosts)
    if (!upstream) {
      return new Response(JSON.stringify({error: 'Host not allowed'}), {
        status: 403,
        headers: {...headers, 'Content-Type': 'application/json'},
      })
    }
    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...headers,
        'Content-Type':
          upstream.headers.get('content-type') ||
          'application/xml; charset=utf-8',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({error: String(err)}), {
      status: 502,
      headers: {...headers, 'Content-Type': 'application/json'},
    })
  }
})
