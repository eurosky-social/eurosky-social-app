import {Text, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {type NavigationProp} from '#/lib/routes/types'
import {emitSoftReset} from '#/state/events'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {useUnreadNotifications} from '#/state/queries/notifications/unread'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme, web} from '#/alf'
import {
  Bell_Filled_Corner0_Rounded as BellFilledIcon,
  Bell_Stroke2_Corner0_Rounded as BellIcon,
} from '#/components/icons/Bell'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilledIcon,
  HomeOpen_Stoke2_Corner0_Rounded as HomeIcon,
} from '#/components/icons/HomeOpen'
import {
  MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as MagnifyingGlassFilledIcon,
  MagnifyingGlass_Stroke2_Corner0_Rounded as MagnifyingGlassIcon,
} from '#/components/icons/MagnifyingGlass'
import {
  Message_Stroke2_Corner0_Rounded as MessageIcon,
  Message_Stroke2_Corner0_Rounded_Filled as MessageFilledIcon,
} from '#/components/icons/Message'
import {
  Newspaper_Filled_Corner2_Rounded as NewspaperFilledIcon,
  Newspaper_Stroke2_Corner2_Rounded as NewspaperIcon,
} from '#/components/icons/Newspaper'
import {InlineLinkText} from '#/components/Link'
import {useAgeAssurance} from '#/ageAssurance'
import {BRAND} from '#/config/brand'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {
  OSO_COLORS,
  OSO_DISPLAY_FEATURES,
  OSO_DISPLAY_FONT,
} from '#/features/osoLanding/theme'
import {router} from '#/routes'

/** Routes that keep the news pill highlighted while browsing the news hub. */
const NEWS_ROUTES = [
  'NewsFeed',
  'NewsSettings',
  'NewsroomDirectory',
  'NewsroomExplore',
  'Newsroom',
  'NewsroomArticle',
]

const PILL_HEIGHT = 48
const ICON_SIZE = 28

type Icons = {
  inactive: React.ComponentType<SVGIconProps>
  active: React.ComponentType<SVGIconProps>
}

/**
 * The Oso sidebar, drawn as the coloured pills from the sidebar design
 * reference with the app's usual icons. Replaces the standard nav items.
 */
export function OsoNavItems({minimal}: {minimal: boolean}) {
  const {t: l} = useLingui()
  const aa = useAgeAssurance()
  const numUnreadNotifications = useUnreadNotifications()
  const numUnreadMessages = useUnreadMessageCount()

  return (
    <View style={[a.gap_md, a.pt_md, minimal && a.align_center]}>
      <OsoNavPill
        label={l({
          message: 'home',
          comment:
            'Oso sidebar link to the landing page. Lowercase on purpose.',
        })}
        href="/"
        icons={{inactive: HomeIcon, active: HomeFilledIcon}}
        background={OSO_COLORS.yellow}
        color={OSO_COLORS.blue}
        minimal={minimal}
      />
      <OsoNavPill
        label={l({
          message: 'news',
          comment: 'Oso sidebar link to the news hub. Lowercase on purpose.',
        })}
        href={NEWS_V2_ENABLED ? '/newsroom/explore' : '/news'}
        relatedRoutes={NEWS_ROUTES}
        icons={{inactive: NewspaperIcon, active: NewspaperFilledIcon}}
        background={OSO_COLORS.blue}
        color={OSO_COLORS.yellow}
        minimal={minimal}
      />
      <OsoNavPill
        label={l({
          message: 'events',
          comment: 'Oso sidebar link to the events page. Lowercase on purpose.',
        })}
        href="/events"
        icons={{inactive: CalendarIcon, active: CalendarIcon}}
        background={OSO_COLORS.green}
        color={OSO_COLORS.violet}
        minimal={minimal}
      />
      <OsoNavPill
        label={l({
          message: 'explore',
          comment:
            'Oso sidebar link to the explore page. Lowercase on purpose.',
        })}
        href="/search"
        icons={{
          inactive: MagnifyingGlassIcon,
          active: MagnifyingGlassFilledIcon,
        }}
        background={OSO_COLORS.lemon}
        color={OSO_COLORS.grey}
        minimal={minimal}
      />
      <OsoNavPill
        label={l({
          message: 'chat',
          comment: 'Oso sidebar link to chat. Lowercase on purpose.',
        })}
        href="/messages"
        icons={{inactive: MessageIcon, active: MessageFilledIcon}}
        count={aa.flags.chatDisabled ? undefined : numUnreadMessages.numUnread}
        hasNew={!aa.flags.chatDisabled && numUnreadMessages.hasNew}
        background={OSO_COLORS.coral}
        color={OSO_COLORS.mint}
        minimal={minimal}
      />
      <OsoNavPill
        label={l({
          message: 'notifications',
          comment: 'Oso sidebar link to notifications. Lowercase on purpose.',
        })}
        href="/notifications"
        icons={{inactive: BellIcon, active: BellFilledIcon}}
        count={numUnreadNotifications}
        background={OSO_COLORS.violet}
        color={OSO_COLORS.green}
        minimal={minimal}
      />
    </View>
  )
}

