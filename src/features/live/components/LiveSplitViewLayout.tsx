import {View} from 'react-native'
import {type ScreenLayoutArgs, useIsFocused} from '@react-navigation/native'
import {type NativeStackNavigationProp} from '@react-navigation/native-stack'

import {type FlatNavigatorParams} from '#/lib/routes/types'
import {type NativeStackNavigationOptionsWithAuth} from '#/view/shell/createNativeStackNavigatorWithAuth'
import {
  LEFT_NAV_MINIMAL_WIDTH,
  LEFT_NAV_STANDARD_WIDTH,
} from '#/view/shell/desktop/LeftNav'
import {SplitViewProvider} from '#/screens/Messages/components/splitView/context'
import {atoms as a, useLayoutBreakpoints, useTheme, web} from '#/alf'
import {
  CENTER_COLUMN_OFFSET,
  CENTER_COLUMN_WIDTH,
  SCROLLBAR_OFFSET,
} from '#/components/Layout'
import {LockScroll} from '#/components/LockScroll'
import {IS_WEB} from '#/env'
import {LiveThreadPanel} from './LiveThreadPanel'

type LiveScreens = 'LiveEvent'

type LayoutProps = ScreenLayoutArgs<
  FlatNavigatorParams,
  LiveScreens,
  NativeStackNavigationOptionsWithAuth,
  NativeStackNavigationProp<
    FlatNavigatorParams,
    LiveScreens,
    string | undefined
  >
>

/** The thread column beside the player on wide screens. */
const THREAD_COLUMN_WIDTH = 420
/** Narrower columns at the tablet breakpoint (1100 to 1300px). */
const THREAD_COLUMN_WIDTH_COMPACT = 360
const CENTER_COLUMN_WIDTH_COMPACT = 540

export function renderLiveSplitViewLayout(props: LayoutProps) {
  return <LiveSplitViewLayout {...props} />
}

/**
 * Wide-screen layout for an event, modelled on the messages split view: the
 * left nav collapses to icons, the screen (player, host, network view) takes
 * the centre column, and the live thread scrolls on its own to the right.
 */
function LiveSplitViewLayout({children, ...props}: LayoutProps) {
  const {rightNavVisible} = useLayoutBreakpoints()
  if (!IS_WEB || !rightNavVisible) {
    return children
  }
  return (
    <LiveSplitViewLayoutInner {...props}>{children}</LiveSplitViewLayoutInner>
  )
}

function LiveSplitViewLayoutInner({children, route}: LayoutProps) {
  const {centerColumnOffset, leftNavMinimal} = useLayoutBreakpoints()
  const t = useTheme()
  const isFocused = useIsFocused()

  const eventId =
    route.params && 'id' in route.params ? route.params.id : undefined

  /*
   * Geometry, derived from the shell rather than guessed. The left nav is
   * fixed with its right edge at
   *   50vw - CENTER_COLUMN_WIDTH / 2 + offset + navShift
   * where `offset` is the tablet shift and `navShift` is the difference
   * between the minimal and standard nav widths on wide screens (the nav is
   * already minimal by breakpoint below 1300px, so no shift applies there).
   * This container is centred at 50vw, so translating it by
   *   containerWidth / 2 - CENTER_COLUMN_WIDTH / 2 + offset + navShift
   * puts its left edge exactly on the nav's right edge.
   */
  const offset = centerColumnOffset ? CENTER_COLUMN_OFFSET : 0
  const navShift = leftNavMinimal
    ? 0
    : LEFT_NAV_MINIMAL_WIDTH - LEFT_NAV_STANDARD_WIDTH
  const threadColumnWidth = centerColumnOffset
    ? THREAD_COLUMN_WIDTH_COMPACT
    : THREAD_COLUMN_WIDTH
  const leftColumnWidth = centerColumnOffset
    ? CENTER_COLUMN_WIDTH_COMPACT
    : CENTER_COLUMN_WIDTH
  const containerWidth = leftColumnWidth + threadColumnWidth
  const translateX =
    containerWidth / 2 - CENTER_COLUMN_WIDTH / 2 + offset + navShift

  return (
    <View
      style={[
        a.flex_1,
        a.flex_row,
        a.mx_auto,
        {maxWidth: containerWidth},
        {
          transform: [{translateX}, {translateX: web(SCROLLBAR_OFFSET) ?? 0}],
        },
      ]}>
      {isFocused && <LockScroll />}
      {/*
       * The split view context's sides name roles, not positions: "left" is
       * the messages chat list (a sidebar with compact header styling) and
       * "right" is the screen. Here the screen sits on the left visually but
       * is still the screen, and the thread column is the sidebar.
       */}
      <SplitViewProvider side="right">
        <View
          style={[
            a.border_l,
            t.atoms.border_contrast_low,
            {width: leftColumnWidth},
          ]}>
          {children}
        </View>
      </SplitViewProvider>
      <SplitViewProvider side="left">
        <View
          style={[
            a.border_x,
            t.atoms.border_contrast_low,
            {width: threadColumnWidth},
          ]}>
          <LiveThreadPanel eventId={eventId} />
        </View>
      </SplitViewProvider>
    </View>
  )
}
