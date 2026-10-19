import {AtUri} from '@atproto/syntax'

import {CONSTELLATION_SERVICE} from '#/lib/constants'

/**
 * Supporter entitlement is membership in an exact configured Bluesky list. A
 * listitem links to both its list and its member, so Constellation's
 * getManyToMany endpoint can verify both links in one query without fetching
 * the record body. Standard list items added manually work exactly like ones
 * created by the deco service.
 */
export const SUBSCRIBER_LIST_COLLECTION = 'app.bsky.graph.list'
export const SUBSCRIBER_LIST_ITEM_COLLECTION = 'app.bsky.graph.listitem'
const LIST_ITEM_SUBJECT_SOURCE = `${SUBSCRIBER_LIST_ITEM_COLLECTION}:subject`
const LIST_ITEM_LIST_PATH = 'list'

type GetManyToManyResponse = {
  items?: {
    linkRecord: {did: string; collection: string; rkey: string}
    otherSubject: string
  }[]
  cursor?: string | null
}

/**
 * Whether `subjectDid` belongs to any exact configured subscriber list.
 *
 * `did` restricts the linking record to the list owner, while the many-to-many
 * join verifies BOTH links in the same listitem: `list` points to the exact
 * configured list URI and `subject` points to this profile DID. This supports
 * ordinary list items created by Bluesky clients and needs no body fetch.
 */
export async function hasSupporterEntitlement(
  subjectDid: string,
  subscriberListUris: readonly string[],
): Promise<boolean> {
  const lists = new Map<string, string>()
  for (const configuredUri of subscriberListUris) {
    try {
      const parsed = new AtUri(configuredUri)
      if (
        parsed.collection === SUBSCRIBER_LIST_COLLECTION &&
        parsed.rkey &&
        parsed.host.startsWith('did:')
      ) {
        lists.set(parsed.toString(), parsed.host)
      }
    } catch {
      // Invalid brand entries cannot grant access.
    }
  }
  if (lists.size === 0) return false

  const url = new URL(
    `/xrpc/blue.microcosm.links.getManyToMany`,
    CONSTELLATION_SERVICE,
  )
  url.searchParams.set('subject', subjectDid)
  url.searchParams.set('source', LIST_ITEM_SUBJECT_SOURCE)
  url.searchParams.set('pathToOther', LIST_ITEM_LIST_PATH)
  url.searchParams.set('limit', '100')
  for (const listUri of lists.keys()) {
    url.searchParams.append('otherSubject', listUri)
  }
  for (const ownerDid of new Set(lists.values())) {
    url.searchParams.append('did', ownerDid)
  }

  const res = await fetch(url.toString(), {
    headers: {accept: 'application/json'},
  })
  if (!res.ok) {
    throw new Error(`Constellation getManyToMany failed: ${res.status}`)
  }
  const json = (await res.json()) as GetManyToManyResponse
  return !!json.items?.some(
    item =>
      item.linkRecord.collection === SUBSCRIBER_LIST_ITEM_COLLECTION &&
      lists.get(item.otherSubject) === item.linkRecord.did,
  )
}
