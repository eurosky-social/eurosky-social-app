import {useRef} from 'react'
import {type BlobRef, type l, type Un$Typed} from '@atproto/lex'
import {AtUri, type DidString, type UriString} from '@atproto/syntax'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {LINK_FAVICON_PROXY} from '#/lib/constants'
import {blobToDataUri} from '#/lib/media/util'
import {isNetworkError} from '#/lib/strings/errors'
import {isRecordNotFoundError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {useProfileUpdateMutation} from '#/state/queries/profile'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient} from '#/state/session'
import {useAgeAssurance} from '#/ageAssurance'
import {app} from '#/lexicons'
import {keepSavedHeaderOrder} from './header'
import {
  assertProfileLinksUnchanged,
  mergeLegacyWebsite,
  mergeSavedLinkRefs,
  planProfileLinksSave,
} from './legacy'
import {legacyWebsiteCheckOptions} from './legacyState'
import {
  filterModeratedLinkViews,
  linksFromProfileView,
  linksFromRecords,
} from './record'
import {type OwnProfileLinks, type ProfileLink} from './types'
import {createProfileLinkWriteState, writeProfileLinks} from './write'

/** Links replace the fork's Website UI, so they must be available to everyone. */
export function useProfileLinksEnabled() {
  return true
}

/**
 * Someone's links from their profile view, minus any that labels hide for
 * this viewer. Empty until moderation settings load, so a hidden link never
 * flashes in.
 */
export function useProfileViewLinks(
  profile: app.bsky.actor.defs.ProfileViewDetailed,
): ProfileLink[] {
  const moderationOpts = useModerationOpts()
  if (!moderationOpts) return []
  return mergeLegacyWebsite(
    linksFromProfileView(
      filterModeratedLinkViews(profile.links, moderationOpts),
    ),
    profile.website,
    (profile.links ?? []).map(link => link.url),
  )
}

/**
 * Whether the current account can add or edit its links. Age-restricted
 * accounts, like those in Safe mode, still see links but can't add them.
 */
export function useCanEditProfileLinks() {
  const enabled = useProfileLinksEnabled()
  const aa = useAgeAssurance()
  return enabled && !aa.flags.isAgeRestricted
}

type StrongRef = {uri: l.AtUriString; cid: l.CidString}

const ownProfileLinksQueryKeyRoot = 'ownProfileLinks'
const ownProfileLinksQueryKey = (did: string) =>
  createQueryKey(ownProfileLinksQueryKeyRoot, {did})

/**
 * The owner's links read from their own repo, for editing. Profile views only
 * carry icon URLs, and saving a link back needs its icon blob.
 */
export function useOwnProfileLinksQuery(did: DidString, {enabled = true} = {}) {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ownProfileLinksQueryKey(did),
    enabled,
    staleTime: STALE.MINUTES.ONE,
    queryFn: async (): Promise<OwnProfileLinks> => {
      let refs: StrongRef[] | undefined
      let website: string | undefined
      try {
        const res = await pdsClient.get(app.bsky.actor.profile, {repo: did})
        refs = res.value.links
        website = res.value.website
      } catch (e) {
        if (isRecordNotFoundError(e)) {
          return {links: [], refs: [], urls: []}
        }
        throw e
      }
      const records = await Promise.all(
        (refs ?? []).map(async ref => {
          try {
            const res = await pdsClient.get(app.bsky.actor.link, {
              repo: did,
              rkey: new AtUri(ref.uri).rkey,
            })
            return {uri: res.uri, cid: res.cid as string, value: res.value}
          } catch (e) {
            // the profile can point at a record that was since deleted
            if (isRecordNotFoundError(e)) return undefined
            throw e
          }
        }),
      )
      const resolved = records.filter(record => record !== undefined)
      const urls = resolved.map(record => record.value.url)
      const keepSavedOrder = keepSavedHeaderOrder(
        queryClient.getQueryData<OwnProfileLinks>(ownProfileLinksQueryKey(did)),
        {refs: refs ?? [], website},
      )
      return {
        ...(keepSavedOrder && {locallySaved: true}),
        links: mergeLegacyWebsite(
          linksFromRecords(refs, resolved),
          website,
          urls,
          true,
        ),
        refs: refs ?? [],
        website,
        urls,
      }
    },
  })
}

/** Keep a retry journal for confirmed writes across failed saves in this editor. */
export function useWriteProfileLinks() {
  const pdsClient = usePdsClient()
  const retryState = useRef(createProfileLinkWriteState())
  return (did: DidString, links: ProfileLink[], existing: ProfileLink[]) =>
    writeProfileLinks(pdsClient, did, links, existing, retryState.current)
}

/**
 * Keeps the owner's editor in step after a save, so reopening it doesn't show
 * the old links while the query refetches.
 */
export function useSetOwnProfileLinksCache() {
  const queryClient = useQueryClient()
  return (did: string, snapshot: OwnProfileLinks) => {
    queryClient.setQueryData(ownProfileLinksQueryKey(did), snapshot)
  }
}

/**
 * Shared by Edit Profile and inline link edits. Keep the legacy field until its
 * replacement is referenced by the same successful profile update.
 */
