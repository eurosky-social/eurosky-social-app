/**
 * Eurosky OAuth client-assertion edge script - STAGING/DEV variant
 * (Bunny.net Edge Scripting).
 *
 * Same STRICT RECONSTRUCTING MINTER as ./index.ts (prod), with ONE difference:
 * instead of pinning a single CLIENT_ID/ALLOWED_ORIGIN pair, it accepts any
 * https SUBDOMAIN of ALLOWED_PARENT_DOMAIN and derives the client identity
 * from the validated request Origin as `<origin>/oauth-client-metadata.json` -
 * the exact URL every environment self-publishes its metadata at
 * (scripts/gen-oauth-metadata.js, driven by EXPO_PUBLIC_OAUTH_BASE_URL).
 *
 * One instance therefore serves EVERY non-prod environment (staging.mu.social,
 * dev.mu.social, v10.mu.social, ...) with zero per-environment config: adding
 * a version is deploy-only, no OAuth change. The apex domain itself is
 * deliberately NOT accepted - prod stays on the pinned ./index.ts instance,
 * so this script can never mint under prod's identity.
 *
 * All environments share one keypair (the committed public JWKS is inlined
 * into every build's metadata), so one key signing for several of our own
 * client_ids changes nothing key-wise; iss/sub are still pinned per request,
 * just to the requesting environment. The subdomain constraint keeps the nice
 * invariant that this key never signs an identity outside domains we control.
 *
 * Config (set in the Bunny dashboard -> script -> Env Configuration):
 *   OAUTH_PRIVATE_JWK      (Environment SECRET) private ES256/P-256 JWK JSON,
 *                          incl. kid - same secret as the prod instance
 *   ALLOWED_PARENT_DOMAIN  (Environment Variable) apex whose https subdomains
 *                          are accepted, e.g. `mu.social` (allows
 *                          https://*.mu.social; the apex itself is rejected)
 *
 * SECURITY MODEL: identical to ./index.ts - the Origin check is
 * defense-in-depth, NOT authentication (any non-browser caller sets Origin
 * freely; that is equally true of prod's exact-match check). What actually
 * protects users is atproto's mandatory PKCE, the redirect_uri pinned to the
 * app origin, and DPoP sender-constrained tokens. See ./index.ts.
 *
 * Request:  POST { header, payload }  (built by @atproto/oauth-client)
 * Response: { jws: "<compact JWS>" }
 */
import * as BunnySDK from 'https://esm.sh/@bunny.net/edgescript-sdk@0.11.2'

/**
 * `iat`/`exp` are stamped from THIS edge node's clock, not the caller's.
 * @atproto/oauth-client builds those timestamps in the browser, so a user
 * whose device clock runs fast produced an `iat` in the future and the
 * authorization server rejected the assertion ("iat ... should be in the
 * past"). The edge runtime is NTP-synced, so it is the authoritative clock.
 * We backdate `iat` slightly to absorb any residual edge<->AS skew.
 */
const IAT_BACKDATE_S = 30
const ASSERTION_LIFETIME_S = 120
const MAX_BODY_BYTES = 8 * 1024

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') bytes = new TextEncoder().encode(input)
  else if (input instanceof Uint8Array) bytes = input
  else bytes = new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * CORS headers echoing the (already validated) request Origin. An empty
 * origin (denials before/at the origin gate) omits the allow-origin grant
 * entirely rather than emitting an empty one.
 */
