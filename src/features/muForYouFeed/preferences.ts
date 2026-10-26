import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'
import {getPreferences, overwriteSavedFeeds, upsertNux} from '@bsky/sdk'

import {
  FU_FEED_URI,
  FU_SAVED_FEED,
  TIMELINE_SAVED_FEED,
  VIDEO_SAVED_FEED,
} from '#/lib/constants'
import {Nux} from '#/state/queries/nuxs/definitions'
import {type app} from '#/lexicons'

type SavedFeed = app.bsky.actor.defs.SavedFeed

/** Keeps the existing saved-feed ID and all other feeds in their original order. */
export function prependMuForYouFeed(feeds: SavedFeed[]): SavedFeed[] {
  const existing = feeds.find(isMuForYouFeed)
  return [
    {...(existing ?? {...FU_SAVED_FEED, id: TID.nextStr()}), pinned: true},
    ...feeds.filter(feed => !isMuForYouFeed(feed)),
  ]
}

export function isMuForYouFeed(feed: SavedFeed): boolean {
  return feed.type === 'feed' && feed.value === FU_FEED_URI
}

/** Replaces the Discover default, while retaining explicit starter-pack choices. */
export function getOnboardingFeeds(
  starterPackFeeds: {uri: string}[] = [],
): SavedFeed[] {
  const feeds: SavedFeed[] = [
    {...FU_SAVED_FEED, id: TID.nextStr()},
    {...TIMELINE_SAVED_FEED, id: TID.nextStr()},
    {...VIDEO_SAVED_FEED, id: TID.nextStr()},
  ]
  const seen = new Set(feeds.map(feed => feed.value))
  for (const {uri} of starterPackFeeds) {
    if (!seen.has(uri)) {
      feeds.push({type: 'feed', value: uri, pinned: true, id: TID.nextStr()})
      seen.add(uri)
    }
  }
  return feeds
}

/** Only called for newly created accounts completing onboarding. */
export async function saveOnboardingFeeds(
  client: Client,
  starterPackFeeds?: {uri: string}[],
) {
  await client.call(overwriteSavedFeeds, getOnboardingFeeds(starterPackFeeds))
  // Do not offer the feed again if a new user later chooses to unpin it.
  await client.call(upsertNux, {
    id: Nux.MuForYouFeedAnnouncement,
    completed: true,
  })
}

/** Read fresh preferences at acceptance time, not the dialog's cached snapshot. */
export async function pinMuForYouFeed(client: Client) {
  const {savedFeeds} = await client.call(getPreferences)
  await client.call(overwriteSavedFeeds, prependMuForYouFeed(savedFeeds))
}
