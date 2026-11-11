import {useLingui} from '@lingui/react/macro'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {NewsStories} from '#/screens/NewsHome/Stories'
import * as Layout from '#/components/Layout'

/** Every publisher's stories, newest first: no ranking and no recommendations. */
export function NewsLatestScreen() {
  const {t: l} = useLingui()
  const title = l({message: 'News', context: 'all news stories, latest first'})
  useSetTitle(title)
  return (
    <Layout.Screen testID="newsLatestScreen">
      <NewsStories mode="latest" header={<PageHeader title={title} />} />
    </Layout.Screen>
  )
}

function PageHeader({title}: {title: string}) {
  return (
    <Layout.Header.Outer>
      <Layout.Header.MenuButton />
      <Layout.Header.Content>
        <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
      </Layout.Header.Content>
      <Layout.Header.Slot />
    </Layout.Header.Outer>
  )
}
