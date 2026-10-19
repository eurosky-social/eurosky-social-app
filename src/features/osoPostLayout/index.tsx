import {createContext, useContext} from 'react'
import {Pressable, Text, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Image_Stroke2_Corner2_Rounded as ImageIcon} from '#/components/icons/Image'
import {device, useStorage} from '#/storage'

/**
 * How Oso's news, events and /myfeeds pages lay out items: `image` puts the
 * picture first and large (like Instagram), `text` leads with the text and
 * shows a small thumbnail beside it (like a list of posts).
 */
export type OsoPostLayout = 'image' | 'text'

export const DEFAULT_OSO_POST_LAYOUT: OsoPostLayout = 'text'

const Context = createContext<OsoPostLayout | undefined>(undefined)
Context.displayName = 'OsoPostLayoutContext'

/**
 * The layout for items rendered inside an `OsoPostLayoutProvider`, or
 * undefined elsewhere, where components keep their usual layout. Only the Oso
 * pages that show the toggle provide one.
 */
export function useOsoPostLayout() {
  return useContext(Context)
}

/** The saved preference and its setter, shared across the pages. */
export function useOsoPostLayoutPreference() {
  const [layout = DEFAULT_OSO_POST_LAYOUT, setLayout] = useStorage(device, [
    'osoPostLayout',
  ])
  return [layout, setLayout] as const
}

export function OsoPostLayoutProvider({children}: {children: React.ReactNode}) {
  const [layout] = useOsoPostLayoutPreference()
  return <Context.Provider value={layout}>{children}</Context.Provider>
}

const SEGMENT_HEIGHT = 32
const SEGMENT_WIDTH = 44

/**
 * The header toggle from the design references: an image icon and a "T",
 * the selected side filled with the accent colour.
 */
export function OsoPostLayoutToggle() {
  const t = useTheme()
  const {t: l} = useLingui()
  const [layout, setLayout] = useOsoPostLayoutPreference()
  const accent = t.palette.primary_500
  /* Readable on the accent in every theme (navy in light, green in dark). */
  const onAccent = t.palette.contrast_0

  const segment = (value: OsoPostLayout) => {
    const selected = layout === value
    return {
      selected,
      style: [
        a.align_center,
        a.justify_center,
        a.rounded_full,
        {
          width: SEGMENT_WIDTH,
          height: SEGMENT_HEIGHT,
          backgroundColor: selected ? accent : 'transparent',
        },
        web({cursor: 'pointer'}),
      ],
      color: selected ? onAccent : accent,
    }
  }
  const image = segment('image')
  const text = segment('text')

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        a.flex_row,
        a.rounded_full,
        {borderWidth: 1.5, borderColor: accent, padding: 2},
      ]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{selected: image.selected}}
        accessibilityLabel={l`Images first`}
        accessibilityHint={l`Shows pictures large, before the text`}
        onPress={() => setLayout('image')}
        style={image.style}>
        <ImageIcon size="md" fill={image.color} />
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{selected: text.selected}}
        accessibilityLabel={l`Text first`}
        accessibilityHint={l`Shows the text first, with small pictures`}
        onPress={() => setLayout('text')}
        style={text.style}>
        <Text
          style={[
            a.font_bold,
            {fontSize: 18, lineHeight: 20, color: text.color},
          ]}>
          T
        </Text>
      </Pressable>
    </View>
  )
}
