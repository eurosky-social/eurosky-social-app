/**
 * Sanity check for the STAGING/DEV assertion Edge Script (bunny/staging.ts).
 *
 * Run it against any running instance of the script - a local Deno run, a
 * Bunny preview, or the deployed staging worker:
 *
 *   ALLOWED_PARENT_DOMAIN=mu.social OAUTH_PRIVATE_JWK=... \
 *     deno run --allow-net --allow-env bunny/staging.ts &
 *   WORKER_URL=http://localhost:8080 node test-staging.mjs
 *
 * Covers everything test.mjs covers for the prod minter, PLUS the wildcard
 * origin gate: arbitrary https subdomains of PARENT_DOMAIN are accepted and
 * each mints its OWN derived client_id; the apex, lookalike domains
 * (evilmu.social, mu.social.evil.com), http, explicit ports, and cross-
 * environment identities are all rejected. Signature verification uses the
 * committed PUBLIC JWK; no private key is needed locally.
 *
 * Config (env):
 *   WORKER_URL     target instance (default http://localhost:8080)
 *   PARENT_DOMAIN  apex whose subdomains the instance allows
 *                  (default mu.social; must match ALLOWED_PARENT_DOMAIN)
 *
 * Note: the script stamps iat/exp from its own clock and ignores whatever the
 * caller sends, so there are no iat/exp guardrail cases here - instead we
 * assert the output timestamps are server-stamped and sane.
 */
import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8080'
const PARENT_DOMAIN = process.env.PARENT_DOMAIN || 'mu.social'

/** Primary test origin; any subdomain works, staging is the canonical one. */
const ORIGIN = `https://staging.${PARENT_DOMAIN}`
const CLIENT_ID = `${ORIGIN}/oauth-client-metadata.json`

// Must mirror IAT_BACKDATE_S / ASSERTION_LIFETIME_S in bunny/staging.ts.
const IAT_BACKDATE_S = 30
const ASSERTION_LIFETIME_S = 120

const subtle = globalThis.crypto.subtle

// The public key the script's private counterpart must match (shared kid).
const publicJwks = JSON.parse(
  readFileSync(
    join(here, '..', '..', 'src', 'config', 'oauth.public-jwks.json'),
    'utf8',
  ),
)
const PUB = publicJwks.keys[0]
const KID = PUB.kid

const now = () => Math.floor(Date.now() / 1000)

function validHeader() {
  return {alg: 'ES256', kid: KID, typ: 'JWT'}
}
function validPayload(over = {}) {
  const iat = now()
  return {
    iss: CLIENT_ID,
    sub: CLIENT_ID,
    aud: 'https://bsky.social',
    jti: 'test-' + Math.random().toString(36).slice(2),
    iat,
    exp: iat + 60,
    ...over,
  }
}
function validPayloadEnvelope() {
  return {header: validHeader(), payload: validPayload()}
}

/** Envelope with iss/sub matching the given origin's derived client_id. */
function envelopeFor(origin) {
  const id = `${origin}/oauth-client-metadata.json`
  return {header: validHeader(), payload: validPayload({iss: id, sub: id})}
}

async function call(body, {origin = ORIGIN, method = 'POST'} = {}) {
  const headers = {'content-type': 'application/json'}
  if (origin !== null) headers['Origin'] = origin
  const res = await fetch(WORKER_URL, {
    method,
    headers,
    body: method === 'OPTIONS' ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = undefined
  }
  return {status: res.status, json, text, res}
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function verifyJws(jws) {
  const [h, p, sig] = jws.split('.')
  if (!h || !p || !sig) throw new Error('malformed jws')
  const key = await subtle.importKey(
    'jwk',
    {kty: PUB.kty, crv: PUB.crv, x: PUB.x, y: PUB.y},
    {name: 'ECDSA', namedCurve: 'P-256'},
    false,
    ['verify'],
  )
  const ok = await subtle.verify(
    {name: 'ECDSA', hash: 'SHA-256'},
    key,
    b64urlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  )
  if (!ok) throw new Error('signature does NOT verify against public JWK')
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)))
  return {header, payload}
}

let passed = 0
let failed = 0
function ok(name) {
  passed++
  console.log(`  PASS  ${name}`)
}
function bad(name, detail) {
  failed++
  console.log(`  FAIL  ${name}\n        ${detail}`)
}

