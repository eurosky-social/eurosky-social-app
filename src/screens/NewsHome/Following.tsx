import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {useProfileShadows} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfilesQuery} from '#/state/queries/profile'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {PublisherFollowButton} from '#/features/publishers/FollowButton'
import {followedPublisherDids} from '#/features/publishers/following'
import {findPublisherByDid, PUBLISHERS} from '#/features/publishers/publishers'
import {NewsStories} from './Stories'

const PUBLISHER_DIDS = PUBLISHERS.map(publisher => publisher.did)
export function FollowingNews({header}: {header: React.ReactNode}) {
  const {t: l} = useLingui()
  const opts = useModerationOpts()
  const query = useProfilesQuery({handles: PUBLISHER_DIDS})
  const profiles = useProfileShadows(query.data?.profiles ?? [])
  const followed = followedPublisherDids(profiles)
  if (followed.length)
    return (
      <NewsStories
        key={followed.join(',')}
        publisherDids={followed}
        header={header}
      />
    )
  const suggestions = opts
    ? profiles
        .filter(
          profile =>
            !!findPublisherByDid(profile.did) &&
            !profile.viewer?.blocking &&
            !profile.viewer?.blockedBy &&
            !profile.viewer?.blockingByList &&
            !moderateProfile(profile, opts).ui('profileView').filter,
        )
        .slice(0, 3)
    : []
  return (
    <Layout.Content webPageScroll contentContainerStyle={[a.pb_4xl]}>
      {header}
      <View testID="followingPublishersEmpty" style={[a.p_lg, a.gap_lg]}>
        {query.isPending || !opts ? (
          <Loader size="lg" />
        ) : query.isError ? (
          <>
            <Text>
              <Trans>Couldn’t load publishers.</Trans>
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
          </>
        ) : (
          <>
            <Text>
              <Trans>Follow publishers to see their stories here.</Trans>
            </Text>
            {suggestions.map(profile => (
              <ProfileCard.Header key={profile.did}>
                <ProfileCard.Avatar
                  profile={profile}
                  moderationOpts={opts}
                  disabledPreview
                />
                <ProfileCard.NameAndHandle
                  profile={profile}
                  moderationOpts={opts}
                />
                <PublisherFollowButton
                  profile={profile}
                  moderationOpts={opts}
                />
              </ProfileCard.Header>
            ))}
            <Link
              to={{screen: 'PublisherDirectory'}}
              label={l`See all`}
              style={[a.self_start, a.py_sm]}>
              <Text style={[a.text_sm, a.font_semi_bold]}>
                <Trans>See all</Trans>
              </Text>
            </Link>
          </>
        )}
      </View>
    </Layout.Content>
  )
}
