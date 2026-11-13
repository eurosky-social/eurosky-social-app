/**
 * Tile blob CDN (Bunny.net Edge Scripting).
 *
 * Serves the resources of DASL web tiles (https://dasl.ing/, see
 * ../../../src/features/tiles/) from the edge instead of from each author's
 * PDS. `GET /blob/<did>/<cid>` resolves the DID to its PDS, passes
 * `com.atproto.sync.getBlob` through, and keeps the body in the edge cache
 * through the Cache API (`caches`): Bunny's pull zones do not cache what a
 * standalone script answers and rewrite its Cache-Control to `no-cache`, so
 * the script stores and serves its own entries, and says which happened in
 * `X-Tile-Cache`. A CID names its bytes for good, so a cached blob never goes stale, and
 * playing a tile costs its author's PDS about one fetch per resource per edge
 * location rather than one per viewer. The app points
 * EXPO_PUBLIC_TILES_BLOB_URL at this host (src/features/tiles/manifest.ts).
 *
 * Lockdown: only GET and HEAD; the DID and CID are checked by shape; the PDS
 * is whatever the DID document names, https on a public name only; redirects
 * (the bsky.social entryway answers getBlob with one to the account's actual
 * host) are followed hop by hop under the same rule. The body streams through
 * untouched, under the inert headers the reference PDS sends (attachment, a
 * sandboxed CSP, nosniff), so nothing served here runs as a page on this
 * origin. Bodies above MAX_BLOB_BYTES are refused.
 *
 * Config (Bunny dashboard -> script -> Env Configuration), all optional:
 *   ALLOWED_ORIGIN  Access-Control-Allow-Origin (default *: the blobs are
 *                   public, and the demo origins need them too).
 *   PLC_URL         the PLC directory (default https://plc.directory).
 *   MAX_BLOB_BYTES  the largest blob served (default 52428800, 50 MiB).
 *   DID_TTL         seconds to remember a DID's PDS (default 3600).
 *   CACHE_SECONDS   cache TTL of a blob (default 31536000: a CID's bytes
 *                   never change).
 *   ERROR_SECONDS   cache TTL of a "blob not found" (default 60).
 */
import * as BunnySDK from 'https://esm.sh/@bunny.net/edgescript-sdk@0.13.0'

const MAX_REDIRECTS = 5
/** Many entries would mean something is enumerating DIDs; start over then. */
const MAX_CACHED_DIDS = 5000
/** A PDS remembered this long is re-resolved when it has no such blob. */
const RETRY_AFTER_MS = 60e3

/** Bump to drop every cached blob. */
const CACHE_NAME = 'tile-blobs:v1'

/** Bodies up to this size are stored whole; larger ones are streamed in. */
const BUFFER_BYTES = 8 * 1024 * 1024

/*
 * Why the cache is not working, when it is not: reported in
 * `X-Tile-Cache-Info` so a deployment can be diagnosed from outside.
 */
let cacheTrouble = ''

function trouble(where: string, e: unknown) {
  cacheTrouble = `${where}: ${e instanceof Error ? e.message : String(e)}`
    .replace(/[^\x20-\x7e]/g, ' ')
    .slice(0, 200)
}

/*
 * The edge cache, where there is one (Bunny, and Deno locally). Entries stay
 * in the region that wrote them. Any failure reads as "no cache".
 */
async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') {
    cacheTrouble = 'no caches global'
    return null
  }
  try {
    return await caches.open(CACHE_NAME)
  } catch (e) {
    trouble('open', e)
    return null
  }
}

/** Lets a cache write outlive the response where the runtime allows it. */
function background(work: Promise<unknown>) {
  const bunny = (
    globalThis as {Bunny?: {v1?: {waitUntil?: (p: Promise<unknown>) => void}}}
  ).Bunny
  if (typeof bunny?.v1?.waitUntil === 'function') bunny.v1.waitUntil(work)
}

