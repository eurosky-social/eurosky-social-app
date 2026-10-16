import {useLingui} from '@lingui/react/macro'

import {getLocalizedFeedName} from '#/lib/strings/feed-names'
import {
  type SavedFeedSourceInfo,
  usePinnedFeedsInfos,
} from '#/state/queries/feed'
import {type FeedDescriptor} from '#/state/queries/post-feed'

export type MyFeedOption = {
  id: FeedDescriptor
  label: string
  info: SavedFeedSourceInfo
}

/** The feed shown when none is chosen. */
export const DEFAULT_MY_FEED: FeedDescriptor = 'following'

/**
 * The user's pinned feeds, shared by the page's tabs and the desktop right
 * rail so both list the same feeds with the same labels (as the events page
 * does with its feeds).
 */
export function useMyFeedOptions() {
  const {i18n} = useLingui()
  const {data: pinnedFeedInfos, isLoading} = usePinnedFeedsInfos()

  const options: MyFeedOption[] = (pinnedFeedInfos ?? []).map(info => ({
    id: info.feedDescriptor,
    label: getLocalizedFeedName(info, i18n),
    info,
  }))

  /**
   * Maps the `feed` route param to one of the user's feeds, falling back to
   * Following for a missing or unknown param.
   */
  const resolveFeed = (param?: string): FeedDescriptor =>
    options.find(option => option.id === param)?.id ?? DEFAULT_MY_FEED

  return {options, resolveFeed, isLoading}
}
