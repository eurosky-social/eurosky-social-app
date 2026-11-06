import {createContext, useContext, useMemo} from 'react'
import {type GestureResponderEvent, type Insets, type View} from 'react-native'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, type ButtonProps} from '#/components/Button'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Text, type TextProps} from '#/components/Typography'

export const DEFAULT_HITSLOP = {top: 5, bottom: 10, left: 10, right: 10}

const PresentationContext = createContext<'default' | 'overlay'>('default')

/** Scope high-contrast video controls without changing feed/thread defaults. */
export function PostControlButtonProvider({
  children,
  presentation,
}: React.PropsWithChildren<{presentation: 'default' | 'overlay'}>) {
  return (
    <PresentationContext.Provider value={presentation}>
      {children}
    </PresentationContext.Provider>
  )
}

const PostControlContext = createContext<{
  overlay?: boolean
  big?: boolean
  active?: boolean
  color?: {color: string}
}>({})
PostControlContext.displayName = 'PostControlContext'

// Base button style, which the the other ones extend
export function PostControlButton({
  ref,
  onPress,
  onLongPress,
  children,
  big,
  active,
  activeColor,
  ...props
}: Omit<ButtonProps, 'hitSlop'> & {
  ref?: React.Ref<React.ComponentRef<typeof View>>
  active?: boolean
  big?: boolean
  color?: string
  activeColor?: string
  hitSlop?: Insets
}) {
  const t = useTheme()
  const haptics = useHaptics()
  const overlay = useContext(PresentationContext) === 'overlay'

  const ctx = useMemo(
    () => ({
      big,
      active,
      overlay,
      color: {
        color:
          activeColor && active
            ? activeColor
            : overlay
              ? '#fff'
              : t.palette.contrast_500,
      },
    }),
    [big, active, activeColor, overlay, t.palette.contrast_500],
  )

  const style = useMemo(
    () => [
      a.flex_row,
      a.align_center,
      a.gap_xs,
      a.bg_transparent,
      {padding: 5},
    ],
    [],
  )

  const handlePress = useMemo(() => {
    if (!onPress) return
    return (evt: GestureResponderEvent) => {
      haptics.tap()
      onPress(evt)
    }
  }, [onPress, haptics])

  const handleLongPress = useMemo(() => {
    if (!onLongPress) return
    return (evt: GestureResponderEvent) => {
      haptics.longPress()
      onLongPress(evt)
    }
  }, [onLongPress, haptics])

  return (
    <Button
      ref={ref}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={style}
      hoverStyle={t.atoms.bg_contrast_25}
      shape="round"
      variant="ghost"
      color="secondary"
      {...props}
      {...(overlay
        ? {
            style: [
              a.flex_col,
              a.align_center,
              a.justify_center,
              a.gap_xs,
              a.bg_transparent,
              {width: 48, minHeight: 48, padding: 6, borderRadius: 8},
              web({filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.65))'}),
              props.style,
            ],
            hoverStyle: props.hoverStyle ?? {backgroundColor: 'rgba(0,0,0,.2)'},
            shape: 'rectangular',
          }
        : {})}
      hitSlop={{
        ...DEFAULT_HITSLOP,
        ...(props.hitSlop || {}),
      }}>
      {typeof children === 'function' ? (
        args => (
          <PostControlContext.Provider value={ctx}>
            {children(args)}
          </PostControlContext.Provider>
        )
      ) : (
        <PostControlContext.Provider value={ctx}>
          {children}
        </PostControlContext.Provider>
      )}
    </Button>
  )
}

export function PostControlButtonIcon({
  icon: Comp,
  style,
  ...rest
}: SVGIconProps & {
  icon: React.ComponentType<SVGIconProps>
}) {
  const {big, color, overlay} = useContext(PostControlContext)

  return (
    <Comp
      style={[color, a.pointer_events_none, style]}
      {...rest}
      width={overlay ? 30 : big ? 22 : 18}
    />
  )
}

export function PostControlButtonText({style, ...props}: TextProps) {
  const {big, active, color, overlay} = useContext(PostControlContext)

  return (
    <Text
      style={[
        color,
        a.user_select_none,
        big ? a.text_md : a.text_sm,
        active && a.font_semi_bold,
        overlay && {
          color: '#fff',
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
        },
        // prevent layout shift on android
        {includeFontPadding: false, textAlignVertical: 'center'},
        style,
      ]}
      {...props}
    />
  )
}
