import {type AtIdentifierString} from '@atproto/syntax'
import {useQueries, useQuery} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {STALE} from '#/state/queries'
import {profilesQueryKey, useProfileQuery} from '#/state/queries/profile'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {app} from '#/lexicons'
import {useDutchOutletsQuery} from './dutch/queries'
import {type DutchOutletListing} from './dutch/types'
import {NEWSROOM_PUBLISHERS} from './publishers'

/**
 * A newsroom: one of the news aggregator's outlets, as its page and every link
 * to it see it. The aggregator's outlet list is the list of newsrooms, so a
 * newsroom exists for every outlet it reads and for nothing else.
 */
export interface Newsroom {
  /** The aggregator's slug: what the page is addressed by. */
  slug: string
  /** Its Bluesky account, where it has one: profile, follow, conversation. */
  did?: string
  name: string
  /** ISO 3166-1 alpha-2, lower case. */
  country: string | null
  /** Hosts its articles live on; a post linking to one points back here. */
  domains: string[]
  /** Theme slug -> its current stories in the theme (see `/api/outlets`). */
  themes: Record<string, number>
  /** Brand accent, for the few outlets given one (see `publishers.ts`). */
  accent?: string
  /**
   * Accounts of its desks and journalists: those the aggregator files under
   * the outlet, then any added by hand in `publishers.ts`. Shown as its
   * reporters and merged into its conversation.
   */
  reporterDids: string[]
}

/**
 * Every newsroom. Undefined until the aggregator's outlets load, and for good
 * where it is not configured or the reader is signed out: there are no
 * newsrooms without it.
 */
export function useNewsrooms(): {
  newsrooms: Newsroom[] | undefined
  isLoading: boolean
  isError: boolean
} {
  const {outlets, isLoading, isError} = useDutchOutletsQuery()
  return {
    newsrooms: outlets?.map(newsroomFromOutlet),
    isLoading,
    isError,
  }
}

/**
 * Brand extras the aggregator does not hold, by the outlet's account. Kept in
 * `publishers.ts`, whose list otherwise only feeds the explore page's RSS
 * fallback.
 */
const EXTRAS = new Map(
  NEWSROOM_PUBLISHERS.map(publisher => [
    publisher.did as string,
    {accent: publisher.accent, reporterDids: publisher.reporterDids},
  ]),
)

export function newsroomFromOutlet(outlet: DutchOutletListing): Newsroom {
  const extras = outlet.did ? EXTRAS.get(outlet.did) : undefined
  const reporterDids = [
    ...new Set([
      ...(outlet.sources?.accounts ?? []),
      ...(extras?.reporterDids ?? []),
    ]),
  ].filter(did => did !== outlet.did)
  return {
    slug: outlet.slug,
    did: outlet.did ?? undefined,
    name: outlet.name,
    country: outlet.country,
    domains: outlet.domains,
    themes: outlet.themes ?? {},
    accent: extras?.accent,
    reporterDids,
  }
}

/** The newsroom a page address names: its slug, or its account's DID. */
export function findNewsroom(
  newsrooms: Newsroom[] | undefined,
  ref: string | undefined,
): Newsroom | undefined {
  if (!ref || !newsrooms) return undefined
  return newsrooms.find(
    newsroom => newsroom.slug === ref || newsroom.did === ref,
  )
}

/**
 * The newsroom whose site a URL points at, if any. Matches the hostname
 * against each newsroom's domains, subdomains included, so `www.ft.com` and
 * `rss.nytimes.com` resolve to their outlets.
 */
export function findNewsroomByUrl(
  newsrooms: Newsroom[] | undefined,
  url: string,
): Newsroom | undefined {
  if (!newsrooms) return undefined
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }
  return newsrooms.find(newsroom =>
    newsroom.domains.some(
      domain => hostname === domain || hostname.endsWith('.' + domain),
    ),
  )
}

/** The page of a newsroom. */
export function newsroomPath(newsroom: Pick<Newsroom, 'slug'>): string {
  return `/newsroom/${encodeURIComponent(newsroom.slug)}`
}

/** The themes a newsroom covers most, by its current stories, busiest first. */
export function topThemes(newsroom: Pick<Newsroom, 'themes'>, count: number) {
  return Object.entries(newsroom.themes)
    .filter(([, stories]) => stories > 0)
    .sort(([x, xs], [y, ys]) => ys - xs || x.localeCompare(y))
    .slice(0, count)
    .map(([theme]) => theme)
}

