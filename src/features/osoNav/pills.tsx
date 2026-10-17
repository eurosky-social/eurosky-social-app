import {Text, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, web} from '#/alf'
import {
  Bell_Filled_Corner0_Rounded as BellFilledIcon,
  Bell_Stroke2_Corner0_Rounded as BellIcon,
} from '#/components/icons/Bell'
import {BrandLogo} from '#/components/icons/BrandLogo'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Hashtag_Filled_Corner0_Rounded as HashtagFilledIcon,
  Hashtag_Stroke2_Corner0_Rounded as HashtagIcon,
} from '#/components/icons/Hashtag'
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
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SettingsSliderIcon} from '#/components/icons/SettingsSlider'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {Tote as ToteIcon} from '#/components/icons/Tote'
import {Trending3_Stroke2_Corner1_Rounded as TrendingIcon} from '#/components/icons/Trending'
import {
  OSO_COLORS,
  OSO_DISPLAY_FEATURES,
  OSO_DISPLAY_FONT,
} from '#/features/osoLanding/theme'

export const OSO_PILL_HEIGHT = 48
export const OSO_PILL_ICON_SIZE = 28
const OSO_TITLE_LOGO_WIDTH = 64

export type OsoPillKind =
  | 'home'
  | 'news'
  | 'events'
  | 'explore'
  | 'feeds'
  | 'chat'
  | 'notifications'
  | 'starterPacks'
  | 'trending'
  | 'discover'
  | 'myFeeds'
  | 'manageFeeds'

export type OsoPillDefinition = {
  label: string
  background: string
  color: string
  icons: {
    inactive: React.ComponentType<SVGIconProps>
    active: React.ComponentType<SVGIconProps>
  }
  /** Label size; long labels are smaller so the pill fits the left bar. */
  fontSize: number
}

/**
 * The single definition of each Oso pill, shared by the left menu and the
 * page titles so they always look the same. Starter packs and trending use
 * the colours of their tiles on the explore page.
 */
export function useOsoPill(kind: OsoPillKind): OsoPillDefinition {
  const {t: l} = useLingui()

  switch (kind) {
    case 'home':
      return {
        label: l({
          message: 'home',
          comment: 'Oso link to the landing page. Lowercase on purpose.',
        }),
        background: OSO_COLORS.navy,
        color: OSO_COLORS.white,
        icons: {inactive: HomeIcon, active: HomeFilledIcon},
        fontSize: 32,
      }
    case 'news':
      return {
        label: l({
          message: 'news',
          comment: 'Oso link and title for the news hub. Lowercase on purpose.',
        }),
        background: OSO_COLORS.blue,
        color: OSO_COLORS.yellow,
        icons: {inactive: NewspaperIcon, active: NewspaperFilledIcon},
        fontSize: 32,
      }
    case 'events':
      return {
        label: l({
          message: 'events',
          comment:
            'Oso link and title for the events page. Lowercase on purpose.',
        }),
        background: OSO_COLORS.green,
        color: OSO_COLORS.blue,
        icons: {inactive: CalendarIcon, active: CalendarIcon},
        fontSize: 32,
      }
    case 'explore':
      return {
        label: l({
          message: 'explore',
          comment:
            'Oso link and title for the explore page. Lowercase on purpose.',
        }),
        background: OSO_COLORS.yellow,
        color: OSO_COLORS.grayBrown,
        icons: {
          inactive: MagnifyingGlassIcon,
          active: MagnifyingGlassFilledIcon,
        },
        fontSize: 32,
      }
    case 'feeds':
      return {
        label: l({
          message: 'feeds',
          comment: 'Oso link to the feeds page. Lowercase on purpose.',
        }),
        background: OSO_COLORS.red,
        color: OSO_COLORS.skyBlue,
        icons: {inactive: HashtagIcon, active: HashtagFilledIcon},
        fontSize: 32,
      }
    case 'chat':
      return {
        label: l({
          message: 'chats',
          comment: 'Oso link to chat. Lowercase on purpose.',
        }),
        background: OSO_COLORS.creme,
        color: OSO_COLORS.darkBlue,
        icons: {inactive: MessageIcon, active: MessageFilledIcon},
        fontSize: 32,
      }
    case 'notifications':
      return {
        label: l({
          message: 'notifications',
          comment: 'Oso link to notifications. Lowercase on purpose.',
        }),
        background: OSO_COLORS.white,
        color: OSO_COLORS.navy,
        icons: {inactive: BellIcon, active: BellFilledIcon},
        fontSize: 22,
      }
    case 'starterPacks':
      return {
        label: l({
          message: 'starter packs',
          comment:
            'Oso title for the starter packs page. Lowercase on purpose.',
        }),
        // Same colours as its tile on the explore page.
        background: OSO_COLORS.navy,
        color: OSO_COLORS.white,
        icons: {inactive: ToteIcon, active: ToteIcon},
        fontSize: 26,
      }
    case 'trending':
      return {
        label: l({
          message: 'popular',
          comment:
            'Oso title for the page of trending topics. Lowercase on purpose.',
        }),
        background: OSO_COLORS.navy,
        color: OSO_COLORS.white,
        icons: {inactive: TrendingIcon, active: TrendingIcon},
        fontSize: 32,
      }
    case 'discover':
      return {
        label: l({
          message: 'discover',
          comment:
            'Oso section title for feeds to discover. Lowercase on purpose.',
        }),
        background: OSO_COLORS.navy,
        color: OSO_COLORS.white,
        icons: {inactive: SparkleIcon, active: SparkleIcon},
        fontSize: 32,
      }
    case 'myFeeds':
      return {
        label: l({
          message: 'my feeds',
          comment:
            'Oso section title for the feeds the user has saved. Lowercase on purpose.',
        }),
        background: OSO_COLORS.navy,
        color: OSO_COLORS.white,
        icons: {inactive: HashtagIcon, active: HashtagFilledIcon},
        fontSize: 30,
      }
    case 'manageFeeds':
      return {
        label: l({
          message: 'manage feeds',
          comment:
            'Oso title for the page for managing feeds. Lowercase on purpose.',
        }),
        background: OSO_COLORS.navy,
        color: OSO_COLORS.white,
        icons: {inactive: SettingsSliderIcon, active: SettingsSliderIcon},
        fontSize: 26,
      }
  }
}

