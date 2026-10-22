import {useCallback, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {useAccountSwitcher} from '#/lib/hooks/useAccountSwitcher'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {makeProfileLink} from '#/lib/routes/links'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {isInvalidHandle, sanitizeHandle} from '#/lib/strings/handles'
import {emitSoftReset} from '#/state/events'
import {useFetchHandle} from '#/state/queries/handle'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {useUnreadNotifications} from '#/state/queries/notifications/unread'
import {useProfilesQuery} from '#/state/queries/profile'
import {type SessionAccount, useSession, useSessionApi} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useCloseAllActiveElements} from '#/state/util'
import {LoadingPlaceholder} from '#/view/com/util/LoadingPlaceholder'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {DesktopLegalLinks} from '#/view/shell/desktop/LegalLinks'
import {NavSignupCard} from '#/view/shell/NavSignupCard'
import {
  atoms as a,
  tokens,
  useBreakpoints,
  useLayoutBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {type DialogControlProps} from '#/components/Dialog'
import {ArrowBoxLeft_Stroke2_Corner0_Rounded as LeaveIcon} from '#/components/icons/ArrowBoxLeft'
import {
  Bell_Filled_Corner0_Rounded as BellFilledIcon,
  Bell_Stroke2_Corner0_Rounded as BellIcon,
} from '#/components/icons/Bell'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {DotGrid3x1_Stroke2_Corner0_Rounded as EllipsisIcon} from '#/components/icons/DotGrid'
import {
  createOsoNavIconsFrom,
  OsoChatActiveIcon,
  OsoChatIcon,
  OsoExploreActiveIcon,
  OsoExploreIcon,
  OsoFeedsActiveIcon,
  OsoFeedsIcon,
  OsoNewsActiveIcon,
  OsoNewsIcon,
  OsoPlusIcon,
  OsoSettingsIcon,
} from '#/components/icons/OsoNav'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {UserCircle_Stroke2_Corner0_Rounded as UserCircleIcon} from '#/components/icons/UserCircle'
import {CENTER_COLUMN_OFFSET, CENTER_COLUMN_WIDTH} from '#/components/Layout'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {useAgeAssurance} from '#/ageAssurance'
import {useAnalytics} from '#/analytics'
import {type Events} from '#/analytics/metrics/types'
import {IS_PARTNER_PREVIEW} from '#/env'
import {useActorStatus} from '#/features/liveNow'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {osoButton} from '#/features/osoAuthStyles'
import {type app} from '#/lexicons'
import {router} from '#/routes'
import {PlatformInfo} from '../../../../modules/expo-bluesky-swiss-army'

const LARGE_ELEMENT_SIZE = 48
/** Events has no icon in Oso's design, so it is built from the calendar. */
const OsoEventsIcons = createOsoNavIconsFrom(CalendarIcon)

const NAV_ICON_WIDTH = 28

export const LEFT_NAV_STANDARD_WIDTH = 240
export const LEFT_NAV_MINIMAL_WIDTH = 80
const LEFT_NAV_PWI_WIDTH = 245

function ProfileCard({minimal}: {minimal: boolean}) {
  const {currentAccount, accounts} = useSession()
  const {logoutEveryAccount} = useSessionApi()
  const {isLoading, data} = useProfilesQuery({
    handles: accounts.map(acc => acc.did),
  })
  const profiles = data?.profiles
  const signOutPromptControl = Prompt.usePromptControl()
  const {t: l} = useLingui()
  const t = useTheme()

  const profile = profiles?.find(p => p.did === currentAccount!.did)
  const otherAccounts = accounts
    .filter(acc => acc.did !== currentAccount!.did)
    .map(account => ({
      account,
      profile: profiles?.find(p => p.did === account.did),
    }))

  const {isActive: live} = useActorStatus(profile)

  return (
    <View style={[a.pb_md, !minimal && [a.w_full, a.align_start]]}>
      {!isLoading && profile ? (
        <Menu.Root>
          <Menu.Trigger label={l`Switch accounts`}>
            {({props, state, control}) => {
              const active = state.hovered || state.focused || control.isOpen
              return (
                <Button
                  label={props.accessibilityLabel}
                  {...props}
                  style={[
                    a.w_full,
                    a.transition_color,
                    active ? t.atoms.bg_contrast_25 : a.transition_delay_50ms,
                    a.rounded_full,
                    a.justify_between,
                    a.align_center,
                    a.flex_row,
                    {gap: 6},
                    !minimal && [a.pl_lg, a.pr_md],
                  ]}>
                  <View
                    style={[
                      !PlatformInfo.getIsReducedMotionEnabled() && [
                        a.transition_transform,
                        {transitionDuration: '250ms'},
                        !active && a.transition_delay_50ms,
                      ],
                      a.relative,
                      a.z_10,
                      active && {
                        transform: [
                          {scale: !minimal ? 2 / 3 : 0.8},
                          {translateX: !minimal ? -22 : 0},
                        ],
                      },
                    ]}>
                    <UserAvatar
                      avatar={profile.avatar}
                      size={LARGE_ELEMENT_SIZE}
                      type={profile?.associated?.labeler ? 'labeler' : 'user'}
                      live={live}
                    />
                  </View>
                  {!minimal && (
                    <>
                      <View
                        style={[
                          a.flex_1,
                          a.transition_opacity,
                          !active && a.transition_delay_50ms,
                          {
                            marginLeft: tokens.space.xl * -1,
                            opacity: active ? 1 : 0,
                          },
                        ]}>
                        <Text
                          emoji
                          style={[a.font_bold, a.text_sm, a.leading_snug]}
                          numberOfLines={1}>
                          {sanitizeDisplayName(
                            profile.displayName || profile.handle,
                          )}
                        </Text>
                        <Text
                          style={[
                            a.text_xs,
                            a.leading_snug,
                            t.atoms.text_contrast_medium,
                          ]}
                          numberOfLines={1}>
                          {sanitizeHandle(profile.handle, '@')}
                        </Text>
                      </View>
                      <EllipsisIcon
                        aria-hidden={true}
                        style={[
                          t.atoms.text_contrast_medium,
                          a.transition_opacity,
                          {opacity: active ? 1 : 0},
                        ]}
                        size="sm"
                      />
                    </>
                  )}
                </Button>
              )
            }}
          </Menu.Trigger>
          <SwitchMenuItems
            accounts={otherAccounts}
            signOutPromptControl={signOutPromptControl}
          />
        </Menu.Root>
      ) : (
        <LoadingPlaceholder
          width={LARGE_ELEMENT_SIZE}
          height={LARGE_ELEMENT_SIZE}
          style={[a.rounded_full, !minimal && a.ml_lg]}
        />
      )}
      <Prompt.Basic
        control={signOutPromptControl}
        title={l`Sign out?`}
        description={l`You will be signed out of all your accounts.`}
        onConfirm={() => logoutEveryAccount('Settings')}
        confirmButtonCta={l`Sign out`}
        cancelButtonCta={l`Cancel`}
        confirmButtonColor="negative"
      />
    </View>
  )
}

function SwitchMenuItems({
  accounts,
  signOutPromptControl,
}: {
  accounts:
    | {
        account: SessionAccount
        profile?: app.bsky.actor.defs.ProfileViewDetailed
      }[]
    | undefined
  signOutPromptControl: DialogControlProps
}) {
  const {t: l} = useLingui()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const closeEverything = useCloseAllActiveElements()

  const navigation = useNavigation<NavigationProp>()
  const ax = useAnalytics()

  const onAddAnotherAccount = () => {
    setShowLoggedOut(true)
    closeEverything()
  }

  const onPressSettings = () => {
    ax.metric('nav:click', {item: 'settings', surface: 'leftNav'})
    navigation.navigate('Settings')
  }

  return (
    <Menu.Outer>
      {accounts && accounts.length > 0 && (
        <>
          <Menu.Group>
            <Menu.LabelText>
              <Trans>Switch account</Trans>
            </Menu.LabelText>
            {accounts.map(other => (
              <SwitchMenuItem
                key={other.account.did}
                account={other.account}
                profile={other.profile}
              />
            ))}
          </Menu.Group>
          <Menu.Divider />
        </>
      )}
      <SwitcherMenuProfileLink />
      <Menu.Item label={l`Settings`} onPress={onPressSettings}>
        <Menu.ItemIcon icon={OsoSettingsIcon} />
        <Menu.ItemText>
          <Trans>Settings</Trans>
        </Menu.ItemText>
      </Menu.Item>
      <Menu.Item label={l`Add another account`} onPress={onAddAnotherAccount}>
        <Menu.ItemIcon icon={PlusIcon} />
        <Menu.ItemText>
          <Trans>Add another account</Trans>
        </Menu.ItemText>
      </Menu.Item>
      <Menu.Item label={l`Sign out`} onPress={signOutPromptControl.open}>
        <Menu.ItemIcon icon={LeaveIcon} />
        <Menu.ItemText>
          <Trans>Sign out</Trans>
        </Menu.ItemText>
      </Menu.Item>
    </Menu.Outer>
  )
}

function SwitcherMenuProfileLink() {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const navigation = useNavigation()
  const context = Menu.useMenuContext()
  const profileLink = currentAccount ? makeProfileLink(currentAccount) : '/'
  const [pathName] = useMemo(() => router.matchPath(profileLink), [profileLink])
  const currentRouteInfo = useNavigationState(state => {
    if (!state) {
      return {name: 'Home'}
    }
    return getCurrentRoute(state)
  })
  const isCurrent = useMemo(() => {
    if (currentRouteInfo.name === 'Profile') {
      return (
        isTab(currentRouteInfo.name, pathName) &&
        (currentRouteInfo.params as CommonNavigatorParams['Profile']).name ===
          currentAccount?.handle
      )
    } else {
      return isTab(currentRouteInfo.name, pathName)
    }
  }, [currentAccount?.handle, currentRouteInfo, pathName])

  const onProfilePress = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      e.preventDefault()
      context.control.close()
      if (isCurrent) {
        emitSoftReset()
      } else {
        const [screen, params] = router.matchPath(profileLink)
        // @ts-expect-error TODO: type matchPath well enough that it can be plugged into navigation.navigate directly
        navigation.navigate(screen, params, {pop: true})
      }
    },
    [navigation, profileLink, isCurrent, context],
  )
  return (
    <Menu.Item
      label={l`Go to profile`}
      // @ts-expect-error The function signature differs on web -inb
      onPress={onProfilePress}
      href={profileLink}>
      <Menu.ItemIcon icon={UserCircleIcon} />
      <Menu.ItemText>
        <Trans>Go to profile</Trans>
      </Menu.ItemText>
    </Menu.Item>
  )
}

