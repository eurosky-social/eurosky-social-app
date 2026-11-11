import {useLingui} from '@lingui/react/macro'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {FollowingNews} from '#/screens/NewsHome/Following'
import * as Layout from '#/components/Layout'

/** Stories from the publishers you follow: Top stories, then Latest. */
export function NewsFollowingScreen() {
  const {t: l} = useLingui()
  const title = l`Following`
  useSetTitle(title)
  return (
    <Layout.Screen testID="newsFollowingScreen">
      <FollowingNews
        header={
          <Layout.Header.Outer>
            <Layout.Header.MenuButton />
            <Layout.Header.Content>
              <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.Slot />
          </Layout.Header.Outer>
        }
      />
    </Layout.Screen>
  )
}