/** What goes in the cache: the answer, under a plain lifetime header. */
function storable(body: BodyInit, headers: Headers): Response {
  const stored = new Headers(headers)
  const seconds = envNumber('CACHE_SECONDS', 31536000)
  stored.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`)
  stored.delete('X-Tile-Cache')
  return new Response(body, {status: 200, headers: stored})
}

const DID_PLC = /^did:plc:[a-z2-7]{24}$/
const DID_WEB = /^did:web:[a-z0-9][a-z0-9.%:_-]*$/
/** A CIDv1 in base32, the only form `$link` and blob refs carry. */
const CID = /^b[a-z2-7]{20,}$/

function env(name: string): string | undefined {
  return Deno.env.get(name) || undefined
}

function envNumber(name: string, fallback: number): number {
  const value = Number(env(name))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

/** An error answer; cached only when asked, as a missing blob may appear. */
function error(status: number, message: string, cacheSeconds = 0): Response {
  return new Response(JSON.stringify({error: message}), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      'Cache-Control':
        cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  })
}

/**
 * Whether the proxy may fetch this: https, on a public name. Addresses and
 * local names are refused, since the host comes from a DID document anyone
 * can write.
 */
function isPublicHttpsUrl(url: URL): boolean {
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (!host.includes('.')) return false
  if (/^[\d.]+$/.test(host) || host.includes(':')) return false
  return !/\.(local|localhost|internal|home|lan)$/.test(host)
}

/** Where a DID's document lives: the PLC directory, or the did:web host. */
function didDocumentUrl(did: string): URL | null {
  if (DID_PLC.test(did)) {
    return new URL(`/${did}`, env('PLC_URL') || 'https://plc.directory')
  }
  if (DID_WEB.test(did)) {
    try {
      const [host, ...path] = did.slice('did:web:'.length).split(':')
      const url = new URL(`https://${decodeURIComponent(host)}/`)
      url.pathname = path.length
        ? `/${path.map(decodeURIComponent).join('/')}/did.json`
        : '/.well-known/did.json'
      return url
    } catch {
      return null
    }
  }
  return null
}

type Resolved = {pds: string; at: number}
const didCache = new Map<string, Resolved>()

/** The PDS a DID document names, remembered for DID_TTL seconds. */
async function resolvePds(
  did: string,
  fresh = false,
): Promise<Resolved | null> {
  const ttlMs = envNumber('DID_TTL', 3600) * 1000
  const cached = didCache.get(did)
  if (cached && !fresh && Date.now() - cached.at < ttlMs) return cached

  const docUrl = didDocumentUrl(did)
  if (!docUrl || !isPublicHttpsUrl(docUrl)) return null
  let doc: {service?: unknown} | undefined
  try {
    const res = await fetch(docUrl.toString(), {
      headers: {Accept: 'application/did+ld+json, application/json'},
    })
    if (!res.ok) return null
    doc = await res.json()
  } catch {
    return null
  }

  const services = Array.isArray(doc?.service) ? doc.service : []
  const service = services.find(
    (s: unknown) =>
      typeof s === 'object' &&
      s !== null &&
      (s as {type?: unknown}).type === 'AtprotoPersonalDataServer' &&
      String((s as {id?: unknown}).id).endsWith('#atproto_pds'),
  ) as {serviceEndpoint?: unknown} | undefined
  if (typeof service?.serviceEndpoint !== 'string') return null
  let endpoint: URL
  try {
    endpoint = new URL(service.serviceEndpoint)
  } catch {
    return null
  }
  if (!isPublicHttpsUrl(endpoint)) return null

  if (didCache.size >= MAX_CACHED_DIDS) didCache.clear()
  const resolved = {pds: endpoint.origin, at: Date.now()}
  didCache.set(did, resolved)
  return resolved
}

/**
 * `getBlob` on the PDS, following redirects one hop at a time so that none
 * can lead off https or onto a private host. Null means a redirect was
 * refused or ran out of hops.
 */
async function fetchBlob(
  pds: string,
  did: string,
  cid: string,
): Promise<Response | null> {
  let current = new URL('/xrpc/com.atproto.sync.getBlob', pds)
  current.searchParams.set('did', did)
  current.searchParams.set('cid', cid)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpsUrl(current)) return null
    const res = await fetch(current.toString(), {
      redirect: 'manual',
      headers: {
        Accept: '*/*',
        // Uncompressed, so the upstream Content-Length is the body's.
        'Accept-Encoding': 'identity',
        'User-Agent': 'mu-tiles-blobs/1.0',
      },
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      await res.body?.cancel()
      if (!location) return null
      current = new URL(location, current)
      continue
    }
    return res
  }
  return null
}

/** Passes bytes through, failing the stream past the limit. */
function limitBytes(
  body: ReadableStream<Uint8Array>,
  max: number,
): ReadableStream<Uint8Array> {
  let seen = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength
        if (seen > max) {
          controller.error(new Error('Blob too large'))
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )
}