function SwitchMenuItem({
  account,
  profile,
}: {
  account: SessionAccount
  profile: app.bsky.actor.defs.ProfileViewDetailed | undefined
}) {
  const {t: l} = useLingui()
  const {onPressSwitchAccount, pendingDid} = useAccountSwitcher()
  const {isActive: live} = useActorStatus(profile)

  return (
    <Menu.Item
      disabled={!!pendingDid}
      style={[a.gap_sm, {minWidth: 150}]}
      key={account.did}
      label={l`Switch to ${sanitizeHandle(
        profile?.handle ?? account.handle,
        '@',
      )}`}
      onPress={() => void onPressSwitchAccount(account, 'SwitchAccount')}>
      <View>
        <UserAvatar
          avatar={profile?.avatar}
          size={20}
          type={profile?.associated?.labeler ? 'labeler' : 'user'}
          live={live}
          hideLiveBadge
        />
      </View>
      <Menu.ItemText>
        {sanitizeHandle(profile?.handle ?? account.handle, '@')}
      </Menu.ItemText>
    </Menu.Item>
  )
}

interface NavItemProps {
  count?: string
  hasNew?: boolean
  href: string
  icons: {
    inactive: React.ComponentType<SVGIconProps>
    active: React.ComponentType<SVGIconProps>
  }
  label: string
  minimal: boolean
  navItem: Events['nav:click']['item']
  /** Other routes that belong to this item's section, for its active state. */
  relatedRoutes?: string[]
}
/** Every route of the news hub, so its nav item stays lit across its tabs. */
const NEWS_HUB_ROUTES = [
  'NewsFeed',
  'NewsSettings',
  'OutletDirectory',
  'Frontpage',
  'NewsArticle',
]

