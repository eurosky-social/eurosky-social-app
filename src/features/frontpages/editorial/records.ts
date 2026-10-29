import {type Client, type l} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'

import {isRecordNotFoundError, matchXrpcError} from '#/lib/xrpc-error'
import {com} from '#/lexicons'
import {
  type Curation,
  curationRecordSchema,
  defaultCuration,
  FRONTPAGE_COLLECTION,
} from './curation'

export type CurationSnapshot = {curation: Curation; cid: l.CidString | null}

export class CurationConflictError extends Error {
  constructor() {
    super('The front page changed in another editor.')
    this.name = 'CurationConflictError'
  }
}

/** Absence means latest-first. Network failures or invalid layouts must not undo hidden posts. */
export async function readCuration(
  client: Client,
  did: DidString,
): Promise<CurationSnapshot> {
  try {
    const result = await client.call(
      com.atproto.repo.getRecord,
      {
        repo: did,
        collection: FRONTPAGE_COLLECTION,
        rkey: 'self',
      },
      {service: null},
    )
    if (!result.cid) throw new Error('The front page record has no CID.')
    const record = curationRecordSchema(did).parse(result.value)
    return {
      cid: result.cid,
      curation: {
        leadPost: record.leadPost,
        sizes: record.sizes,
        starterPackViews: record.starterPackViews,
        order: record.order,
        hidden: record.hidden,
        includeLatest: record.includeLatest,
      },
    }
  } catch (error) {
    if (isRecordNotFoundError(error))
      return {curation: defaultCuration(), cid: null}
    throw error
  }
}

/** Compare-and-swap protects a second editor's work, including the initial creation. */
export async function saveCuration(
  client: Client,
  did: DidString,
  source: CurationSnapshot,
  curation: Curation,
): Promise<CurationSnapshot> {
  if (client.assertDid !== did)
    throw new Error('Only the profile owner can edit this front page.')
  const record = curationRecordSchema(did).parse({
    $type: FRONTPAGE_COLLECTION,
    version: 1,
    ...curation,
    updatedAt: new Date().toISOString(),
  })
  try {
    const result = await client.call(
      com.atproto.repo.putRecord,
      {
        repo: did,
        collection: FRONTPAGE_COLLECTION,
        rkey: 'self',
        swapRecord: source.cid,
        record,
        validate: false,
      },
      {service: null},
    )
    return {curation, cid: result.cid}
  } catch (error) {
    if (matchXrpcError(error, com.atproto.repo.putRecord) === 'InvalidSwap')
      throw new CurationConflictError()
    throw error
  }
}
