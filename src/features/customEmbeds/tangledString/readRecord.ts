import {type AtIdentifierString} from '@atproto/syntax'
import {
  type ReadTangledStringRecord,
  TANGLED_STRING_COLLECTION,
} from '@social-app-community/embed-tangled-string'

import {createServiceClient} from '#/lib/lexClient'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {com} from '#/lexicons'

export const readTangledStringRecord: ReadTangledStringRecord = async (
  match,
  {signal},
) => {
  const {did, pds} = await resolveDidAndPds(match.actor)
  const record = await createServiceClient(pds).call(
    com.atproto.repo.getRecord,
    {
      repo: did as AtIdentifierString,
      collection: TANGLED_STRING_COLLECTION,
      rkey: match.rkey,
      ...(match.source === 'record' ? {cid: match.ref.cid} : null),
    },
    {signal},
  )

  return record
}