function NavItem({
  count,
  hasNew,
  href,
  icons,
  label,
  minimal,
  navItem,
  relatedRoutes,
}: NavItemProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const {currentAccount} = useSession()

  const [pathName] = useMemo(() => router.matchPath(href), [href])
  const currentRouteInfo = useNavigationState(state => {
    if (!state) {
      return {name: 'Home'}
    }
    return getCurrentRoute(state)
  })
  let isCurrent =
    currentRouteInfo.name === 'Profile'
      ? isTab(currentRouteInfo.name, pathName) &&
        (currentRouteInfo.params as CommonNavigatorParams['Profile']).name ===
          currentAccount?.handle
      : isTab(currentRouteInfo.name, pathName)
  const isRelated =
    currentRouteInfo.name.startsWith(pathName) ||
    !!relatedRoutes?.includes(currentRouteInfo.name)
  const navigation = useNavigation<NavigationProp>()
  const onPressWrapped = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      ax.metric('nav:click', {item: navItem, surface: 'leftNav'})
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      e.preventDefault()
      if (isCurrent) {
        emitSoftReset()
      } else {
        const [screen, params] = router.matchPath(href)
        // @ts-expect-error TODO: type matchPath well enough that it can be plugged into navigation.navigate directly
        navigation.navigate(screen, params, {pop: true})
      }
    },
    [navigation, href, isCurrent, ax, navItem],
  )

  const Icon = isCurrent || isRelated ? icons.active : icons.inactive

  return (
    <PressableWithHover
      style={[
        a.flex_row,
        a.align_center,
        a.p_md,
        a.rounded_full,
        a.gap_sm,
        a.outline_inset_1,
        a.transition_color,
      ]}
      hoverStyle={t.atoms.bg_contrast_25}
      // @ts-expect-error the function signature differs on web -prf
      onPress={onPressWrapped}
      href={href}
      dataSet={{noUnderline: 1}}
      role="link"
      accessibilityLabel={label}
      accessibilityHint="">
      <View
        style={[
          a.align_center,
          a.justify_center,
          {
            width: 24,
            height: 24,
          },
          a.z_10,
        ]}>
        <Icon aria-hidden={true} width={NAV_ICON_WIDTH} style={t.atoms.text} />
        {typeof count === 'string' && count ? (
          <View
            style={[
              a.absolute,
              a.inset_0,
              {right: -20}, // more breathing room
            ]}>
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
                a.leading_tight,
                a.z_20,
                {
                  top: '-10%',
                  left: count.length === 1 ? 12 : 8,
                  backgroundColor: t.palette.primary_500,
                  color: t.palette.white,
                  lineHeight: a.text_sm.fontSize,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  minWidth: 16,
                },
              ]}>
              {count}
            </Text>
          </View>
        ) : hasNew ? (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              a.z_20,
              {
                backgroundColor: t.palette.primary_500,
                width: 8,
                height: 8,
                right: -2,
                top: -4,
              },
            ]}
          />
        ) : null}
      </View>
      {!minimal && (
        <Text style={[a.text_xl, isCurrent ? a.font_bold : a.font_normal]}>
          {label}
        </Text>
      )}
    </PressableWithHover>
  )
}

