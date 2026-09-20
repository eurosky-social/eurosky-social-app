import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {atoms as a, useTheme} from '#/alf'
import {Bubbles_Stroke2_Corner2_Rounded as BubblesIcon} from '#/components/icons/Bubble'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {NewsroomSwitcherMenu} from '../components/NewsroomSwitcherMenu'
import {getNewsroomPublisherByDid, type NewsroomPublisher} from '../publishers'
import {useArticleDiscussionQuery} from '../queries'
import {ArticleHeader} from './ArticleHeader'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsroomArticle'>

/**
 * A focused stop between a story card and the article itself: the piece shown
 * large, then the full in-network discussion as a feed, so the reader sees the
 * whole conversation before leaving for the outlet's site.
 *
 * The discussion is every post that features the article, ranked with the
 * publisher's own post first (see `useArticleDiscussionQuery`), rendered as
 * real, interactive post cards via the `posts|` feed rather than a static list.
 */
export function NewsroomArticleScreen({route, navigation}: Props) {
  const {url, title, image, description, publishedAt, outletName, outletDid} =
    route.params

  const {data, isLoading} = useArticleDiscussionQuery({
    url,
    publisherDid: outletDid,
  })
  const posts = data?.posts ?? []
  const sharers = posts.map(post => post.author)

  // The article's outlet is the switcher's selected org when it is a registered
  // publisher; a bare feed outlet leaves nothing selected.
  const currentPublisher = outletDid
    ? getNewsroomPublisherByDid(outletDid)
    : undefined

  function onSelectPublisher(publisher: NewsroomPublisher) {
    navigation.navigate('Newsroom', {name: publisher.did})
  }

  function onSelectExplore() {
    navigation.navigate('NewsroomExplore')
  }

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
        <Layout.Header.Slot>
          <NewsroomSwitcherMenu
            selectedId={currentPublisher?.id}
            onSelect={onSelectPublisher}
            onSelectExplore={onSelectExplore}
          />
        </Layout.Header.Slot>
      </Layout.Header.Outer>

      {posts.length > 0 ? (
        <PostFeed
          feed={`posts|${posts.map(post => post.uri).join(',')}`}
          disablePoll
          ListHeaderComponent={header}
          renderEmptyState={ArticleDiscussionEmpty}
        />
      ) : (
        <Layout.Content>
          {header}
          {isLoading ? (
            <View style={[a.py_2xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : (
            <ArticleDiscussionEmpty />
          )}
        </Layout.Content>
      )}
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