/**
 * Terms, Privacy, Donate and Feedback, which Oso shows at the bottom of the
 * left menu instead of in the right column.
 */
export function OsoNavFooter() {
  const t = useTheme()
  const {t: l} = useLingui()
  const links = [
    {label: l`Terms`, to: BRAND.links.tos},
    {label: l`Privacy`, to: BRAND.links.privacy},
    {label: l`Donate`, to: BRAND.links.donate},
    {label: l`Feedback`, to: BRAND.links.feedback},
  ]

  return (
    <View style={[a.flex_row, a.flex_wrap, a.pt_lg, {columnGap: 8, rowGap: 2}]}>
      {links.map(link => (
        <InlineLinkText
          key={link.to}
          to={link.to}
          label={link.label}
          style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {link.label}
        </InlineLinkText>
      ))}
    </View>
  )
}

function OsoNavPill({
  label,
  href,
  relatedRoutes,
  icons,
  count,
  hasNew = false,
  background,
  color,
  minimal,
}: {
  label: string
  href: string
  relatedRoutes?: string[]
  icons: Icons
  count?: string
  hasNew?: boolean
  background: string
  color: string
  minimal: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const [pathName] = router.matchPath(href)
  const currentRouteName = useNavigationState(state =>
    state ? getCurrentRoute(state).name : 'Home',
  )
  const isCurrent = isTab(currentRouteName, pathName)
  const isActive = isCurrent || !!relatedRoutes?.includes(currentRouteName)
  const Icon = isActive ? icons.active : icons.inactive

  const onPress = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return
    }
    e.preventDefault()
    if (isCurrent) {
      emitSoftReset()
    } else {
      const [screen, params] = router.matchPath(href)
      // @ts-expect-error matchPath is not typed well enough for navigate
      navigation.navigate(screen, params, {pop: true})
    }
  }

  return (
    <PressableWithHover
      style={[
        a.flex_row,
        a.align_center,
        a.rounded_full,
        a.gap_sm,
        {
          height: PILL_HEIGHT,
          backgroundColor: background,
          alignSelf: minimal ? 'center' : 'flex-start',
        },
        minimal
          ? {width: PILL_HEIGHT, justifyContent: 'center'}
          : {paddingLeft: (PILL_HEIGHT - ICON_SIZE) / 2, paddingRight: 20},
        isActive && {
          outlineWidth: 3,
          outlineStyle: 'solid',
          outlineColor: t.atoms.text.color,
          outlineOffset: 2,
        },
      ]}
      hoverStyle={{opacity: 0.9}}
      // @ts-expect-error the function signature differs on web
      onPress={onPress}
      href={href}
      dataSet={{noUnderline: 1}}
      role="link"
      accessibilityLabel={label}
      accessibilityHint="">
      <View>
        <Icon aria-hidden={true} width={ICON_SIZE} fill={color} />
        {count ? (
          <Text
            accessibilityLabel={l`${plural(count, {
              one: '# unread item',
              other: '# unread items',
            })}`}
            accessibilityHint=""
            accessible={true}
            numberOfLines={1}
            style={[
              a.absolute,
              a.text_xs,
              a.font_semi_bold,
              a.rounded_full,
              a.text_center,
              {
                top: -6,
                left: ICON_SIZE - 10,
                minWidth: 16,
                paddingHorizontal: 4,
                paddingVertical: 1,
                backgroundColor: OSO_COLORS.black,
                color: '#FFFFFF',
              },
            ]}>
            {count}
          </Text>
        ) : hasNew ? (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              {
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                backgroundColor: OSO_COLORS.black,
              },
            ]}
          />
        ) : null}
      </View>
      {!minimal && (
        <Text
          style={[
            {
              color,
              fontSize: 32,
              lineHeight: PILL_HEIGHT,
              fontFamily: OSO_DISPLAY_FONT,
              fontWeight: '700',
            },
            web({fontFeatureSettings: OSO_DISPLAY_FEATURES}),
          ]}>
          {label}
        </Text>
      )}
    </PressableWithHover>
  )
}
