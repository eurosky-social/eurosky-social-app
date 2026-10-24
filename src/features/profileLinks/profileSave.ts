import {type Un$Typed} from '@atproto/lex'

import {type app} from '#/lexicons'
import {ProfileLinksChangedError} from './legacy'

type ProfileRecord = Un$Typed<app.bsky.actor.profile.Main>

/** Combine ordinary profile edits with required link edits or optional migration. */
export function prepareProfileSave({
  fields,
  links,
  linksDirty,
}: {
  fields: Pick<ProfileRecord, 'displayName' | 'description' | 'pronouns'>
  links?: {
    updates: (record: ProfileRecord) => ProfileRecord
    onSuccess: () => Promise<void>
  }
  linksDirty: boolean
}) {
  const normalized = {
    displayName: fields.displayName || undefined,
    description: fields.description || undefined,
    pronouns: fields.pronouns || undefined,
  }
  let appliedLinks = false
  return {
    fields: normalized,
    updates: links
      ? (record: ProfileRecord): ProfileRecord => {
          /* upsertProfile may call this again after a CAS conflict. */
          appliedLinks = false
          let next = record
          try {
            next = links.updates(record)
            appliedLinks = true
          } catch (e) {
            if (linksDirty || !(e instanceof ProfileLinksChangedError)) throw e
            /* Only optional migration is skipped; keep the latest link fields. */
          }
          return {...next, ...normalized}
        }
      : normalized,
    onSuccess: async () => {
      /* A skipped migration must not cache its refs or clean up native links. */
      if (appliedLinks) await links?.onSuccess()
    },
  }
}
