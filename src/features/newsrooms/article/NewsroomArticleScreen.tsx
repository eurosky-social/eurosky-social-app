import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Bubbles_Stroke2_Corner2_Rounded as BubblesIcon} from '#/components/icons/Bubble'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useArticleDiscussionQuery} from '../queries'
import {ArticleHeader} from './ArticleHeader'
import {
  type ArticleThreadItem,
  ArticleThreadPost,
  useArticleThreadItems,
} from './ArticleThreads'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsroomArticle'>

/** Space under the last post of the discussion. */
const BOTTOM_BUFFER = 200

/**
 * A focused stop between a story card and the article itself: the piece shown
 * large, then the in-network discussion, so the reader sees the conversation
 * before leaving for the outlet's site.
 *
 * The discussion is every post that features the article, each with a few of
 * its replies, rendered as feed slices (see `useArticleThreadItems`).
 */
export function NewsroomArticleScreen({route}: Props) {
  const {url, title, image, description, publishedAt, outletName, outletDid} =
    route.params

  const {data, isLoading} = useArticleDiscussionQuery({
    url,
    publisherDid: outletDid,
  })
  const posts = data?.posts ?? []
  const sharers = posts.map(post => post.author)
  const items = useArticleThreadItems({posts, anchorUri: data?.anchor?.uri})

  const header = (
    <Layout.Center>
      <ArticleHeader
        url={url}
        title={title}
        image={image}
        description={description}
        publishedAt={publishedAt}
        outletName={outletName}
        outletDid={outletDid}
        sharers={sharers}
        anchor={data?.anchor ?? undefined}
      />
    </Layout.Center>
  )

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Article</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
      </Layout.Header.Outer>

      <List
        data={items}
        keyExtractor={(item: ArticleThreadItem) => item.key}
        renderItem={({item}: {item: ArticleThreadItem}) => (
          <ArticleThreadPost item={item} />
        )}
        ListHeaderComponent={header}
        /* Room past the last post, so it can scroll clear of the bottom bar. */
        ListFooterComponent={<View style={{height: BOTTOM_BUFFER}} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={[a.py_2xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : (
            <ArticleDiscussionEmpty />
          )
        }
      />
    </Layout.Screen>
  )
}

/** Nothing in the network has picked the article up yet. */
function ArticleDiscussionEmpty() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View style={[a.p_2xl, a.align_center, a.gap_sm]}>
      <BubblesIcon size="xl" style={[t.atoms.text_contrast_low]} />
      <Text style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
        {l({
          message: 'No one in the network has posted about this yet.',
          comment:
            'Empty state under a news article, where its discussion goes',
        })}
      </Text>
    </View>
  )
}