/** The design's "+" in the green button's text colour. */
function BlackPlusIcon(props: SVGIconProps) {
  return <OsoPlusIcon {...props} fill={osoButton.greenFilled.text.color} />
}

function ComposeBtn({minimal}: {minimal: boolean}) {
  const {currentAccount} = useSession()
  const {getState} = useNavigation()
  const {openComposer} = useOpenComposer()
  const {t: l} = useLingui()
  const [isFetchingHandle, setIsFetchingHandle] = useState(false)
  const fetchHandle = useFetchHandle()

  const getProfileHandle = async () => {
    const routes = getState()?.routes
    const currentRoute = routes?.[routes?.length - 1]

    if (currentRoute?.name === 'Profile') {
      let handle: string | undefined = (
        currentRoute.params as CommonNavigatorParams['Profile']
      ).name

      if (handle.startsWith('did:')) {
        try {
          setIsFetchingHandle(true)
          handle = await fetchHandle(handle)
        } catch (e) {
          handle = undefined
        }
        setIsFetchingHandle(false)
      }

      if (
        !handle ||
        handle === currentAccount?.handle ||
        isInvalidHandle(handle)
      )
        return undefined

      return handle
    }

    return undefined
  }

  const onPressCompose = async () =>
    openComposer({mention: await getProfileHandle(), logContext: 'Fab'})

  return (
    <View style={minimal ? [a.px_sm, a.pt_lg] : [a.flex_row, a.pl_md, a.pt_lg]}>
      <Button
        disabled={isFetchingHandle}
        label={l`Compose new post`}
        onPress={() => void onPressCompose()}
        size="large"
        color="primary"
        style={[
          a.rounded_full,
          osoButton.greenFilled.style,
          minimal && {width: LARGE_ELEMENT_SIZE, height: LARGE_ELEMENT_SIZE},
        ]}
        hoverStyle={osoButton.greenFilled.hoverStyle}>
        {/* xs is the cap height of the button text, so + and N line up */}
        <ButtonIcon icon={BlackPlusIcon} size={minimal ? 'sm' : 'xs'} />
        {!minimal && (
          <ButtonText style={osoButton.greenFilled.text}>
            <Trans context="action">New post</Trans>
          </ButtonText>
        )}
      </Button>
    </View>
  )
}

