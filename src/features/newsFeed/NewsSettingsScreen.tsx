import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {NewsFeedSetup} from './components/NewsFeedSetup'
import {makeDefaultNewsFeedPrefs, useNewsFeedPrefsQuery} from './state/prefs'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsSettings'>

/**
 * The news page's settings: the same topics, regions and accounts as the news
 * feed's setup, editing the same record. The news page boosts the stories that
 * match them, so saving returns there.
 */
export function NewsSettingsScreen({navigation}: Props) {
  const {data: prefs, isLoading} = useNewsFeedPrefsQuery()

  function leave() {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.navigate('NewsroomExplore')
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
