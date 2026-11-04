import {useState} from 'react'
import {Text} from 'react-native'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render, within} from '@testing-library/react-native'

import {createDrawing, TRANSPARENT} from './model'
import {useDrawing} from './useDrawing'
import {DrawingWorkspace} from './Workspace'

jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react') as typeof import('react')
  const RN = jest.requireActual<typeof import('react-native')>('react-native')
  /* Web scroll refs have scrollTo, but no native setNativeProps method. */
  const ScrollView = React.forwardRef<
    {scrollTo: () => void},
    React.ComponentProps<typeof RN.View> & {scrollEnabled?: boolean}
  >(function WebScrollViewMock(props, ref) {
    'use no memo'
    React.useImperativeHandle(ref, () => ({scrollTo: () => {}}))
    return <RN.View {...props} />
  })
  return {__esModule: true, default: ScrollView}
})

jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({
    atoms: {},
    palette: {
      primary_500: '#FF8A24',
      contrast_700: '#111111',
      contrast_500: '#777777',
      contrast_300: '#AAAAAA',
    },
  }),
}))
jest.mock('#/view/com/util/UserAvatar', () => ({UserAvatar: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
jest.mock('#/components/forms/TextField', () => {
  const {View, TextInput} = require('react-native')
  return {Root: View, Input: TextInput}
})
const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function Harness({active = true}: {active?: boolean}) {
  const [initial] = useState(createDrawing)
  const [recent, setRecent] = useState<string[]>([])
  const drawing = useDrawing(initial, () => {}, {
    onColorUsed: color =>
      setRecent(previous => [
        color,
        ...previous.filter(item => item !== color),
      ]),
  })
  return (
    <I18nProvider i18n={i18n}>
      <DrawingWorkspace
        drawing={drawing}
        recentColors={recent}
        active={active}
        disabled={false}
        onClear={drawing.clear}
      />
      <Text testID="state">
        {JSON.stringify({
          tool: drawing.tool,
          size: drawing.brushSize,
          color: drawing.color,
          painted: drawing.drawing.pixels.filter(pixel => pixel !== TRANSPARENT)
            .length,
          palette: drawing.drawing.palette,
        })}
      </Text>
    </I18nProvider>
  )
}
function state(screen: ReturnType<typeof render>) {
  return JSON.parse(screen.getByTestId('state').props.children) as {
    tool: string
    size: number
    color: string
    painted: number
    palette: string[]
  }
}
function draw(screen: ReturnType<typeof render>) {
  const canvas = screen.getByTestId('drawingDrawingSurface')
  fireEvent(canvas, 'responderGrant', {
    nativeEvent: {locationX: 100, locationY: 100},
  })
  fireEvent(canvas, 'responderMove', {
    nativeEvent: {locationX: 120, locationY: 100, touches: [{}]},
  })
  fireEvent(canvas, 'responderRelease', {
    nativeEvent: {locationX: 120, locationY: 100},
  })
}
function preset(screen: ReturnType<typeof render>, index: number) {
  fireEvent.press(screen.getByTestId('drawingColor'))
  fireEvent.press(screen.getByTestId('drawingColorTab-presets'))
  fireEvent.press(screen.getByTestId(`drawingPresetColor-${index}`))
}

it('groups drawing tools at the top and other controls at the bottom, keeping popovers', () => {
  const screen = render(<Harness />)
  const tools = within(screen.getByTestId('drawingToolsBar'))
  const actions = within(screen.getByTestId('drawingActionsBar'))
  for (const tool of ['brush', 'eraser', 'fill', 'eyedropper', 'pan']) {
    expect(tools.getByTestId(`drawingTool-${tool}`)).toBeTruthy()
    expect(actions.queryByTestId(`drawingTool-${tool}`)).toBeNull()
  }
  for (const control of [
    'drawingBrushSize',
    'drawingColor',
    'drawingUndo',
    'drawingRedo',
    'drawingClear',
  ]) {
    expect(actions.getByTestId(control)).toBeTruthy()
    expect(tools.queryByTestId(control)).toBeNull()
  }
  expect(screen.queryByTestId('drawingToolbar')).toBeNull()
  expect(screen.queryByTestId('drawingZoom')).toBeNull()
  expect(screen.queryByTestId('drawingTool-line')).toBeNull()
  expect(screen.queryByTestId('drawingFit')).toBeNull()
  expect(screen.queryByTestId('drawingGrid')).toBeNull()
  expect(screen.queryByTestId('drawingPresetColor-0')).toBeNull()
  fireEvent.press(screen.getByTestId('drawingBrushSize'))
  fireEvent.press(screen.getByTestId('drawingBrushSize-4'))
  expect(state(screen).size).toBe(4)
  expect(screen.queryByTestId('drawingBrushPopover')).toBeNull()
  draw(screen)
  expect(state(screen).painted).toBeGreaterThan(20)
  fireEvent.press(screen.getByTestId('drawingTool-eraser'))
  draw(screen)
  expect(state(screen).painted).toBe(0)
  fireEvent.press(screen.getByTestId('drawingTool-fill'))
  draw(screen)
  expect(state(screen).painted).toBe(4096)
  fireEvent.press(screen.getByTestId('drawingUndo'))
  expect(state(screen).painted).toBe(0)
  fireEvent.press(screen.getByTestId('drawingRedo'))
  expect(state(screen).painted).toBe(4096)
  fireEvent.press(screen.getByTestId('drawingClear'))
  expect(state(screen).painted).toBe(0)
})

it('closes options and disables gesture capture when the editor loses focus', () => {
  const screen = render(<Harness />)
  fireEvent.press(screen.getByTestId('drawingColor'))
  expect(screen.getByTestId('drawingColorPopover')).toBeTruthy()
  screen.rerender(<Harness active={false} />)
  expect(screen.queryByTestId('drawingColorPopover')).toBeNull()
  const props = screen.getByTestId('drawingDrawingSurface').props as {
    onStartShouldSetResponder: () => boolean
  }
  expect(props.onStartShouldSetResponder()).toBe(false)
})

it('offers presets, custom HSV/hex, and genuinely used recent colors in three tabs', () => {
  const screen = render(<Harness />)
  fireEvent.press(screen.getByTestId('drawingColor'))
  expect(screen.queryByTestId('drawingHexColor')).toBeNull()
  fireEvent.press(screen.getByTestId('drawingColorTab-recent'))
  expect(screen.getByText('Paint a color to add it here.')).toBeTruthy()
  fireEvent.press(screen.getByTestId('drawingColorTab-custom'))
  fireEvent.changeText(screen.getByTestId('drawingHexColor'), '#123ABC')
  expect(state(screen).color).toBe('#123ABC')
  expect(state(screen).palette).not.toContain('#123ABC')
  fireEvent.press(screen.getByTestId('drawingColorPickerClose'))
  draw(screen)
  expect(state(screen).palette).toContain('#123ABC')
  expect(state(screen).palette[0]).toBe('#17121F')
  fireEvent.press(screen.getByTestId('drawingColor'))
  fireEvent.press(screen.getByTestId('drawingColorTab-recent'))
  expect(
    screen.getByTestId('drawingRecentColor-0').props.accessibilityLabel,
  ).toContain('#123ABC')
})

it('supports custom color drags with web-style scroll refs and restores scrolling after release or cancellation', () => {
  const screen = render(<Harness />)
  preset(screen, 4)
  fireEvent.press(screen.getByTestId('drawingColor'))
  fireEvent.press(screen.getByTestId('drawingColorTab-custom'))
  const surfaces = screen.getAllByTestId('drawingDrawingSurface')
  const hue = surfaces[2]
  const sv = surfaces[1]
  const size = (hue.props.style as {width: number}).width
  const scrollingEnabled = () =>
    screen.getByTestId('drawingColorScroll').props.scrollEnabled
  expect(scrollingEnabled()).toBe(true)
  fireEvent(hue, 'responderGrant', {
    nativeEvent: {locationX: size / 2, locationY: 12},
  })
  expect(scrollingEnabled()).toBe(false)
  fireEvent(hue, 'responderRelease', {
    nativeEvent: {locationX: size / 2, locationY: 12},
  })
  expect(scrollingEnabled()).toBe(true)
  fireEvent(sv, 'responderGrant', {
    nativeEvent: {locationX: size / 2, locationY: size / 2},
  })
  expect(scrollingEnabled()).toBe(false)
  fireEvent(sv, 'responderRelease', {
    nativeEvent: {locationX: size / 2, locationY: size / 2},
  })
  expect(scrollingEnabled()).toBe(true)
  expect(state(screen).color).toBe('#408080')
  fireEvent(sv, 'responderGrant', {nativeEvent: {locationX: 0, locationY: 0}})
  expect(scrollingEnabled()).toBe(false)
  fireEvent(sv, 'responderTerminate')
  expect(scrollingEnabled()).toBe(true)
  fireEvent(sv, 'responderGrant', {nativeEvent: {locationX: 0, locationY: 0}})
  fireEvent.press(screen.getByTestId('drawingColorTab-presets'))
  expect(scrollingEnabled()).toBe(true)
  expect(screen.queryByTestId('drawingColorPicker')).toBeNull()
})

it('dismisses options without painting and samples a painted color without adding undo history', () => {
  const screen = render(<Harness />)
  preset(screen, 4)
  draw(screen)
  const painted = state(screen).painted
  preset(screen, 1)
  fireEvent.press(screen.getByTestId('drawingColor'))
  fireEvent.press(screen.getByTestId('drawingPopoverBackdrop'))
  expect(state(screen).painted).toBe(painted)
  fireEvent.press(screen.getByTestId('drawingTool-eyedropper'))
  draw(screen)
  expect(state(screen).color).toBe('#ED445E')
  expect(state(screen).painted).toBe(painted)
  expect(state(screen).tool).toBe('brush')
  fireEvent.press(screen.getByTestId('drawingUndo'))
  expect(state(screen).painted).toBe(0)
})
