import {Pressable, Text, View} from 'react-native'

import {atoms as a, useBreakpoints, web} from '#/alf'
import {OSO_COLORS, OSO_DISPLAY_FEATURES, OSO_DISPLAY_FONT} from './theme'

export type OsoTile = {
  testID: string
  label: string
  hint: string
  onPress: () => void
  /**
   * Scales the tile's default text size, for long labels. A label may contain
   * line breaks (`\n`); each line is kept on its own line.
   */
  fontScale?: number
  /** Overrides the tile's colours, which otherwise follow its position. */
  colors?: {background: string; text: string}
}

/*
 * Sized to match the signed-out splash: no wider than a phone column on
 * phones. Desktop mirrors the reference frame (the first tile takes two
 * thirds, the other two stack on the right); phones stack all three. Any
 * further tiles sit underneath in a row of equal tiles (stacked on phones).
 */
const DESKTOP = {width: 520, height: 240, rowHeight: 80, gap: 12}
const MOBILE = {width: 320, gap: 10}

const HOLE = 12
const HOLE_INSET = 8

/**
 * Tiles from the Oso landing page design, largest first. The first three
 * follow the design's colours (yellow, blue, then green); `moreTiles` use
 * their own `colors`.
 */
export function OsoTileGrid({
  tiles,
  moreTiles = [],
  holeColor,
}: {
  tiles: [OsoTile, OsoTile, OsoTile]
  /** Smaller tiles in a row under the main three. */
  moreTiles?: OsoTile[]
  /** The page colour behind the grid, shown through the punched holes. */
  holeColor: string
}) {
  const {gtMobile} = useBreakpoints()
  const [large, medium, small] = tiles
  // Phones shorten the main tiles when more follow, so the page still fits.
  const compact = moreTiles.length > 0

  if (gtMobile) {
    return (
      <View style={{width: DESKTOP.width, gap: DESKTOP.gap}}>
        <View style={[a.flex_row, {height: DESKTOP.height, gap: DESKTOP.gap}]}>
          <Tile
            tile={large}
            fontSize={96}
            background={OSO_COLORS.yellow}
            color={OSO_COLORS.blue}
            holeColor={holeColor}
            style={{flex: 2}}
          />
          <View style={[a.flex_1, {gap: DESKTOP.gap}]}>
            <Tile
              tile={medium}
              fontSize={44}
              background={OSO_COLORS.blue}
              color={OSO_COLORS.green}
              holeColor={holeColor}
              style={{flex: 2.5}}
            />
            <Tile
              tile={small}
              fontSize={28}
              background={OSO_COLORS.green}
              color={OSO_COLORS.blue}
              holeColor={holeColor}
              style={{flex: 1}}
            />
          </View>
        </View>
        {compact && (
          <View
            style={[a.flex_row, {height: DESKTOP.rowHeight, gap: DESKTOP.gap}]}>
            {moreTiles.map(tile => (
              <Tile
                key={tile.testID}
                tile={tile}
                fontSize={24}
                background={OSO_COLORS.green}
                color={OSO_COLORS.blue}
                holeColor={holeColor}
                style={{flex: 1}}
              />
            ))}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[a.w_full, {maxWidth: MOBILE.width, gap: MOBILE.gap}]}>
      <Tile
        tile={large}
        fontSize={72}
        background={OSO_COLORS.yellow}
        color={OSO_COLORS.blue}
        holeColor={holeColor}
        style={{height: compact ? 120 : 150}}
      />
      <Tile
        tile={medium}
        fontSize={44}
        background={OSO_COLORS.blue}
        color={OSO_COLORS.green}
        holeColor={holeColor}
        style={{height: compact ? 84 : 100}}
      />
      <Tile
        tile={small}
        fontSize={28}
        background={OSO_COLORS.green}
        color={OSO_COLORS.blue}
        holeColor={holeColor}
        style={{height: compact ? 60 : 64}}
      />
      {moreTiles.map(tile => (
        <Tile
          key={tile.testID}
          tile={tile}
          fontSize={24}
          background={OSO_COLORS.green}
          color={OSO_COLORS.blue}
          holeColor={holeColor}
          style={{height: 52}}
        />
      ))}
    </View>
  )
}

function Tile({
  tile,
  fontSize,
  background,
  color,
  holeColor,
  style,
}: {
  tile: OsoTile
  fontSize: number
  background: string
  color: string
  holeColor: string
  style: {flex: number} | {height: number}
}) {
  const hole = {
    width: HOLE,
    height: HOLE,
    borderRadius: HOLE / 2,
    backgroundColor: holeColor,
  }
  const size = fontSize * (tile.fontScale ?? 1)
  const tileBackground = tile.colors?.background ?? background
  const textColor = tile.colors?.text ?? color
  const lines = tile.label.split('\n').length

  return (
    <Pressable
      testID={tile.testID}
      accessibilityRole="link"
      accessibilityLabel={tile.label}
      accessibilityHint={tile.hint}
      onPress={tile.onPress}
      style={({pressed}) => [
        a.justify_center,
        a.align_center,
        a.overflow_hidden,
        a.px_md,
        {
          borderRadius: 20,
          backgroundColor: tileBackground,
          opacity: pressed ? 0.85 : 1,
        },
        web({cursor: 'pointer'}),
        style,
      ]}>
      {/* The two punched holes from the design. */}
      <View style={[a.absolute, {top: HOLE_INSET, left: HOLE_INSET}, hole]} />
      <View style={[a.absolute, {top: HOLE_INSET, right: HOLE_INSET}, hole]} />
      <Text
        numberOfLines={lines}
        style={[
          a.text_center,
          {
            color: textColor,
            fontSize: size,
            lineHeight: size * (lines > 1 ? 1 : 1.1),
            fontFamily: OSO_DISPLAY_FONT,
            fontWeight: '500',
          },
          web({fontFeatureSettings: OSO_DISPLAY_FEATURES}),
        ]}>
        {tile.label}
      </Text>
    </Pressable>
  )
}
