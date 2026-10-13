import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {IS_DUTCH_API_CONFIGURED} from '#/features/newsrooms/dutch/config'
import {NewsInterestsSetup} from './components/interests/NewsInterestsSetup'
import {NewsFeedSetup} from './components/NewsFeedSetup'
import {makeDefaultNewsFeedPrefs, useNewsFeedPrefsQuery} from './state/prefs'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsSettings'>

/**
 * The news page's settings: its languages and the reader's interests, each a
 * tab on the page, so saving returns there. They are kept in the news feed's
 * record. Without the news aggregator the page reads RSS, which interests
 * cannot filter, so it falls back to the news feed's topics, regions and
 * accounts, which the page boosts the stories that match.
 */
export function NewsSettingsScreen({navigation}: Props) {
  const {data: prefs, isLoading} = useNewsFeedPrefsQuery()

  /*
   * Leaving replaces the screen rather than stacking the news page on it: a
   * settings screen left mounted underneath keeps the draft it opened with,
   * and saving from it later would overwrite whatever was saved since.
   */
  function leave() {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.replace('NewsroomExplore')
    }
  }

  if (isLoading) {
    return (
      <Layout.Screen testID="newsSettingsScreen">
        <Layout.Center style={[a.flex_1, a.justify_center, a.align_center]}>
          <Loader size="xl" />
        </Layout.Center>
      </Layout.Screen>
    )
  }

  if (IS_DUTCH_API_CONFIGURED) {
    return (
      <NewsInterestsSetup
        initialDraft={prefs ?? makeDefaultNewsFeedPrefs()}
        onExit={leave}
        onSaved={leave}
      />
    )
  }

  return (
    <NewsFeedSetup
      initialDraft={prefs ?? makeDefaultNewsFeedPrefs()}
      hasRecord={!!prefs}
      onExit={() => {
        leave()
        return true
      }}
      onSaved={leave}
    />
  )
}