async function main() {
  console.log(`Target: ${WORKER_URL}`)
  console.log(`Parent domain: ${PARENT_DOMAIN} (primary origin ${ORIGIN})`)
  console.log(`kid: ${KID}\n`)

  // Reachability + origin gate (works even without the secret).
  let reach
  try {
    reach = await call(validPayloadEnvelope(), {origin: null})
  } catch (e) {
    console.error(
      `Cannot reach ${WORKER_URL} - is the script running there?\n${e}`,
    )
    process.exit(2)
  }
  if (reach.status === 403) ok('no Origin -> 403')
  else bad('no Origin -> 403', `got ${reach.status} ${reach.text}`)

  // The wildcard gate: only https subdomains of the parent pass.
  const rejectedOrigins = [
    [`https://${PARENT_DOMAIN}`, 'apex (prod uses the pinned instance)'],
    [`https://evil${PARENT_DOMAIN.replace('.', '')}.social`, 'lookalike'],
    [`https://evil-${PARENT_DOMAIN}`, 'lookalike suffix'],
    [`https://${PARENT_DOMAIN}.evil.com`, 'parent as sub of attacker domain'],
    [`http://staging.${PARENT_DOMAIN}`, 'http'],
    [`https://staging.${PARENT_DOMAIN}:8443`, 'explicit port'],
    [`https://staging.${PARENT_DOMAIN}/path`, 'non-origin Origin value'],
    ['https://evil.example', 'unrelated domain'],
  ]
  for (const [o, why] of rejectedOrigins) {
    const r = await call(envelopeFor(o), {origin: o})
    if (r.status === 403) ok(`reject ${why}: ${o} -> 403`)
    else bad(`reject ${why}: ${o} -> 403`, `got ${r.status} ${r.text}`)
  }

  const preflight = await call(undefined, {method: 'OPTIONS'})
  if (
    preflight.status === 204 &&
    preflight.res.headers.get('access-control-allow-origin') === ORIGIN
  ) {
    ok('OPTIONS preflight -> 204 + CORS')
  } else {
    bad('OPTIONS preflight -> 204 + CORS', `got ${preflight.status}`)
  }

  // Denied preflight must not grant CORS.
  const badPreflight = await call(undefined, {
    method: 'OPTIONS',
    origin: 'https://evil.example',
  })
  if (
    badPreflight.status === 204 &&
    !badPreflight.res.headers.get('access-control-allow-origin')
  ) {
    ok('OPTIONS from bad origin -> no allow-origin grant')
  } else {
    bad(
      'OPTIONS from bad origin -> no allow-origin grant',
      `got ${badPreflight.status} acao=${badPreflight.res.headers.get('access-control-allow-origin')}`,
    )
  }

  // Happy path (needs the secret configured on the instance).
  const good = await call(validPayloadEnvelope())
  if (good.status === 500) {
    console.log(
      `\n  SKIP  signing tests: instance returned 500 (key misconfigured).\n` +
        `        Set the OAUTH_PRIVATE_JWK secret on the target instance,\n` +
        `        then re-run.\n`,
    )
    summarize(true)
    return
  }
  if (good.status === 200 && good.json?.jws) {
    try {
      const {payload} = await verifyJws(good.json.jws)
      if (payload.iss === CLIENT_ID && payload.aud === 'https://bsky.social') {
        ok('valid request -> 200 + JWS verifies against public JWK')
      } else {
        bad('valid request', `payload mismatch: ${JSON.stringify(payload)}`)
      }
    } catch (e) {
      bad('valid request -> JWS verifies', String(e))
    }
  } else {
    bad('valid request -> 200', `got ${good.status} ${good.text}`)
  }

  /*
   * Derived identity: any other subdomain mints under its OWN client_id
   * (including nested subdomains), and no environment can mint under another
   * environment's identity.
   */
  for (const o of [
    `https://dev.${PARENT_DOMAIN}`,
    `https://v10.${PARENT_DOMAIN}`,
    `https://a.b.${PARENT_DOMAIN}`,
  ]) {
    const oid = `${o}/oauth-client-metadata.json`
    const own = await call(envelopeFor(o), {origin: o})
    if (own.status === 200 && own.json?.jws) {
      try {
        const {payload} = await verifyJws(own.json.jws)
        if (payload.iss === oid && payload.sub === oid) {
          ok(`origin ${o} -> mints its own derived client_id`)
        } else {
          bad(`origin ${o} identity`, `iss=${payload.iss}`)
        }
      } catch (e) {
        bad(`origin ${o} identity`, String(e))
      }
    } else {
      bad(`origin ${o} identity`, `got ${own.status} ${own.text}`)
    }
  }

  // Cross-environment: dev origin with staging's iss/sub must be rejected.
  const cross = await call(validPayloadEnvelope(), {
    origin: `https://dev.${PARENT_DOMAIN}`,
  })
  if (cross.status === 400) {
    ok(`dev origin + ${ORIGIN} identity -> 400`)
  } else {
    bad(
      `dev origin + ${ORIGIN} identity -> 400`,
      `got ${cross.status} ${cross.text}`,
    )
  }

  // iat/exp are stamped from the server clock and ignore caller input. Send
  // absurd caller timestamps and assert the output is re-stamped and sane.
  const stamp = await call({
    header: validHeader(),
    payload: validPayload({iat: now() + 99999, exp: now() + 999999}),
  })
  if (stamp.status === 200 && stamp.json?.jws) {
    try {
      const {payload} = await verifyJws(stamp.json.jws)
      const t = now()
      const iatPast = payload.iat <= t && payload.iat >= t - IAT_BACKDATE_S - 30
      const expFuture =
        payload.exp > t && payload.exp <= t + ASSERTION_LIFETIME_S + 30
      const saneLifetime =
        payload.exp - payload.iat <= ASSERTION_LIFETIME_S + 60
      if (iatPast && expFuture && saneLifetime) {
        ok('iat/exp re-stamped from server clock (caller values ignored)')
      } else {
        bad(
          'iat/exp re-stamped from server clock',
          `iat=${payload.iat} exp=${payload.exp} now=${t}`,
        )
      }
    } catch (e) {
      bad('iat/exp re-stamped from server clock', String(e))
    }
  } else {
    bad(
      'iat/exp re-stamped from server clock',
      `got ${stamp.status} ${stamp.text}`,
    )
  }

  // Injected header params + extra claims must be STRIPPED by the
  // reconstructing minter (and a bogus caller kid ignored, not echoed).
  const inj = await call({
    header: {
      ...validHeader(),
      kid: 'attacker-kid',
      injected_hdr: 'x',
      crit: ['x'],
    },
    payload: validPayload({injected_claim: 'y', scope: 'transition:generic'}),
  })
  if (inj.status === 200 && inj.json?.jws) {
    try {
      const {header, payload} = await verifyJws(inj.json.jws)
      const hKeys = Object.keys(header).sort().join(',')
      const pKeys = Object.keys(payload).sort().join(',')
      const clean =
        hKeys === 'alg,kid,typ' &&
        header.kid === KID &&
        pKeys === 'aud,exp,iat,iss,jti,sub' &&
        payload.iss === CLIENT_ID
      if (clean) ok('injected header/claims stripped; kid reconstructed')
      else
        bad(
          'reconstruction strips injection',
          `header=[${hKeys}] kid=${header.kid} payload=[${pKeys}]`,
        )
    } catch (e) {
      bad('reconstruction strips injection', String(e))
    }
  } else {
    bad('reconstruction strips injection', `got ${inj.status} ${inj.text}`)
  }

  // Guardrails (all should be 400, secret is set at this point).
  const cases = [
    ['wrong iss -> 400', {payload: validPayload({iss: 'https://evil'})}],
    ['wrong sub -> 400', {payload: validPayload({sub: 'https://evil'})}],
    ['non-https aud -> 400', {payload: validPayload({aud: 'http://x'})}],
    [
      'aud with path -> 400',
      {payload: validPayload({aud: 'https://bsky.social/x'})},
    ],
    [
      'aud with query -> 400',
      {payload: validPayload({aud: 'https://bsky.social/?a=1'})},
    ],
    [
      'aud with userinfo -> 400',
      {payload: validPayload({aud: 'https://u@bsky.social'})},
    ],
    ['missing jti -> 400', {payload: validPayload({jti: undefined})}],
    ['alg != ES256 -> 400', {header: {...validHeader(), alg: 'HS256'}}],
  ]
  for (const [name, env] of cases) {
    const r = await call({
      header: env.header || validHeader(),
      payload: env.payload || validPayload(),
    })
    if (r.status === 400) ok(name)
    else bad(name, `got ${r.status} ${r.text}`)
  }

  summarize(false)
}

function summarize(skipped) {
  console.log(
    `\n${passed} passed, ${failed} failed${skipped ? ' (signing tests skipped)' : ''}`,
  )
  process.exit(failed ? 1 : 0)
}

main().catch(e => {
  console.error(e)
  process.exit(2)
})
