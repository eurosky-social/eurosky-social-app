#!/usr/bin/env node
/**
 * Phase-1 helper: hand-write test decoration records so the client read path
 * (src/features/avatarDecorations/) can be exercised before the deco service
 * exists.
 *
 * Writes, as the logged-in account:
 *   - a `social.mu.deco.grant` record {subject} (issuer role)
 *   - a `social.mu.deco.settings` self-record {frame} (subject role,
 *     only when the subject IS the logged-in account)
 *
 * Usage:
 *   HANDLE=you.example APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *     node services/deco/scripts/emit-test-records.mjs
 *
 * Env options:
 *   PDS_URL      PDS to log into (default https://bsky.social)
 *   FRAME        avatar frame id for the settings record (default gold-ring;
 *                see src/features/avatarDecorations/catalog.ts)
 *   GRADIENT     display-name gradient id (optional; see nameGradients.ts,
 *                e.g. sunset, ocean, aurora, rose, ember, violet, rainbow)
 *   OUTLINE=1    add a dark outline around the gradient name
 *   SUBJECT_DID  grant subject (default: the logged-in account's own DID)
 *   MODE=revoke  delete all grant records naming SUBJECT_DID instead; the
 *                settings record is left in place - that IS the lapse
 *                behavior (frame goes dormant, restores on re-grant)
 *
 * Running emit twice creates a duplicate grant; harmless (existence-only),
 * clean up with MODE=revoke which deletes all of them.
 */

const PDS_URL = process.env.PDS_URL || 'https://bsky.social'
const {HANDLE, APP_PASSWORD} = process.env
const FRAME = process.env.FRAME || 'gold-ring'
const GRADIENT = process.env.GRADIENT
const OUTLINE = process.env.OUTLINE === '1'
const MODE = process.env.MODE || 'emit'

const GRANT_COLLECTION = 'social.mu.deco.grant'
const SETTINGS_COLLECTION = 'social.mu.deco.settings'

if (!HANDLE || !APP_PASSWORD) {
  console.error(
    'Usage: HANDLE=you.example APP_PASSWORD=... node emit-test-records.mjs',
  )
  process.exit(1)
}

async function xrpc(path, {method = 'GET', token, body, params} = {}) {
  const url = new URL(`/xrpc/${path}`, PDS_URL)
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? {authorization: `Bearer ${token}`} : {}),
      ...(body ? {'content-type': 'application/json'} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(json)}`)
  }
  return json
}

const session = await xrpc('com.atproto.server.createSession', {
  method: 'POST',
  body: {identifier: HANDLE, password: APP_PASSWORD},
})
const {did, accessJwt} = session
const subject = process.env.SUBJECT_DID || did
const now = new Date().toISOString()

if (MODE === 'revoke') {
  const toDelete = []
  let cursor
  do {
    const page = await xrpc('com.atproto.repo.listRecords', {
      token: accessJwt,
      params: {
        repo: did,
        collection: GRANT_COLLECTION,
        limit: '100',
        ...(cursor ? {cursor} : {}),
      },
    })
    for (const r of page.records ?? []) {
      if (r.value?.subject === subject) toDelete.push(r.uri)
    }
    cursor = page.cursor
  } while (cursor)

  for (const uri of toDelete) {
    await xrpc('com.atproto.repo.deleteRecord', {
      method: 'POST',
      token: accessJwt,
      body: {repo: did, collection: GRANT_COLLECTION, rkey: uri.split('/').pop()},
    })
    console.log(`deleted ${uri}`)
  }
  console.log(
    `revoked ${toDelete.length} grant(s) for ${subject}; settings record left dormant`,
  )
} else {
  const grant = await xrpc('com.atproto.repo.createRecord', {
    method: 'POST',
    token: accessJwt,
    body: {
      repo: did,
      collection: GRANT_COLLECTION,
      record: {$type: GRANT_COLLECTION, subject, createdAt: now},
    },
  })
  console.log(`grant:    ${grant.uri}`)

  if (subject === did) {
    const settings = await xrpc('com.atproto.repo.putRecord', {
      method: 'POST',
      token: accessJwt,
      body: {
        repo: did,
        collection: SETTINGS_COLLECTION,
        rkey: 'self',
        record: {
          $type: SETTINGS_COLLECTION,
          avatar: FRAME,
          ...(GRADIENT ? {name: GRADIENT} : {}),
          ...(GRADIENT && OUTLINE ? {nameOutline: true} : {}),
          updatedAt: now,
        },
      },
    })
    console.log(
      `settings: ${settings.uri} (avatar: ${FRAME}${GRADIENT ? `, name: ${GRADIENT}` : ''})`,
    )
  } else {
    console.log(
      `subject ${subject} differs from issuer; write the settings record from the subject's own account`,
    )
  }

  console.log(`\nissuer DID: ${did}`)
  console.log(
    `-> add it to src/config/brand.json decorations.issuerDids, then give Constellation ~a minute to index.`,
  )
  console.log(
    `   check: https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?subject=${subject}&source=${GRANT_COLLECTION}:subject`,
  )
}
