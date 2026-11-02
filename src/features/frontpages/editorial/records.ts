import {type Client, type l} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'

import {isRecordNotFoundError, matchXrpcError} from '#/lib/xrpc-error'
import {com} from '#/lexicons'
import {
  type Curation,
  curationRecordSchema,
  defaultCuration,
  fromLegacyRecord,
  fromSlotsRecord,
  FRONTPAGE_COLLECTION,
  legacyRecordSchema,
  slotsRecordSchema,
} from './curation'

export type CurationSnapshot = {curation: Curation; cid: l.CidString | null}

export class CurationConflictError extends Error {
  constructor() {
    super('The front page changed in another editor.')
    this.name = 'CurationConflictError'
  }
}

/** Absence means the default page. Network failures or invalid layouts are errors, not the default page. Every record shape is read; the current one is written. */
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
    const value = result.value as {version?: unknown}
    if (value?.version === 1)
      return {
        cid: result.cid,
        curation: fromLegacyRecord(legacyRecordSchema(did).parse(value)),
      }
    if (value?.version === 2)
      return {
        cid: result.cid,
        curation: fromSlotsRecord(slotsRecordSchema(did).parse(value)),
      }
    const record = curationRecordSchema(did).parse(value)
    return {
      cid: result.cid,
      curation: {
        cover: record.cover,
        sections: record.sections,
        sizes: record.sizes,
        starterPackViews: record.starterPackViews,
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
    version: 3,
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
