import {Pressable, type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {getCurrentRoute} from '#/lib/routes/helpers'
import {type NavigationProp} from '#/lib/routes/types'
import {getLocalizedFeedName} from '#/lib/strings/feed-names'
import {emitSoftReset} from '#/state/events'
import {
  type SavedFeedSourceInfo,
  usePinnedFeedsInfos,
} from '#/state/queries/feed'
import {useSelectedFeed, useSetSelectedFeed} from '#/state/shell/selected-feed'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme, web} from '#/alf'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {FilterTimeline_Stroke2_Corner0_Rounded as FilterTimeline} from '#/components/icons/FilterTimeline'
import {OsoFeedsIcon} from '#/components/icons/OsoNav'
import {PlusSmall_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_PARTNER_PREVIEW} from '#/env'

export function DesktopFeeds() {
  const t = useTheme()
  const ax = useAnalytics()
  const {data: pinnedFeedInfos, error, isLoading} = usePinnedFeedsInfos()
  const selectedFeed = useSelectedFeed()
  const setSelectedFeed = useSetSelectedFeed()
  const navigation = useNavigation<NavigationProp>()
  const route = useNavigationState(state => {
    if (!state) {
      return {name: 'Home'}
    }
    return getCurrentRoute(state)
  })

  if (isLoading) {
    return (
      <View style={[{gap: 10}]}>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <View
              key={i}
              style={[
                a.rounded_sm,
                t.atoms.bg_contrast_25,
                {
                  height: 16,
                  width: i % 2 === 0 ? '60%' : '80%',
                },
              ]}
            />
          ))}
      </View>
    )
  }

  if (error || !pinnedFeedInfos) {
    return null
  }

  return (
    <View
      style={[
        a.flex_1,
        web({
          gap: 2,
          /*
           * Small padding prevents overflow prior to actually overflowing the
           * height of the screen with lots of feeds.
           */
          paddingTop: 2,
          overflowY: 'auto',
        }),
      ]}>
      {IS_PARTNER_PREVIEW && (
        // Same heading style as the events screen's feed picker.
        <ModuleHeader.Container style={[a.px_0, a.pt_0, a.pb_xs]}>
          <ModuleHeader.Icon icon={OsoFeedsIcon} />
          <ModuleHeader.TitleText>
            <Trans>Your feeds</Trans>
          </ModuleHeader.TitleText>
        </ModuleHeader.Container>
      )}
      {pinnedFeedInfos.map((feedInfo, index) => {
        const feed = feedInfo.feedDescriptor
        const current =
          route.name === 'Home' &&
          (selectedFeed ? feed === selectedFeed : index === 0)

        return (
          <FeedItem
            key={feedInfo.uri}
            feedInfo={feedInfo}
            current={current}
            onPress={() => {
              ax.metric('desktopFeeds:feed:click', {
                feedUri: feedInfo.uri,
                feedDescriptor: feed,
              })
              setSelectedFeed(feed)
              navigation.navigate('Home')
              if (route.name === 'Home' && feed === selectedFeed) {
                emitSoftReset()
              }
            }}
          />
        )
      })}
      <MoreFeedsLink />
    </View>
  )
}

/**
 * "+ More feeds", the link to the feeds page under the desktop feed list.
 * Oso's phone home header uses it too.
 */
export function MoreFeedsLink({
  compact = false,
  style,
}: {
  /** Just a larger "+" without the text, for Oso's phone header. */
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const routeName = useNavigationState(state =>
    state ? getCurrentRoute(state).name : 'Home',
  )
  const route = {name: routeName}

  return (
    <Link
      to="/feeds"
      label={l`More feeds`}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.self_start,
        a.rounded_sm,
        compact ? {padding: 4} : {paddingVertical: 6, paddingHorizontal: 8},
        route.name === 'Feeds' && {backgroundColor: t.palette.primary_50},
        style,
      ]}>
      {({hovered}) => {
        const isActive = route.name === 'Feeds'
        return (
          <>
            <View
              style={[
                a.align_center,
                a.justify_center,
                a.rounded_xs,
                isActive
                  ? {backgroundColor: t.palette.primary_100}
                  : t.atoms.bg_contrast_50,
                compact ? {width: 30, height: 30} : {width: 20, height: 20},
              ]}>
              <Plus
                style={
                  compact ? {width: 24, height: 24} : {width: 16, height: 16}
                }
                fill={
                  isActive || hovered
                    ? t.atoms.text.color
                    : t.atoms.text_contrast_medium.color
                }
              />
            </View>
            {!compact && (
              <Text
                style={[
                  a.text_md,
                  a.leading_snug,
                  isActive
                    ? [t.atoms.text, a.font_semi_bold]
                    : hovered
                      ? t.atoms.text
                      : t.atoms.text_contrast_medium,
                ]}
                numberOfLines={1}>
                {l`More feeds`}
              </Text>
            )}
          </>
        )
      }}
    </Link>
  )
}

function FeedItem({
  feedInfo,
  current,
  onPress,
}: {
  feedInfo: SavedFeedSourceInfo
  current: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {
    state: hovered,
    onIn: onHoverIn,
    onOut: onHoverOut,
  } = useInteractionState()
  const isFollowing = feedInfo.feedDescriptor === 'following'
  const displayName = getLocalizedFeedName(feedInfo, i18n)

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={displayName}
      accessibilityHint={l`Opens ${displayName} feed`}
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.self_start,
        a.rounded_sm,
        {paddingVertical: 6, paddingHorizontal: 8},
        current && {backgroundColor: t.palette.primary_50},
      ]}>
      {isFollowing ? (
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_xs,
            {
              width: 20,
              height: 20,
              backgroundColor: t.palette.primary_500,
            },
          ]}>
          <FilterTimeline
            style={{width: 14, height: 14}}
            fill={t.palette.white}
          />
        </View>
      ) : (
        <UserAvatar
          type={feedInfo.type === 'list' ? 'list' : 'algo'}
          size={20}
          avatar={feedInfo.avatar}
          noBorder
        />
      )}
      <Text
        style={[
          a.text_md,
          a.leading_snug,
          current
            ? [t.atoms.text, a.font_semi_bold]
            : hovered
              ? t.atoms.text
              : t.atoms.text_contrast_medium,
        ]}
        numberOfLines={1}>
        {displayName}
      </Text>
    </Pressable>
  )
}
