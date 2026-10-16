import {Pressable, Text, useWindowDimensions, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useEnableMinimalShellMode} from '#/state/shell/minimal-mode'
import {atoms as a, useBreakpoints, web} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'

export type OsoLandingDestination = 'news' | 'events' | 'explore'

/**
 * Colours from the Oso landing page design reference. The page is always
 * black, independent of the user's theme.
 */
const COLORS = {
  background: '#000000',
  yellow: '#F8FD79',
  blue: '#5167FF',
  green: '#00E068',
}

/**
 * ABC Solar Display Medium, bundled by scripts/prepare-oso-preview.mjs. ss05
 * is the stylistic set with the angled "t" used in the design. Tiles use the
 * plain react-native Text because Typography's Text swaps in the theme font.
 */
const DISPLAY_FONT = 'ABCSolarDisplay, LeagueSpartan, system-ui, sans-serif'

const GAP_DESKTOP = 24
const GAP_MOBILE = 16

/**
 * Full-screen chooser shown to signed-in Oso users before the home feed. No
 * navigation chrome: the user picks news, events or explore, and the app
 * continues from there as usual.
 */
export function OsoLanding({
  onSelect,
}: {
  onSelect: (destination: OsoLandingDestination) => void
}) {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {width} = useWindowDimensions()
  useEnableMinimalShellMode()

  const padding = gtMobile ? 48 : 20
  const gap = gtMobile ? GAP_DESKTOP : GAP_MOBILE
  const contentWidth = width - padding * 2
  /*
   * Desktop mirrors the reference frame: news takes two thirds of the row,
   * events and explore stack in the remaining third. On phones the tiles
   * stack, still shrinking from news to explore.
   */
  const newsWidth = gtMobile ? ((contentWidth - gap) * 2) / 3 : contentWidth
  const sideWidth = gtMobile ? (contentWidth - gap) / 3 : contentWidth

  return (
    <View
      testID="osoLanding"
      style={[
        a.util_screen_outer,
        a.flex_1,
        a.gap_xl,
        {padding, backgroundColor: COLORS.background},
      ]}>
      <BrandLogo variant="mark" size={gtMobile ? 220 : 140} fill="#FFFFFF" />
      <View style={[a.flex_1, gtMobile ? a.flex_row : a.flex_col, {gap}]}>
        <Tile
          testID="osoLandingNews"
          label={l({
            message: 'news',
            comment:
              'Oso landing page tile linking to the news hub. Lowercase on purpose.',
          })}
          hint={l`Opens the news page`}
          tileWidth={newsWidth}
          fontSize={Math.min(newsWidth * 0.3, 360)}
          background={COLORS.yellow}
          color={COLORS.blue}
          style={{flex: 2}}
          onPress={() => onSelect('news')}
        />
        <View style={[{flex: gtMobile ? 1 : 2.4, gap}]}>
          <Tile
            testID="osoLandingEvents"
            label={l({
              message: 'events',
              comment:
                'Oso landing page tile linking to the events page. Lowercase on purpose.',
            })}
            hint={l`Opens the events page`}
            tileWidth={sideWidth}
            fontSize={Math.min(sideWidth * (gtMobile ? 0.28 : 0.2), 200)}
            background={COLORS.blue}
            color={COLORS.green}
            style={{flex: gtMobile ? 2.5 : 1.4}}
            onPress={() => onSelect('events')}
          />
          <Tile
            testID="osoLandingExplore"
            label={l({
              message: 'explore',
              comment:
                'Oso landing page tile linking to the explore page. Lowercase on purpose.',
            })}
            hint={l`Opens the explore page`}
            tileWidth={sideWidth}
            fontSize={Math.min(sideWidth * (gtMobile ? 0.19 : 0.14), 140)}
            background={COLORS.green}
            color={COLORS.blue}
            style={{flex: 1}}
            onPress={() => onSelect('explore')}
          />
        </View>
      </View>
    </View>
  )
}

function Tile({
  testID,
  label,
  hint,
  tileWidth,
  fontSize,
  background,
  color,
  style,
  onPress,
}: {
  testID: string
  label: string
  hint: string
  tileWidth: number
  fontSize: number
  background: string
  color: string
  style: {flex: number}
  onPress: () => void
}) {
  const {gtMobile} = useBreakpoints()
  const radius = Math.min(Math.max(tileWidth * 0.04, 24), 56)
  // Same hole size on every tile, as in the design.
  const hole = gtMobile ? 34 : 20
  const holeInset = hole * 0.6

  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({pressed}) => [
        a.justify_center,
        a.align_center,
        a.overflow_hidden,
        a.px_lg,
        {
          minHeight: fontSize * 1.6,
          borderRadius: radius,
          backgroundColor: background,
          opacity: pressed ? 0.85 : 1,
        },
        web({cursor: 'pointer'}),
        style,
      ]}>
      {/* The two punched holes from the design, in the page colour. */}
      <View
        style={[
          a.absolute,
          {
            top: holeInset,
            left: holeInset,
            width: hole,
            height: hole,
            borderRadius: hole / 2,
            backgroundColor: COLORS.background,
          },
        ]}
      />
      <View
        style={[
          a.absolute,
          {
            top: holeInset,
            right: holeInset,
            width: hole,
            height: hole,
            borderRadius: hole / 2,
            backgroundColor: COLORS.background,
          },
        ]}
      />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          a.text_center,
          {
            color,
            fontSize,
            lineHeight: fontSize * 1.1,
            fontFamily: DISPLAY_FONT,
            fontWeight: '500',
          },
          web({fontFeatureSettings: '"ss05"'}),
        ]}>
        {label}
      </Text>
    </Pressable>
  )
}
