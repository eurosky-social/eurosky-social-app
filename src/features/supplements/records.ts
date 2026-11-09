import {TID} from '@atproto/common-web'
import {type Client, type l} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'

import {isRecordNotFoundError, matchXrpcError} from '#/lib/xrpc-error'
import {com} from '#/lexicons'
import {
  type Supplement,
  SUPPLEMENT_COLLECTION,
  supplementRecordSchema,
} from './supplement'

export type StoredSupplement = {
  did: DidString
  rkey: string
  cid: l.CidString
  supplement: Supplement
}

export class SupplementConflictError extends Error {
  constructor() {
    super('The supplement changed in another editor.')
    this.name = 'SupplementConflictError'
  }
}

function rkeyOf(uri: string) {
  return uri.slice(uri.lastIndexOf('/') + 1)
}

/**
 * An account's supplements. One malformed record is left out rather than
 * hiding the rest, since this is a public list anyone's record can land in.
 */
export async function listSupplements(
  client: Client,
  did: DidString,
): Promise<StoredSupplement[]> {
  const {records} = await client.call(
    com.atproto.repo.listRecords,
    {repo: did, collection: SUPPLEMENT_COLLECTION, limit: 100},
    {service: null},
  )
  return records.flatMap(({uri, cid, value}) => {
    const parsed = supplementRecordSchema.safeParse(value)
    return parsed.success
      ? [{did, rkey: rkeyOf(uri), cid, supplement: parsed.data}]
      : []
  })
}

/** Null when it does not exist. A malformed record or a failed read throws. */
export async function readSupplement(
  client: Client,
  did: DidString,
  rkey: string,
): Promise<StoredSupplement | null> {
  try {
    const result = await client.call(
      com.atproto.repo.getRecord,
      {repo: did, collection: SUPPLEMENT_COLLECTION, rkey},
      {service: null},
    )
    if (!result.cid) throw new Error('The supplement record has no CID.')
    return {
      did,
      rkey,
      cid: result.cid,
      supplement: supplementRecordSchema.parse(result.value),
    }
  } catch (error) {
    if (isRecordNotFoundError(error)) return null
    throw error
  }
}

/**
 * Publishes a new supplement, or `source` again. Compare-and-swap protects a
 * second editor's work, including from a supplement deleted meanwhile.
 */
export async function saveSupplement(
  client: Client,
  did: DidString,
  source: Pick<StoredSupplement, 'rkey' | 'cid'> | undefined,
  supplement: Supplement,
): Promise<StoredSupplement> {
  if (client.assertDid !== did)
    throw new Error('Only its editor can edit this supplement.')
  const rkey = source?.rkey ?? TID.nextStr()
  const record = supplementRecordSchema.parse({
    ...supplement,
    $type: SUPPLEMENT_COLLECTION,
    version: 1,
    updatedAt: new Date().toISOString(),
  })
  try {
    const result = await client.call(
      com.atproto.repo.putRecord,
      {
        repo: did,
        collection: SUPPLEMENT_COLLECTION,
        rkey,
        swapRecord: source?.cid ?? null,
        record,
        /* Until the lexicon is discoverable by PDSes, as for the frontpage. */
        validate: false,
      },
      {service: null},
    )
    return {did, rkey, cid: result.cid, supplement}
  } catch (error) {
    if (matchXrpcError(error, com.atproto.repo.putRecord) === 'InvalidSwap')
      throw new SupplementConflictError()
    throw error
  }
}

export async function deleteSupplement(
  client: Client,
  did: DidString,
  source: Pick<StoredSupplement, 'rkey' | 'cid'>,
): Promise<void> {
  if (client.assertDid !== did)
    throw new Error('Only its editor can delete this supplement.')
  try {
    await client.call(
      com.atproto.repo.deleteRecord,
      {
        repo: did,
        collection: SUPPLEMENT_COLLECTION,
        rkey: source.rkey,
        swapRecord: source.cid,
      },
      {service: null},
    )
  } catch (error) {
    if (matchXrpcError(error, com.atproto.repo.deleteRecord) === 'InvalidSwap')
      throw new SupplementConflictError()
    throw error
  }
}
