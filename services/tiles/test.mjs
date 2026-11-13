/**
 * Exercises a running tile blob CDN (services/tiles/bunny/index.ts), local
 * or deployed, against a real tile of @berjon.com on eurosky.social:
 *
 *   deno run --allow-net --allow-env services/tiles/bunny/index.ts   # :8080
 *   node services/tiles/test.mjs http://127.0.0.1:8080
 *   node services/tiles/test.mjs https://tiles.mu.social
 *
 * The blob's bytes are checked against its CID (a raw sha-256 CIDv1), so the
 * test needs no fixture beyond the CID. Exits non-zero on the first failure.
 */
import {createHash} from 'node:crypto'

const base = (process.argv[2] || 'http://127.0.0.1:8080').replace(/\/$/, '')
const DID = 'did:plc:izttpdp3l6vss5crelt5kcux'
// /trilo.png of "The Internet Transition", an image/png blob.
const CID = 'bafkreihdadacrx6zowligm4yqvvdnili6oiyvjbmhtiqj6bb5ug54t3dcy'
const MISSING = 'bafkreihdadacrx6zowligm4yqvvdnili6oiyvjbmhtiqj6bb5ug54t3dca'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
function base32Decode(s) {
  let bits = 0
  let value = 0
  const out = []
  for (const c of s) {
    value = (value << 5) | ALPHABET.indexOf(c)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** The sha-256 digest a base32 CIDv1 (raw or dag-pb, sha2-256) carries. */
function cidDigest(cid) {
  const bytes = base32Decode(cid.slice(1))
  // version 1, codec (0x55 raw / 0x70 dag-pb), multihash 0x12 (sha2-256), length 0x20
  if (bytes[0] !== 1 || bytes[2] !== 0x12 || bytes[3] !== 0x20) {
    throw new Error(`not a sha-256 CIDv1: ${cid}`)
  }
  return bytes.subarray(4, 36).toString('hex')
}

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}
/** Something worth knowing that is not the script's doing. */
function note(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'note'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function main() {
  const url = `${base}/blob/${DID}/${CID}`

  const pre = await fetch(url, {method: 'OPTIONS'})
  check(
    'OPTIONS answers 204 with CORS',
    pre.status === 204 &&
      pre.headers.get('access-control-allow-origin') === '*',
    String(pre.status),
  )

  const head = await fetch(url, {method: 'HEAD'})
  check(
    'HEAD answers 200 with no body',
    head.status === 200 && (await head.arrayBuffer()).byteLength === 0,
    String(head.status),
  )

  const res = await fetch(url)
  const body = Buffer.from(await res.arrayBuffer())
  check('GET answers 200', res.status === 200, String(res.status))
  check(
    'bytes match the CID',
    createHash('sha256').update(body).digest('hex') === cidDigest(CID),
    `${body.length} bytes`,
  )
  check(
    'PNG magic',
    body.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  )
  const h = res.headers
  check(
    'Content-Type passes through',
    h.get('content-type') === 'image/png',
    h.get('content-type') ?? '',
  )
  check(
    'Content-Length is the body',
    Number(h.get('content-length')) === body.length,
    h.get('content-length') ?? 'absent',
  )
  check('CORS *', h.get('access-control-allow-origin') === '*')
  // Bunny rewrites a standalone script's Cache-Control to no-cache, so on a
  // deployment this is a note: the edge cache is checked by X-Tile-Cache below.
  note(
    'immutable Cache-Control reaches the client',
    /public, max-age=\d+, immutable/.test(h.get('cache-control') ?? ''),
    h.get('cache-control') ?? '',
  )
  check('nosniff', h.get('x-content-type-options') === 'nosniff')
  check(
    'attachment',
    (h.get('content-disposition') ?? '').startsWith('attachment'),
    h.get('content-disposition') ?? '',
  )
  check(
    'sandboxed CSP',
    (h.get('content-security-policy') ?? '').includes('sandbox'),
    h.get('content-security-policy') ?? '',
  )
  check('ETag is the CID', h.get('etag') === `"${CID}"`, h.get('etag') ?? '')

  const missing = await fetch(`${base}/blob/${DID}/${MISSING}`)
  check('missing blob is 404', missing.status === 404, String(missing.status))

  // The script stores the blob in the edge cache as it streams it; the write
  // finishes a moment after the response, so give it a few tries.
  let state = h.get('x-tile-cache')
  let cachedHeaders = h
  let cachedBody = body
  for (let i = 0; i < 6 && state !== 'HIT'; i++) {
    await new Promise(r => setTimeout(r, 500))
    const again = await fetch(url)
    state = again.headers.get('x-tile-cache')
    cachedHeaders = again.headers
    cachedBody = Buffer.from(await again.arrayBuffer())
  }
  const cached = {headers: cachedHeaders}
  if (cachedHeaders.get('x-tile-cache-info')) {
    console.log(
      `note the script says: ${cachedHeaders.get('x-tile-cache-info')}`,
    )
  }
  check(
    'a repeat GET is served from the edge cache',
    state === 'HIT',
    `X-Tile-Cache: ${state}`,
  )
  check(
    'cached bytes match the CID',
    createHash('sha256').update(cachedBody).digest('hex') === cidDigest(CID),
    `${cachedBody.length} bytes`,
  )
  check(
    'cached answer keeps type and inert headers',
    cached.headers.get('content-type') === 'image/png' &&
      cached.headers.get('x-content-type-options') === 'nosniff' &&
      cached.headers.get('access-control-allow-origin') === '*',
  )
  const cachedHead = await fetch(url, {method: 'HEAD'})
  check(
    'HEAD of a cached blob has no body',
    cachedHead.status === 200 &&
      (await cachedHead.arrayBuffer()).byteLength === 0,
    cachedHead.headers.get('x-tile-cache') ?? '',
  )

  const badDid = await fetch(`${base}/blob/did:plc:nope/${CID}`)
  check('bad DID is 400', badDid.status === 400, String(badDid.status))
  const badCid = await fetch(`${base}/blob/${DID}/QmNotBase32`)
  check('bad CID is 400', badCid.status === 400, String(badCid.status))
  const unknown = await fetch(
    `${base}/blob/did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/${CID}`,
  )
  check('unknown DID is 404', unknown.status === 404, String(unknown.status))
  const path = await fetch(
    `${base}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${CID}`,
  )
  check('other paths are 404', path.status === 404, String(path.status))
  const post = await fetch(url, {method: 'POST'})
  check('POST is 405', post.status === 405, String(post.status))

  // A did:web account: a bad CID still resolves the DID first, so an unknown
  // did:web host answers 404 (no PDS) rather than 400.
  const web = await fetch(`${base}/blob/did:web:no-such-host.invalid/${CID}`)
  check('unresolvable did:web is 404', web.status === 404, String(web.status))

  if (failures) {
    console.error(`\n${failures} failure(s)`)
    process.exit(1)
  }
  console.log('\nall good')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
