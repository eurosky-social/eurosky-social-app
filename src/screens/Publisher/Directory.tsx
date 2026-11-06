import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useMaybeProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {formatCount} from '#/view/com/util/numeric/format'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {ProfileBadges} from '#/components/ProfileBadges'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {usePageGeometry} from '#/features/product/layout/usePageGeometry'
import {PublisherFollowButton} from '#/features/publishers/FollowButton'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {PublisherGrid} from './Grid'

/** Account cards use real profile data; story queries start only after selection. */
export function PublisherDirectoryScreen() {
  const {t: l} = useLingui()
  const {wide} = usePageGeometry()
  useSetTitle(l`Publishers`)
  return (
    <Layout.Screen testID="publisherDirectoryScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Publishers</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content webPageScroll contentContainerStyle={[a.pb_4xl]}>
        <PublisherGrid wide={wide}>
          {PUBLISHERS.map(publisher => (
            <PublisherCard key={publisher.id} publisher={publisher} />
          ))}
        </PublisherGrid>
      </Layout.Content>
    </Layout.Screen>
  )
}

function PublisherCard({publisher}: {publisher: (typeof PUBLISHERS)[number]}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {data} = useProfileQuery({did: publisher.did})
  const profile = useMaybeProfileShadow(data)
  const opts = useModerationOpts()
  const moderation =
    profile && opts ? moderateProfile(profile, opts) : undefined
  const blocked =
    profile?.viewer?.blocking ||
    profile?.viewer?.blockedBy ||
    profile?.viewer?.blockingByList
  const showDetails =
    profile && moderation && !moderation.ui('profileView').blur && !blocked
  const description = new RichTextAPI({
    text: showDetails ? (profile.description ?? '') : '',
  })
  description.detectFacetsWithoutResolution()
  return (
    <View
      testID="publisherCard"
      style={[
        a.gap_lg,
        a.p_lg,
        a.border,
        a.rounded_lg,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
        {minWidth: 0},
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Link
          testID={`publisher-${publisher.id}`}
          to={{screen: 'Publisher', params: {publisher: publisher.id}}}
          label={l`View ${publisher.name}`}
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_md,
            {minWidth: 0},
          ]}>
          <UserAvatar
            type="user"
            shape="square"
            size={56}
            avatar={moderation ? profile?.avatar : undefined}
            moderation={moderation?.ui('avatar')}
          />
          <View style={[a.flex_1, a.gap_xs, {minWidth: 0}]}>
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <Text
                numberOfLines={2}
                style={[a.flex_shrink, a.text_lg, a.font_bold]}>
                {publisher.name}
              </Text>
              {profile && <ProfileBadges profile={profile} size="sm" />}
            </View>
            <Text
              numberOfLines={1}
              style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {sanitizeHandle(profile?.handle ?? publisher.domain, '@')}
            </Text>
          </View>
        </Link>
        {profile && opts && (
          <PublisherFollowButton profile={profile} moderationOpts={opts} />
        )}
      </View>
      {!!description.text && (
        <RichText
          testID="publisherCardDescription"
          value={description}
          numberOfLines={3}
          authorHandle={profile?.handle}
          enableTags
          shouldProxyLinks
          style={[a.text_md, a.leading_relaxed]}
        />
      )}
      {showDetails && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {formatCount(i18n, profile.followersCount ?? 0)}{' '}
          {plural(profile.followersCount ?? 0, {
            one: 'follower',
            other: 'followers',
          })}
        </Text>
      )}
    </View>
  )
}
