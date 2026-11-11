import {useLingui} from '@lingui/react/macro'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import * as Layout from '#/components/Layout'
import {NewsStories} from './Stories'

/** Discover: recommendations for everyone. Following and News have their own pages. */
export function NewsHomeScreen() {
  const {t: l} = useLingui()
  useSetTitle(l`Discover`)
  return (
    <Layout.Screen testID="newsHomeScreen">
      <NewsStories />
    </Layout.Screen>
  )
}
