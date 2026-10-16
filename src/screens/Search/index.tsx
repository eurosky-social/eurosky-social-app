import {
  type NativeStackScreenProps,
  type SearchTabNavigatorParams,
} from '#/lib/routes/types'
import {IS_PARTNER_PREVIEW} from '#/env'
import {OsoExploreHub} from './OsoExploreHub'
import {SearchScreenShell} from './Shell'

export function SearchScreen(
  props: NativeStackScreenProps<SearchTabNavigatorParams, 'Search'>,
) {
  const queryParam = props.route?.params?.q ?? ''

  if (
    IS_PARTNER_PREVIEW &&
    !queryParam &&
    props.route?.params?.view !== 'explore'
  ) {
    return <OsoExploreHub />
  }

  return (
    <SearchScreenShell
      queryParam={queryParam}
      testID="searchScreen"
      isExplore
    />
  )
}
