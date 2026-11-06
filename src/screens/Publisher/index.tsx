import {View} from 'react-native'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {usePostFeedQuery} from '#/state/queries/post-feed'
import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {ScreenHider} from '#/components/moderation/ScreenHider'
import {Text} from '#/components/Typography'
import {ArticleList} from '#/features/articles/ArticleList'
import {articlesFromAuthorFeed} from '#/features/articles/articles'
import {articleModeration} from '#/features/articles/moderation'
import {usePageGeometry} from '#/features/product/layout/usePageGeometry'
import {findPublisher} from '#/features/publishers/publishers'
import {type app} from '#/lexicons'
import {PublisherProfileDetails} from './ProfileDetails'

/** A reader-only publisher surface, independent of the editorial layout editor. */
export function PublisherScreen({
  route,
  navigation,
}: NativeStackScreenProps<CommonNavigatorParams, 'Publisher'>) {
  const selected = findPublisher(route.params?.publisher)
  const {t: l} = useLingui()
  useSetTitle(selected?.name ?? l`Publisher`)
  const back = (
    <Layout.Header.BackButton
      onPress={event => {
        if (!navigation.canGoBack()) {
          event.preventDefault()
          navigation.navigate('PublisherDirectory')
        }
      }}
    />
  )
  return (
    <Layout.Screen testID="publisherScreen">
      {selected ? (
        <PublisherAccount
          key={selected.did}
          did={selected.did}
          name={selected.name}
          back={back}
        />
      ) : (
        <>
          <Layout.Content>
            <PublisherHeader back={back} />
            <Status>
              <Text>
                <Trans>Publisher not found.</Trans>
              </Text>
              <Link
                to={{screen: 'PublisherDirectory'}}
                label={l`Browse publishers`}
                color="secondary"
                size="small">
                <ButtonText>
                  <Trans>Browse publishers</Trans>
                </ButtonText>
              </Link>
            </Status>
          </Layout.Content>
        </>
      )}
    </Layout.Screen>
  )
}

function PublisherAccount({
  did,
  name,
  back,
}: {
  did: string
  name: string
  back: React.ReactNode
}) {
  const opts = useModerationOpts()
  const profile = useProfileQuery({did})
  if (profile.isError)
    return (
      <>
        <Layout.Content>
          <PublisherHeader back={back} />
          <Status>
            <Text>
              <Trans>Couldn’t load this publisher.</Trans>
            </Text>
            <Retry onPress={() => void profile.refetch()} />
          </Status>
        </Layout.Content>
      </>
    )
  if (!profile.data || !opts)
    return (
      <>
        <Layout.Content>
          <PublisherHeader back={back} />
          <Status>
            <Loader size="lg" />
          </Status>
        </Layout.Content>
      </>
    )
  return (
    <PublisherArticles
      profile={profile.data}
      name={name}
      moderationOpts={opts}
      back={back}
    />
  )
}

function PublisherArticles({
  profile: unshadowedProfile,
  name,
  moderationOpts,
  back,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  name: string
  moderationOpts: ModerationOpts
  back: React.ReactNode
}) {
  const {t: l} = useLingui()
  const profile = useProfileShadow(unshadowedProfile)
  const moderation = moderateProfile(profile, moderationOpts)
  const blocked = !!profile.viewer?.blocking || !!profile.viewer?.blockedBy
  const {wide} = usePageGeometry()
  const feed = usePostFeedQuery(
    `author|${profile.did}|posts_no_replies`,
    undefined,
    {enabled: !blocked},
  )
  const articles = articlesFromAuthorFeed(
    feed.data?.pages.flatMap(page => page.slices) ?? [],
    profile.did,
  ).filter(article => !articleModeration(article, moderationOpts).filter)

  return (
    <ScreenHider
      style={a.flex_1}
      modui={moderation.ui('profileView')}
      screenDescription={l`publisher`}>
      <Layout.Content contentContainerStyle={[a.pb_4xl]}>
        <PublisherHeader back={back} />
        <View style={[a.px_lg]}>
          {!blocked && (
            <PublisherProfileDetails
              name={name}
              profile={profile}
              moderationOpts={moderationOpts}
            />
          )}
          {blocked ? (
            <Status>
              <Text>
                <Trans>Posts are unavailable for this account.</Trans>
              </Text>
            </Status>
          ) : (
            <>
              {feed.isPending ? (
                <Status>
                  <Loader size="lg" />
                </Status>
              ) : (
                <ArticleList articles={articles} wide={wide} />
              )}
              {feed.isError ? (
                <Status>
                  <Text>
                    <Trans>Couldn’t load stories.</Trans>
                  </Text>
                  <Retry
                    onPress={() =>
                      void (feed.isFetchNextPageError
                        ? feed.fetchNextPage()
                        : feed.refetch())
                    }
                  />
                </Status>
              ) : !feed.isPending && !articles.length ? (
                <Status>
                  <Text>
                    <Trans>No stories yet.</Trans>
                  </Text>
                </Status>
              ) : null}
              {feed.hasNextPage && !feed.isError && (
                <Status>
                  <Button
                    testID="publisherMoreStories"
                    label={l`More stories`}
                    color="secondary"
                    size="small"
                    disabled={feed.isFetching}
                    onPress={() => void feed.fetchNextPage()}>
                    <ButtonText>
                      {feed.isFetchingNextPage ? (
                        <Trans>Loading…</Trans>
                      ) : (
                        <Trans>More stories</Trans>
                      )}
                    </ButtonText>
                  </Button>
                </Status>
              )}
            </>
          )}
        </View>
      </Layout.Content>
    </ScreenHider>
  )
}

/** Ordinary scroll content: never reserve a sticky header above the articles. */
function PublisherHeader({back}: {back: React.ReactNode}) {
  return (
    <View testID="publisherBackRow" style={[a.flex_row, a.px_lg, a.py_sm]}>
      {back}
    </View>
  )
}

function Status({children}: {children: React.ReactNode}) {
  return <View style={[a.p_lg, a.align_center, a.gap_md]}>{children}</View>
}

function Retry({onPress}: {onPress: () => void}) {
  const {t: l} = useLingui()
  return (
    <Button
      label={l`Try again`}
      color="secondary"
      size="small"
      onPress={onPress}>
      <ButtonText>
        <Trans>Try again</Trans>
      </ButtonText>
    </Button>
  )
}
