import {useState} from 'react'
import {useSharedValue} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {useSession} from '#/state/session'
import {TabBar} from '#/view/com/pager/TabBar'
import * as Layout from '#/components/Layout'
import {FollowingNews} from './Following'
import {NewsStories} from './Stories'

/** Public Discover, with an account-scoped Following reader after sign-in. */
export function NewsHomeScreen() {
  const {t: l} = useLingui()
  useSetTitle(l`Home`)
  const {hasSession} = useSession()
  const [tab, setTab] = useState(0)
  const dragProgress = useSharedValue(0)
  const dragState = useSharedValue<'idle' | 'dragging' | 'settling'>('idle')
  const header = hasSession ? (
    <TabBar
      fullWidth
      dragProgress={dragProgress}
      dragState={dragState}
      testID="newsFeedTabs"
      items={[l`Following`, l`Discover`]}
      selectedPage={tab}
      onSelect={page => {
        setTab(page)
        dragProgress.set(page)
      }}
    />
  ) : undefined
  return (
    <Layout.Screen testID="newsHomeScreen">
      {hasSession && tab === 0 ? (
        <FollowingNews header={header} />
      ) : (
        <NewsStories header={header} />
      )}
    </Layout.Screen>
  )
}
