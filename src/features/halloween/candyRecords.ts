import {type Client} from '@atproto/lex'
import {isValidDid, toDatetimeString} from '@atproto/syntax'

import {CONSTELLATION_SERVICE} from '#/lib/constants'
import {com} from '#/lexicons'

export const CANDY_COLLECTION = 'social.mu.halloween.candy'

/** One filtered backlink is enough to establish an earlier gift from this account. */
export async function hasGivenProfileCandy(
  senderDid: string,
  subject: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const url = new URL(
    '/xrpc/blue.microcosm.links.getBacklinks',
    CONSTELLATION_SERVICE,
  )
  url.searchParams.set('subject', subject)
  url.searchParams.set('source', `${CANDY_COLLECTION}:subject`)
  url.searchParams.set('did', senderDid)
  url.searchParams.set('limit', '1')
  const response = await fetch(url.toString(), {
    headers: {accept: 'application/json'},
    signal,
  })
  if (!response.ok)
    throw new Error(`Could not load candy gifts: ${response.status}`)
  const json = (await response.json()) as {
    records: {did: string; collection: string; rkey: string}[]
  }
  return json.records.some(
    record =>
      record.did === senderDid && record.collection === CANDY_COLLECTION,
  )
}

/** Each deliberate profile click creates a new gift, independently of posts and likes. */
export function giveProfileCandy(client: Client, subject: string) {
  if (!isValidDid(subject)) throw new Error('Candy requires a recipient DID')
  return client.call(com.atproto.repo.createRecord, {
    repo: client.assertDid,
    collection: CANDY_COLLECTION,
    record: {
      $type: CANDY_COLLECTION,
      subject,
      createdAt: toDatetimeString(new Date()),
    },
  })
}
