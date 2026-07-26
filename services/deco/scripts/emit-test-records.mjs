#!/usr/bin/env node
/**
 * Hand-write a standard Bluesky list membership for testing the decoration
 * entitlement read path without Mollie or the deco service.
 *
 * Usage:
 *   HANDLE=issuer.example APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *   LIST_URI=at://did:plc:issuer/app.bsky.graph.list/rkey \
 *     node services/deco/scripts/emit-test-records.mjs
 *
 * Env options:
 *   PDS_URL      issuer account PDS (default https://bsky.social)
 *   LIST_URI     exact subscriber list AT-URI owned by the logged-in issuer
 *                account (required)
 *   SUBJECT_DID  member DID (default: logged-in issuer DID)
 *   FRAME        avatar frame id (default gold-ring)
 *   GRADIENT     optional display-name gradient id
 *   OUTLINE=1    add a dark outline around the gradient name
 *   MODE=revoke  remove every matching membership; leave settings dormant
 *
 * The list item uses a normal PDS-generated rkey, deliberately proving that
 * manually managed Bluesky list members work and no service-specific rkey is
 * required by the client.
 */

import process from 'node:process'

const PDS_URL = process.env.PDS_URL || 'https://bsky.social'
const { HANDLE, APP_PASSWORD, LIST_URI } = process.env
const FRAME = process.env.FRAME || 'gold-ring'
const GRADIENT = process.env.GRADIENT
const OUTLINE = process.env.OUTLINE === '1'
const MODE = process.env.MODE || 'emit'

const LIST_ITEM_COLLECTION = 'app.bsky.graph.listitem'
const SETTINGS_COLLECTION = 'social.mu.deco.settings'

if (!HANDLE || !APP_PASSWORD || !LIST_URI) {
  console.error(
    'Usage: HANDLE=issuer.example APP_PASSWORD=... LIST_URI=at://.../app.bsky.graph.list/... node emit-test-records.mjs',
  )
  process.exit(1)
}

async function xrpc(path, { method = 'GET', token, body, params } = {}) {
  const url = new URL(`/xrpc/${path}`, PDS_URL)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
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
  body: { identifier: HANDLE, password: APP_PASSWORD },
})
const { did, accessJwt } = session
const subject = process.env.SUBJECT_DID || did
const now = new Date().toISOString()

if (!LIST_URI.startsWith(`at://${did}/app.bsky.graph.list/`)) {
  throw new Error(`LIST_URI must be an app.bsky.graph.list owned by ${did}`)
}

if (MODE === 'revoke') {
  const toDelete = []
  let cursor
  do {
    const page = await xrpc('com.atproto.repo.listRecords', {
      token: accessJwt,
      params: {
        repo: did,
        collection: LIST_ITEM_COLLECTION,
        limit: '100',
        ...(cursor ? { cursor } : {}),
      },
    })
    for (const record of page.records ?? []) {
      if (
        record.value?.list === LIST_URI &&
        record.value?.subject === subject
      ) {
        toDelete.push(record.uri)
      }
    }
    cursor = page.cursor
  } while (cursor)

  for (const uri of toDelete) {
    await xrpc('com.atproto.repo.deleteRecord', {
      method: 'POST',
      token: accessJwt,
      body: {
        repo: did,
        collection: LIST_ITEM_COLLECTION,
        rkey: uri.split('/').pop(),
      },
    })
    console.log(`deleted ${uri}`)
  }
  console.log(
    `removed ${toDelete.length} membership(s) for ${subject}; settings left dormant`,
  )
} else {
  const membership = await xrpc('com.atproto.repo.createRecord', {
    method: 'POST',
    token: accessJwt,
    body: {
      repo: did,
      collection: LIST_ITEM_COLLECTION,
      record: {
        $type: LIST_ITEM_COLLECTION,
        list: LIST_URI,
        subject,
        createdAt: now,
      },
    },
  })
  console.log(`membership: ${membership.uri}`)

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
          ...(GRADIENT ? { name: GRADIENT } : {}),
          ...(GRADIENT && OUTLINE ? { nameOutline: true } : {}),
          updatedAt: now,
        },
      },
    })
    console.log(
      `settings: ${settings.uri} (avatar: ${FRAME}${
        GRADIENT ? `, name: ${GRADIENT}` : ''
      })`,
    )
  } else {
    console.log(
      `subject ${subject} differs from issuer; write settings from the subject account`,
    )
  }

  console.log('\nAdd this exact URI to decorations.subscriberListUris:')
  console.log(LIST_URI)
  const check = new URL(
    'https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getManyToMany',
  )
  check.searchParams.set('subject', subject)
  check.searchParams.set('source', `${LIST_ITEM_COLLECTION}:subject`)
  check.searchParams.set('pathToOther', 'list')
  check.searchParams.set('otherSubject', LIST_URI)
  check.searchParams.set('did', did)
  check.searchParams.set('limit', '1')
  console.log(`Constellation check: ${check}`)
}
