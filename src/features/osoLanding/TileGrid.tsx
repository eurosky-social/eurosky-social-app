import {Pressable, Text, View} from 'react-native'

import {atoms as a, useBreakpoints, web} from '#/alf'
import {OSO_COLORS, OSO_DISPLAY_FEATURES, OSO_DISPLAY_FONT} from './theme'

export type OsoTile = {
  testID: string
  label: string
  hint: string
  onPress: () => void
}

/*
 * Sized to match the signed-out splash: no wider than a phone column on
 * phones. Desktop mirrors the reference frame (the first tile takes two
 * thirds, the other two stack on the right); phones stack all three.
 */
const DESKTOP = {width: 520, height: 240, gap: 12}
const MOBILE = {width: 320, gap: 10}

const HOLE = 12
const HOLE_INSET = 8

/**
 * Three tiles from the Oso landing page design, largest first. Colours follow
 * the design: yellow, blue, then green.
 */
export function OsoTileGrid({
  tiles,
  holeColor,
}: {
  tiles: [OsoTile, OsoTile, OsoTile]
  /** The page colour behind the grid, shown through the punched holes. */
  holeColor: string
}) {
  const {gtMobile} = useBreakpoints()
  const [large, medium, small] = tiles

  if (gtMobile) {
    return (
      <View
        style={[
          a.flex_row,
          {width: DESKTOP.width, height: DESKTOP.height, gap: DESKTOP.gap},
        ]}>
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
        style={{height: 150}}
      />
      <Tile
        tile={medium}
        fontSize={44}
        background={OSO_COLORS.blue}
        color={OSO_COLORS.green}
        holeColor={holeColor}
        style={{height: 100}}
      />
      <Tile
        tile={small}
        fontSize={28}
        background={OSO_COLORS.green}
        color={OSO_COLORS.blue}
        holeColor={holeColor}
        style={{height: 64}}
      />
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
          backgroundColor: background,
          opacity: pressed ? 0.85 : 1,
        },
        web({cursor: 'pointer'}),
        style,
      ]}>
      {/* The two punched holes from the design. */}
      <View style={[a.absolute, {top: HOLE_INSET, left: HOLE_INSET}, hole]} />
      <View style={[a.absolute, {top: HOLE_INSET, right: HOLE_INSET}, hole]} />
      <Text
        numberOfLines={1}
        style={[
          a.text_center,
          {
            color,
            fontSize,
            lineHeight: fontSize * 1.1,
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
