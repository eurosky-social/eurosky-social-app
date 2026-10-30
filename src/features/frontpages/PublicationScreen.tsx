import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {useProfileQuery} from '#/state/queries/profile'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {atoms as a, useLayoutBreakpoints} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {ScreenHider} from '#/components/moderation/ScreenHider'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {
  ExploreColumn,
  ExploreSpreadBorders,
} from '#/features/news/explore/components/ExploreColumn'
import {getPublisherName} from '#/features/news/publishers'
import {EditorialFrontpage} from './editorial'
import {EditorialFrontpageSkeleton} from './editorial/Skeleton'
import {type Frontpage} from './frontpages'
import {findPublicationPreview} from './preview'

/** Both news versions use this detail page; only their publisher lookup and conversation source differ. */
export function PublicationScreen({
  publication,
  view,
  intro,
  conversation,
  accountless,
}: {
  publication: Frontpage
  view?: 'conversation'
  intro?: React.ReactNode
  conversation: React.ReactNode
  accountless?: React.ReactNode
}) {
  const {t: l} = useLingui()
  const opts = useModerationOpts()
  const query = useProfileQuery({did: publication.did})
  if (publication.did && (query.isLoading || !opts))
    return <PublicationLoading name={publication.name} view={view} />
  if (publication.did && !query.data)
    return (
      <PublicationStatus name={publication.name}>
        <Text>
          <Trans>Couldn’t load this publication.</Trans>
        </Text>
        <Button
          label={l`Try again`}
          color="secondary"
          size="small"
          onPress={() => void query.refetch()}>
          <ButtonText>
            <Trans>Try again</Trans>
          </ButtonText>
        </Button>
      </PublicationStatus>
    )
  const profile = query.data
  const title =
    findPublicationPreview(publication.slug)?.name ||
    getPublisherName(profile) ||
    publication.name
  const blocked = !!profile?.viewer?.blocking || !!profile?.viewer?.blockedBy
  if (view === 'conversation')
    return (
      <Layout.Screen testID="publicationConversation">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
          </Layout.Header.Content>
        </Layout.Header.Outer>
        {profile && opts ? (
          <ScreenHider
            style={[a.flex_1]}
            modui={moderateProfile(profile, opts).ui('profileView')}
            screenDescription={l`publication`}>
            {blocked ? (
              <Layout.Center>
                <Text>
                  <Trans>Posts are unavailable for this account.</Trans>
                </Text>
              </Layout.Center>
            ) : (
              conversation
            )}
          </ScreenHider>
        ) : (
          conversation
        )}
      </Layout.Screen>
    )
  if (profile && opts) {
    const content = (
      <EditorialFrontpage
        key={profile.did}
        profile={profile}
        moderationOpts={opts}
        publicationName={title}
        intro={intro}
      />
    )
    return (
      <Layout.Screen testID="frontpageScreen" noCenterBorders>
        {IS_WEB ? content : <Layout.Content>{content}</Layout.Content>}
      </Layout.Screen>
    )
  }
  /* Outlets without an AT Protocol account keep their aggregator journalism; no fake account or writable layout. */
  return (
    <Layout.Screen testID="frontpageScreen" noCenterBorders>
      <ExploreSpreadBorders />
      <ExploreColumn style={[a.px_lg, a.pb_4xl]}>
        <View
          style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_sm, a.py_md]}>
          <Layout.Header.BackButton />
        </View>
        {accountless}
      </ExploreColumn>
    </Layout.Screen>
  )
}

/** Standalone feed view retains the outlet/reporters merge and its responsive contextual rail. */
export function PublicationConversation({
  feed,
  pending = false,
  context,
}: {
  feed?: FeedDescriptor
  pending?: boolean
  context: React.ReactNode
}) {
  const {rightNavVisible} = useLayoutBreakpoints()
  if (pending)
    return (
      <Layout.Center style={[a.align_center, a.py_xl]}>
        <Loader size="lg" />
      </Layout.Center>
    )
  const inline = !rightNavVisible ? context : null
  const empty = () => (
    <View style={[a.p_2xl]}>
      <Text>
        <Trans>No recent posts from this publication.</Trans>
      </Text>
    </View>
  )
  if (!feed)
    return (
      <Layout.Content>
        {inline}
        {empty()}
      </Layout.Content>
    )
  return (
    <PostFeed
      key={feed}
      testID="publicationConversationFeed"
      feed={feed}
      renderEmptyState={empty}
      ListHeaderComponent={inline ? <>{inline}</> : undefined}
    />
  )
}

/**
 * A publication still resolving. The spread is sketched in place, so the page
 * keeps its width and shape; the conversation is a feed, so it keeps a spinner.
 */
export function PublicationLoading({
  name,
  view,
}: {
  name?: string
  view?: 'conversation'
}) {
  if (view === 'conversation')
    return (
      <PublicationStatus name={name}>
        <Loader size="xl" />
      </PublicationStatus>
    )
  return (
    <Layout.Screen testID="publicationLoading" noCenterBorders>
      {IS_WEB ? (
        <EditorialFrontpageSkeleton />
      ) : (
        <Layout.Content>
          <EditorialFrontpageSkeleton />
        </Layout.Content>
      )}
    </Layout.Screen>
  )
}

export function PublicationStatus({
  name,
  children,
}: {
  name?: string
  children: React.ReactNode
}) {
  return (
    <Layout.Screen testID="publicationStatus">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{name}</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Center
        style={[a.flex_1, a.align_center, a.justify_center, a.gap_md, a.p_2xl]}>
        {children}
      </Layout.Center>
    </Layout.Screen>
  )
}
