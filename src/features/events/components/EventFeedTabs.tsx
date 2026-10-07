import {useRef, useState} from 'react'
import {type ScrollView, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {DraggableScrollView} from '#/view/com/pager/DraggableScrollView'
import {BlockDrawerGesture} from '#/view/shell/BlockDrawerGesture'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {transparentifyColor} from '#/alf/util/colorGeneration'
import {Button, ButtonIcon} from '#/components/Button'
import {
  ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeft,
  ArrowRight_Stroke2_Corner0_Rounded as ArrowRight,
} from '#/components/icons/Arrow'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

/** How far one press of an arrow button scrolls. */
const ARROW_SCROLL_DISTANCE = 200

/**
 * Horizontal pill tabs for switching between event feeds. Modelled on
 * InterestTabs: drag-to-scroll everywhere, plus arrow buttons on web when there
 * is more to scroll, since a mouse has no obvious way to scroll sideways.
 */
export function EventFeedTabs<Id extends string>({
  items,
  selectedId,
  onSelect,
  gutterWidth = tokens.space.lg,
}: {
  items: {id: Id; label: string}[]
  selectedId: Id
  onSelect: (id: Id) => void
  gutterWidth?: number
}) {
  const {t: l} = useLingui()
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const tabOffsets = useRef(new Map<Id, {x: number; width: number}>())
  const [viewportWidth, setViewportWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)

  const maxScrollX = Math.max(0, contentWidth - viewportWidth)
  const canScrollLeft = scrollX > 0
  const canScrollRight = Math.ceil(scrollX) < maxScrollX

  const scrollTo = (x: number) => {
    listRef.current?.scrollTo({
      x: Math.min(maxScrollX, Math.max(0, x)),
      animated: true,
    })
  }

  const onPressTab = (id: Id) => {
    onSelect(id)
    // Center the selected tab.
    const offset = tabOffsets.current.get(id)
    if (offset) scrollTo(offset.x - (viewportWidth - offset.width) / 2)
  }

  return (
    <View style={[a.relative, a.flex_row]}>
      <BlockDrawerGesture>
        <DraggableScrollView
          ref={listRef}
          contentContainerStyle={[
            a.gap_sm,
            a.py_md,
            {paddingHorizontal: gutterWidth},
          ]}
          showsHorizontalScrollIndicator={false}
          onLayout={evt => setViewportWidth(evt.nativeEvent.layout.width)}
          onContentSizeChange={width => setContentWidth(width)}
          onScroll={evt => setScrollX(evt.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}>
          {items.map(item => (
            <View
              key={item.id}
              onLayout={evt => {
                const {x, width} = evt.nativeEvent.layout
                tabOffsets.current.set(item.id, {x, width})
              }}>
              <Tab
                label={item.label}
                active={item.id === selectedId}
                onPress={() => onPressTab(item.id)}
              />
            </View>
          ))}
        </DraggableScrollView>
      </BlockDrawerGesture>
      {IS_WEB && canScrollLeft && (
        <ArrowButton
          side="left"
          label={l`Scroll left`}
          gutterWidth={gutterWidth}
          onPress={() => scrollTo(scrollX - ARROW_SCROLL_DISTANCE)}
        />
      )}
      {IS_WEB && canScrollRight && (
        <ArrowButton
          side="right"
          label={l`Scroll right`}
          gutterWidth={gutterWidth}
          onPress={() => scrollTo(scrollX + ARROW_SCROLL_DISTANCE)}
        />
      )}
    </View>
  )
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <Button
      label={active ? l`${label} (selected)` : l`Show ${label}`}
      onPress={onPress}
      // Disable the default focus ring; the pill renders its own.
      style={web({outline: 'none'})}>
      {({hovered, pressed, focused}) => (
        <View
          style={[
            a.rounded_full,
            a.px_lg,
            a.py_sm,
            a.border,
            active || hovered || pressed
              ? [t.atoms.bg_contrast_25, t.atoms.border_contrast_medium]
              : focused
                ? {
                    borderColor: t.palette.primary_300,
                    backgroundColor: t.palette.primary_25,
                  }
                : [t.atoms.bg, t.atoms.border_contrast_low],
          ]}>
          <Text
            emoji
            style={[
              a.font_medium,
              active || hovered || pressed
                ? t.atoms.text
                : t.atoms.text_contrast_medium,
            ]}>
            {label}
          </Text>
        </View>
      )}
    </Button>
  )
}

function ArrowButton({
  side,
  label,
  gutterWidth,
  onPress,
}: {
  side: 'left' | 'right'
  label: string
  gutterWidth: number
  onPress: () => void
}) {
  const t = useTheme()
  const bg = t.atoms.bg.backgroundColor
  // Fade the tabs out under the button, toward the edge it sits on.
  const fade = `linear-gradient(to ${side}, ${transparentifyColor(bg, 0)} 0%, ${bg} 30%, ${bg} 100%)`

  return (
    <View
      style={[
        a.absolute,
        a.top_0,
        a.bottom_0,
        a.justify_center,
        a.z_10,
        side === 'left'
          ? [a.left_0, a.pr_md, {paddingLeft: gutterWidth}]
          : [a.right_0, a.pl_md, {paddingRight: gutterWidth}],
        web({background: fade}),
      ]}>
      <Button
        label={label}
        onPress={onPress}
        color="secondary"
        size="small"
        shape="round"
        style={[a.border, t.atoms.border_contrast_low, t.atoms.bg]}>
        <ButtonIcon icon={side === 'left' ? ArrowLeft : ArrowRight} />
      </Button>
    </View>
  )
}