export function usePrepareProfileLinksSave() {
  const writeProfileLinks = useWriteProfileLinks()
  const setCache = useSetOwnProfileLinksCache()
  const canMigrate = useCanEditProfileLinks()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return async (
    did: DidString,
    links: ProfileLink[],
    snapshot: OwnProfileLinks,
  ) => {
    const assertUnchanged = (record: {
      links?: {uri: string; cid: string}[]
      website?: string
    }) => {
      try {
        assertProfileLinksUnchanged(snapshot, record)
      } catch (e) {
        void queryClient.invalidateQueries({
          queryKey: ownProfileLinksQueryKey(did),
        })
        throw e
      }
    }
    const migrating = links.find(link => link.legacyWebsite !== undefined)
    let plan = planProfileLinksSave(snapshot, links, canMigrate)
    if (
      migrating &&
      !plan.website &&
      (await queryClient.fetchQuery(
        legacyWebsiteCheckOptions(migrating.url),
      )) === 'block'
    ) {
      plan = planProfileLinksSave(snapshot, links, false)
    }
    /* Check before writing records as well as inside the profile's CAS update. */
    let current: {links?: {uri: string; cid: string}[]; website?: string} = {}
    try {
      current = (await pdsClient.get(app.bsky.actor.profile, {repo: did})).value
    } catch (e) {
      if (!isRecordNotFoundError(e)) throw e
    }
    assertUnchanged(current)
    const written = await writeProfileLinks(
      did,
      plan.links,
      snapshot.links.filter(link => link.uri),
    )
    const refs = mergeSavedLinkRefs(snapshot, written.refs) as StrongRef[]
    return {
      updates: (record: Un$Typed<app.bsky.actor.profile.Main>) => {
        assertUnchanged(record)
        return {
          ...record,
          links: refs.length ? refs : undefined,
          website: plan.website as UriString | undefined,
        }
      },
      /* A filtered AppView isn't authoritative for link refs or legacy cleanup. */
      checkCommitted: () => true,
      onSuccess: async () => {
        written.clearDraftKeys()
        const saved = plan.links.map((link, i) => ({
          ...link,
          uri: written.refs[i].uri,
          cid: written.refs[i].cid,
        }))
        const urls = [
          ...saved.map(link => link.url),
          ...snapshot.urls.filter(
            url => !snapshot.links.some(link => link.uri && link.url === url),
          ),
        ]
        setCache(did, {
          links: mergeLegacyWebsite(saved, plan.website, urls, true),
          refs,
          website: plan.website,
          urls,
          locallySaved: true,
        })
        await written.deleteRemoved()
      },
    }
  }
}

/**
 * Saves the owner's links, for edits made outside Edit Profile (tapping a link
 * on your own profile).
 */
export function useSaveProfileLinksMutation() {
  const {mutateAsync: updateProfile, isPending} = useProfileUpdateMutation()
  const prepare = usePrepareProfileLinksSave()
  const queryClient = useQueryClient()
  const save = async (
    profile: app.bsky.actor.defs.ProfileViewDetailed,
    links: ProfileLink[],
    snapshot: OwnProfileLinks,
  ) => {
    try {
      const prepared = await prepare(profile.did, links, snapshot)
      await updateProfile({
        profile,
        updates: prepared.updates,
        checkCommitted: prepared.checkCommitted,
      })
      await prepared.onSuccess()
    } catch (e) {
      void queryClient.invalidateQueries({
        queryKey: ownProfileLinksQueryKey(profile.did),
      })
      throw e
    }
  }
  return {save, isPending}
}

const FAVICON_TIMEOUT = 8e3

/**
 * Fetches a site's favicon through cardyb and uploads it to the user's PDS,
 * like a link card thumbnail. Storing the blob on the record means it's
 * scanned like any other profile image, instead of hotlinked. Resolves to
 * undefined when the site has no usable icon; the pill falls back to a globe.
 *
 * Also resolves to a data URI of the icon: the CDN can't serve the blob until
 * the profile is saved and a record points at it, so the editor shows this
 * instead.
 *
 * Always asks for the site's current icon, skipping cardyb's and the HTTP
 * cache, so re-adding a link picks up a favicon the site has since changed.
 */
export function useUploadLinkIcon() {
  const pdsClient = usePdsClient()
  return async (
    url: string,
  ): Promise<{icon: BlobRef; previewUrl: string} | undefined> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FAVICON_TIMEOUT)
    let icon: Blob
    try {
      const res = await fetch(
        `${LINK_FAVICON_PROXY()}${encodeURIComponent(url)}&fresh=true`,
        {signal: controller.signal, cache: 'no-store'},
      )
      if (!res.ok || res.headers.get('content-type') !== 'image/png') {
        return undefined
      }
      icon = await res.blob()
    } catch {
      // no icon is a normal outcome, e.g. a slow site
      return undefined
    } finally {
      clearTimeout(timeout)
    }
    try {
      const [{blob}, previewUrl] = await Promise.all([
        uploadBlob(pdsClient, icon, 'image/png'),
        blobToDataUri(icon),
      ])
      return {icon: blob, previewUrl}
    } catch (e) {
      if (!isNetworkError(e)) {
        logger.error('Failed to upload profile link icon', {safeMessage: e})
      }
      return undefined
    }
  }
}
