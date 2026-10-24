import {useState} from 'react'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {NewsFeedSetup} from './components/NewsFeedSetup'
import {NewsFeedTab} from './components/NewsFeedTab'
import {
  makeDefaultNewsFeedPrefs,
  type NewsFeedPrefs,
  useNewsFeedPrefsQuery,
} from './state/prefs'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsFeed'>

export function NewsFeedScreen({}: Props) {
  const {data: prefs, isLoading} = useNewsFeedPrefsQuery()

  // Set while editing an existing feed from its header.
  const [editing, setEditing] = useState(false)
  // Optimistic copy so the feed shows immediately after saving, before the
  // record query refetches.
  const [savedPrefs, setSavedPrefs] = useState<NewsFeedPrefs | null>(null)

  const effective = prefs ?? savedPrefs
  const isConfigured = !!effective && effective.topics.length > 0

  // With no welcome screen, an unconfigured feed drops straight into setup.
  if (editing || (!isLoading && !isConfigured)) {
    return (
      <NewsFeedSetup
        // Remounts between first-time setup and editing, so each starts fresh.
        key={editing ? 'edit' : 'first'}
        // Seeded from the record if one exists so setup never silently drops
        // saved data.
        initialDraft={effective ?? makeDefaultNewsFeedPrefs()}
        hasRecord={!!effective}
        onExit={() => {
          // Editing an existing feed: just close setup and stay on the feed.
          if (isConfigured) {
            setEditing(false)
            return true
          }
          // First-time setup: nothing to return to, so let the back button
          // leave.
        }}
        onSaved={draft => {
          setSavedPrefs(draft)
          setEditing(false)
        }}
        onRemoved={() => setSavedPrefs(null)}
      />
    )
  }

  if (isConfigured && effective) {
    return <NewsFeedTab prefs={effective} onEdit={() => setEditing(true)} />
  }

  // Loading.
  return (
    <Layout.Screen testID="newsFeedScreen">
      <Layout.Center style={[a.flex_1, a.justify_center, a.align_center]}>
        <Loader size="xl" />
      </Layout.Center>
    </Layout.Screen>
  )
}