BunnySDK.net.http.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {status: 204, headers: corsHeaders()})
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return error(405, 'Method not allowed')
  }

  const match = /^\/blob\/([^/]+)\/([^/]+)$/.exec(new URL(req.url).pathname)
  if (!match) return error(404, 'Not found')
  let did: string
  let cid: string
  try {
    did = decodeURIComponent(match[1])
    cid = decodeURIComponent(match[2])
  } catch {
    return error(400, 'Bad DID or CID')
  }
  if (!DID_PLC.test(did) && !DID_WEB.test(did)) return error(400, 'Bad DID')
  if (!CID.test(cid)) return error(400, 'Bad CID')

  // One key per blob, on the request's own origin, whatever its query.
  const cacheKey = `${new URL(req.url).origin}/blob/${did}/${cid}`
  const cache = await openCache()
  if (cache) {
    try {
      const hit = await cache.match(cacheKey)
      if (hit) {
        const headers = new Headers(hit.headers)
        headers.set('X-Tile-Cache', 'HIT')
        headers.set(
          'Cache-Control',
          `public, max-age=${envNumber('CACHE_SECONDS', 31536000)}, immutable`,
        )
        if (req.method === 'HEAD') await hit.body?.cancel()
        return new Response(req.method === 'HEAD' ? null : hit.body, {
          status: 200,
          headers,
        })
      }
    } catch (e) {
      trouble('match', e)
    }
  }

  const errorSeconds = envNumber('ERROR_SECONDS', 60)
  const resolved = await resolvePds(did)
  if (!resolved) return error(404, 'DID has no PDS', errorSeconds)

  let upstream: Response | null
  try {
    upstream = await fetchBlob(resolved.pds, did, cid)
    // No such blob on a PDS remembered for a while: the account may have
    // moved. Resolve afresh and, if that names another host, ask it.
    if (
      upstream &&
      !upstream.ok &&
      upstream.status < 500 &&
      Date.now() - resolved.at > RETRY_AFTER_MS
    ) {
      const again = await resolvePds(did, true)
      if (again && again.pds !== resolved.pds) {
        await upstream.body?.cancel()
        upstream = await fetchBlob(again.pds, did, cid)
      }
    }
  } catch {
    return error(502, 'PDS unreachable')
  }
  if (!upstream) return error(502, 'Bad redirect from PDS')

  if (!upstream.ok) {
    await upstream.body?.cancel()
    if (upstream.status === 429) return error(503, 'PDS rate limited')
    if (upstream.status >= 500) return error(502, 'PDS error')
    // The reference PDS answers 400 "Blob not found".
    return error(404, 'Blob not found', errorSeconds)
  }

  const max = envNumber('MAX_BLOB_BYTES', 50 * 1024 * 1024)
  const encoded = upstream.headers.has('content-encoding')
  const length = Number(upstream.headers.get('content-length'))
  const hasLength = !encoded && Number.isInteger(length) && length >= 0
  if (hasLength && length > max) {
    await upstream.body?.cancel()
    return error(413, 'Blob too large', errorSeconds)
  }

  const headers = new Headers({
    ...corsHeaders(),
    'Content-Type':
      upstream.headers.get('content-type') || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${cid}"`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': `public, max-age=${envNumber('CACHE_SECONDS', 31536000)}, immutable`,
    ETag: `"${cid}"`,
    'X-Tile-Cache': 'MISS',
    'Access-Control-Expose-Headers': 'X-Tile-Cache, X-Tile-Cache-Info',
  })
  if (cacheTrouble) headers.set('X-Tile-Cache-Info', cacheTrouble)
  if (hasLength) headers.set('Content-Length', String(length))

  if (req.method === 'HEAD' || !upstream.body) {
    await upstream.body?.cancel()
    return new Response(null, {status: 200, headers})
  }
  const body = limitBytes(upstream.body, max)
  if (!cache) return new Response(body, {status: 200, headers})

  // A body of known, modest size is read whole and stored before answering,
  // so the next request is a hit; the cost is a few milliseconds, once.
  if (hasLength && length <= BUFFER_BYTES) {
    let bytes: ArrayBuffer
    try {
      bytes = await new Response(body).arrayBuffer()
    } catch {
      return error(502, 'PDS stream failed')
    }
    try {
      await cache.put(cacheKey, storable(bytes, headers))
      cacheTrouble = ''
    } catch (e) {
      trouble('put', e)
      headers.set('X-Tile-Cache-Info', cacheTrouble)
    }
    return new Response(bytes, {status: 200, headers})
  }

  // Anything larger streams: one copy to the viewer, one to the cache. A
  // body past the limit fails both, so nothing truncated is ever stored.
  const [toViewer, toCache] = body.tee()
  background(
    cache.put(cacheKey, storable(toCache, headers)).then(
      () => {
        cacheTrouble = ''
      },
      e => trouble('put (stream)', e),
    ),
  )
  return new Response(toViewer, {status: 200, headers})
})
