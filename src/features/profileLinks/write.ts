import {TID} from '@atproto/common-web'
import {type Client, getBlobCidString, type l} from '@atproto/lex'
import {
  AtUri,
  type DidString,
  toDatetimeString,
  type UriString,
} from '@atproto/syntax'

import {isNetworkError} from '#/lib/strings/errors'
import {isRecordNotFoundError, matchXrpcError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {app, com} from '#/lexicons'
import {ProfileLinksChangedError} from './legacy'
import {type ProfileLink} from './types'

type StrongRef = {uri: l.AtUriString; cid: l.CidString}
type StagedWrite = {baseCid?: string; link: ProfileLink; ref: StrongRef}

/** Confirmed writes belong to this edit session, not to the frozen repo snapshot. */
export function createProfileLinkWriteState() {
  return {
    draftKeys: new Map<string, string>(),
    staged: new Map<string, StagedWrite>(),
  }
}

function sameContent(a: ProfileLink, b: ProfileLink) {
  return (
    a.url === b.url &&
    a.title === b.title &&
    (a.icon && getBlobCidString(a.icon)) ===
      (b.icon && getBlobCidString(b.icon))
  )
}

/**
 * Stage link records before the profile points at them. Journal acknowledged
 * writes so a failed profile save or sibling write can be retried with CAS,
 * without accepting another client's changes or rebasing the editor snapshot.
 */
export async function writeProfileLinks(
  client: Client,
  did: DidString,
  links: ProfileLink[],
  existing: ProfileLink[],
  state: ReturnType<typeof createProfileLinkWriteState>,
) {
  const existingByUri = new Map(
    existing.flatMap(link => (link.uri ? [[link.uri, link]] : [])),
  )
  const results = await Promise.allSettled(
    links.map(async (link): Promise<StrongRef> => {
      const before = link.uri ? existingByUri.get(link.uri) : undefined
      const draftKey = JSON.stringify([
        did,
        link.url,
        link.title,
        link.icon && getBlobCidString(link.icon),
      ])
      let rkey = before?.uri
        ? new AtUri(before.uri).rkey
        : state.draftKeys.get(draftKey)
      if (!rkey) {
        rkey = TID.nextStr()
        state.draftKeys.set(draftKey, rkey)
      }
      const uri = before?.uri ?? `at://${did}/app.bsky.actor.link/${rkey}`
      const staged = state.staged.get(uri)
      if (staged) {
        if (before?.cid !== staged.baseCid && before?.cid !== staged.ref.cid) {
          throw new ProfileLinksChangedError()
        }
        /* A successful prior attempt is reusable only while it is still current. */
        try {
          const current = await client.get(app.bsky.actor.link, {
            repo: did,
            rkey,
          })
          if (current.cid !== staged.ref.cid)
            throw new ProfileLinksChangedError()
        } catch (e) {
          if (isRecordNotFoundError(e)) throw new ProfileLinksChangedError()
          throw e
        }
        if (sameContent(staged.link, link)) return staged.ref
      } else if (before?.uri && before.cid && sameContent(before, link)) {
        return {uri: before.uri as l.AtUriString, cid: before.cid}
      }
      const res = await client
        .put(
          app.bsky.actor.link,
          {
            url: link.url as UriString,
            title: link.title,
            icon: link.icon,
            createdAt: toDatetimeString(new Date()),
          },
          {repo: did, rkey, swapRecord: staged?.ref.cid ?? before?.cid},
        )
        .catch((e: unknown) => {
          if (matchXrpcError(e, com.atproto.repo.putRecord) === 'InvalidSwap') {
            throw new ProfileLinksChangedError()
          }
          throw e
        })
      const ref = {uri: res.uri, cid: res.cid}
      state.staged.set(uri, {
        baseCid: staged?.baseCid ?? before?.cid,
        link: {...link},
        ref,
      })
      return ref
    }),
  )
  /* Don't allow a retry while siblings from the failed attempt are still writing. */
  const failed = results.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
  const refs = results.flatMap(result =>
    result.status === 'fulfilled' ? [result.value] : [],
  )
  const kept = new Set(refs.map(ref => ref.uri as string))
  const removed = existing.filter(link => link.uri && !kept.has(link.uri))
  return {
    refs,
    clearDraftKeys: () => {
      state.draftKeys.clear()
      state.staged.clear()
    },
    deleteRemoved: async () => {
      try {
        await Promise.all(
          removed.map(link =>
            client.delete(app.bsky.actor.link, {
              repo: did,
              rkey: new AtUri(link.uri!).rkey,
            }),
          ),
        )
      } catch (e) {
        if (!isNetworkError(e))
          logger.error('Failed to delete profile link records', {
            safeMessage: e,
          })
      }
    },
  }
}
