import {useDutchOutletsQuery} from '#/features/news/dutch/queries'
import {accountsForInterests} from '#/features/news/explore/interests'
import {useNewsFeedPrefsQuery} from './prefs'

/**
 * The accounts the news feed reads: those of the outlets the reader's
 * interests cover, the same interests the news page is shaped by. With
 * `selectedId`, just that interest's; one no longer saved reads them all.
 */
export function useInterestAccounts(selectedId?: string) {
  const {data: prefs, isLoading: prefsLoading} = useNewsFeedPrefsQuery()
  const interests = prefs?.interests ?? []
  const selected = interests.find(interest => interest.id === selectedId)
  const hasInterests = interests.length > 0
  const {outlets, isLoading, isError, refetch} = useDutchOutletsQuery({
    enabled: hasInterests,
  })

  return {
    hasInterests,
    /** Undefined until the outlets load. */
    dids: outlets
      ? accountsForInterests(selected ? [selected] : interests, outlets)
      : undefined,
    isLoading: prefsLoading || (hasInterests && isLoading),
    isError: hasInterests && isError,
    refetch,
  }
}
