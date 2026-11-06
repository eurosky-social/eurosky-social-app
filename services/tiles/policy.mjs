/**
 * The tiles switch: pauses or resumes tile playback for every mu user at
 * once by writing the `social.mu.tiles.policy` record in the brand's admin
 * repo (src/features/tiles/policy.ts reads it; lexicons/social/mu/tiles/
 * policy.json is the shape). Open apps notice within a minute. No deploy.
 *
 *   node services/tiles/policy.mjs status
 *   HANDLE=eurosky.social APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *     node services/tiles/policy.mjs pause "Tiles are paused while we look into a problem."
 *   HANDLE=eurosky.social APP_PASSWORD=... node services/tiles/policy.mjs resume
 *
 * HANDLE is the admin account, the creator of the trusted-verifier list in
 * src/config/brand.json (eurosky.social for mu); an app password will do.
 * `status` needs neither. Zero dependencies.
 */
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const COLLECTION = 'social.mu.tiles.policy'
const RKEY = 'self'
const PUBLIC_API = 'https://public.api.bsky.app'

const [command, ...rest] = process.argv.slice(2)
const message = rest.join(' ').trim()
if (!['status', 'pause', 'resume'].includes(command)) {
  console.error(
    'usage: node services/tiles/policy.mjs status | pause [message] | resume',
  )
  process.exit(2)
}

/** The admin handle: the env, else the brand's verifier-list creator. */
function adminActor() {
  if (process.env.HANDLE) return process.env.HANDLE
  const brand = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../src/config/brand.json', import.meta.url)),
      'utf8',
    ),
  )
  const uri = brand.verification?.trustedVerifierListUris?.[0]
  if (!uri) throw new Error('no trusted-verifier list in brand.json')
  return uri.split('/')[2]
}

async function json(url, init) {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      `${new URL(url).pathname} ${res.status}: ${JSON.stringify(body)}`,
    )
    err.body = body
    throw err
  }
  return body
}

async function resolveDid(actor) {
  if (actor.startsWith('did:')) return actor
  const r = await json(
    `${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(actor)}`,
  )
  return r.did
}

async function resolvePds(did) {
  const url = did.startsWith('did:web:')
    ? `https://${did.slice('did:web:'.length)}/.well-known/did.json`
    : `https://plc.directory/${did}`
  const doc = await json(url)
  const pds = doc.service?.find(s => s.id === '#atproto_pds')?.serviceEndpoint
  if (!pds) throw new Error(`no PDS in the DID document of ${did}`)
  return pds
}

const actor = adminActor()
const did = await resolveDid(actor)
const pds = await resolvePds(did)

async function current() {
  try {
    const r = await json(
      `${pds}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=${COLLECTION}&rkey=${RKEY}`,
    )
    return r.value
  } catch (e) {
    if (e.body?.error === 'RecordNotFound') return null
    throw e
  }
}

function describe(value) {
  if (!value) return 'tiles play (no policy record)'
  if (value.enabled !== false) return `tiles play (since ${value.updatedAt})`
  return `tiles PAUSED since ${value.updatedAt}${value.message ? `: ${value.message}` : ''}`
}

if (command === 'status') {
  console.log(`${did} on ${pds}`)
  console.log(describe(await current()))
  process.exit(0)
}

const password = process.env.APP_PASSWORD
if (!password) {
  console.error(
    'APP_PASSWORD (an app password of the admin account) is required',
  )
  process.exit(2)
}
const session = await json(`${pds}/xrpc/com.atproto.server.createSession`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({identifier: actor, password}),
})
if (session.did !== did) {
  throw new Error(`signed in as ${session.did}, expected ${did}`)
}

const record = {
  $type: COLLECTION,
  enabled: command === 'resume',
  ...(command === 'pause' && message ? {message} : {}),
  updatedAt: new Date().toISOString(),
}
const put = await json(`${pds}/xrpc/com.atproto.repo.putRecord`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${session.accessJwt}`,
  },
  body: JSON.stringify({repo: did, collection: COLLECTION, rkey: RKEY, record}),
})
console.log(`${put.uri}`)
console.log(describe(record))
