import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  CommonActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native'

import {getCurrentRoute} from '#/lib/routes/helpers'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme, web} from '#/alf'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {FilterTimeline_Stroke2_Corner0_Rounded as FilterTimeline} from '#/components/icons/FilterTimeline'
import {Hashtag_Stroke2_Corner0_Rounded as HashtagIcon} from '#/components/icons/Hashtag'
import {Text} from '#/components/Typography'
import {type MyFeedOption, useMyFeedOptions} from './useMyFeedOptions'

/**
 * The /myfeeds feed picker for the desktop right column, mirroring the events
 * page's EventsRightRail.
 */
export function MyFeedsRightRail() {
  const t = useTheme()
  const navigation = useNavigation()
  const {options, resolveFeed} = useMyFeedOptions()

  /*
   * The rail renders in the shell rather than inside the screen, so it reads
   * the selected feed from the navigation state instead of threading a prop
   * through the shell.
   */
  const routeKey = useNavigationState(state => {
    const route = getCurrentRoute(state)
    return route.name === 'OsoMyFeeds' && 'key' in route ? route.key : undefined
  })
  const feedParam = useNavigationState(state => {
    const route = getCurrentRoute(state)
    if (route.name !== 'OsoMyFeeds') return undefined
    return (route.params as {feed?: string} | undefined)?.feed
  })
  const feed = resolveFeed(feedParam)

  const onSelect = (id: string) => {
    if (!routeKey) return
    // Target the route by key; the shell sits outside its navigator.
    navigation.dispatch({
      ...CommonActions.setParams({feed: id}),
      source: routeKey,
    })
  }

  return (
    <View>
      {/* The shell's gutters already pad the column, so drop the module's. */}
      <ModuleHeader.Container style={[a.px_0, a.pt_0, a.pb_xs]}>
        <ModuleHeader.Icon icon={HashtagIcon} />
        <ModuleHeader.TitleText>
          <Trans>My feeds</Trans>
        </ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <Text
        style={[
          a.pb_md,
          a.text_sm,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>The feeds you have pinned</Trans>
      </Text>
      <View style={[web({gap: 2})]}>
        {options.map(option => (
          <FeedItem
            key={option.id}
            option={option}
            current={option.id === feed}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </View>
  )
}

function FeedItem({
  option,
  current,
  onPress,
}: {
  option: MyFeedOption
  current: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {
    state: hovered,
    onIn: onHoverIn,
    onOut: onHoverOut,
  } = useInteractionState()

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={option.label}
      accessibilityHint={l`Shows the ${option.label} feed`}
      accessibilityState={{selected: current}}
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
      {option.id === 'following' ? (
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
            // Readable on both the navy and the dark-mode green accent.
            fill={t.palette.contrast_0}
          />
        </View>
      ) : (
        <UserAvatar
          type={option.info.type === 'list' ? 'list' : 'algo'}
          size={20}
          avatar={option.info.avatar}
        />
      )}
      <Text
        emoji
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
        {option.label}
      </Text>
    </Pressable>
  )
}
