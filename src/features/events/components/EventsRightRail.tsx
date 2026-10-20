import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  CommonActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native'

import {getCurrentRoute} from '#/lib/routes/helpers'
import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme, web} from '#/alf'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {type Props as IconProps} from '#/components/icons/common'
import {FilterTimeline_Stroke2_Corner0_Rounded as FilterTimeline} from '#/components/icons/FilterTimeline'
import {Person_Stroke2_Corner0_Rounded as PersonIcon} from '#/components/icons/Person'
import {Ticket_Stroke2_Corner0_Rounded as TicketIcon} from '#/components/icons/Ticket'
import {Text} from '#/components/Typography'
import {type EventFeedId} from '../feeds'
import {type EventFeedOption, useEventFeedOptions} from '../useEventFeedOptions'

/** Badge glyphs for the feeds that have no logo of their own. */
const FEED_GLYPHS: Partial<
  Record<EventFeedId, React.ComponentType<IconProps>>
> = {
  upcoming: CalendarIcon,
  following: FilterTimeline,
  mine: PersonIcon,
  agenda: TicketIcon,
}

/**
 * The event feed picker for the desktop right column, styled after the home
 * feed list (DesktopFeeds) it replaces on the events screen.
 */
export function EventsRightRail() {
  const t = useTheme()
  const navigation = useNavigation()
  const {options, resolveFeed} = useEventFeedOptions()

  /*
   * The rail renders in the shell rather than inside the screen, so it reads
   * the selected feed from the navigation state instead of threading a prop
   * through the shell.
   */
  const routeKey = useNavigationState(state => {
    const route = getCurrentRoute(state)
    return route.name === 'Events' && 'key' in route ? route.key : undefined
  })
  const feedParam = useNavigationState(state => {
    const route = getCurrentRoute(state)
    if (route.name !== 'Events') return undefined
    return (route.params as {feed?: string} | undefined)?.feed
  })
  const feed = resolveFeed(feedParam)

  const onSelect = (id: EventFeedId) => {
    if (!routeKey) return
    // Target the Events route by key; the shell sits outside its navigator.
    navigation.dispatch({
      ...CommonActions.setParams({feed: id}),
      source: routeKey,
    })
  }

  return (
    <View>
      {/* The shell's gutters already pad the column, so drop the module's. */}
      <ModuleHeader.Container style={[a.px_0, a.pt_0, a.pb_xs]}>
        <ModuleHeader.Icon icon={CalendarIcon} />
        <ModuleHeader.TitleText>
          <Trans>Event feeds</Trans>
        </ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <Text
        style={[
          a.pb_md,
          a.text_sm,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>Curated or filtered event feeds</Trans>
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
  option: EventFeedOption
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
  const Logo = option.icon
  const Glyph = FEED_GLYPHS[option.id] ?? CalendarIcon

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={option.label}
      accessibilityHint={l`Shows the ${option.label} events feed`}
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
      {Logo ? (
        // Community logos are wide, so they sit unbadged in the badge's slot.
        <View
          style={[a.align_center, a.justify_center, {width: 20, height: 20}]}>
          <Logo
            width={10}
            fill={
              current || hovered
                ? t.atoms.text.color
                : t.atoms.text_contrast_medium.color
            }
          />
        </View>
      ) : (
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
          <Glyph style={{width: 14, height: 14}} fill={t.palette.white} />
        </View>
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