function corsHeaders(origin: string): Record<string, string> {
  if (!origin) return {Vary: 'Origin'}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function deny(status: number, message: string, origin: string): Response {
  return new Response(JSON.stringify({error: message}), {
    status,
    headers: {'content-type': 'application/json', ...corsHeaders(origin)},
  })
}

/**
 * Validate that `origin` is a clean https origin on a SUBDOMAIN of `parent`
 * and return its canonical form (URL.origin: lowercased host, no default
 * port), or null if rejected. Rejects the apex itself (prod uses the pinned
 * instance), lookalikes (evilmu.social, mu.social.evil.com fails the suffix
 * test by domain-label boundary), non-https, explicit ports, userinfo, and
 * any Origin value that is not exactly an origin (paths etc.).
 */
function canonicalSubdomainOrigin(
  origin: string,
  parent: string,
): string | null {
  if (!parent || !origin || origin.length > 512) return null
  let u: URL
  try {
    u = new URL(origin)
  } catch {
    return null
  }
  if (
    u.protocol !== 'https:' ||
    u.port !== '' ||
    u.username !== '' ||
    u.password !== '' ||
    u.origin !== origin
  ) {
    return null
  }
  const parentHost = parent.toLowerCase()
  const host = u.hostname
  if (host === parentHost) return null
  if (!host.endsWith('.' + parentHost)) return null
  return u.origin
}

/**
 * The client assertion `aud` is the authorization server issuer, which in
 * atproto is an origin-shaped https URL. We cannot allowlist it (sign-in
 * resolves an arbitrary user handle -> their PDS -> their AS), but we can
 * reject anything that is not a clean https origin: no userinfo, no query,
 * no fragment, root path only.
 */
function validAudience(aud: unknown): aud is string {
  if (typeof aud !== 'string' || aud.length > 512) return false
  let u: URL
  try {
    u = new URL(aud)
  } catch {
    return false
  }
  return (
    u.protocol === 'https:' &&
    u.hostname !== '' &&
    u.username === '' &&
    u.password === '' &&
    u.search === '' &&
    u.hash === '' &&
    (u.pathname === '/' || u.pathname === '')
  )
}

BunnySDK.net.http.serve(async (req: Request): Promise<Response> => {
  // Config from env (set in the Bunny dashboard). Read per-request to mirror
  // the Worker's `env`-param semantics and stay fail-closed if misconfigured.
  const parentDomain = Deno.env.get('ALLOWED_PARENT_DOMAIN') ?? ''
  const privateJwkRaw = Deno.env.get('OAUTH_PRIVATE_JWK') ?? ''

  const rawOrigin = req.headers.get('Origin') ?? ''
  const origin = canonicalSubdomainOrigin(rawOrigin, parentDomain) ?? ''

  if (req.method === 'OPTIONS') {
    return new Response(null, {status: 204, headers: corsHeaders(origin)})
  }
  // Defense-in-depth only - NOT authentication (see SECURITY MODEL above).
  if (!origin) {
    return deny(403, 'origin not allowed', '')
  }
  if (req.method !== 'POST') {
    return deny(405, 'method not allowed', origin)
  }

  /*
   * The client identity is derived from the validated Origin, never from the
   * caller's payload: each environment publishes its metadata at exactly this
   * URL, so iss/sub below are pinned to the requesting environment.
   */
  const clientId = `${origin}/oauth-client-metadata.json`

  // Body-size cap (cheap abuse/DoS guard; real rate limiting is operator-side).
  const cl = req.headers.get('content-length')
  if (cl && Number(cl) > MAX_BODY_BYTES) {
    return deny(413, 'request too large', origin)
  }
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return deny(413, 'request too large', origin)
  }

  let body: {header?: unknown; payload?: unknown}
  try {
    body = JSON.parse(raw)
  } catch {
    return deny(400, 'invalid JSON', origin)
  }
  const header = body.header as Record<string, unknown> | undefined
  const payload = body.payload as Record<string, unknown> | undefined
  if (
    !header ||
    !payload ||
    typeof header !== 'object' ||
    typeof payload !== 'object'
  ) {
    return deny(400, 'missing header/payload', origin)
  }

  let privateJwk: JsonWebKey & {kid?: string}
  try {
    privateJwk = JSON.parse(privateJwkRaw)
  } catch {
    return deny(500, 'worker key misconfigured', origin)
  }
  // Fail closed if the secret has no kid (kid is authoritative below).
  if (typeof privateJwk.kid !== 'string' || !privateJwk.kid) {
    return deny(500, 'worker key misconfigured (missing kid)', origin)
  }

  // -- Validate the request (reject confused/hostile callers clearly) ------
  const now = Math.floor(Date.now() / 1000)
  const errors: string[] = []
  if (header.alg !== 'ES256') errors.push('alg must be ES256')
  if (payload.iss !== clientId) errors.push('iss must be client_id')
  if (payload.sub !== clientId) errors.push('sub must be client_id')
  if (!validAudience(payload.aud)) {
    errors.push('aud must be a clean https origin')
  }
  if (
    typeof payload.jti !== 'string' ||
    !payload.jti ||
    payload.jti.length > 256
  ) {
    errors.push('jti required')
  }
  // Note: we deliberately do NOT validate the caller's iat/exp - they are
  // discarded and re-stamped from this node's clock below (see IAT_BACKDATE_S).
  if (errors.length) {
    return deny(400, `invalid assertion: ${errors.join('; ')}`, origin)
  }

  // -- RECONSTRUCT from the whitelist - never sign caller-supplied JWT
  //    material. Anything the caller put in header/payload beyond the
  //    fields validated above is discarded here. -------------------------
  const outHeader = {alg: 'ES256', kid: privateJwk.kid, typ: 'JWT'}
  const outPayload = {
    iss: clientId,
    sub: clientId,
    aud: payload.aud as string,
    jti: payload.jti as string,
    iat: now - IAT_BACKDATE_S,
    exp: now + ASSERTION_LIFETIME_S,
  }

  // -- Sign (ES256 = ECDSA P-256 / SHA-256; WebCrypto returns P1363 r||s,
  //    which is exactly the JWS ES256 signature format) -------------------
  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey(
      'jwk',
      privateJwk,
      {name: 'ECDSA', namedCurve: 'P-256'},
      false,
      ['sign'],
    )
  } catch {
    return deny(500, 'worker key import failed', origin)
  }
  const signingInput = `${b64url(JSON.stringify(outHeader))}.${b64url(
    JSON.stringify(outPayload),
  )}`
  const sig = await crypto.subtle.sign(
    {name: 'ECDSA', hash: 'SHA-256'},
    key,
    new TextEncoder().encode(signingInput),
  )
  const jws = `${signingInput}.${b64url(sig)}`

  return new Response(JSON.stringify({jws}), {
    headers: {'content-type': 'application/json', ...corsHeaders(origin)},
  })
})