/** The pill's background shape, for pressable and static pills alike. */
export function osoPillShapeStyle(
  pill: OsoPillDefinition,
  {
    minimal = false,
    height = OSO_PILL_HEIGHT,
  }: {
    minimal?: boolean
    /** Smaller pills are used in the phone-width bottom bar. */
    height?: number
  } = {},
) {
  return [
    a.flex_row,
    a.align_center,
    a.rounded_full,
    a.gap_sm,
    {
      height,
      backgroundColor: pill.background,
      alignSelf: minimal ? ('center' as const) : ('flex-start' as const),
    },
    minimal
      ? {width: height, justifyContent: 'center' as const}
      : {
          paddingLeft: (height - OSO_PILL_ICON_SIZE) / 2,
          paddingRight: 20,
        },
  ]
}

export function OsoPillLabel({pill}: {pill: OsoPillDefinition}) {
  return (
    <Text
      numberOfLines={1}
      style={[
        {
          color: pill.color,
          fontSize: pill.fontSize,
          lineHeight: OSO_PILL_HEIGHT,
          fontFamily: OSO_DISPLAY_FONT,
          fontWeight: '700',
        },
        web({fontFeatureSettings: OSO_DISPLAY_FEATURES}),
      ]}>
      {pill.label}
    </Text>
  )
}

/**
 * A pill used as a page title, so the page heading looks exactly like the
 * left menu button that leads to it.
 */
export function OsoTitlePill({
  kind,
  withLogo = true,
}: {
  kind: OsoPillKind
  /** Section headers inside a page leave out the logo. */
  withLogo?: boolean
}) {
  const pill = useOsoPill(kind)
  const Icon = pill.icons.active

  return (
    <View style={[a.flex_row, a.align_center, a.gap_md]}>
      {/*
       * The Oso wordmark between the back button and the title. The hero logo
       * is near-black in light mode and light in dark mode.
       */}
      {withLogo && <BrandLogo variant="hero" size={OSO_TITLE_LOGO_WIDTH} />}
      <View accessibilityRole="header" style={osoPillShapeStyle(pill)}>
        <Icon aria-hidden={true} width={OSO_PILL_ICON_SIZE} fill={pill.color} />
        <OsoPillLabel pill={pill} />
      </View>
    </View>
  )
}