export function DesktopLeftNav({routeName}: {routeName: string}) {
  const {hasSession} = useSession()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()

  const aa = useAgeAssurance()
  // splitview uses the minimal variant of the leftnav. unfortunately there's no easy
  // way to thread this data through because of the view hierarchy, so just check the route name
  const isMessagesRelatedScreen =
    routeName.startsWith('Messages') && aa.state.access === aa.Access.Full
  const {leftNavMinimal: leftNavMinimalBreakpoint, centerColumnOffset} =
    useLayoutBreakpoints()
  const numUnreadNotifications = useUnreadNotifications()
  const numUnreadMessages = useUnreadMessageCount()

  const leftNavMinimal = isMessagesRelatedScreen || leftNavMinimalBreakpoint
  /*
   * Oso lists FAQ, legal and other links at the bottom of this column on every
   * page, instead of in the right column. The icon-only column has no room.
   */
  const showLegalLinks = IS_PARTNER_PREVIEW && !leftNavMinimal

  if (!hasSession && !gtMobile) {
    return null
  }

  return (
    <View
      role="navigation"
      style={[
        a.fixed,
        a.top_0,
        a.p_lg,
        styles.leftNav,
        !hasSession && !leftNavMinimal && {width: LEFT_NAV_PWI_WIDTH},
        // Full height, so the links can sit at the bottom.
        showLegalLinks && {height: '100vh'},
        leftNavMinimal && [
          {width: LEFT_NAV_MINIMAL_WIDTH},
          a.h_full,
          a.align_center,
          web(a.overflow_x_hidden),
        ],
        {
          transform: [
            {
              translateX:
                -(CENTER_COLUMN_WIDTH / 2) +
                (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0) +
                (isMessagesRelatedScreen && !leftNavMinimalBreakpoint
                  ? LEFT_NAV_MINIMAL_WIDTH - LEFT_NAV_STANDARD_WIDTH
                  : 0),
            },
            {translateX: '-100%'},
            ...a.scrollbar_offset.transform,
          ],
        },
      ]}>
      {hasSession ? (
        <ProfileCard minimal={leftNavMinimal} />
      ) : !leftNavMinimal ? (
        <View style={[a.pt_xl]}>
          <NavSignupCard />
        </View>
      ) : null}
      {hasSession && (
        <>
          <NavItem
            label={l`Feeds`}
            href="/"
            navItem="home"
            minimal={leftNavMinimal}
            icons={{
              inactive: OsoFeedsIcon,
              active: OsoFeedsActiveIcon,
            }}
          />
          <NavItem
            label={l`News`}
            href={NEWS_V2_ENABLED ? '/news/explore' : '/news'}
            navItem="news"
            relatedRoutes={NEWS_V2_ENABLED ? NEWS_HUB_ROUTES : undefined}
            minimal={leftNavMinimal}
            icons={{
              inactive: OsoNewsIcon,
              active: OsoNewsActiveIcon,
            }}
          />
          <NavItem
            label={l`Events`}
            href="/events"
            navItem="events"
            minimal={leftNavMinimal}
            icons={{
              inactive: OsoEventsIcons.inactive,
              active: OsoEventsIcons.active,
            }}
          />
          <NavItem
            label={l`Explore`}
            href="/search"
            navItem="search"
            minimal={leftNavMinimal}
            icons={{
              inactive: OsoExploreIcon,
              active: OsoExploreActiveIcon,
            }}
          />
          <NavItem
            label={l`Notifications`}
            href="/notifications"
            navItem="notifications"
            minimal={leftNavMinimal}
            count={numUnreadNotifications}
            icons={{
              inactive: BellIcon,
              active: BellFilledIcon,
            }}
          />
          <NavItem
            label={l`Chat`}
            href="/messages"
            navItem="chat"
            minimal={leftNavMinimal}
            count={
              aa.flags.chatDisabled ? undefined : numUnreadMessages.numUnread
            }
            hasNew={!aa.flags.chatDisabled && numUnreadMessages.hasNew}
            icons={{
              inactive: OsoChatIcon,
              active: OsoChatActiveIcon,
            }}
          />

          <ComposeBtn minimal={leftNavMinimal} />
        </>
      )}
      {showLegalLinks && (
        <>
          {/* Pushes the links to the bottom of the screen */}
          <View style={[a.flex_1, {minHeight: 24}]} />
          <View style={[a.px_md, a.pb_sm]}>
            <DesktopLegalLinks />
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  leftNav: {
    left: '50%',
    width: LEFT_NAV_STANDARD_WIDTH,
    maxHeight: '100vh',
    // @ts-expect-error web only
    overflowY: 'auto',
    scrollbarWidth: 'thin',
  },
})