/** How many current stories a newsroom has, across every theme. */
export function storyCount(newsroom: Pick<Newsroom, 'themes'>): number {
  return Object.values(newsroom.themes).reduce((sum, n) => sum + n, 0)
}

/**
 * The live profiles of the newsrooms with an account, keyed by DID. Chunked
 * because `getProfiles` takes at most 25 actors, and each chunk shares the
 * app's profiles cache.
 */
export function useNewsroomProfiles(
  newsrooms: Pick<Newsroom, 'did'>[] | undefined,
): Map<string, app.bsky.actor.defs.ProfileViewDetailed> {
  const appviewClient = useAppviewClient()
  const dids = [
    ...new Set(
      (newsrooms ?? [])
        .map(newsroom => newsroom.did)
        .filter((did): did is string => !!did),
    ),
  ]
  const results = useQueries({
    queries: chunk(dids, 25).map(actors => ({
      staleTime: STALE.MINUTES.FIVE,
      queryKey: profilesQueryKey(actors),
      queryFn: () =>
        appviewClient.call(app.bsky.actor.getProfiles, {
          actors: actors as AtIdentifierString[],
        }),
    })),
  })
  const profiles = new Map<string, app.bsky.actor.defs.ProfileViewDetailed>()
  for (const result of results) {
    for (const profile of result.data?.profiles ?? []) {
      profiles.set(profile.did, profile)
    }
  }
  return profiles
}

/**
 * How many reporters' posts the conversation merges at most. Each is an author
 * feed read of its own, and a verifying outlet can have a hundred.
 */
const CONVERSATION_REPORTERS = 24

/** How many verification records are read at most, a page of 100 at a time. */
const MAX_VERIFIED = 300

const createVerifiedJournalistsQueryKey = (args: {did: string}) =>
  createQueryKey('newsroomVerifiedJournalists', args)

/**
 * The journalists an outlet has verified. An outlet that is a Bluesky trusted
 * verifier publishes an `app.bsky.graph.verification` record for each account
 * it vouches for - its staff, in practice - so the record set is its masthead,
 * kept by the outlet itself. Read from its own repo: the records are public,
 * and only the PDS that hosts the repo lists them.
 */
function useVerifiedJournalistsQuery({did}: {did?: string}) {
  const {data: profile} = useProfileQuery({did})
  const isVerifier = profile?.verification?.trustedVerifierStatus === 'valid'
  return useQuery({
    queryKey: createVerifiedJournalistsQueryKey({did: did ?? ''}),
    /* Mastheads change on the order of hires. */
    staleTime: STALE.HOURS.ONE,
    enabled: !!did && isVerifier,
    async queryFn() {
      const {pds} = await resolveDidAndPds(did!)
      const subjects: string[] = []
      let cursor: string | undefined
      do {
        const url = new URL('/xrpc/com.atproto.repo.listRecords', pds)
        url.searchParams.set('repo', did!)
        url.searchParams.set('collection', 'app.bsky.graph.verification')
        url.searchParams.set('limit', '100')
        if (cursor) url.searchParams.set('cursor', cursor)
        const res = await fetch(url.toString())
        if (!res.ok) throw new Error(`listRecords ${res.status} for ${did}`)
        const page = (await res.json()) as {
          cursor?: string
          records: {value: {subject?: unknown}}[]
        }
        for (const record of page.records) {
          const subject = record.value.subject
          if (typeof subject === 'string' && subject.startsWith('did:')) {
            subjects.push(subject)
          }
        }
        cursor = page.records.length > 0 ? page.cursor : undefined
      } while (cursor && subjects.length < MAX_VERIFIED)
      return subjects
    },
  })
}

/**
 * A newsroom's reporters: the accounts the aggregator files under it and any
 * added by hand, then the journalists it has verified, if it is a verifier.
 */
export function useNewsroomReporters(newsroom: Newsroom | undefined): {
  reporterDids: string[]
  /** The accounts its conversation merges: its own, then a bounded few. */
  conversationDids: string[]
  isLoading: boolean
} {
  const {data: verified, isLoading} = useVerifiedJournalistsQuery({
    did: newsroom?.did,
  })
  if (!newsroom) return {reporterDids: [], conversationDids: [], isLoading}
  const reporterDids = [
    ...new Set([...newsroom.reporterDids, ...(verified ?? [])]),
  ].filter(did => did !== newsroom.did)
  return {
    reporterDids,
    conversationDids: [
      ...(newsroom.did ? [newsroom.did] : []),
      ...reporterDids.slice(0, CONVERSATION_REPORTERS),
    ],
    isLoading,
  }
}
