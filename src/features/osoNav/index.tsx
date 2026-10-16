import {Text, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {type NavigationProp} from '#/lib/routes/types'
import {emitSoftReset} from '#/state/events'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {useUnreadNotifications} from '#/state/queries/notifications/unread'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {InlineLinkText} from '#/components/Link'
import {useAgeAssurance} from '#/ageAssurance'
import {BRAND} from '#/config/brand'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {OSO_COLORS} from '#/features/osoLanding/theme'
import {router} from '#/routes'
import {
  OSO_PILL_HEIGHT,
  OSO_PILL_ICON_SIZE,
  type OsoPillKind,
  OsoPillLabel,
  osoPillShapeStyle,
  useOsoPill,
} from './pills'

/** Routes that keep the news pill highlighted while browsing the news hub. */
const NEWS_ROUTES = [
  'NewsFeed',
  'NewsSettings',
  'NewsroomDirectory',
  'NewsroomExplore',
  'Newsroom',
  'NewsroomArticle',
]

/**
 * The Oso sidebar, drawn as the coloured pills from the sidebar design
 * reference with the app's usual icons. Replaces the standard nav items.
 */
export function OsoNavItems({minimal}: {minimal: boolean}) {
  return (
    <View style={[a.gap_md, a.pt_md, minimal && a.align_center]}>
      <OsoNavPillList minimal={minimal} />
    </View>
  )
}

const BOTTOM_BAR_PILL_HEIGHT = 36

/**
 * The phone-width bottom bar: the same buttons and colours as the sidebar, as
 * round icon buttons, then the user's avatar, which opens the account page.
 */
export function OsoBottomBarItems() {
  return (
    <View
      style={[
        a.flex_1,
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.py_sm,
      ]}>
      <OsoNavPillList minimal height={BOTTOM_BAR_PILL_HEIGHT} />
      <OsoAccountButton size={BOTTOM_BAR_PILL_HEIGHT} />
    </View>
  )
}

function OsoNavPillList({
  minimal,
  height,
}: {
  minimal: boolean
  height?: number
}) {
  const aa = useAgeAssurance()
  const numUnreadNotifications = useUnreadNotifications()
  const numUnreadMessages = useUnreadMessageCount()

  return (
    <>
      <OsoNavPill kind="home" href="/" minimal={minimal} height={height} />
      <OsoNavPill
        kind="news"
        href={NEWS_V2_ENABLED ? '/newsroom/explore' : '/news'}
        relatedRoutes={NEWS_ROUTES}
        minimal={minimal}
        height={height}
      />
      <OsoNavPill
        kind="events"
        href="/events"
        minimal={minimal}
        height={height}
      />
      <OsoNavPill
        kind="explore"
        href="/search"
        minimal={minimal}
        height={height}
      />
      <OsoNavPill
        kind="feeds"
        href="/following"
        minimal={minimal}
        height={height}
      />
      <OsoNavPill
        kind="chat"
        href="/messages"
        count={aa.flags.chatDisabled ? undefined : numUnreadMessages.numUnread}
        hasNew={!aa.flags.chatDisabled && numUnreadMessages.hasNew}
        minimal={minimal}
        height={height}
      />
      <OsoNavPill
        kind="notifications"
        href="/notifications"
        count={numUnreadNotifications}
        minimal={minimal}
        height={height}
      />
    </>
  )
}

/** The user's avatar, linking to the Oso account page. */
function OsoAccountButton({size}: {size: number}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const navigation = useNavigation<NavigationProp>()
  const isActive = useNavigationState(
    state => !!state && getCurrentRoute(state).name === 'OsoAccount',
  )

  const onPress = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return
    }
    e.preventDefault()
    navigation.navigate('OsoAccount')
  }

  return (
    <PressableWithHover
      style={[
        a.rounded_full,
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
      href="/account"
      dataSet={{noUnderline: 1}}
      role="link"
      accessibilityLabel={l`Account`}
      accessibilityHint={l`Opens your profile, settings and sign-out options`}>
      <UserAvatar
        avatar={profile?.avatar}
        size={size}
        type={profile?.associated?.labeler ? 'labeler' : 'user'}
      />
    </PressableWithHover>
  )
}

/**
 * Placeholder until Oso has its own FAQ page. BRAND.links.faq still points at
 * Bluesky's FAQ, which is why it is not used here.
 */
const OSO_FAQ_URL = 'https://oso.social/faq'

export type OsoFooterLink = 'faq' | 'donate' | 'feedback' | 'terms' | 'privacy'

/**
 * FAQ, Donate, Feedback, Terms and Privacy, which Oso shows at the bottom of
 * the left menu instead of in the right column. `links` picks which to show,
 * in this order.
 */
export function OsoNavFooter({
  links: include = ['faq', 'donate', 'feedback', 'terms', 'privacy'],
}: {
  links?: OsoFooterLink[]
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const allLinks: Record<OsoFooterLink, {label: string; to: string}> = {
    faq: {label: l`FAQ`, to: OSO_FAQ_URL},
    donate: {label: l`Donate`, to: BRAND.links.donate},
    feedback: {label: l`Feedback`, to: BRAND.links.feedback},
    terms: {label: l`Terms`, to: BRAND.links.tos},
    privacy: {label: l`Privacy`, to: BRAND.links.privacy},
  }
  const links = include.map(key => allLinks[key])

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
  kind,
  href,
  relatedRoutes,
  count,
  hasNew = false,
  minimal,
  height = OSO_PILL_HEIGHT,
}: {
  kind: OsoPillKind
  href: string
  relatedRoutes?: string[]
  count?: string
  hasNew?: boolean
  minimal: boolean
  height?: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const pill = useOsoPill(kind)
  const navigation = useNavigation<NavigationProp>()
  const [pathName] = router.matchPath(href)
  const currentRouteName = useNavigationState(state =>
    state ? getCurrentRoute(state).name : 'Home',
  )
  const isCurrent = isTab(currentRouteName, pathName)
  const isActive = isCurrent || !!relatedRoutes?.includes(currentRouteName)
  const Icon = isActive ? pill.icons.active : pill.icons.inactive
  const iconSize =
    height === OSO_PILL_HEIGHT
      ? OSO_PILL_ICON_SIZE
      : Math.round((height * OSO_PILL_ICON_SIZE) / OSO_PILL_HEIGHT)

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
        osoPillShapeStyle(pill, {minimal, height}),
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
      accessibilityLabel={pill.label}
      accessibilityHint="">
      <View>
        <Icon aria-hidden={true} width={iconSize} fill={pill.color} />
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
                left: iconSize - 10,
                minWidth: 16,
                paddingHorizontal: 4,
                paddingVertical: 1,
                backgroundColor: OSO_COLORS.highlight,
                color: OSO_COLORS.navy,
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
                backgroundColor: OSO_COLORS.highlight,
              },
            ]}
          />
        ) : null}
      </View>
      {!minimal && <OsoPillLabel pill={pill} />}
    </PressableWithHover>
  )
}
